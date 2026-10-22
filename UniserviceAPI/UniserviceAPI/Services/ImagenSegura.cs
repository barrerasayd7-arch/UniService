using System.Buffers.Binary;

namespace UniserviceAPI.Services;

// Quita los metadatos de una imagen antes de publicarla. Las fotos del celular traen EXIF con la
// ubicación GPS, el modelo del teléfono y la fecha; en un avatar público eso expone al usuario.
// Sólo reescribe la estructura del contenedor (no decodifica píxeles). Devuelve null si el archivo
// no es una imagen bien formada del tipo indicado.
public static class ImagenSegura
{
    public static byte[]? SinMetadatos(byte[] datos, string contentType) => contentType switch
    {
        "image/jpeg" => Jpeg(datos),
        "image/png" => Png(datos),
        "image/webp" => WebP(datos),
        _ => null
    };

    private static byte[]? Jpeg(byte[] d)
    {
        if (d.Length < 4 || d[0] != 0xFF || d[1] != 0xD8) return null;
        using var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 2);
        var i = 2;
        while (i + 4 <= d.Length)
        {
            if (d[i] != 0xFF) return null;
            var marcador = d[i + 1];
            if (marcador == 0xFF) { i++; continue; } // relleno
            var largo = BinaryPrimitives.ReadUInt16BigEndian(d.AsSpan(i + 2));
            if (largo < 2 || i + 2 + largo > d.Length) return null;
            if (marcador == 0xDA) // inicio de los datos de imagen: el resto se copia tal cual
            {
                salida.Write(d, i, d.Length - i);
                return salida.ToArray();
            }
            // APP1 (EXIF/XMP), APP13 (IPTC) y comentarios fuera; JFIF, ICC y Adobe se conservan.
            var descartar = marcador is 0xE1 or 0xED or 0xFE || (marcador >= 0xE3 && marcador <= 0xEF && marcador != 0xEE);
            if (!descartar) salida.Write(d, i, 2 + largo);
            i += 2 + largo;
        }
        return null;
    }

    private static readonly HashSet<string> ChunksPngPrivados = ["eXIf", "tEXt", "zTXt", "iTXt", "tIME"];

    private static byte[]? Png(byte[] d)
    {
        if (d.Length < 8) return null;
        using var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 8);
        var i = 8;
        while (i + 12 <= d.Length)
        {
            var largo = BinaryPrimitives.ReadUInt32BigEndian(d.AsSpan(i));
            if (largo > int.MaxValue || i + 12 + (long)largo > d.Length) return null;
            var tipo = System.Text.Encoding.ASCII.GetString(d, i + 4, 4);
            var total = 12 + (int)largo;
            if (!ChunksPngPrivados.Contains(tipo)) salida.Write(d, i, total);
            i += total;
            if (tipo == "IEND") return salida.ToArray();
        }
        return null;
    }

    private static byte[]? WebP(byte[] d)
    {
        if (d.Length < 12) return null;
        using var salida = new MemoryStream(d.Length);
        salida.Write(d, 0, 12);
        var i = 12;
        while (i + 8 <= d.Length)
        {
            var tipo = System.Text.Encoding.ASCII.GetString(d, i, 4);
            var largo = BinaryPrimitives.ReadUInt32LittleEndian(d.AsSpan(i + 4));
            var total = 8 + (long)largo + (largo & 1);
            if (i + 8 + (long)largo > d.Length) return null;
            total = Math.Min(total, d.Length - i);
            if (tipo is not ("EXIF" or "XMP "))
            {
                var inicio = salida.Position;
                salida.Write(d, i, (int)total);
                if (tipo == "VP8X" && largo >= 1)
                {
                    // Bits de "tiene EXIF" (0x08) y "tiene XMP" (0x04) a cero, ya que se quitaron.
                    var buffer = salida.GetBuffer();
                    buffer[inicio + 8] &= unchecked((byte)~0x0C);
                }
            }
            i += (int)total;
        }
        if (i != d.Length) return null;
        var resultado = salida.ToArray();
        BinaryPrimitives.WriteUInt32LittleEndian(resultado.AsSpan(4), (uint)(resultado.Length - 8));
        return resultado;
    }
}
