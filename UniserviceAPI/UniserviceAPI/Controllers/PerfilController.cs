using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Perfil de usuario y seguidores. El usuario siempre sale del JWT:
//  - /me: el perfil completo propio (correo, teléfono, verificación).
//  - /{id}: el perfil público de otro, sin datos de contacto, y sólo de cuentas activas.
[ApiController, Route("api/perfil")]
public sealed class PerfilController(IConfiguration config, SupabaseStorageService storage) : ControllerBase
{
    private const int MaxBytesAvatar = 2 * 1024 * 1024;
    private int Yo => InstitutionalAccess.UserId(User)!.Value;

    private const string ConsultaPerfil = """
        SELECT u.id_usuario, u.nombre, u.descripcion, u.avatar, u.universidad, u.fecha_registro,
               u.correo, u.telefono, COALESCE(u.id_rol, 2) AS id_rol, u.estado IS TRUE AS activo,
               pa.programa, pa.semestre, pa.sede, pa.disponibilidad, pa.portafolio_url,
               (SELECT count(*) FROM seguidores s JOIN usuarios f ON f.id_usuario = s.id_seguidor AND f.estado IS TRUE
                 WHERE s.id_seguido = u.id_usuario) AS total_seguidores,
               (SELECT count(*) FROM seguidores s JOIN usuarios f ON f.id_usuario = s.id_seguido AND f.estado IS TRUE
                 WHERE s.id_seguidor = u.id_usuario) AS total_siguiendo,
               (SELECT count(*) FROM servicios sv WHERE sv.id_proveedor = u.id_usuario AND sv.estado = 'aprobado') AS total_servicios,
               r.promedio, r.total_calificaciones,
               EXISTS (SELECT 1 FROM seguidores WHERE id_seguidor = @yo AND id_seguido = u.id_usuario) AS lo_sigo,
               GREATEST(
                 (SELECT max(v.verificado_hasta) FROM verificaciones_correo_institucional v
                   WHERE v.id_usuario = u.id_usuario AND v.correo = lower(trim(u.correo))),
                 (SELECT max(i.verificado_hasta) FROM identidades_institucionales i WHERE i.id_usuario = u.id_usuario)
               ) AS verificado_hasta
        FROM usuarios u
        LEFT JOIN perfiles_academicos pa ON pa.id_usuario = u.id_usuario
        LEFT JOIN LATERAL (
          SELECT round(avg(c.puntuacion)::numeric, 1) AS promedio, count(*) AS total_calificaciones
          FROM calificaciones c JOIN servicios sv ON sv.id_servicio = c.id_servicio
          WHERE sv.id_proveedor = u.id_usuario
        ) r ON true
        WHERE u.id_usuario = @id
        """;

