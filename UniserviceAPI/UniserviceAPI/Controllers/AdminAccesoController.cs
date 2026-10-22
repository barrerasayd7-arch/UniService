using Microsoft.AspNetCore.Mvc;
using Npgsql;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;

namespace UniserviceAPI.Controllers;

// Acceso al panel con la contraseña de administrador (distinta a la de la cuenta).
// Flujo: login normal → GET estado → POST verificar (o POST clave la primera vez / si la olvidó)
// → el token devuelto va en la cabecera X-Admin-Elevacion de cada llamada a /api/admin/*.
[ApiController, Route("api/admin/acceso"), AdminOnly(elevacion: false)]
public sealed class AdminAccesoController(IConfiguration config, AdminElevation elevation) : ControllerBase
{
    private int AdminId => InstitutionalAccess.UserId(User)!.Value;

    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        return conn;
    }

    private async Task Audit(NpgsqlConnection conn, NpgsqlTransaction? tx, string accion, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO auditoria_admin(id_admin, accion, entidad, id_entidad) VALUES (@admin, @accion, 'admin', @admin)
            """, conn, tx);
        cmd.Parameters.AddWithValue("admin", AdminId);
        cmd.Parameters.AddWithValue("accion", accion);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private ObjectResult Bloqueado(DateTime hasta)
    {
        var minutos = Math.Max(1, (int)Math.Ceiling((hasta - DateTime.UtcNow).TotalMinutes));
        return StatusCode(429, new
        {
            error = $"Demasiados intentos. Vuelve a intentarlo en {minutos} {(minutos == 1 ? "minuto" : "minutos")}.",
            bloqueado_hasta = hasta
        });
    }

    [HttpGet("estado")]
    public async Task<IActionResult> Estado(CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT u.correo, ac.id_usuario IS NOT NULL, CASE WHEN ac.bloqueado_hasta > now() THEN ac.bloqueado_hasta END
            FROM usuarios u LEFT JOIN admin_credenciales ac ON ac.id_usuario = u.id_usuario
            WHERE u.id_usuario = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", AdminId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        await r.ReadAsync(ct);
        return Ok(new
        {
            correo = r.IsDBNull(0) ? null : r.GetString(0).Trim().ToLowerInvariant(),
            configurada = r.GetBoolean(1),
            bloqueado_hasta = r.IsDBNull(2) ? (DateTime?)null : r.GetDateTime(2)
        });
    }

    [HttpPost("verificar")]
    public async Task<IActionResult> Verificar(AdminClaveRequest dto, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        string hash;
        int intentos, version;
        DateTime? bloqueado;
        // FOR UPDATE: dos intentos simultáneos no pueden saltarse el contador.
        await using (var cmd = new NpgsqlCommand("""
            SELECT clave_hash, intentos_fallidos, version, CASE WHEN bloqueado_hasta > now() THEN bloqueado_hasta END
            FROM admin_credenciales WHERE id_usuario = @id FOR UPDATE
            """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", AdminId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                return Conflict(new { error = "Primero crea tu contraseña de administrador", configurada = false });
            hash = r.GetString(0);
            intentos = r.GetInt16(1);
            version = r.GetInt32(2);
            bloqueado = r.IsDBNull(3) ? null : r.GetDateTime(3);
        }
        if (bloqueado != null) return Bloqueado(bloqueado.Value);

        if (!BCrypt.Net.BCrypt.Verify(dto.clave, hash))
        {
            intentos++;
            var bloquear = intentos >= AdminElevation.MaxIntentos;
            var hasta = DateTime.UtcNow.Add(AdminElevation.Bloqueo);
            await using (var cmd = new NpgsqlCommand("""
                UPDATE admin_credenciales SET intentos_fallidos = @intentos, bloqueado_hasta = @hasta WHERE id_usuario = @id
                """, conn, tx))
            {
                cmd.Parameters.AddWithValue("intentos", (short)(bloquear ? 0 : intentos));
                cmd.Parameters.AddWithValue("hasta", bloquear ? hasta : (object)DBNull.Value);
                cmd.Parameters.AddWithValue("id", AdminId);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            await Audit(conn, tx, bloquear ? "acceso_bloqueado" : "acceso_fallido", ct);
            await tx.CommitAsync(ct);
            if (bloquear) return Bloqueado(hasta);

            var quedan = AdminElevation.MaxIntentos - intentos;
            return BadRequest(new
            {
                error = $"Contraseña de administrador incorrecta. {(quedan == 1 ? "Te queda 1 intento." : $"Te quedan {quedan} intentos.")}",
                intentos_restantes = quedan
            });
        }

        await using (var cmd = new NpgsqlCommand(
            "UPDATE admin_credenciales SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = @id", conn, tx))
        {
            cmd.Parameters.AddWithValue("id", AdminId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await Audit(conn, tx, "acceso_panel", ct);
        await tx.CommitAsync(ct);

        var (token, expires) = elevation.Emitir(AdminId, version);
        return Ok(new { token, expires_at = expires });
    }

    // Crea o restablece la contraseña de admin. Exige el código OTP enviado al correo de la cuenta
    // (send-code → verify-code): con sólo la contraseña de la cuenta no se puede fijar ni cambiar.
    [HttpPost("clave")]
    public async Task<IActionResult> Clave(AdminNuevaClaveRequest dto, CancellationToken ct)
    {
        var codeKey = config["InstitutionalEmail:CodeKey"];
        if (string.IsNullOrWhiteSpace(codeKey) || System.Text.Encoding.UTF8.GetByteCount(codeKey) < 32)
            return StatusCode(503, new { error = "La verificación por correo aún no está configurada" });
        if (AdminElevation.ErrorClave(dto.clave) is { } errorClave)
            return BadRequest(new { error = errorClave });

        await using var conn = await Open(ct);
        string? correo, passwordHash;
        await using (var cmd = new NpgsqlCommand("SELECT correo, password_hash FROM usuarios WHERE id_usuario = @id", conn))
        {
            cmd.Parameters.AddWithValue("id", AdminId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            correo = r.IsDBNull(0) ? null : InstitutionalAccess.NormalizeEmail(r.GetString(0));
            passwordHash = r.IsDBNull(1) ? null : r.GetString(1).Trim();
        }

        var verificado = InstitutionalAccess.VerifiedEmail(dto.verificacion_token, codeKey);
        if (verificado == null || correo == null || !string.Equals(verificado, correo, StringComparison.Ordinal))
            return BadRequest(new { error = "El código venció o no corresponde a tu correo. Solicita uno nuevo" });
        if (!string.IsNullOrEmpty(passwordHash) && BCrypt.Net.BCrypt.Verify(dto.clave, passwordHash))
            return BadRequest(new { error = "Usa una contraseña distinta a la de tu cuenta" });

        await using var tx = await conn.BeginTransactionAsync(ct);
        int version;
        await using (var cmd = new NpgsqlCommand("""
            INSERT INTO admin_credenciales(id_usuario, clave_hash) VALUES (@id, @hash)
            ON CONFLICT (id_usuario) DO UPDATE SET clave_hash = EXCLUDED.clave_hash, intentos_fallidos = 0,
              bloqueado_hasta = NULL, version = admin_credenciales.version + 1, actualizada_en = now()
            RETURNING version
            """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", AdminId);
            cmd.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(dto.clave));
            version = (int)(await cmd.ExecuteScalarAsync(ct))!;
        }
        await Audit(conn, tx, version == 1 ? "clave_admin_creada" : "clave_admin_restablecida", ct);
        await tx.CommitAsync(ct);
        elevation.Invalidate(AdminId);

        // Acaba de probar la sesión, el correo y la contraseña nueva: entra directo al panel.
        var (token, expires) = elevation.Emitir(AdminId, version);
        return Ok(new { token, expires_at = expires });
    }
}
