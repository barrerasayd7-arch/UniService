using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Hubs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Solicitudes de un cliente a un servicio. Cliente y proveedor salen del JWT y del servicio, nunca del cuerpo.
// Estados: Pendiente → Aceptada → Completada, o Pendiente → Rechazada; el cliente puede cancelar
// mientras esté Pendiente o Aceptada. Sólo una solicitud activa por cliente y servicio (índice de la 008).
[ApiController, Route("api/solicitudes")]
public class SolicitudesController(IConfiguration config, EmailService email, IHubContext<ChatHub> chatHub) : ControllerBase
{
    // Campos propios de cada categoría que llegan en "campos" (ver solicitud_config.dart).
    private static readonly HashSet<string> CamposPermitidos = ["cantidad_paginas", "lenguaje", "dias_estadia", "fecha_inicio"];

    private int UserId => InstitutionalAccess.UserId(User)!.Value;

    [HttpPost, ServiceFilter(typeof(ActiveStudentFilter))]
    public async Task<IActionResult> Crear(CrearSolicitudDTO dto, CancellationToken ct)
    {
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-5)); // Colombia
        if (dto.fecha_deseada < hoy) return BadRequest(new { error = "La fecha deseada no puede estar en el pasado" });
        var campos = dto.campos ?? [];
        if (campos.Keys.Any(k => !CamposPermitidos.Contains(k)) || campos.Values.Any(v => v == null || v.Length > 100))
            return BadRequest(new { error = "Campos adicionales inválidos" });

        await using var conn = await Open(config, ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        int idProveedor; string titulo, categoria, nombreProveedor, correoProveedor, nombreCliente;
        await using (var servicio = new NpgsqlCommand("""
            SELECT s.id_proveedor, s.titulo, coalesce(c.nombre_categoria, 'Servicio'), p.nombre, p.correo, cl.nombre
            FROM servicios s
            JOIN usuarios p ON p.id_usuario = s.id_proveedor AND p.estado IS TRUE
            LEFT JOIN categorias c ON c.id_categoria = s.id_categoria
            JOIN usuarios cl ON cl.id_usuario = @cliente
            WHERE s.id_servicio = @id AND s.estado = 'aprobado'
            """, conn, tx))
        {
            servicio.Parameters.AddWithValue("id", dto.id_servicio);
            servicio.Parameters.AddWithValue("cliente", UserId);
            await using var r = await servicio.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return NotFound(new { error = "El servicio no existe o no está disponible" });
            (idProveedor, titulo, categoria, nombreProveedor, correoProveedor, nombreCliente) =
                (r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5));
        }
        if (idProveedor == UserId) return BadRequest(new { error = "No puedes solicitar tu propio servicio" });

        int idSolicitud;
        try
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO solicitudes(id_cliente, id_proveedor, id_servicio, tipo_servicio, descripcion,
                  presupuesto, fecha_deseada, hora_deseada, campos_personalizados, estado)
                VALUES (@cliente, @proveedor, @servicio, @tipo, @descripcion, @presupuesto, @fecha, @hora, @campos, 'Pendiente')
                RETURNING id_solicitud
                """, conn, tx);
            insert.Parameters.AddWithValue("cliente", UserId);
            insert.Parameters.AddWithValue("proveedor", idProveedor);
            insert.Parameters.AddWithValue("servicio", dto.id_servicio);
            insert.Parameters.AddWithValue("tipo", categoria.Length > 100 ? categoria[..100] : categoria);
            insert.Parameters.AddWithValue("descripcion", dto.descripcion.Trim());
            insert.Parameters.AddWithValue("presupuesto", dto.presupuesto);
            insert.Parameters.Add("fecha", NpgsqlDbType.Date).Value = (object?)dto.fecha_deseada ?? DBNull.Value;
            insert.Parameters.Add("hora", NpgsqlDbType.Time).Value =
                dto.hora_deseada == null ? DBNull.Value : TimeOnly.ParseExact(dto.hora_deseada, "HH:mm");
            insert.Parameters.Add("campos", NpgsqlDbType.Jsonb).Value = JsonSerializer.Serialize(campos);
            idSolicitud = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(new { error = "Ya tienes una solicitud activa para este servicio" });
        }

        // Chat entre cliente y proveedor con un mensaje del sistema que resume la solicitud.
        var mensaje = $"Nueva solicitud para \"{titulo}\".\nPresupuesto: ${dto.presupuesto:N0}" +
            (dto.fecha_deseada is { } f ? $"\nFecha deseada: {f:dd/MM/yyyy}" : "") + $"\n\n{dto.descripcion.Trim()}";
        await using var chat = new NpgsqlCommand("""
            WITH c AS (
              INSERT INTO chats(id_usuario1, id_usuario2, ultimo_mensaje) VALUES (@u1, @u2, now())
              ON CONFLICT (id_usuario1, id_usuario2) DO UPDATE SET ultimo_mensaje = now()
              RETURNING id_chat)
            INSERT INTO mensajes(id_chat, id_remitente, id_destinatario, mensaje, tipo)
            SELECT id_chat, @cliente, @proveedor, @mensaje, 'sistema' FROM c
            RETURNING id_chat
            """, conn, tx);
        chat.Parameters.AddWithValue("u1", Math.Min(UserId, idProveedor));
        chat.Parameters.AddWithValue("u2", Math.Max(UserId, idProveedor));
        chat.Parameters.AddWithValue("cliente", UserId);
        chat.Parameters.AddWithValue("proveedor", idProveedor);
        chat.Parameters.AddWithValue("mensaje", mensaje);
        var idChat = Convert.ToInt32(await chat.ExecuteScalarAsync(ct));
        await tx.CommitAsync(ct);

        await chatHub.Clients.Group($"chat_{idChat}").SendAsync("RecibirMensaje", new
        {
            id_chat = idChat, id_remitente = UserId, id_destinatario = idProveedor,
            mensaje, tipo = "sistema", fecha_envio = DateTime.UtcNow.ToString("o")
        }, ct);
        _ = Task.Run(async () =>
        {
            try
            {
                await email.EnviarNotificacionSolicitud(correoProveedor, Html(nombreProveedor), Html(nombreCliente),
                    Html(titulo), Html(categoria), Html(dto.descripcion.Trim()), dto.presupuesto.ToString("N0"));
            }
            catch (Exception ex) { Console.WriteLine($"[EMAIL] Error notificando solicitud: {ex.Message}"); }
        });

        return Created($"/api/solicitudes/{idSolicitud}", new { id_solicitud = idSolicitud, id_chat = idChat, estado = "Pendiente" });
    }

    [HttpGet("enviadas")]
    public Task<IActionResult> Enviadas([FromQuery] string? estado, CancellationToken ct) => Listar("id_cliente", estado, ct);

    [HttpGet("recibidas")]
    public Task<IActionResult> Recibidas([FromQuery] string? estado, CancellationToken ct) => Listar("id_proveedor", estado, ct);

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detalle(int id, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand(Select + " WHERE so.id_solicitud = @id AND (so.id_cliente = @user OR so.id_proveedor = @user)", conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? Ok(Fila(r)) : NotFound(new { error = "Solicitud no encontrada" });
    }

    [HttpPost("{id:int}/aceptar")]
    public Task<IActionResult> Aceptar(int id, AceptarSolicitudDTO dto, CancellationToken ct) =>
        Transicion(id, "id_proveedor", ["Pendiente"], "Aceptada", ", fue_aceptada = true, contraoferta = @extra",
            dto.contraoferta, NpgsqlDbType.Numeric, ct);

    [HttpPost("{id:int}/rechazar")]
    public Task<IActionResult> Rechazar(int id, RechazarSolicitudDTO dto, CancellationToken ct) =>
        Transicion(id, "id_proveedor", ["Pendiente"], "Rechazada", ", motivo_rechazo = @extra",
            dto.motivo.Trim(), NpgsqlDbType.Text, ct);

    [HttpPost("{id:int}/completar")]
    public Task<IActionResult> Completar(int id, CancellationToken ct) =>
        Transicion(id, "id_proveedor", ["Aceptada"], "Completada", "", null, NpgsqlDbType.Text, ct);

    [HttpPost("{id:int}/cancelar")]
    public Task<IActionResult> Cancelar(int id, CancellationToken ct) =>
        Transicion(id, "id_cliente", ["Pendiente", "Aceptada"], "Cancelada", "", null, NpgsqlDbType.Text, ct);

    // ── Auxiliares ──

    private const string Select = """
        SELECT so.id_solicitud, so.estado, so.descripcion, so.presupuesto, so.contraoferta, so.motivo_rechazo,
               so.fecha_deseada, so.hora_deseada, so.campos_personalizados::text AS campos,
               so.fecha_creacion, so.fecha_actualizacion,
               so.id_servicio, s.titulo AS titulo_servicio, c.nombre_categoria AS categoria,
               (SELECT i.url_imagen FROM servicios_imagenes i WHERE i.id_servicio = s.id_servicio ORDER BY i.orden LIMIT 1) AS imagen,
               so.id_cliente, cl.nombre AS nombre_cliente, cl.avatar AS avatar_cliente,
               so.id_proveedor, pr.nombre AS nombre_proveedor, pr.avatar AS avatar_proveedor,
               cal.id_calificacion
        FROM solicitudes so
        JOIN servicios s ON s.id_servicio = so.id_servicio
        LEFT JOIN categorias c ON c.id_categoria = s.id_categoria
        JOIN usuarios cl ON cl.id_usuario = so.id_cliente
        JOIN usuarios pr ON pr.id_usuario = so.id_proveedor
        LEFT JOIN calificaciones cal ON cal.id_cliente = so.id_cliente AND cal.id_servicio = so.id_servicio
        """;

    private static readonly string[] Estados = ["Pendiente", "Aceptada", "Rechazada", "Completada", "Cancelada"];

    private async Task<IActionResult> Listar(string columna, string? estado, CancellationToken ct)
    {
        if (estado != null && !Estados.Contains(estado)) return BadRequest(new { error = "Estado inválido" });
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand(Select + $"""
             WHERE so.{columna} = @user AND (@estado IS NULL OR so.estado = @estado)
            ORDER BY (so.estado IN ('Pendiente', 'Aceptada')) DESC, so.fecha_creacion DESC NULLS LAST, so.id_solicitud DESC
            LIMIT 200
            """, conn);
        cmd.Parameters.AddWithValue("user", UserId);
        cmd.Parameters.Add("estado", NpgsqlDbType.Text).Value = (object?)estado ?? DBNull.Value;
        var lista = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) lista.Add(Fila(r));
        return Ok(lista);
    }

    private object Fila(NpgsqlDataReader r)
    {
        var estado = r.Get<string>("estado")!;
        var idCalificacion = r.Get<int?>("id_calificacion");
        var soyCliente = r.Get<int>("id_cliente") == UserId;
        return new
        {
            id_solicitud = r.Get<int>("id_solicitud"),
            estado,
            rol = soyCliente ? "cliente" : "proveedor",
            descripcion = r.Get<string?>("descripcion"),
            presupuesto = r.Get<decimal?>("presupuesto"),
            contraoferta = r.Get<decimal?>("contraoferta"),
            motivo_rechazo = r.Get<string?>("motivo_rechazo"),
            fecha_deseada = r.Get<DateOnly?>("fecha_deseada"),
            hora_deseada = r.Get<TimeOnly?>("hora_deseada")?.ToString("HH:mm"),
            campos = JsonSerializer.Deserialize<JsonElement>(r.Get<string?>("campos") ?? "{}"),
            fecha_creacion = r.Utc("fecha_creacion"),
            fecha_actualizacion = r.Utc("fecha_actualizacion"),
            servicio = new
            {
                id_servicio = r.Get<int>("id_servicio"),
                titulo = r.Get<string>("titulo_servicio"),
                categoria = r.Get<string?>("categoria"),
                imagen = UrlPublica(r.Get<string?>("imagen"))
            },
            cliente = new { id_usuario = r.Get<int>("id_cliente"), nombre = r.Get<string>("nombre_cliente"), avatar = UrlPublica(r.Get<string?>("avatar_cliente")) },
            proveedor = new { id_usuario = r.Get<int>("id_proveedor"), nombre = r.Get<string>("nombre_proveedor"), avatar = UrlPublica(r.Get<string?>("avatar_proveedor")) },
            puede_calificar = soyCliente && estado == "Completada" && idCalificacion == null,
            id_calificacion = idCalificacion
        };
    }

    // Cambia el estado sólo si el usuario tiene el rol indicado y la solicitud está en un estado de origen válido.
    private async Task<IActionResult> Transicion(int id, string columnaRol, string[] desde, string hacia,
        string setExtra, object? extra, NpgsqlDbType tipoExtra, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand($"""
            UPDATE solicitudes SET estado = @hacia, fecha_actualizacion = now(){setExtra}
            WHERE id_solicitud = @id AND {columnaRol} = @user AND estado = ANY(@desde)
            RETURNING id_solicitud
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        cmd.Parameters.AddWithValue("hacia", hacia);
        cmd.Parameters.AddWithValue("desde", desde);
        if (setExtra.Contains("@extra")) cmd.Parameters.Add("extra", tipoExtra).Value = extra ?? DBNull.Value;
        if (await cmd.ExecuteScalarAsync(ct) != null) return Ok(new { ok = true, estado = hacia });

        await using var existe = new NpgsqlCommand(
            $"SELECT estado FROM solicitudes WHERE id_solicitud = @id AND {columnaRol} = @user", conn);
        existe.Parameters.AddWithValue("id", id);
        existe.Parameters.AddWithValue("user", UserId);
        return await existe.ExecuteScalarAsync(ct) is string actual
            ? Conflict(new { error = $"La solicitud está {actual.ToLowerInvariant()} y no admite esta acción" })
            : NotFound(new { error = "Solicitud no encontrada" });
    }
}
