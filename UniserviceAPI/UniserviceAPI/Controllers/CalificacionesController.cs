using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;
using static UniserviceAPI.Services.ServiciosComun;

namespace UniserviceAPI.Controllers;

// Reseñas: sólo el cliente de una solicitud Completada puede calificar, una vez por servicio.
// Las reseñas de un servicio se leen en GET /api/servicios/{id}.
[ApiController, Route("api/calificaciones")]
public class CalificacionesController(IConfiguration config) : ControllerBase
{
    private int UserId => InstitutionalAccess.UserId(User)!.Value;

    // Para mostrar u ocultar el formulario de reseña en el detalle del servicio.
    [HttpGet("estado")]
    public async Task<IActionResult> Estado([FromQuery] int id_servicio, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM solicitudes WHERE id_cliente = @user AND id_servicio = @servicio AND estado = 'Completada')
                     AS completada,
                   c.id_calificacion, c.puntuacion, c.comentario, c.fecha_calificacion, c.fecha_modificacion
            FROM (SELECT 1) x
            LEFT JOIN calificaciones c ON c.id_cliente = @user AND c.id_servicio = @servicio
            """, conn);
        cmd.Parameters.AddWithValue("user", UserId);
        cmd.Parameters.AddWithValue("servicio", id_servicio);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        await r.ReadAsync(ct);
        var idCalificacion = r.Get<int?>("id_calificacion");
        return Ok(new
        {
            puede_calificar = r.Get<bool>("completada") && idCalificacion == null,
            ya_califico = idCalificacion != null,
            mi_calificacion = idCalificacion == null ? null : new
            {
                id_calificacion = idCalificacion,
                puntuacion = (int)r.Get<short>("puntuacion"),
                comentario = r.Get<string?>("comentario"),
                fecha = r.Utc("fecha_calificacion"),
                editada = r.Get<DateTime?>("fecha_modificacion") != null
            }
        });
    }

    [HttpPost, ServiceFilter(typeof(ActiveStudentFilter))]
    public async Task<IActionResult> Crear(CrearCalificacionDTO dto, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        try
        {
            // La solicitud completada más reciente del usuario para ese servicio respalda la reseña.
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO calificaciones(id_solicitud, id_cliente, id_servicio, puntuacion, comentario)
                SELECT so.id_solicitud, @user, @servicio, @puntuacion, @comentario
                FROM solicitudes so
                WHERE so.id_cliente = @user AND so.id_servicio = @servicio AND so.estado = 'Completada'
                ORDER BY so.id_solicitud DESC LIMIT 1
                RETURNING id_calificacion
                """, conn);
            cmd.Parameters.AddWithValue("user", UserId);
            cmd.Parameters.AddWithValue("servicio", dto.id_servicio);
            Contenido(cmd, dto);
            var id = await cmd.ExecuteScalarAsync(ct);
            if (id == null)
                return StatusCode(403, new { error = "Sólo puedes calificar servicios que el proveedor marcó como completados" });
            return Created($"/api/calificaciones/{id}", new { id_calificacion = id });
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(new { error = "Ya calificaste este servicio; puedes editar tu reseña" });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Editar(int id, GuardarCalificacionDTO dto, CancellationToken ct)
    {
        await using var conn = await Open(config, ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE calificaciones SET puntuacion = @puntuacion, comentario = @comentario, fecha_modificacion = now()
            WHERE id_calificacion = @id AND id_cliente = @user
            RETURNING id_calificacion
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("user", UserId);
        Contenido(cmd, dto);
        return await cmd.ExecuteScalarAsync(ct) == null
            ? NotFound(new { error = "Reseña no encontrada" })
            : Ok(new { ok = true });
    }

    private static void Contenido(NpgsqlCommand cmd, GuardarCalificacionDTO dto)
    {
        cmd.Parameters.AddWithValue("puntuacion", (short)dto.puntuacion);
        cmd.Parameters.Add("comentario", NpgsqlDbType.Text).Value =
            string.IsNullOrWhiteSpace(dto.comentario) ? DBNull.Value : dto.comentario.Trim();
    }
}
