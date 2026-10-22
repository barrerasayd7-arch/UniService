using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using UniserviceAPI.Services;

namespace UniserviceAPI.Controllers;

[ApiController]
[Route("api/auth")]
public class InstitutionalAuthController(IConfiguration config) : ControllerBase
{
    [Authorize(AuthenticationSchemes = "MicrosoftInstitutional")]
    [HttpPost("microsoft-login")]
    public async Task<IActionResult> Login(CancellationToken ct)
    {
        // El middleware valida firma, emisor, audiencia, tenant, cliente, scope y rol.
        var tenant = Guid.Parse(User.FindFirst("tid")!.Value);
        var oid = Guid.Parse(User.FindFirst("oid")!.Value);
        var correo = InstitutionalAccess.NormalizeEmail(User.FindFirst("email")?.Value)
            ?? InstitutionalAccess.NormalizeEmail(User.FindFirst("preferred_username")?.Value);
        if (correo == null) return StatusCode(403, new { error = "Se requiere correo @unicesar.edu.co" });
        var exp = DateTimeOffset.FromUnixTimeSeconds(long.Parse(User.FindFirst("exp")!.Value)).UtcDateTime;
        var expires = exp < DateTime.UtcNow.AddHours(1) ? exp : DateTime.UtcNow.AddHours(1);
        var nombre = User.FindFirst("name")?.Value ?? correo.Split('@')[0];
        nombre = nombre.Length > 50 ? nombre[..50] : nombre;
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        // Evita dos altas concurrentes para la misma identidad.
        await using (var mutex = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@identity, 0))", conn, tx))
        {
            mutex.Parameters.AddWithValue("identity", $"{tenant}:{oid}");
            await mutex.ExecuteNonQueryAsync(ct);
        }
        int id = 0, rol = 2;
        await using (var find = new NpgsqlCommand("""
            SELECT u.id_usuario, u.id_rol, u.nombre, u.estado, u.correo
            FROM identidades_institucionales i JOIN usuarios u USING(id_usuario)
            WHERE i.tenant_id = @tenant AND i.object_id = @oid FOR UPDATE OF u
            """, conn, tx))
        {
            find.Parameters.AddWithValue("tenant", tenant);
            find.Parameters.AddWithValue("oid", oid);
            await using var reader = await find.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader["estado"] is not true) return StatusCode(403, new { error = "Cuenta suspendida" });
                id = reader.GetInt32(0); rol = Convert.ToInt32(reader["id_rol"]);
                nombre = reader["nombre"].ToString()!;
                correo = reader["correo"].ToString()!;
            }
        }
        if (id == 0)
        {
            // No vincular cuentas preexistentes sólo por correo; requieren una migración supervisada.
            await using var insert = new NpgsqlCommand("""
                INSERT INTO usuarios(correo, nombre, id_rol, estado)
                SELECT @correo, @nombre, 2, true
                WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE lower(trim(correo)) = @correo)
                ON CONFLICT DO NOTHING RETURNING id_usuario
                """, conn, tx);
            insert.Parameters.AddWithValue("correo", correo);
            insert.Parameters.AddWithValue("nombre", nombre);
            var result = await insert.ExecuteScalarAsync(ct);
            if (result == null) return Conflict(new { error = "Cuenta existente: solicita al administrador vincular tu identidad Microsoft" });
            id = Convert.ToInt32(result);
        }
        await using (var upsert = new NpgsqlCommand("""
            INSERT INTO identidades_institucionales(id_usuario, tenant_id, object_id, verificado_hasta)
            VALUES (@id, @tenant, @oid, @expires)
            ON CONFLICT (id_usuario) DO UPDATE SET verificado_hasta = EXCLUDED.verificado_hasta, verificado_en = now();
            UPDATE usuarios SET ultima_actividad = now() WHERE id_usuario = @id
            """, conn, tx))
        {
            upsert.Parameters.AddWithValue("id", id); upsert.Parameters.AddWithValue("tenant", tenant);
            upsert.Parameters.AddWithValue("oid", oid); upsert.Parameters.AddWithValue("expires", expires);
            await upsert.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Ok(new { token = Sesiones.Emitir(config, id, rol, DateTime.UtcNow, expires), expires_at = expires,
            user = new { id, nombre, correo, id_rol = rol, estudiante_activo = true } });
    }
}
