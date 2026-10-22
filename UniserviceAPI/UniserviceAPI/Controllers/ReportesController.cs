using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Reportes que hace un usuario. El autor sale del JWT; cada usuario sólo ve y amplía los suyos.
// La gestión (listar todos, cambiar estado) está en /api/admin/reportes.
[ApiController, Route("api/reportes")]
public sealed class ReportesController(IConfiguration config, SupabaseStorageService storage) : ControllerBase
{
    private const int MaxImagenes = 3;
    private const int MaxBytesImagen = 5 * 1024 * 1024;
    private int Yo => InstitutionalAccess.UserId(User)!.Value;

    // Los mismos valores que permite el CHECK chk_tipo_reporte de la BD.
    private static readonly HashSet<string> Tipos =
    [
        "servicio_fraude", "servicio_inapropiado", "contenido_inapropiado", "pago_problema",
        "usuario_acoso", "usuario_fraude", "usuario_abuso", "usuario_spam", "usuario_suplantacion",
        "usuario_comportamiento", "bug_tecnico", "queja_general", "sugerencia", "otro"
    ];

    [HttpPost, EnableRateLimiting("Reportes"), RequestSizeLimit(32 * 1024)]
    public async Task<IActionResult> Crear(CrearReporteDTO dto, CancellationToken ct)
    {
        var tipo = dto.tipo_reporte?.Trim() ?? "";
        var titulo = Entrada.Texto(dto.titulo, 150);
        var descripcion = Entrada.Texto(dto.descripcion, 2000, multilinea: true);
        if (!Tipos.Contains(tipo)) return BadRequest(new { error = "Tipo de reporte inválido" });
        if (titulo is not { Length: >= 5 }) return BadRequest(new { error = "El título debe tener entre 5 y 150 caracteres" });
        if (descripcion is not { Length: >= 10 }) return BadRequest(new { error = "La descripción debe tener entre 10 y 2000 caracteres" });
        if (tipo.StartsWith("usuario_") && dto.id_usuario_reportado == null)
            return BadRequest(new { error = "Indica el usuario que reportas" });
        if (tipo.StartsWith("servicio_") && dto.id_servicio == null)
            return BadRequest(new { error = "Indica el servicio que reportas" });
        if (dto.id_usuario_reportado == Yo) return BadRequest(new { error = "No puedes reportarte a ti mismo" });

        await using var conn = await Open(config, ct);
        // Lo referenciado debe existir; la solicitud, además, debe ser del autor (cliente o proveedor).
        await using (var cmd = new NpgsqlCommand("""
            SELECT (@servicio::int IS NULL OR EXISTS (SELECT 1 FROM servicios WHERE id_servicio = @servicio)) AS servicio_ok,
                   (@solicitud::int IS NULL OR EXISTS (SELECT 1 FROM solicitudes WHERE id_solicitud = @solicitud
                      AND @yo IN (id_cliente, id_proveedor))) AS solicitud_ok,
                   (@usuario::int IS NULL OR EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @usuario)) AS usuario_ok,
                   EXISTS (SELECT 1 FROM reportes WHERE id_usuario = @yo AND tipo_reporte = @tipo
                      AND estado IN ('Pendiente', 'En_revision')
                      AND id_servicio IS NOT DISTINCT FROM @servicio AND id_solicitud IS NOT DISTINCT FROM @solicitud
                      AND id_usuario_reportado IS NOT DISTINCT FROM @usuario) AS duplicado
            """, conn))
        {
            Referencias(cmd, dto, tipo);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            if (!r.Get<bool>("servicio_ok")) return NotFound(new { error = "Servicio no encontrado" });
            if (!r.Get<bool>("solicitud_ok")) return NotFound(new { error = "Solicitud no encontrada" });
            if (!r.Get<bool>("usuario_ok")) return NotFound(new { error = "Usuario no encontrado" });
            if (r.Get<bool>("duplicado")) return Conflict(new { error = "Ya tienes un reporte igual en revisión" });
        }

        await using var insert = new NpgsqlCommand("""
            INSERT INTO reportes(id_usuario, id_servicio, id_solicitud, id_usuario_reportado, tipo_reporte, titulo, descripcion)
            VALUES (@yo, @servicio, @solicitud, @usuario, @tipo, @titulo, @descripcion)
            RETURNING id_reporte, estado, fecha_creacion
            """, conn);
        Referencias(insert, dto, tipo);
        insert.Parameters.AddWithValue("titulo", titulo);
        insert.Parameters.AddWithValue("descripcion", descripcion);
        await using var ins = await insert.ExecuteReaderAsync(ct);
        await ins.ReadAsync(ct);
        return Ok(new { id_reporte = ins.Get<int>("id_reporte"), estado = ins.Get<string>("estado"), fecha_creacion = ins.Utc("fecha_creacion") });
    }

    private void Referencias(NpgsqlCommand cmd, CrearReporteDTO dto, string tipo)
    {
        cmd.Parameters.AddWithValue("yo", Yo);
        cmd.Parameters.AddWithValue("tipo", tipo);
        cmd.Parameters.Add(new NpgsqlParameter("servicio", NpgsqlDbType.Integer) { Value = (object?)dto.id_servicio ?? DBNull.Value });
        cmd.Parameters.Add(new NpgsqlParameter("solicitud", NpgsqlDbType.Integer) { Value = (object?)dto.id_solicitud ?? DBNull.Value });
        cmd.Parameters.Add(new NpgsqlParameter("usuario", NpgsqlDbType.Integer) { Value = (object?)dto.id_usuario_reportado ?? DBNull.Value });
    }

