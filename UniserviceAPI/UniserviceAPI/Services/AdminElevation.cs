using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using NpgsqlTypes;

namespace UniserviceAPI.Services;

// Segunda contraseña del panel admin (tabla admin_credenciales, migración 010).
// Al validarla se emite un "token de elevación" corto que /api/admin/* exige en la
// cabecera X-Admin-Elevacion, además del JWT normal de la sesión.
public sealed class AdminElevation(IConfiguration config, IMemoryCache cache)
{
    public const string Header = "X-Admin-Elevacion";
    public static readonly TimeSpan Validity = TimeSpan.FromHours(1);
    public const int MaxIntentos = 5;
    public static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
    private const string Purpose = "admin_elevacion";

    // Clave derivada de Jwt:Key: un token de elevación no sirve como sesión ni una sesión como elevación.
    private SymmetricSecurityKey Key =>
        new(HMACSHA256.HashData(Encoding.UTF8.GetBytes(config["Jwt:Key"]!), "uniservice:admin-elevacion"u8));

    public (string token, DateTime expires) Emitir(int id, int version)
    {
        var expires = DateTime.UtcNow.Add(Validity);
        var token = new JwtSecurityToken(
            claims: [new Claim("purpose", Purpose), new Claim("adm", id.ToString()), new Claim("ver", version.ToString())],
            expires: expires,
            signingCredentials: new SigningCredentials(Key, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    // Válido si es de este admin y de la versión vigente de su contraseña de admin.
    public async Task<bool> Valida(string? token, int id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        ClaimsPrincipal principal;
        try
        {
            principal = new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = Key,
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);
        }
        catch (Exception e) when (e is SecurityTokenException or ArgumentException)
        {
            return false;
        }
        if (principal.FindFirst("purpose")?.Value != Purpose || principal.FindFirst("adm")?.Value != id.ToString())
            return false;
        var version = await Version(id, ct);
        return version != null && principal.FindFirst("ver")?.Value == version.Value.ToString();
    }

    private async Task<int?> Version(int id, CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey(id), out int? cached)) return cached;
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT version FROM admin_credenciales WHERE id_usuario = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        int? version = await cmd.ExecuteScalarAsync(ct) is int v ? v : null;
        cache.Set(CacheKey(id), version, Ttl);
        return version;
    }

    public void Invalidate(int id) => cache.Remove(CacheKey(id));
    private static string CacheKey(int id) => $"admin-elevacion:{id}";

    // Reglas de la contraseña de admin; null si es válida.
    public static string? ErrorClave(string? clave) => clave switch
    {
        null or { Length: < 10 } => "La contraseña de administrador debe tener al menos 10 caracteres",
        _ when Encoding.UTF8.GetByteCount(clave) > 72 => "La contraseña de administrador es demasiado larga",
        _ when !clave.Any(char.IsLetter) || !clave.Any(char.IsDigit) => "Combina letras y números en la contraseña de administrador",
        _ => null
    };

    // ¿Coincide con la contraseña de admin de la cuenta? Impide que la cuenta y el panel compartan contraseña.
    public static async Task<bool> CoincideConClaveAdmin(NpgsqlConnection conn, string password, int? idUsuario = null, string? correo = null)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT ac.clave_hash FROM admin_credenciales ac JOIN usuarios u ON u.id_usuario = ac.id_usuario
            WHERE u.id_usuario = @id OR lower(trim(u.correo)) = @correo
            """, conn);
        cmd.Parameters.Add(new NpgsqlParameter("id", NpgsqlDbType.Integer) { Value = (object?)idUsuario ?? DBNull.Value });
        cmd.Parameters.Add(new NpgsqlParameter("correo", NpgsqlDbType.Text) { Value = (object?)correo ?? DBNull.Value });
        return await cmd.ExecuteScalarAsync() is string hash && BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