    // =========================
    // CONSULTA
    // =========================
    [HttpGet("me")]
    public async Task<IActionResult> MiPerfil(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        var perfil = await Leer(conn, Yo, privado: true, ct);
        return perfil == null ? NotFound(new { error = "Perfil no encontrado" }) : Ok(perfil);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> PerfilPublico(int id, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        var perfil = await Leer(conn, id, privado: false, ct);
        // Cuenta suspendida o inexistente: mismo 404, sin revelar cuál de las dos.
        return perfil == null ? NotFound(new { error = "Perfil no encontrado" }) : Ok(perfil);
    }

    private async Task<Dictionary<string, object?>?> Leer(NpgsqlConnection conn, int id, bool privado, CancellationToken ct)
    {
        var perfil = new Dictionary<string, object?>();
        await using (var cmd = new NpgsqlCommand(ConsultaPerfil, conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("yo", Yo);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            if (!privado && !r.GetBoolean(r.GetOrdinal("activo"))) return null;

            perfil["id"] = r.Get<int>("id_usuario");
            perfil["nombre"] = r.Get<string>("nombre");
            perfil["descripcion"] = r.Get<string?>("descripcion");
            perfil["avatar"] = UrlPublica(r.Get<string?>("avatar"));
            perfil["universidad"] = r.Get<string?>("universidad");
            perfil["fecha_registro"] = r.Utc("fecha_registro");
            perfil["perfil_academico"] = new
            {
                programa = r.Get<string?>("programa") ?? "",
                semestre = r.Get<short?>("semestre"),
                sede = r.Get<string?>("sede") ?? "",
                disponibilidad = r.Get<string?>("disponibilidad") ?? "",
                portafolio_url = r.Get<string?>("portafolio_url")
            };
            perfil["estadisticas"] = new
            {
                seguidores = r.Get<long>("total_seguidores"),
                siguiendo = r.Get<long>("total_siguiendo"),
                servicios = r.Get<long>("total_servicios"),
                calificacion_promedio = r.Get<decimal?>("promedio"),
                total_calificaciones = r.Get<long>("total_calificaciones")
            };
            if (privado)
            {
                perfil["correo"] = r.Get<string>("correo");
                perfil["telefono"] = r.Get<string?>("telefono");
                perfil["id_rol"] = r.Get<int>("id_rol");
                var verificado = r.Get<DateTime?>("verificado_hasta");
                perfil["correo_verificado_hasta"] = verificado;
                perfil["correo_verificado"] = verificado > DateTime.UtcNow;
            }
            else
            {
                perfil["es_mio"] = id == Yo;
                perfil["lo_sigo"] = r.Get<bool>("lo_sigo");
            }
        }

        await using (var cmd = new NpgsqlCommand("""
            SELECT h.id_habilidad, h.nombre, uh.nivel, uh.detalle FROM usuario_habilidades uh
            JOIN habilidades h ON h.id_habilidad = uh.id_habilidad
            WHERE uh.id_usuario = @id ORDER BY h.nombre
            """, conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            var habilidades = new List<object>();
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                habilidades.Add(new
                {
                    id_habilidad = r.Get<int>("id_habilidad"), nombre = r.Get<string>("nombre"),
                    nivel = r.Get<string>("nivel"), detalle = r.Get<string>("detalle")
                });
            perfil["habilidades"] = habilidades;
        }
        return perfil;
    }

    // =========================
    // EDICIÓN
    // =========================
    [HttpPut("me"), EnableRateLimiting("Perfil"), RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Actualizar(ActualizarPerfilDTO dto, CancellationToken ct)
    {
        var errores = new Dictionary<string, string>();
        string? nombre = null, descripcion = null, telefono = null, programa = null, sede = null, disponibilidad = null, portafolio = null;

        if (dto.nombre != null && (nombre = Entrada.Nombre(dto.nombre)) == null)
            errores["nombre"] = "Entre 2 y 50 letras; sin números ni símbolos";
        if (dto.descripcion != null && (descripcion = Entrada.Texto(dto.descripcion, 500, multilinea: true)) == null)
            errores["descripcion"] = "Máximo 500 caracteres";
        if (dto.telefono != null && dto.telefono.Trim() != "" && (telefono = Entrada.Telefono(dto.telefono)) == null)
            errores["telefono"] = "Teléfono inválido: de 7 a 12 dígitos";
        if (dto.programa != null && (programa = Entrada.Texto(dto.programa, 120)) == null)
            errores["programa"] = "Máximo 120 caracteres";
        if (dto.sede != null && (sede = Entrada.Texto(dto.sede, 120)) == null)
            errores["sede"] = "Máximo 120 caracteres";
        if (dto.disponibilidad != null && (disponibilidad = Entrada.Texto(dto.disponibilidad, 300, multilinea: true)) == null)
            errores["disponibilidad"] = "Máximo 300 caracteres";
        if (dto.semestre is < 0 or > 20)
            errores["semestre"] = "Entre 1 y 20";
        if (dto.portafolio_url != null && dto.portafolio_url.Trim() != "" && (portafolio = Entrada.UrlHttps(dto.portafolio_url, 500)) == null)
            errores["portafolio_url"] = "Debe ser un enlace https:// válido";
        if (errores.Count > 0) return BadRequest(new { error = "Revisa los datos del perfil", campos = errores });

        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var sets = new List<string>();
        await using (var cmd = new NpgsqlCommand { Connection = conn, Transaction = tx })
        {
            if (dto.nombre != null) { sets.Add("nombre = @nombre"); cmd.Parameters.AddWithValue("nombre", nombre!); }
            if (dto.descripcion != null) { sets.Add("descripcion = @descripcion"); P(cmd, "descripcion", NpgsqlDbType.Text, descripcion == "" ? null : descripcion); }
            if (dto.telefono != null) { sets.Add("telefono = @telefono"); P(cmd, "telefono", NpgsqlDbType.Varchar, telefono); }
            if (sets.Count > 0)
            {
                cmd.CommandText = $"UPDATE usuarios SET {string.Join(", ", sets)} WHERE id_usuario = @id";
                cmd.Parameters.AddWithValue("id", Yo);
                await cmd.ExecuteNonQueryAsync(ct);
            }
        }

        if (dto.programa != null || dto.sede != null || dto.disponibilidad != null || dto.semestre != null || dto.portafolio_url != null)
        {
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO perfiles_academicos(id_usuario, programa, semestre, sede, disponibilidad, portafolio_url, actualizado_en)
                VALUES (@id, COALESCE(@programa, ''), @semestre, COALESCE(@sede, ''), COALESCE(@disponibilidad, ''), @portafolio, now())
                ON CONFLICT (id_usuario) DO UPDATE SET
                  programa = COALESCE(@programa, perfiles_academicos.programa),
                  sede = COALESCE(@sede, perfiles_academicos.sede),
                  disponibilidad = COALESCE(@disponibilidad, perfiles_academicos.disponibilidad),
                  semestre = CASE WHEN @cambia_semestre THEN @semestre ELSE perfiles_academicos.semestre END,
                  portafolio_url = CASE WHEN @cambia_portafolio THEN @portafolio ELSE perfiles_academicos.portafolio_url END,
                  actualizado_en = now()
                """, conn, tx);
            cmd.Parameters.AddWithValue("id", Yo);
            P(cmd, "programa", NpgsqlDbType.Varchar, programa);
            P(cmd, "sede", NpgsqlDbType.Varchar, sede);
            P(cmd, "disponibilidad", NpgsqlDbType.Varchar, disponibilidad);
            P(cmd, "semestre", NpgsqlDbType.Smallint, dto.semestre is > 0 ? (short)dto.semestre.Value : null);
            P(cmd, "portafolio", NpgsqlDbType.Varchar, portafolio);
            cmd.Parameters.AddWithValue("cambia_semestre", dto.semestre != null);
            cmd.Parameters.AddWithValue("cambia_portafolio", dto.portafolio_url != null);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Ok(await Leer(conn, Yo, privado: true, ct));
    }

    // =========================
    // AVATAR
    // =========================
    // Sólo JPG, PNG o WebP (comprobado por sus bytes, no por el nombre ni el Content-Type),
    // máximo 2 MB, sin metadatos (EXIF/GPS) y con un nombre que decide el servidor.
    [HttpPost("me/avatar"), EnableRateLimiting("Avatar"), RequestSizeLimit(MaxBytesAvatar + 64 * 1024)]
    public async Task<IActionResult> SubirAvatar(IFormFile? avatar, CancellationToken ct)
    {
        if (avatar == null || avatar.Length == 0) return BadRequest(new { error = "Adjunta una imagen en el campo \"avatar\"" });
        if (avatar.Length > MaxBytesAvatar) return BadRequest(new { error = "La imagen debe pesar menos de 2 MB" });

        byte[] datos;
        await using (var ms = new MemoryStream((int)avatar.Length))
        {
            await avatar.CopyToAsync(ms, ct);
            datos = ms.ToArray();
        }
        if (TipoImagen(datos) is not { } tipo) return BadRequest(new { error = "Sólo se permiten imágenes JPG, PNG o WebP" });
        if (ImagenSegura.SinMetadatos(datos, tipo.ContentType) is not { } limpia)
            return BadRequest(new { error = "La imagen está dañada o no se puede procesar" });

        string url;
        try { url = await storage.SubirAsync($"avatares/{Yo}/{Guid.NewGuid():N}.{tipo.Extension}", limpia, tipo.ContentType, ct); }
        catch (Exception ex)
        {
            Console.WriteLine($"[Perfil] Error subiendo avatar de {Yo}: {ex.Message}");
            return StatusCode(502, new { error = "No se pudo guardar la imagen. Inténtalo de nuevo" });
        }

        string? anterior;
        try { anterior = await CambiarAvatar(url, ct); }
        catch
        {
            await BorrarSiEsPropio(url);
            throw;
        }
        await BorrarSiEsPropio(anterior);
        return Ok(new { avatar = url });
    }

    [HttpDelete("me/avatar"), EnableRateLimiting("Avatar")]
    public async Task<IActionResult> QuitarAvatar(CancellationToken ct)
    {
        await BorrarSiEsPropio(await CambiarAvatar(null, ct));
        return Ok(new { avatar = (string?)null });
    }

    // Guarda el avatar nuevo y devuelve el anterior.
    private async Task<string?> CambiarAvatar(string? url, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE usuarios u SET avatar = @url
            FROM (SELECT avatar FROM usuarios WHERE id_usuario = @id FOR UPDATE) anterior
            WHERE u.id_usuario = @id RETURNING anterior.avatar
            """, conn);
        P(cmd, "url", NpgsqlDbType.Varchar, url);
        cmd.Parameters.AddWithValue("id", Yo);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    // Sólo se borran archivos de la carpeta de avatares de este usuario en nuestro Storage.
    private async Task BorrarSiEsPropio(string? url)
    {
        if (url == null || !url.Contains($"/storage/v1/object/public/imagenes-servicios/avatares/{Yo}/", StringComparison.Ordinal)) return;
        try { await storage.EliminarImagenAsync(url); }
        catch (Exception ex) { Console.WriteLine($"[Perfil] No se pudo borrar {url}: {ex.Message}"); }
    }

    // =========================
    // SEGUIDORES
    // =========================
    [HttpPost("{id:int}/seguir"), EnableRateLimiting("Perfil")]
    public async Task<IActionResult> Seguir(int id, CancellationToken ct)
    {
        if (id == Yo) return BadRequest(new { error = "No puedes seguirte a ti mismo" });
        await using var conn = await Open(config, ct);
        await using (var cmd = new NpgsqlCommand("""
            INSERT INTO seguidores(id_seguidor, id_seguido)
            SELECT @yo, id_usuario FROM usuarios WHERE id_usuario = @id AND estado IS TRUE
            ON CONFLICT DO NOTHING
            RETURNING 1
            """, conn))
        {
            cmd.Parameters.AddWithValue("yo", Yo);
            cmd.Parameters.AddWithValue("id", id);
            if (await cmd.ExecuteScalarAsync(ct) == null && !await Activo(conn, id, ct))
                return NotFound(new { error = "Perfil no encontrado" });
        }
        return Ok(new { siguiendo = true, total_seguidores = await TotalSeguidores(conn, id, ct) });
    }

    [HttpDelete("{id:int}/seguir"), EnableRateLimiting("Perfil")]
    public async Task<IActionResult> DejarDeSeguir(int id, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using (var cmd = new NpgsqlCommand("DELETE FROM seguidores WHERE id_seguidor = @yo AND id_seguido = @id", conn))
        {
            cmd.Parameters.AddWithValue("yo", Yo);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        return Ok(new { siguiendo = false, total_seguidores = await TotalSeguidores(conn, id, ct) });
    }

    [HttpGet("{id:int}/seguidores")]
    public Task<IActionResult> Seguidores(int id, int pagina = 1, int tamano = 20, CancellationToken ct = default) =>
        Lista(id, "s.id_seguido = @id", "s.id_seguidor", pagina, tamano, ct);

    [HttpGet("{id:int}/siguiendo")]
    public Task<IActionResult> Siguiendo(int id, int pagina = 1, int tamano = 20, CancellationToken ct = default) =>
        Lista(id, "s.id_seguidor = @id", "s.id_seguido", pagina, tamano, ct);

    // filtro y columna son constantes de este archivo, nunca datos del cliente.
    private async Task<IActionResult> Lista(int id, string filtro, string columna, int pagina, int tamano, CancellationToken ct)
    {
        pagina = Math.Clamp(pagina, 1, 10_000);
        tamano = Math.Clamp(tamano, 1, 50);
        await using var conn = await Open(config, ct);
        if (id != Yo && !await Activo(conn, id, ct)) return NotFound(new { error = "Perfil no encontrado" });

        await using var cmd = new NpgsqlCommand($"""
            SELECT u.id_usuario, u.nombre, u.avatar, u.universidad,
                   EXISTS (SELECT 1 FROM seguidores x WHERE x.id_seguidor = @yo AND x.id_seguido = u.id_usuario) AS lo_sigo,
                   count(*) OVER() AS total
            FROM seguidores s JOIN usuarios u ON u.id_usuario = {columna} AND u.estado IS TRUE
            WHERE {filtro}
            ORDER BY s.fecha_seguimiento DESC NULLS LAST, u.id_usuario
            LIMIT @limite OFFSET @offset
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("yo", Yo);
        cmd.Parameters.AddWithValue("limite", tamano);
        cmd.Parameters.AddWithValue("offset", (pagina - 1) * tamano);
        var items = new List<object>();
        long total = 0;
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            total = r.Get<long>("total");
            items.Add(new
            {
                id = r.Get<int>("id_usuario"), nombre = r.Get<string>("nombre"),
                avatar = UrlPublica(r.Get<string?>("avatar")), universidad = r.Get<string?>("universidad"),
                lo_sigo = r.Get<bool>("lo_sigo")
            });
        }
        return Ok(new { items, total, pagina, tamano });
    }

    private static async Task<bool> Activo(NpgsqlConnection conn, int id, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id AND estado IS TRUE)", conn);
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteScalarAsync(ct) is true;
    }

    private static async Task<long> TotalSeguidores(NpgsqlConnection conn, int id, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT count(*) FROM seguidores s JOIN usuarios f ON f.id_usuario = s.id_seguidor AND f.estado IS TRUE
            WHERE s.id_seguido = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        return (long)(await cmd.ExecuteScalarAsync(ct))!;
    }

    private static void P(NpgsqlCommand cmd, string nombre, NpgsqlDbType tipo, object? valor) =>
        cmd.Parameters.Add(new NpgsqlParameter(nombre, tipo) { Value = valor ?? DBNull.Value });
}
