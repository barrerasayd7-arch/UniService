using System.Net;
using System.Security.Claims;
using Npgsql;

namespace UniserviceAPI.Services;

// Utilidades compartidas por servicios, solicitudes y calificaciones.
public static class ServiciosComun
{
    public static async Task<NpgsqlConnection> Open(IConfiguration config, CancellationToken ct)
    {
        var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        try { await conn.OpenAsync(ct); return conn; }
        catch { await conn.DisposeAsync(); throw; }
    }

    // Lee una columna por nombre; para columnas que admiten NULL usar un tipo anulable (int?, string?).
    public static T? Get<T>(this NpgsqlDataReader r, string columna)
    {
        var i = r.GetOrdinal(columna);
        return r.IsDBNull(i) ? default : r.GetFieldValue<T>(i);
    }

    // Las fechas se guardan en UTC (timestamp sin zona); se marcan como UTC para que el JSON lleve "Z".
    public static DateTime? Utc(this NpgsqlDataReader r, string columna) =>
        r.Get<DateTime?>(columna) is { } f ? DateTime.SpecifyKind(f, DateTimeKind.Utc) : null;

    public static bool EsAdmin(ClaimsPrincipal user) => user.FindFirst("id_rol")?.Value == "1";

    public static readonly string[] Modalidades = ["presencial", "virtual", "mixta"];
    public static readonly string[] Disponibilidades = ["entre_semana", "fines_de_semana", "siempre"];
    public static string Modalidad(int valor) => Modalidades[Math.Clamp(valor, 0, 2)];
    public static string Disponibilidad(int valor) => Disponibilidades[Math.Clamp(valor, 0, 2)];

    // Las rutas relativas de la web antigua (img/default_*.png) no existen para la app.
    public static string? UrlPublica(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
            ? url : null;

    // Texto escrito por usuarios que va dentro de un correo HTML.
    public static string Html(string? texto) => WebUtility.HtmlEncode(texto ?? "");

    // Tipo real de la imagen por sus primeros bytes (el Content-Type lo decide el cliente).
    public static (string ContentType, string Extension)? TipoImagen(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return ("image/jpeg", "jpg");
        if (b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ("image/png", "png");
        if (b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8) && b[8..12].SequenceEqual("WEBP"u8)) return ("image/webp", "webp");
        return null;
    }
}
