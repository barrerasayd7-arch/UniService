using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;
using UniServiceAPI.Models;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AccountStatus _cuentas;
    private readonly IMemoryCache _cache;

    public AuthController(IConfiguration config, AccountStatus cuentas, IMemoryCache cache)
    {
        _config = config;
        _cuentas = cuentas;
        _cache = cache;
    }

    // Se verifica aunque el correo no exista, para que el tiempo de respuesta no revele qué cuentas existen.
    private static readonly Lazy<string> HashFicticio = new(() => BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()));
    private const int MaxFallosLogin = 8;
    private static readonly TimeSpan BloqueoLogin = TimeSpan.FromMinutes(15);
    private const string ErrorCredenciales = "Correo o contraseña incorrectos";

    // =========================
    // ENVIAR CÓDIGO
    // =========================
    [AllowAnonymous]
    [HttpPost("send-code")]
    public Task<IActionResult> EnviarCodigo([FromBody] EmailDTO data) => Task.FromResult<IActionResult>(StatusCode(403, new { error = "Usa /api/auth/institutional-email/send-code y verify-code" }));

    // =========================
    // VERIFICAR CÓDIGO
    // =========================
    [AllowAnonymous]
    [HttpPost("verify-code")]
    public IActionResult VerificarCodigo([FromBody] VerificarCodigoDTO data) => StatusCode(403, new { error = "Usa /api/auth/institutional-email/send-code y verify-code" });

    // =========================
    // RECUPERAR CONTRASEÑA con el mismo código OTP del registro:
    // send-code → verify-code → este endpoint con el token devuelto.
    // =========================
    [AllowAnonymous]
    [EnableRateLimiting("InstitutionalEmail")]
    [HttpPost("reset-password-verificado")]
    public async Task<IActionResult> ResetPasswordVerificado([FromBody] ResetPasswordVerificadoDTO dto)
    {
        var email = InstitutionalAccess.NormalizeEmail(dto.correo);
        if (email == null)
            return BadRequest(new { error = "Usa tu correo @unicesar.edu.co" });

        var codeKey = _config["InstitutionalEmail:CodeKey"];
        if (string.IsNullOrWhiteSpace(codeKey) || Encoding.UTF8.GetByteCount(codeKey) < 32)
            return StatusCode(503, new { error = "La recuperación de contraseña aún no está configurada" });

        var verificado = InstitutionalAccess.VerifiedEmail(dto.verificacion_token, codeKey);
        if (verificado == null)
            return BadRequest(new { error = "El código venció. Solicita uno nuevo" });
        if (!string.Equals(verificado, email, StringComparison.Ordinal))
            return BadRequest(new { error = "Verificación de correo inválida" });
        if (Entrada.ErrorPassword(dto.nueva_password) is { } errorPassword)
            return BadRequest(new { error = errorPassword });

        await using var conn = new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync();
        if (await AdminElevation.CoincideConClaveAdmin(conn, dto.nueva_password, correo: email))
            return BadRequest(new { error = "Usa una contraseña distinta a tu contraseña de administrador" });
        // Cambia la contraseña y cierra todas las sesiones abiertas (quien tuviera un token robado lo pierde).
        await using var cmd = new NpgsqlCommand("""
            UPDATE usuarios SET password_hash = @hash, sesiones_validas_desde = @ahora
            WHERE lower(trim(correo)) = @email RETURNING id_usuario
            """, conn);
        cmd.Parameters.AddWithValue("@hash", BCrypt.Net.BCrypt.HashPassword(dto.nueva_password));
        cmd.Parameters.AddWithValue("@ahora", DateTime.UtcNow);
        cmd.Parameters.AddWithValue("@email", email);
        if (await cmd.ExecuteScalarAsync() is not int id)
            return NotFound(new { error = "No hay una cuenta con este correo" });

        _cuentas.Invalidate(id);
        _cache.Remove(ClaveFallos(email));
        return Ok(new { ok = true });
    }

    // =========================
    // REGISTER: crea la cuenta a partir del JWT efímero
    // emitido por /api/auth/institutional-email/verify-code.
    // =========================
    [AllowAnonymous]
    [EnableRateLimiting("Login")]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDTO dto)
    {
        var email = InstitutionalAccess.NormalizeEmail(dto.correo);
        if (email == null)
            return BadRequest(new { error = "Usa tu correo @unicesar.edu.co" });

        var codeKey = _config["InstitutionalEmail:CodeKey"];
        var jwtKey = _config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(codeKey) || Encoding.UTF8.GetByteCount(codeKey) < 32 ||
            string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
            return StatusCode(503, new { error = "El registro aún no está configurado" });

        var verificado = InstitutionalAccess.VerifiedEmail(dto.verificacion_token, codeKey);
        if (verificado == null)
            return BadRequest(new { error = "Verificación de correo inválida o vencida. Solicita un código nuevo" });
        if (!string.Equals(verificado, email, StringComparison.Ordinal))
            return BadRequest(new { error = "Verificación de correo inválida" });

        // usuarios.nombre es varchar(50) y usuarios.telefono varchar(13).
        var nombreCompleto = Entrada.Nombre($"{dto.nombre} {dto.apellido}");
        if (nombreCompleto == null)
            return BadRequest(new { error = "Nombre y apellido: sólo letras, máximo 50 caracteres entre ambos" });
        var telefono = Entrada.Telefono(dto.telefono);
        if (telefono == null)
            return BadRequest(new { error = "Teléfono inválido: de 7 a 12 dígitos" });
        if (Entrada.ErrorPassword(dto.password) is { } errorPassword)
            return BadRequest(new { error = errorPassword });

        await using var conn = new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();

        await using (var exists = new NpgsqlCommand(
            "SELECT COUNT(*) FROM usuarios WHERE lower(trim(correo)) = @email", conn, tx))
        {
            exists.Parameters.AddWithValue("@email", email);
            if (Convert.ToInt32(await exists.ExecuteScalarAsync()) > 0)
                return Conflict(new { error = "Ya existe una cuenta con ese correo. Inicia sesión en su lugar" });
        }

        var hash = BCrypt.Net.BCrypt.HashPassword(dto.password);

        int id;
        try
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO usuarios(nombre, correo, password_hash, telefono, universidad, id_rol, estado, ultima_actividad)
                VALUES (@nombre, @correo, @hash, @telefono, @universidad, 2, true, clock_timestamp())
                RETURNING id_usuario
                """, conn, tx);
            insert.Parameters.AddWithValue("@nombre", nombreCompleto);
            insert.Parameters.AddWithValue("@correo", email);
            insert.Parameters.AddWithValue("@hash", hash);
            insert.Parameters.AddWithValue("@telefono", telefono);
            insert.Parameters.AddWithValue("@universidad", "Universidad Popular del Cesar");
            id = Convert.ToInt32(await insert.ExecuteScalarAsync());
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            // Dos registros simultáneos con el mismo correo: el segundo choca con usuarios_correo_key.
            return Conflict(new { error = "Ya existe una cuenta con ese correo. Inicia sesión en su lugar" });
        }

        var verifExpires = DateTime.UtcNow.Add(InstitutionalAccess.VerificationValidity);
        await using (var verif = new NpgsqlCommand("""
            INSERT INTO verificaciones_correo_institucional(id_usuario, correo, verificado_hasta)
            VALUES (@id, @correo, @expires)
            ON CONFLICT(id_usuario) DO UPDATE SET correo = EXCLUDED.correo,
              verificado_en = clock_timestamp(), verificado_hasta = EXCLUDED.verificado_hasta
            """, conn, tx))
        {
            verif.Parameters.AddWithValue("@id", id);
            verif.Parameters.AddWithValue("@correo", email);
            verif.Parameters.AddWithValue("@expires", verifExpires);
            await verif.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();

        return Ok(new
        {
            token = Sesiones.Emitir(_config, id, 2),
            user = new
            {
                id,
                nombre = nombreCompleto,
                correo = email,
                id_rol = 2,
                telefono,
                universidad = "Universidad Popular del Cesar"
            }
        });
    }

    // =========================
    // LOGIN
    // =========================
    // Mismo 401 y mismo mensaje si el correo no existe o la contraseña falla (no revela qué cuentas existen).
    // Límite por IP (política "Login") y bloqueo por cuenta tras MaxFallosLogin intentos fallidos.
    [AllowAnonymous]
    [EnableRateLimiting("Login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDTO dto, CancellationToken ct)
    {
        var correo = (dto.correo ?? "").Trim().ToLowerInvariant();
        if (correo.Length is 0 or > 100 || string.IsNullOrEmpty(dto.password) || dto.password.Length > 200)
            return Unauthorized(new { error = ErrorCredenciales });

        var clave = ClaveFallos(correo);
        if (_cache.TryGetValue(clave, out int fallos) && fallos >= MaxFallosLogin)
            return StatusCode(429, new { error = "Demasiados intentos fallidos. Espera 15 minutos o recupera tu contraseña" });

        await using var conn = new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);

        int id = 0, idRol = 2;
        string? nombre = null, correoUser = null, hash = null;
        var activa = false;
        await using (var cmd = new NpgsqlCommand("""
            SELECT id_usuario, COALESCE(id_rol, 2), nombre, correo, password_hash, estado IS TRUE
            FROM usuarios WHERE lower(trim(correo)) = @correo
            """, conn))
        {
            cmd.Parameters.AddWithValue("correo", correo);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                id = reader.GetInt32(0);
                idRol = reader.GetInt32(1);
                nombre = reader.IsDBNull(2) ? null : reader.GetString(2);
                correoUser = reader.IsDBNull(3) ? null : reader.GetString(3);
                hash = reader.IsDBNull(4) ? null : reader.GetString(4).Trim();
                activa = reader.GetBoolean(5);
            }
        }

        bool passwordOk;
        try { passwordOk = BCrypt.Net.BCrypt.Verify(dto.password, string.IsNullOrEmpty(hash) ? HashFicticio.Value : hash) && !string.IsNullOrEmpty(hash); }
        catch (BCrypt.Net.SaltParseException) { passwordOk = false; } // hash antiguo corrupto
        if (!passwordOk)
        {
            _cache.Set(clave, fallos + 1, BloqueoLogin);
            return Unauthorized(new { error = ErrorCredenciales });
        }
        _cache.Remove(clave);

        // Sólo se informa la suspensión a quien demostró conocer la contraseña.
        if (!activa)
            return StatusCode(403, new { error = "Tu cuenta ha sido suspendida. Contacta al administrador.", suspendida = true });

        await using (var update = new NpgsqlCommand("UPDATE usuarios SET ultima_actividad = NOW() WHERE id_usuario = @id", conn))
        {
            update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
        }

        return Ok(new
        {
            token = Sesiones.Emitir(_config, id, idRol),
            user = new { id, nombre, correo = correoUser, id_rol = idRol }
        });
    }

    private static string ClaveFallos(string correo) => $"login-fallos:{correo}";

    // =========================
    // LOGOUT: cierra todas las sesiones del usuario (los JWT emitidos hasta ahora dejan de valer).
    // =========================
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var id = InstitutionalAccess.UserId(User)!.Value;
        await using var conn = new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await Sesiones.Revocar(conn, null, id, DateTime.UtcNow, ct);
        await using (var cmd = new NpgsqlCommand("UPDATE usuarios SET ultima_actividad = NOW() WHERE id_usuario = @id", conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        _cuentas.Invalidate(id);
        return Ok(new { ok = true });
    }

    // =========================
    // GOOGLE LOGIN
    // =========================
    [AllowAnonymous]
    [HttpPost("google-login")]
    public Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDTO dto) => Task.FromResult<IActionResult>(StatusCode(403, new { error = "Verifica tu correo @unicesar.edu.co con un código" }));

    // =========================
    // CAMBIAR CONTRASEÑA (usuario autenticado)
    // Exige la actual, cierra las demás sesiones y devuelve un token nuevo para este dispositivo.
    // (La recuperación sin sesión es /reset-password-verificado, con código OTP al correo institucional.)
    // =========================
    [EnableRateLimiting("Password")]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDTO dto, CancellationToken ct)
    {
        var userId = InstitutionalAccess.UserId(User)!.Value;
        if (string.IsNullOrEmpty(dto.ContrasenaActual))
            return BadRequest(new { error = "Escribe tu contraseña actual" });
        if (Entrada.ErrorPassword(dto.ContrasenaNueva) is { } errorPassword)
            return BadRequest(new { error = errorPassword });
        if (dto.ContrasenaNueva == dto.ContrasenaActual)
            return BadRequest(new { error = "La nueva contraseña debe ser distinta de la actual" });

        await using var conn = new NpgsqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);

        int rol;
        string? hash;
        await using (var cmd = new NpgsqlCommand("SELECT password_hash, COALESCE(id_rol, 2) FROM usuarios WHERE id_usuario = @id", conn))
        {
            cmd.Parameters.AddWithValue("id", userId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return NotFound(new { error = "Usuario no encontrado" });
            hash = reader.IsDBNull(0) ? null : reader.GetString(0).Trim();
            rol = reader.GetInt32(1);
        }
        bool actualOk;
        try { actualOk = !string.IsNullOrEmpty(hash) && BCrypt.Net.BCrypt.Verify(dto.ContrasenaActual, hash); }
        catch (BCrypt.Net.SaltParseException) { actualOk = false; }
        if (!actualOk)
            return BadRequest(new { error = "La contraseña actual es incorrecta" });

        if (await AdminElevation.CoincideConClaveAdmin(conn, dto.ContrasenaNueva, idUsuario: userId))
            return BadRequest(new { error = "Usa una contraseña distinta a tu contraseña de administrador" });

        var ahora = DateTime.UtcNow;
        await using (var update = new NpgsqlCommand("""
            UPDATE usuarios SET password_hash = @hash, sesiones_validas_desde = @ahora WHERE id_usuario = @id
            """, conn))
        {
            update.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(dto.ContrasenaNueva));
            update.Parameters.AddWithValue("ahora", ahora);
            update.Parameters.AddWithValue("id", userId);
            await update.ExecuteNonQueryAsync(ct);
        }
        _cuentas.Invalidate(userId);
        return Ok(new { ok = true, token = Sesiones.Emitir(_config, userId, rol, ahora, ahora + Sesiones.Duracion) });
    }

    // =========================
    // CAMBIAR CORREO (usuario autenticado)
    // =========================
    [HttpPost("change-email")]
    public Task<IActionResult> ChangeEmail([FromBody] ChangeEmailDTO dto) => Task.FromResult<IActionResult>(StatusCode(403, new { error = "El cambio de correo verificado requiere un proceso supervisado" }));

    // =========================
    // VERIFICAR CONTRASEÑA MAESTRA DE ADMIN
    // =========================
    private static readonly Dictionary<int, (int intentos, DateTime bloqueadoHasta)> _adminAttempts = new();

    [HttpPost("verify-admin-master")]
    public IActionResult VerifyAdminMaster([FromBody] VerifyAdminMasterDTO dto)
    {
        try
        {
            var userIdClaim = User.FindFirst("id")?.Value;
            var rolClaim = User.FindFirst("id_rol")?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
                return Unauthorized(new { error = "Token inválido o expirado" });

            if (rolClaim != "1")
                return StatusCode(403, new { error = "No tienes permisos de administrador" });

            int userId = int.Parse(userIdClaim);

            var entry = (intentos: 0, bloqueadoHasta: default(DateTime));

            if (_adminAttempts.TryGetValue(userId, out var storedEntry))
            {
                if (storedEntry.bloqueadoHasta > DateTime.UtcNow)
                {
                    var minutosRestantes = (int)Math.Ceiling((storedEntry.bloqueadoHasta - DateTime.UtcNow).TotalMinutes);
                    return StatusCode(429, new { error = $"Demasiados intentos. Intenta de nuevo en {minutosRestantes} minuto(s).", bloqueado = true });
                }

                if (storedEntry.bloqueadoHasta != default)
                    _adminAttempts.Remove(userId);
            }

            // Sin hash configurado no hay contraseña maestra válida (antes había una por defecto en el código).
            var storedHash = _config["Admin:MasterPasswordHash"];
            if (string.IsNullOrWhiteSpace(storedHash))
                return StatusCode(503, new { error = "La contraseña maestra de administrador no está configurada" });

            if (!BCrypt.Net.BCrypt.Verify(dto.MasterPassword, storedHash))
            {
                var nuevosIntentos = entry.intentos + 1;
                if (nuevosIntentos >= 3)
                {
                    var bloqueoHasta = DateTime.UtcNow.AddMinutes(10);
                    _adminAttempts[userId] = (nuevosIntentos, bloqueoHasta);
                    return BadRequest(new { error = "Demasiados intentos fallidos. Cuenta bloqueada por 10 minutos.", bloqueado = true });
                }

                _adminAttempts[userId] = (nuevosIntentos, default);
                return BadRequest(new { error = $"Contraseña maestra incorrecta. Intento {nuevosIntentos} de 3.", intentos = nuevosIntentos });
            }

            _adminAttempts.Remove(userId);
            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}