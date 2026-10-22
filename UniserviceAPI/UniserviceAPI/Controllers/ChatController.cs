using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using UniserviceAPI.Hubs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Chat entre dos usuarios. Quién escribe y quién lee sale siempre del JWT, y cada operación
// sobre un chat comprueba que el usuario es uno de sus dos participantes. Un chat ajeno
// responde 404 (igual que uno inexistente) para no revelar qué chats existen.
[ApiController, Route("api/chat")]
public sealed class ChatController(IConfiguration config, IHubContext<ChatHub> hub) : ControllerBase
{
    public const int MaxLargoMensaje = 2000;
    private int Yo => InstitutionalAccess.UserId(User)!.Value;

    public sealed record IniciarChatDTO(int id_usuario);
    public sealed record EnviarMensajeDTO(string? mensaje);

    // Crea (o devuelve) el chat con otro usuario activo. Requiere correo institucional verificado.
    [HttpPost("iniciar"), EnableRateLimiting("Chat"), ServiceFilter(typeof(ActiveStudentFilter))]
    public async Task<IActionResult> Iniciar(IniciarChatDTO dto, CancellationToken ct)
    {
        if (dto.id_usuario == Yo) return BadRequest(new { error = "No puedes chatear contigo mismo" });
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            WITH otro AS (SELECT id_usuario FROM usuarios WHERE id_usuario = @otro AND estado IS TRUE),
            nuevo AS (
              INSERT INTO chats(id_usuario1, id_usuario2)
              SELECT least(@yo, id_usuario), greatest(@yo, id_usuario) FROM otro
              ON CONFLICT (id_usuario1, id_usuario2) DO NOTHING
              RETURNING id_chat)
            SELECT id_chat FROM nuevo
            UNION ALL
            SELECT c.id_chat FROM chats c, otro
            WHERE c.id_usuario1 = least(@yo, otro.id_usuario) AND c.id_usuario2 = greatest(@yo, otro.id_usuario)
            LIMIT 1
            """, conn);
        cmd.Parameters.AddWithValue("yo", Yo);
        cmd.Parameters.AddWithValue("otro", dto.id_usuario);
        var id = await cmd.ExecuteScalarAsync(ct);
        return id == null ? NotFound(new { error = "Usuario no encontrado" }) : Ok(new { id_chat = Convert.ToInt32(id) });
    }

    [HttpGet("mis-chats")]
    public async Task<IActionResult> MisChats(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT c.id_chat, c.fecha_creacion, u.id_usuario AS id_otro, u.nombre, u.avatar,
                   u.estado IS TRUE AS otro_activo, u.ultima_actividad,
                   ult.mensaje AS ultimo_mensaje, ult.tipo AS ultimo_tipo, ult.fecha_envio AS ultimo_fecha,
                   ult.id_remitente AS ultimo_remitente,
                   (SELECT count(*) FROM mensajes m WHERE m.id_chat = c.id_chat AND m.id_destinatario = @yo AND m.leido = false) AS no_leidos
            FROM chats c
            JOIN usuarios u ON u.id_usuario = CASE WHEN c.id_usuario1 = @yo THEN c.id_usuario2 ELSE c.id_usuario1 END
            LEFT JOIN LATERAL (
              SELECT m.mensaje, m.tipo, m.fecha_envio, m.id_remitente FROM mensajes m
              WHERE m.id_chat = c.id_chat ORDER BY m.id_mensaje DESC LIMIT 1
            ) ult ON true
            WHERE @yo IN (c.id_usuario1, c.id_usuario2)
            ORDER BY COALESCE(ult.fecha_envio, c.ultimo_mensaje, c.fecha_creacion) DESC NULLS LAST
            LIMIT 200
            """, conn);
        cmd.Parameters.AddWithValue("yo", Yo);
        var chats = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            var activo = r.Get<bool>("otro_activo");
            var actividad = r.Utc("ultima_actividad");
            chats.Add(new
            {
                id_chat = r.Get<int>("id_chat"),
                otro = new
                {
                    id = r.Get<int>("id_otro"),
                    // Si la otra cuenta está suspendida se muestra el chat, pero no sus datos.
                    nombre = activo ? r.Get<string>("nombre") : "Usuario no disponible",
                    avatar = activo ? UrlPublica(r.Get<string?>("avatar")) : null,
                    disponible = activo,
                    en_linea = activo && actividad > DateTime.UtcNow.AddMinutes(-2)
                },
                ultimo_mensaje = r.Get<string?>("ultimo_mensaje"),
                ultimo_tipo = r.Get<string?>("ultimo_tipo"),
                ultimo_fecha = r.Utc("ultimo_fecha"),
                ultimo_es_mio = r.Get<int?>("ultimo_remitente") == Yo,
                no_leidos = r.Get<long>("no_leidos"),
                fecha_creacion = r.Utc("fecha_creacion")
            });
        }
        return Ok(chats);
    }

    // Mensajes de un chat, del más antiguo al más nuevo. Paginación hacia atrás con ?antes={id_mensaje}.
    [HttpGet("{idChat:int}/mensajes")]
    public async Task<IActionResult> Mensajes(int idChat, int? antes, int limite = 50, CancellationToken ct = default)
    {
        limite = Math.Clamp(limite, 1, 100);
        await using var conn = await Open(config, ct);
        if (await OtroParticipante(conn, idChat, ct) == null) return NotFound(new { error = "Chat no encontrado" });

        await using var cmd = new NpgsqlCommand("""
            SELECT * FROM (
              SELECT id_mensaje, id_remitente, mensaje, tipo, leido, fecha_envio FROM mensajes
              WHERE id_chat = @chat AND (@antes::int IS NULL OR id_mensaje < @antes)
              ORDER BY id_mensaje DESC LIMIT @limite
            ) m ORDER BY id_mensaje
            """, conn);
        cmd.Parameters.AddWithValue("chat", idChat);
        cmd.Parameters.Add(new NpgsqlParameter("antes", NpgsqlTypes.NpgsqlDbType.Integer) { Value = (object?)antes ?? DBNull.Value });
        cmd.Parameters.AddWithValue("limite", limite);
        var mensajes = new List<object>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            mensajes.Add(Mensaje(r.Get<int>("id_mensaje"), idChat, r.Get<int>("id_remitente"), r.Get<string>("mensaje")!,
                r.Get<string?>("tipo") ?? "texto", r.Get<bool?>("leido") ?? false, r.Utc("fecha_envio")));
        return Ok(mensajes);
    }

    [HttpPost("{idChat:int}/mensajes"), EnableRateLimiting("Chat"), ServiceFilter(typeof(ActiveStudentFilter)), RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Enviar(int idChat, EnviarMensajeDTO dto, CancellationToken ct)
    {
        var texto = Entrada.Texto(dto.mensaje, MaxLargoMensaje, multilinea: true);
        if (string.IsNullOrEmpty(texto))
            return BadRequest(new { error = $"El mensaje debe tener entre 1 y {MaxLargoMensaje} caracteres" });

        await using var conn = await Open(config, ct);
        if (await OtroParticipante(conn, idChat, ct) is not { } otro) return NotFound(new { error = "Chat no encontrado" });
        if (!otro.Activo) return Conflict(new { error = "Este usuario ya no está disponible" });

        await using var tx = await conn.BeginTransactionAsync(ct);
        int idMensaje;
        DateTime? fecha;
        await using (var cmd = new NpgsqlCommand("""
            INSERT INTO mensajes(id_chat, id_remitente, id_destinatario, mensaje, tipo, fecha_envio)
            VALUES (@chat, @yo, @otro, @mensaje, 'texto', (now() AT TIME ZONE 'utc'))
            RETURNING id_mensaje, fecha_envio
            """, conn, tx))
        {
            cmd.Parameters.AddWithValue("chat", idChat);
            cmd.Parameters.AddWithValue("yo", Yo);
            cmd.Parameters.AddWithValue("otro", otro.Id);
            cmd.Parameters.AddWithValue("mensaje", texto);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            idMensaje = r.Get<int>("id_mensaje");
            fecha = r.Utc("fecha_envio");
        }
        await using (var cmd = new NpgsqlCommand("UPDATE chats SET ultimo_mensaje = now() WHERE id_chat = @chat", conn, tx))
        {
            cmd.Parameters.AddWithValue("chat", idChat);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);

        var mensaje = Mensaje(idMensaje, idChat, Yo, texto, "texto", false, fecha);
        // Sólo a los dos participantes (todas sus conexiones), nunca a todos los conectados.
        await hub.Clients.Groups(ChatHub.GrupoUsuario(Yo), ChatHub.GrupoUsuario(otro.Id)).SendAsync("RecibirMensaje", mensaje, ct);
        return Ok(mensaje);
    }

    [HttpPut("{idChat:int}/leido")]
    public async Task<IActionResult> MarcarLeido(int idChat, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        if (await OtroParticipante(conn, idChat, ct) is not { } otro) return NotFound(new { error = "Chat no encontrado" });
        await using var cmd = new NpgsqlCommand(
            "UPDATE mensajes SET leido = true WHERE id_chat = @chat AND id_destinatario = @yo AND leido = false", conn);
        cmd.Parameters.AddWithValue("chat", idChat);
        cmd.Parameters.AddWithValue("yo", Yo);
        var marcados = await cmd.ExecuteNonQueryAsync(ct);
        if (marcados > 0)
            await hub.Clients.Group(ChatHub.GrupoUsuario(otro.Id)).SendAsync("MensajesLeidos", new { id_chat = idChat }, ct);
        return Ok(new { marcados });
    }

    [HttpGet("no-leidos")]
    public async Task<IActionResult> NoLeidos(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT count(*) FROM mensajes WHERE id_destinatario = @yo AND leido = false", conn);
        cmd.Parameters.AddWithValue("yo", Yo);
        return Ok(new { no_leidos = (long)(await cmd.ExecuteScalarAsync(ct))! });
    }

    [HttpPut("actividad")]
    public async Task<IActionResult> Actividad(CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("UPDATE usuarios SET ultima_actividad = now() WHERE id_usuario = @yo", conn);
        cmd.Parameters.AddWithValue("yo", Yo);
        await cmd.ExecuteNonQueryAsync(ct);
        return Ok(new { ok = true });
    }

    private sealed record Participante(int Id, bool Activo);

    // El otro participante del chat si el usuario actual es parte de él; null si no (o si no existe).
    private async Task<Participante?> OtroParticipante(NpgsqlConnection conn, int idChat, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT u.id_usuario, u.estado IS TRUE FROM chats c
            JOIN usuarios u ON u.id_usuario = CASE WHEN c.id_usuario1 = @yo THEN c.id_usuario2 ELSE c.id_usuario1 END
            WHERE c.id_chat = @chat AND @yo IN (c.id_usuario1, c.id_usuario2)
            """, conn);
        cmd.Parameters.AddWithValue("chat", idChat);
        cmd.Parameters.AddWithValue("yo", Yo);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? new(r.GetInt32(0), r.GetBoolean(1)) : null;
    }

    // Mismo formato para la respuesta REST y para SignalR (que llega a ambos participantes,
    // por eso no lleva "es_mio": el cliente compara id_remitente con su propio id).
    private static object Mensaje(int id, int idChat, int remitente, string texto, string tipo, bool leido, DateTime? fecha) => new
    {
        id_mensaje = id, id_chat = idChat, id_remitente = remitente,
        mensaje = texto, tipo, leido, fecha_envio = fecha
    };
}