    [HttpGet("mios")]
    public async Task<IActionResult> Mios(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT r.id_reporte, r.tipo_reporte, r.titulo, r.descripcion, r.estado, r.fecha_creacion, r.fecha_resolucion,
                   r.resolucion_notas, r.evidencia, r.id_servicio, s.titulo AS titulo_servicio, r.id_solicitud,
                   r.id_usuario_reportado, ur.nombre AS nombre_reportado
            FROM reportes r
            LEFT JOIN servicios s ON s.id_servicio = r.id_servicio
            LEFT JOIN usuarios ur ON ur.id_usuario = r.id_usuario_reportado
            WHERE r.id_usuario = @yo
            ORDER BY r.fecha_creacion DESC
            LIMIT 100
            """, conn);
        cmd.Parameters.AddWithValue("yo", Yo);
        var lista = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            lista.Add(new
            {
                id_reporte = r.Get<int>("id_reporte"), tipo_reporte = r.Get<string>("tipo_reporte"),
                titulo = r.Get<string>("titulo"), descripcion = r.Get<string>("descripcion"), estado = r.Get<string?>("estado"),
                fecha_creacion = r.Utc("fecha_creacion"), fecha_resolucion = r.Utc("fecha_resolucion"),
                resolucion_notas = r.Get<string?>("resolucion_notas"), evidencias = Evidencias(r.Get<string?>("evidencia")),
                id_servicio = r.Get<int?>("id_servicio"), titulo_servicio = r.Get<string?>("titulo_servicio"),
                id_solicitud = r.Get<int?>("id_solicitud"),
                id_usuario_reportado = r.Get<int?>("id_usuario_reportado"), nombre_reportado = r.Get<string?>("nombre_reportado")
            });
        return Ok(lista);
    }

    // Evidencia en imágenes: sólo el autor, sólo mientras el reporte está pendiente y máximo 3 en total.
    [HttpPost("{id:int}/imagenes"), EnableRateLimiting("Reportes"), RequestSizeLimit(MaxImagenes * MaxBytesImagen + 256 * 1024)]
    public async Task<IActionResult> SubirImagenes(int id, [FromForm] List<IFormFile> imagenes, CancellationToken ct)
    {
        if (imagenes.Count is 0 or > MaxImagenes) return BadRequest(new { error = $"Envía entre 1 y {MaxImagenes} imágenes" });
        var archivos = new List<(byte[] Datos, string ContentType, string Extension)>();
        foreach (var imagen in imagenes)
        {
            if (imagen.Length is 0 or > MaxBytesImagen) return BadRequest(new { error = "Cada imagen debe pesar menos de 5 MB" });
            await using var ms = new MemoryStream((int)imagen.Length);
            await imagen.CopyToAsync(ms, ct);
            var datos = ms.ToArray();
            if (TipoImagen(datos) is not { } tipo) return BadRequest(new { error = "Sólo se permiten imágenes JPG, PNG o WebP" });
            if (ImagenSegura.SinMetadatos(datos, tipo.ContentType) is not { } limpia)
                return BadRequest(new { error = "Una de las imágenes está dañada" });
            archivos.Add((limpia, tipo.ContentType, tipo.Extension));
        }

        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        string? evidencia;
        await using (var cmd = new NpgsqlCommand("""
            SELECT evidencia FROM reportes WHERE id_reporte = @id AND id_usuario = @yo AND estado = 'Pendiente' FOR UPDATE
            """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", id);
            cmd.Parameters.AddWithValue("yo", Yo);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return NotFound(new { error = "Reporte no encontrado o ya en revisión" });
            evidencia = r.Get<string?>("evidencia");
        }
        var existentes = Evidencias(evidencia);
        if (existentes.Count + archivos.Count > MaxImagenes)
            return Conflict(new { error = $"Un reporte admite {MaxImagenes} imágenes; ya tiene {existentes.Count}" });

        var urls = new List<string>();
        try
        {
            foreach (var a in archivos)
                urls.Add(await storage.SubirAsync($"reportes/{id}/{Guid.NewGuid():N}.{a.Extension}", a.Datos, a.ContentType, ct));
            await using var update = new NpgsqlCommand("UPDATE reportes SET evidencia = @evidencia WHERE id_reporte = @id", conn, tx);
            update.Parameters.AddWithValue("evidencia",
                string.IsNullOrWhiteSpace(evidencia) ? string.Join(",", urls) : $"{evidencia},{string.Join(",", urls)}");
            update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (Exception ex)
        {
            foreach (var url in urls)
                try { await storage.EliminarImagenAsync(url); } catch { /* huérfano en Storage, la BD queda coherente */ }
            Console.WriteLine($"[Reportes] Error subiendo evidencia del reporte {id}: {ex.Message}");
            return StatusCode(502, new { error = "No se pudieron guardar las imágenes. Inténtalo de nuevo" });
        }
        return Ok(new { evidencias = existentes.Concat(urls) });
    }

    // La columna antigua guarda URLs separadas por comas (y a veces texto libre): sólo se devuelven las URLs.
    private static List<string> Evidencias(string? evidencia) =>
        (evidencia ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(u => UrlPublica(u) != null).ToList();
}
