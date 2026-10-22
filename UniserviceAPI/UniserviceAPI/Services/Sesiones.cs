using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace UniserviceAPI.Services;

// Emisión y revocación de los JWT de sesión.
// Cada token lleva "iat"; un token emitido antes de usuarios.sesiones_validas_desde se rechaza
// (ver AccountStatus y el evento OnTokenValidated en Program.cs).
public static class Sesiones
{
    public static readonly TimeSpan Duracion = TimeSpan.FromDays(1);

    public static string Emitir(IConfiguration config, int id, int rol, DateTime emitido, DateTime expira)
    {
        var token = new JwtSecurityToken(
            claims:
            [
                new Claim("id", id.ToString()),
                new Claim("id_rol", rol.ToString()),
                new Claim(JwtRegisteredClaimNames.Iat, new DateTimeOffset(emitido).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
            ],
            expires: expira,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string Emitir(IConfiguration config, int id, int rol)
    {
        var ahora = DateTime.UtcNow;
        return Emitir(config, id, rol, ahora, ahora + Duracion);
    }

    // Invalida todos los tokens del usuario emitidos antes de "ahora". La hora la pone la API
    // (no now() de la BD) para que un token nuevo emitido con la misma hora siga siendo válido
    // aunque los relojes del servidor y de la BD difieran.
    public static async Task Revocar(NpgsqlConnection conn, NpgsqlTransaction? tx, int id, DateTime ahora, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "UPDATE usuarios SET sesiones_validas_desde = @ahora WHERE id_usuario = @id", conn, tx);
        cmd.Parameters.AddWithValue("ahora", ahora);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public static long EmitidoEn(ClaimsPrincipal user) =>
        long.TryParse(user.FindFirst(JwtRegisteredClaimNames.Iat)?.Value, out var iat) ? iat : 0;
}
