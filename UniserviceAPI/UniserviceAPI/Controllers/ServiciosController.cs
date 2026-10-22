using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Servicios que publican los estudiantes.
// - Invitados: listado y detalle de servicios aprobados (sin contacto ni dirección).
// - Publicar, editar e imágenes: correo institucional verificado. El dueño siempre sale del JWT.
// - Todo cambio de contenido (texto o imágenes) vuelve el servicio a 'pendiente' para revisión.
[ApiController, Route("api/servicios")]
public class ServiciosController(IConfiguration config, SupabaseStorageService storage, EmailService email) : ControllerBase
{
    private const int MaxImagenes = 5;
    private const int MaxBytesImagen = 5 * 1024 * 1024;
    private const int MaxPendientesPorUsuario = 10;
    private const int CategoriaArriendo = 6;
    private static readonly string[] Ordenes = ["recientes", "antiguos", "precio-menor", "precio-mayor", "rating-mayor", "rating-menor"];

    private int UserId => InstitutionalAccess.UserId(User)!.Value;

    [HttpGet, AllowAnonymous]
    public async Task<IActionResult> Listar([FromQuery] int pagina = 1, [FromQuery] int por_pagina = 12,
        [FromQuery] int? categoria = null, [FromQuery] string? busqueda = null, [FromQuery] string orden = "recientes",
        CancellationToken ct = default)
    {
        if (pagina is < 1 or > 10000 || por_pagina is < 1 or > 50) return BadRequest(new { error = "Paginación inválida" });
        if (!Ordenes.Contains(orden)) return BadRequest(new { error = "Orden inválido" });
        if (busqueda?.Length > 100) return BadRequest(new { error = "La búsqueda es demasiado larga" });

        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT * FROM uniservice_mobile.listar_servicios(@pagina, @por_pagina, @categoria, @busqueda, @orden)", conn);
        cmd.Parameters.AddWithValue("pagina", pagina);
        cmd.Parameters.AddWithValue("por_pagina", por_pagina);
        cmd.Parameters.Add("categoria", NpgsqlDbType.Integer).Value = (object?)categoria ?? DBNull.Value;
        cmd.Parameters.Add("busqueda", NpgsqlDbType.Text).Value = string.IsNullOrWhiteSpace(busqueda) ? DBNull.Value : busqueda.Trim();
        cmd.Parameters.AddWithValue("orden", orden);

        var servicios = new List<object>();
        long total = 0;
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            while (await r.ReadAsync(ct))
            {
                total = r.Get<long>("total");
                servicios.Add(new
                {
                    id_servicio = r.Get<int>("id_servicio"),
                    id_proveedor = r.Get<int>("id_proveedor"),
                    titulo = r.Get<string>("titulo"),
                    descripcion = r.Get<string>("descripcion"),
                    id_categoria = r.Get<int?>("id_categoria"),
                    categoria = r.Get<string?>("categoria"),
                    precio = r.Get<decimal>("precio"),
                    unidad_precio = r.Get<string>("unidad_precio"),
                    modalidad = Modalidad(r.Get<int>("modalidad")),
                    disponibilidad = Disponibilidad(r.Get<int>("disponibilidad")),
                    fecha_publicacion = r.Utc("fecha_publicacion"),
                    proveedor = r.Get<string>("proveedor"),
                    universidad = r.Get<string?>("universidad"),
                    avatar = UrlPublica(r.Get<string?>("avatar")),
                    imagen = UrlPublica(r.Get<string?>("imagen")),
                    num_resenas = r.Get<int>("num_resenas"),
                    promedio = (double)r.Get<decimal>("promedio")
                });
            }
        }
        return Ok(new { servicios, pagina, por_pagina, total, total_paginas = (int)Math.Ceiling(total / (double)por_pagina) });
    }

    [HttpGet("categorias"), AllowAnonymous]
    public async Task<IActionResult> Categorias(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("SELECT id_categoria, nombre_categoria FROM categorias ORDER BY id_categoria", conn);
        var lista = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) lista.Add(new { id_categoria = r.GetInt32(0), nombre = r.GetString(1) });
        return Ok(lista);
    }

    // Visible si está aprobado y el proveedor activo; el dueño y los admins ven también sus otros estados.
    [HttpGet("{id:int}"), AllowAnonymous]
    public async Task<IActionResult> Detalle(int id, CancellationToken ct)
    {
        var usuario = InstitutionalAccess.UserId(User);
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT s.*, c.nombre_categoria, u.nombre AS proveedor, u.universidad, u.avatar, u.estado IS TRUE AS proveedor_activo,
              (SELECT count(*)::integer FROM servicios p WHERE p.id_proveedor = s.id_proveedor AND p.estado = 'aprobado') AS proveedor_servicios,
              pr.num AS proveedor_resenas, pr.prom AS proveedor_promedio
            FROM servicios s
            JOIN usuarios u ON u.id_usuario = s.id_proveedor
            LEFT JOIN categorias c ON c.id_categoria = s.id_categoria
            LEFT JOIN LATERAL (
              SELECT count(*)::integer AS num, round(avg(cal.puntuacion), 2) AS prom
              FROM calificaciones cal JOIN servicios p ON p.id_servicio = cal.id_servicio
              WHERE p.id_proveedor = s.id_proveedor) pr ON true
            WHERE s.id_servicio = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", id);

        object servicio;
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            if (!await r.ReadAsync(ct)) return NotFound(new { error = "Servicio no encontrado" });
            var idProveedor = r.Get<int>("id_proveedor");
            var esPropio = usuario == idProveedor;
            var estado = r.Get<string>("estado")!;
            if (!(estado == "aprobado" && r.Get<bool>("proveedor_activo")) && !esPropio && !EsAdmin(User))
                return NotFound(new { error = "Servicio no encontrado" });

            var conSesion = usuario != null;
            servicio = new
            {
                id_servicio = id,
                titulo = r.Get<string>("titulo"),
                descripcion = r.Get<string>("descripcion"),
                id_categoria = r.Get<int?>("id_categoria"),
                categoria = r.Get<string?>("nombre_categoria"),
                precio = r.Get<decimal>("precio_hora"),
                unidad_precio = r.Get<string>("unidad_precio"),
                modalidad = Modalidad(r.Get<int>("modalidad")),
                disponibilidad = Disponibilidad(r.Get<int>("disponibilidad")),
                fecha_publicacion = r.Utc("fecha_publicacion"),
                estado,
                motivo_rechazo = esPropio ? r.Get<string?>("motivo_rechazo") : null,
                es_propio = esPropio,
                // Contacto y ubicación exacta sólo con sesión iniciada.
                contacto = conSesion ? r.Get<string?>("contacto") : null,
                direccion = conSesion ? r.Get<string?>("direccion") : null,
                ubicacion_lat = conSesion ? r.Get<decimal?>("ubicacion_lat") : null,
                ubicacion_lng = conSesion ? r.Get<decimal?>("ubicacion_lng") : null,
                tiene_ubicacion = r.Get<decimal?>("ubicacion_lat") != null,
                proveedor = new
                {
                    id_usuario = idProveedor,
                    nombre = r.Get<string>("proveedor"),
                    universidad = r.Get<string?>("universidad"),
                    avatar = UrlPublica(r.Get<string?>("avatar")),
                    servicios_publicados = r.Get<int>("proveedor_servicios"),
                    num_resenas = r.Get<int>("proveedor_resenas"),
                    promedio = (double)(r.Get<decimal?>("proveedor_promedio") ?? 0)
                }
            };
        }

        var imagenes = new List<object>();
        await using (var img = new NpgsqlCommand(
            "SELECT id_imagen, url_imagen, orden FROM servicios_imagenes WHERE id_servicio = @id ORDER BY orden", conn))
        {
            img.Parameters.AddWithValue("id", id);
            await using var r = await img.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                if (UrlPublica(r.GetString(1)) is { } url) imagenes.Add(new { id_imagen = r.GetInt32(0), url, orden = r.GetInt16(2) });
        }

        var resenas = new List<object>();
        await using (var res = new NpgsqlCommand("""
            SELECT c.id_calificacion, c.id_cliente, u.nombre AS autor, u.avatar, c.puntuacion, c.comentario,
                   c.fecha_calificacion, c.fecha_modificacion
            FROM calificaciones c JOIN usuarios u ON u.id_usuario = c.id_cliente
            WHERE c.id_servicio = @id ORDER BY c.fecha_calificacion DESC NULLS LAST LIMIT 50
            """, conn))
        {
            res.Parameters.AddWithValue("id", id);
            await using var r = await res.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                resenas.Add(new
                {
                    id_calificacion = r.Get<int>("id_calificacion"),
                    id_cliente = r.Get<int>("id_cliente"),
                    autor = r.Get<string>("autor"),
                    avatar = UrlPublica(r.Get<string?>("avatar")),
                    puntuacion = (int)r.Get<short>("puntuacion"),
                    comentario = r.Get<string?>("comentario"),
                    fecha = r.Utc("fecha_calificacion"),
                    editada = r.Get<DateTime?>("fecha_modificacion") != null
                });
        }

        int numResenas; double promedio;
        await using (var stats = new NpgsqlCommand(
            "SELECT count(*)::integer, coalesce(round(avg(puntuacion), 2), 0) FROM calificaciones WHERE id_servicio = @id", conn))
        {
            stats.Parameters.AddWithValue("id", id);
            await using var r = await stats.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            numResenas = r.GetInt32(0); promedio = (double)r.GetDecimal(1);
        }

        return Ok(new { servicio, imagenes, resenas, num_resenas = numResenas, promedio });
    }

    [HttpGet("mios")]
    public async Task<IActionResult> Mios(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT s.id_servicio, s.titulo, s.estado, s.motivo_rechazo, s.precio_hora, s.unidad_precio,
                   s.fecha_publicacion, c.nombre_categoria,
                   (SELECT i.url_imagen FROM servicios_imagenes i WHERE i.id_servicio = s.id_servicio ORDER BY i.orden LIMIT 1) AS imagen,
                   (SELECT count(*)::integer FROM servicios_imagenes i WHERE i.id_servicio = s.id_servicio) AS num_imagenes,
                   (SELECT count(*)::integer FROM calificaciones cal WHERE cal.id_servicio = s.id_servicio) AS num_resenas,
                   (SELECT coalesce(round(avg(cal.puntuacion), 2), 0) FROM calificaciones cal WHERE cal.id_servicio = s.id_servicio) AS promedio,
                   (SELECT count(*)::integer FROM solicitudes so WHERE so.id_servicio = s.id_servicio AND so.estado = 'Pendiente') AS solicitudes_pendientes
            FROM servicios s LEFT JOIN categorias c ON c.id_categoria = s.id_categoria
            WHERE s.id_proveedor = @user ORDER BY s.fecha_publicacion DESC, s.id_servicio DESC
            """, conn);
        cmd.Parameters.AddWithValue("user", UserId);
        var lista = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            lista.Add(new
            {
                id_servicio = r.Get<int>("id_servicio"),
                titulo = r.Get<string>("titulo"),
                estado = r.Get<string>("estado"),
                motivo_rechazo = r.Get<string?>("motivo_rechazo"),
                precio = r.Get<decimal>("precio_hora"),
                unidad_precio = r.Get<string>("unidad_precio"),
                categoria = r.Get<string?>("nombre_categoria"),
                fecha_publicacion = r.Utc("fecha_publicacion"),
                imagen = UrlPublica(r.Get<string?>("imagen")),
                num_imagenes = r.Get<int>("num_imagenes"),
                num_resenas = r.Get<int>("num_resenas"),
                promedio = (double)r.Get<decimal>("promedio"),
                solicitudes_pendientes = r.Get<int>("solicitudes_pendientes")
            });
        return Ok(lista);
    }

    [HttpPost, ServiceFilter(typeof(ActiveStudentFilter))]
    public async Task<IActionResult> Crear(GuardarServicioDTO dto, CancellationToken ct)
    {
        if (Validar(dto) is { } error) return BadRequest(new { error });
        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using (var limite = new NpgsqlCommand("""
            SELECT count(*) FROM servicios WHERE id_proveedor = @user AND estado = 'pendiente'
            """, conn, tx))
        {
            limite.Parameters.AddWithValue("user", UserId);
            if (Convert.ToInt32(await limite.ExecuteScalarAsync(ct)) >= MaxPendientesPorUsuario)
                return Conflict(new { error = $"Tienes {MaxPendientesPorUsuario} servicios esperando revisión. Espera a que se revisen antes de publicar más." });
        }

        await using var insert = new NpgsqlCommand("""
            INSERT INTO servicios(id_proveedor, titulo, descripcion, id_categoria, precio_hora, unidad_precio,
              modalidad, disponibilidad, contacto, direccion, ubicacion_lat, ubicacion_lng)
            SELECT @user, @titulo, @descripcion, c.id_categoria, @precio, @unidad, @modalidad, @disponibilidad,
              @contacto, @direccion, @lat, @lng
            FROM categorias c WHERE c.id_categoria = @categoria
            RETURNING id_servicio
            """, conn, tx);
        insert.Parameters.AddWithValue("user", UserId);
        Parametros(insert, dto);
        var id = await insert.ExecuteScalarAsync(ct);
        if (id == null) return BadRequest(new { error = "La categoría no existe" });
        await tx.CommitAsync(ct);

        NotificarAdmins(Convert.ToInt32(id), dto.titulo.Trim());
        return Created($"/api/servicios/{id}", new { id_servicio = id, estado = "pendiente" });
    }

    [HttpPut("{id:int}"), ServiceFilter(typeof(ActiveStudentFilter))]
    public async Task<IActionResult> Editar(int id, GuardarServicioDTO dto, CancellationToken ct)
    {
        if (Validar(dto) is { } error) return BadRequest(new { error });
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE servicios s SET titulo = @titulo, descripcion = @descripcion, id_categoria = c.id_categoria,
              precio_hora = @precio, unidad_precio = @unidad, modalidad = @modalidad, disponibilidad = @disponibilidad,
              contacto = @contacto, direccion = @direccion, ubicacion_lat = @lat, ubicacion_lng = @lng,
              estado = 'pendiente', motivo_rechazo = NULL, revisado_en = NULL, revisado_por = NULL
            FROM categorias c
            WHERE s.id_servicio = @id AND s.id_proveedor = @user AND c.id_categoria = @categoria
            RETURNING s.id_servicio
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        Parametros(cmd, dto);
        if (await cmd.ExecuteScalarAsync(ct) == null)
            return await EstadoPropio(conn, id, ct) == null
                ? NotFound(new { error = "Servicio no encontrado" })
                : BadRequest(new { error = "La categoría no existe" });

        NotificarAdmins(id, dto.titulo.Trim());
        return Ok(new { ok = true, estado = "pendiente" });
    }

    // El proveedor pausa un servicio aprobado o reanuda uno pausado (no necesita nueva revisión).
    [HttpPatch("{id:int}/pausa")]
    public async Task<IActionResult> Pausar(int id, PausarServicioDTO dto, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE servicios SET estado = @nuevo
            WHERE id_servicio = @id AND id_proveedor = @user AND estado = @actual
            RETURNING estado
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        cmd.Parameters.AddWithValue("nuevo", dto.pausado ? "pausado" : "aprobado");
        cmd.Parameters.AddWithValue("actual", dto.pausado ? "aprobado" : "pausado");
        if (await cmd.ExecuteScalarAsync(ct) is string estado) return Ok(new { ok = true, estado });

        return await EstadoPropio(conn, id, ct) == null
            ? NotFound(new { error = "Servicio no encontrado" })
            : Conflict(new { error = dto.pausado ? "Sólo puedes pausar un servicio aprobado" : "Sólo puedes reanudar un servicio pausado" });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (await EstadoPropio(conn, id, ct, tx, bloquear: true) == null) return NotFound(new { error = "Servicio no encontrado" });

        await using (var activas = new NpgsqlCommand(
            "SELECT EXISTS(SELECT 1 FROM solicitudes WHERE id_servicio = @id AND estado = 'Aceptada')", conn, tx))
        {
            activas.Parameters.AddWithValue("id", id);
            if (await activas.ExecuteScalarAsync(ct) is true)
                return Conflict(new { error = "Tienes solicitudes aceptadas en curso. Complétalas o cancélalas antes de eliminar el servicio." });
        }

        var urls = await UrlsImagenes(conn, tx, id, ct);
        // Solicitudes, calificaciones e imágenes se borran en cascada (migración 008).
        await using (var delete = new NpgsqlCommand("DELETE FROM servicios WHERE id_servicio = @id", conn, tx))
        {
            delete.Parameters.AddWithValue("id", id);
            await delete.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        await BorrarArchivos(urls);
        return Ok(new { ok = true });
    }

    [HttpPost("{id:int}/imagenes"), ServiceFilter(typeof(ActiveStudentFilter))]
    [RequestSizeLimit(MaxImagenes * MaxBytesImagen + 1024 * 1024)]
    public async Task<IActionResult> SubirImagenes(int id, [FromForm] List<IFormFile> imagenes, CancellationToken ct)
    {
        if (imagenes.Count is 0 or > MaxImagenes) return BadRequest(new { error = $"Envía entre 1 y {MaxImagenes} imágenes" });
        var archivos = new List<(byte[] Datos, string ContentType, string Extension)>();
        foreach (var imagen in imagenes)
        {
            if (imagen.Length is 0 or > MaxBytesImagen) return BadRequest(new { error = "Cada imagen debe pesar menos de 5 MB" });
            using var ms = new MemoryStream();
            await imagen.CopyToAsync(ms, ct);
            var datos = ms.ToArray();
            if (TipoImagen(datos) is not { } tipo) return BadRequest(new { error = "Sólo se permiten imágenes JPG, PNG o WebP" });
            archivos.Add((datos, tipo.ContentType, tipo.Extension));
        }

        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (await EstadoPropio(conn, id, ct, tx, bloquear: true) == null) return NotFound(new { error = "Servicio no encontrado" });
        int existentes;
        await using (var count = new NpgsqlCommand("SELECT count(*)::integer FROM servicios_imagenes WHERE id_servicio = @id", conn, tx))
        {
            count.Parameters.AddWithValue("id", id);
            existentes = Convert.ToInt32(await count.ExecuteScalarAsync(ct));
        }
        if (existentes + archivos.Count > MaxImagenes)
            return Conflict(new { error = $"Un servicio admite {MaxImagenes} imágenes; ya tiene {existentes}" });

        var subidas = new List<string>();
        try
        {
            foreach (var (datos, contentType, extension) in archivos)
                subidas.Add(await storage.SubirAsync($"servicios/{id}/{Guid.NewGuid():N}.{extension}", datos, contentType, ct));

            await using (var insert = new NpgsqlCommand("""
                INSERT INTO servicios_imagenes(id_servicio, url_imagen, orden)
                SELECT @id, x.url, @desde + x.n - 1 FROM unnest(@urls) WITH ORDINALITY x(url, n);
                UPDATE servicios SET estado = 'pendiente', motivo_rechazo = NULL, revisado_en = NULL, revisado_por = NULL
                WHERE id_servicio = @id;
                """, conn, tx))
            {
                insert.Parameters.AddWithValue("id", id);
                insert.Parameters.AddWithValue("desde", existentes);
                insert.Parameters.AddWithValue("urls", subidas.ToArray());
                await insert.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct);
        }
        catch
        {
            await BorrarArchivos(subidas); // no dejar archivos sin registro en la BD
            throw;
        }
        return Ok(new { ok = true, estado = "pendiente", urls = subidas });
    }

    [HttpDelete("{id:int}/imagenes/{idImagen:int}")]
    public async Task<IActionResult> EliminarImagen(int id, int idImagen, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (await EstadoPropio(conn, id, ct, tx, bloquear: true) == null) return NotFound(new { error = "Servicio no encontrado" });

        // Borra la imagen y corre las siguientes una posición para que el orden siga siendo 0..n-1 (0 = portada).
        await using var delete = new NpgsqlCommand("""
            WITH borrada AS (
              DELETE FROM servicios_imagenes WHERE id_imagen = @img AND id_servicio = @id RETURNING url_imagen, orden),
            corridas AS (
              UPDATE servicios_imagenes SET orden = orden - 1
              WHERE id_servicio = @id AND orden > (SELECT orden FROM borrada))
            SELECT url_imagen FROM borrada
            """, conn, tx);
        delete.Parameters.AddWithValue("img", idImagen);
        delete.Parameters.AddWithValue("id", id);
        if (await delete.ExecuteScalarAsync(ct) is not string url) return NotFound(new { error = "Imagen no encontrada" });
        await tx.CommitAsync(ct);
        await BorrarArchivos([url]);
        return Ok(new { ok = true });
    }

    // Recibe todos los id_imagen del servicio en el orden deseado; el primero queda de portada.
    [HttpPut("{id:int}/imagenes/orden")]
    public async Task<IActionResult> OrdenarImagenes(int id, OrdenImagenesDTO dto, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (await EstadoPropio(conn, id, ct, tx, bloquear: true) == null) return NotFound(new { error = "Servicio no encontrado" });

        var actuales = new HashSet<int>();
        await using (var ids = new NpgsqlCommand("SELECT id_imagen FROM servicios_imagenes WHERE id_servicio = @id", conn, tx))
        {
            ids.Parameters.AddWithValue("id", id);
            await using var r = await ids.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) actuales.Add(r.GetInt32(0));
        }
        if (dto.imagenes.Distinct().Count() != dto.imagenes.Length || !actuales.SetEquals(dto.imagenes))
            return BadRequest(new { error = "Envía todas las imágenes del servicio, sin repetir" });

        await using (var update = new NpgsqlCommand("""
            UPDATE servicios_imagenes i SET orden = x.n - 1
            FROM unnest(@ids) WITH ORDINALITY x(id, n)
            WHERE i.id_imagen = x.id AND i.id_servicio = @id
            """, conn, tx))
        {
            update.Parameters.AddWithValue("ids", dto.imagenes);
            update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Ok(new { ok = true });
    }

    // ── Auxiliares ──

    private static string? Validar(GuardarServicioDTO dto)
    {
        if (dto.titulo.Trim().Length < 5) return "El título debe tener al menos 5 caracteres";
        if (dto.descripcion.Trim().Length < 20) return "La descripción debe tener al menos 20 caracteres";
        if (dto.contacto.Trim().Length < 5) return "Indica un correo o teléfono de contacto";
        if ((dto.ubicacion_lat == null) != (dto.ubicacion_lng == null)) return "La ubicación necesita latitud y longitud";
        return null;
    }

    private static void Parametros(NpgsqlCommand cmd, GuardarServicioDTO dto)
    {
        cmd.Parameters.AddWithValue("titulo", dto.titulo.Trim());
        cmd.Parameters.AddWithValue("descripcion", dto.descripcion.Trim());
        cmd.Parameters.AddWithValue("categoria", dto.id_categoria);
        cmd.Parameters.AddWithValue("precio", dto.precio);
        cmd.Parameters.AddWithValue("unidad", dto.unidad_precio ?? (dto.id_categoria == CategoriaArriendo ? "mes" : "hora"));
        cmd.Parameters.AddWithValue("modalidad", Array.IndexOf(Modalidades, dto.modalidad));
        cmd.Parameters.AddWithValue("disponibilidad", Array.IndexOf(Disponibilidades, dto.disponibilidad));
        cmd.Parameters.AddWithValue("contacto", dto.contacto.Trim());
        cmd.Parameters.Add("direccion", NpgsqlDbType.Text).Value =
            string.IsNullOrWhiteSpace(dto.direccion) ? DBNull.Value : dto.direccion.Trim();
        cmd.Parameters.Add("lat", NpgsqlDbType.Numeric).Value = (object?)dto.ubicacion_lat ?? DBNull.Value;
        cmd.Parameters.Add("lng", NpgsqlDbType.Numeric).Value = (object?)dto.ubicacion_lng ?? DBNull.Value;
    }

    // Estado del servicio si pertenece al usuario; null si no existe o es de otro.
    private async Task<string?> EstadoPropio(NpgsqlConnection conn, int id, CancellationToken ct,
        NpgsqlTransaction? tx = null, bool bloquear = false)
    {
        await using var cmd = new NpgsqlCommand(
            "SELECT estado FROM servicios WHERE id_servicio = @id AND id_proveedor = @user" + (bloquear ? " FOR UPDATE" : ""), conn, tx);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    private static async Task<List<string>> UrlsImagenes(NpgsqlConnection conn, NpgsqlTransaction tx, int id, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("SELECT url_imagen FROM servicios_imagenes WHERE id_servicio = @id", conn, tx);
        cmd.Parameters.AddWithValue("id", id);
        var urls = new List<string>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) urls.Add(r.GetString(0));
        return urls;
    }

    // Si Storage falla, el archivo queda huérfano pero la BD ya es consistente: no se interrumpe la respuesta.
    private async Task BorrarArchivos(IEnumerable<string> urls)
    {
        foreach (var url in urls.Where(u => UrlPublica(u) != null))
        {
            try { await storage.EliminarImagenAsync(url); }
            catch (Exception ex) { Console.WriteLine($"[STORAGE] No se pudo borrar {url}: {ex.Message}"); }
        }
    }

    // En segundo plano: el correo no debe retrasar ni hacer fallar la publicación.
    private void NotificarAdmins(int idServicio, string titulo)
    {
        var proveedor = UserId;
        _ = Task.Run(async () =>
        {
            try
            {
                await using var c = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
                await c.OpenAsync();
                await using var cmd = new NpgsqlCommand("""
                    SELECT a.correo, a.nombre, p.nombre FROM usuarios a, usuarios p
                    WHERE a.id_rol = 1 AND a.estado IS TRUE AND p.id_usuario = @proveedor
                    """, c);
                cmd.Parameters.AddWithValue("proveedor", proveedor);
                var admins = new List<(string Correo, string Nombre, string Proveedor)>();
                await using (var r = await cmd.ExecuteReaderAsync())
                    while (await r.ReadAsync()) admins.Add((r.GetString(0), r.GetString(1), r.GetString(2)));
                foreach (var (correo, nombre, nombreProveedor) in admins)
                    await email.EnviarNotificacionNuevoServicio(correo, Html(nombre), Html(nombreProveedor), Html(titulo), idServicio);
            }
            catch (Exception ex) { Console.WriteLine($"[EMAIL] No se pudo notificar a los admins: {ex.Message}"); }
        });
    }
}
