using System.Text;
using System.Text.RegularExpressions;

namespace UniserviceAPI.Services;

// Validación y limpieza de texto e imágenes que envían los usuarios (perfil, chat, reportes).
public static partial class Entrada
{
    // Recorta, normaliza Unicode y rechaza caracteres de control (salvo saltos de línea si se permiten).
    // Devuelve null si el texto no es válido o supera el máximo.
    public static string? Texto(string? valor, int max, bool multilinea = false)
    {
        if (valor == null) return null;
        var t = valor.Replace("\r\n", "\n").Trim().Normalize(NormalizationForm.FormC);
        foreach (var c in t)
        {
            if (c == '\n' && multilinea) continue;
            if (char.IsControl(c) || c is '​' or '‎' or '‏' or '‪' or '‫' or '‬' or '‭' or '‮' or '⁦' or '⁧' or '⁨' or '⁩')
                return null;
        }
        return t.Length <= max ? t : null;
    }

    // Nombre visible: letras (con tildes), espacios, apóstrofo, punto y guion. 2 a 50 caracteres.
    public static string? Nombre(string? valor)
    {
        var t = Texto(valor, 50);
        if (t == null) return null;
        t = Espacios().Replace(t, " ");
        return t.Length >= 2 && NombreValido().IsMatch(t) ? t : null;
    }

    // Teléfono: se quitan espacios, guiones, puntos y paréntesis; quedan 7 a 12 dígitos con + opcional
    // (cabe en usuarios.telefono varchar(13)).
    public static string? Telefono(string? valor)
    {
        if (valor == null) return null;
        var t = Separadores().Replace(valor.Trim(), "");
        return TelefonoValido().IsMatch(t) ? t : null;
    }

    // Enlace público: sólo https, sin usuario:contraseña embebidos, con dominio.
    public static string? UrlHttps(string? valor, int max)
    {
        var t = Texto(valor, max);
        if (string.IsNullOrEmpty(t) || t.Any(char.IsWhiteSpace)) return null;
        return Uri.TryCreate(t, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps &&
               string.IsNullOrEmpty(uri.UserInfo) && uri.Host.Contains('.') ? uri.AbsoluteUri : null;
    }

    // Contraseña nueva: 8 a 72 bytes (BCrypt ignora lo que pase de 72), con al menos una letra y un número.
    public static string? ErrorPassword(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8) return "La contraseña debe tener al menos 8 caracteres";
        if (Encoding.UTF8.GetByteCount(password) > 72) return "La contraseña es demasiado larga (máximo 72 caracteres)";
        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit)) return "La contraseña debe combinar letras y números";
        return null;
    }

    [GeneratedRegex(@"\s+")] private static partial Regex Espacios();
    [GeneratedRegex(@"^\p{L}[\p{L}\p{M}' .-]*$")] private static partial Regex NombreValido();
    [GeneratedRegex(@"[\s\-.()]")] private static partial Regex Separadores();
    [GeneratedRegex(@"^\+?[0-9]{7,12}$")] private static partial Regex TelefonoValido();
}
