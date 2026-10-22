using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using UniserviceAPI.Services;

namespace UniserviceAPI.Controllers;

public sealed record InstitutionalEmailRequest([Required, StringLength(100)] string correo);
public sealed record InstitutionalCodeRequest(
    [Required, StringLength(100)] string correo,
    [Required, RegularExpression("^[0-9]{6}$")] string codigo);

[ApiController, Route("api/auth/institutional-email"), AllowAnonymous]
[EnableRateLimiting("InstitutionalEmail")]
public sealed class InstitutionalEmailController(IConfiguration config, IHttpClientFactory clients) : ControllerBase
{
    private bool Configured => Encoding.UTF8.GetByteCount(config["InstitutionalEmail:CodeKey"] ?? "") >= 32
        && Encoding.UTF8.GetByteCount(config["Jwt:Key"] ?? "") >= 32
        && config["Jwt:Key"] != "uniservice_super_secret_key_2026_segura_12345"
        && !string.IsNullOrWhiteSpace(config["Brevo:ApiKey"])
        && !string.IsNullOrWhiteSpace(config["Brevo:FromEmail"]);

    private byte[] Hash(string email, Guid challenge, string code) =>
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(config["InstitutionalEmail:CodeKey"]!),
            Encoding.UTF8.GetBytes($"{email}:{challenge:D}:{code}"));

    private static async Task Lock(NpgsqlConnection conn, NpgsqlTransaction tx, string email, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@email, 0))", conn, tx);
        cmd.Parameters.AddWithValue("email", email);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    [HttpPost("send-code")]
    public async Task<IActionResult> Send(InstitutionalEmailRequest request, CancellationToken ct)
    {
        var email = InstitutionalAccess.NormalizeEmail(request.correo);
        if (email == null) return BadRequest(new { error = "Usa tu correo @unicesar.edu.co" });
        if (!Configured) return StatusCode(503, new { error = "El acceso por correo aún no está configurado" });
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await Lock(conn, tx, email, ct);
        var code = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6", CultureInfo.InvariantCulture);
        var challenge = Guid.NewGuid();
        await using (var save = new NpgsqlCommand("""
            INSERT INTO uniservice_mobile.codigos_correo(correo, desafio, hash, expira_en)
            VALUES (@email, @challenge, @hash, clock_timestamp() + interval '10 minutes')
            ON CONFLICT (correo) DO UPDATE SET desafio = EXCLUDED.desafio, hash = EXCLUDED.hash,
              expira_en = EXCLUDED.expira_en, ultimo_envio = clock_timestamp(), consumido = false,
              ventana = CASE WHEN codigos_correo.ventana <= clock_timestamp() - interval '1 hour' THEN clock_timestamp() ELSE codigos_correo.ventana END,
              envios = CASE WHEN codigos_correo.ventana <= clock_timestamp() - interval '1 hour' THEN 1 ELSE codigos_correo.envios + 1 END,
              fallos = CASE WHEN codigos_correo.ventana <= clock_timestamp() - interval '1 hour' THEN 0 ELSE codigos_correo.fallos END
            WHERE codigos_correo.ultimo_envio <= clock_timestamp() - interval '60 seconds'
              AND (codigos_correo.ventana <= clock_timestamp() - interval '1 hour' OR (codigos_correo.envios < 5 AND codigos_correo.fallos < 5))
            RETURNING correo
            """, conn, tx))
        {
            save.Parameters.AddWithValue("email", email);
            save.Parameters.AddWithValue("challenge", challenge);
            save.Parameters.AddWithValue("hash", Hash(email, challenge, code));
            if (await save.ExecuteScalarAsync(ct) == null)
                return StatusCode(429, new { error = "Espera antes de solicitar otro código. Máximo 5 envíos o intentos fallidos por hora" });
        }
        // La transacción mantiene el código inaccesible hasta que el proveedor acepta el envío.
        using var message = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        message.Headers.Add("api-key", config["Brevo:ApiKey"]);
        message.Content = JsonContent.Create(new
        {
            sender = new { email = config["Brevo:FromEmail"], name = config["Brevo:FromName"] ?? "UniService" },
            to = new[] { new { email } },
            subject = "Tu código de acceso a UniService",
            htmlContent = $"<p>Tu código de acceso es <strong>{code}</strong>.</p><p>Caduca en 10 minutos y solo puedes usarlo una vez. No lo compartas.</p><p>Si no lo solicitaste, ignora este correo.</p>"
        });
        try
        {
            using var response = await clients.CreateClient("InstitutionalEmail").SendAsync(message, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                Console.WriteLine($"[BREVO] FALLO status={(int)response.StatusCode} body={errorBody}");
                return StatusCode(503, new { error = "No pudimos enviar el código. Inténtalo más tarde" });
            }
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"[BREVO] HttpRequestException: {ex.Message}");
            return StatusCode(503, new { error = "Servicio de correo no disponible" });
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { return StatusCode(503, new { error = "Servicio de correo no disponible" }); }
        await tx.CommitAsync(ct);
        return Ok(new { mensaje = "Código enviado. Revisa tu bandeja y correo no deseado", expires_in = 600, resend_after = 60 });
    }

    // Solo valida el código y emite un JWT efímero de verificación (15 min).
    // No crea cuentas: eso lo hace POST /api/auth/register con el token devuelto.
    // El token se firma con InstitutionalEmail:CodeKey (no con Jwt:Key) para que
    // el middleware de sesión no lo acepte como auth.
    [HttpPost("verify-code")]
    public async Task<IActionResult> Verify(InstitutionalCodeRequest request, CancellationToken ct)
    {
        var email = InstitutionalAccess.NormalizeEmail(request.correo);
        if (email == null) return BadRequest(new { error = "Usa tu correo @unicesar.edu.co" });
        if (!Configured) return StatusCode(503, new { error = "El acceso por correo aún no está configurado" });
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await Lock(conn, tx, email, ct);
        byte[] stored; Guid challenge;
        await using (var find = new NpgsqlCommand("""
            SELECT desafio, hash FROM uniservice_mobile.codigos_correo
            WHERE correo = @email AND expira_en > clock_timestamp() AND fallos < 5 AND NOT consumido FOR UPDATE
            """, conn, tx))
        {
            find.Parameters.AddWithValue("email", email);
            await using var reader = await find.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return BadRequest(new { error = "Código inválido, vencido o agotado" });
            challenge = reader.GetGuid(0); stored = reader.GetFieldValue<byte[]>(1);
        }
        if (!CryptographicOperations.FixedTimeEquals(stored, Hash(email, challenge, request.codigo)))
        {
            await using var failed = new NpgsqlCommand("UPDATE uniservice_mobile.codigos_correo SET fallos = fallos + 1 WHERE correo = @email", conn, tx);
            failed.Parameters.AddWithValue("email", email);
            await failed.ExecuteNonQueryAsync(ct);
            await tx.CommitAsync(ct);
            return BadRequest(new { error = "Código inválido, vencido o agotado" });
        }
        await using (var consume = new NpgsqlCommand("UPDATE uniservice_mobile.codigos_correo SET consumido = true WHERE correo = @email", conn, tx))
        {
            consume.Parameters.AddWithValue("email", email); await consume.ExecuteNonQueryAsync(ct);
        }
        // Si la cuenta ya existe, el código confirma de nuevo el buzón: renueva su verificación.
        bool cuentaExistente;
        await using (var renew = new NpgsqlCommand("""
            INSERT INTO verificaciones_correo_institucional(id_usuario, correo, verificado_hasta)
            SELECT id_usuario, @email, clock_timestamp() + @validez FROM usuarios WHERE lower(trim(correo)) = @email
            ON CONFLICT(id_usuario) DO UPDATE SET correo = EXCLUDED.correo,
              verificado_en = clock_timestamp(), verificado_hasta = EXCLUDED.verificado_hasta
            RETURNING id_usuario
            """, conn, tx))
        {
            renew.Parameters.AddWithValue("email", email);
            renew.Parameters.AddWithValue("validez", InstitutionalAccess.VerificationValidity);
            cuentaExistente = await renew.ExecuteScalarAsync(ct) != null;
        }
        await tx.CommitAsync(ct);

        var expires = DateTime.UtcNow.AddMinutes(15);
        var token = new JwtSecurityToken(
            claims: [
                new Claim("purpose", "institutional_email_verify"),
                new Claim("email", email)
            ],
            expires: expires,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["InstitutionalEmail:CodeKey"]!)),
                SecurityAlgorithms.HmacSha256));
        return Ok(new
        {
            verificacion_token = new JwtSecurityTokenHandler().WriteToken(token),
            expires_at = expires,
            expires_in = 900,
            cuenta_existente = cuentaExistente
        });
    }
}
