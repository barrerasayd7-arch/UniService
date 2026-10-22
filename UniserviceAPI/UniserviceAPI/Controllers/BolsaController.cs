using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;

namespace UniserviceAPI.Controllers;

[ApiController, Authorize, ServiceFilter(typeof(ActiveStudentFilter))]
[Route("api/bolsa")]
public class BolsaController(IConfiguration config) : ControllerBase
{
    private int UserId => InstitutionalAccess.UserId(User)!.Value;
    private async Task<NpgsqlConnection> Connect(CancellationToken ct)
    {
        var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        try { await conn.OpenAsync(ct); return conn; }
        catch { await conn.DisposeAsync(); throw; }
    }
    private static async Task<List<Dictionary<string, object?>>> Read(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }
    private static async Task<bool> ValidSkills(int[] ids, NpgsqlConnection conn, NpgsqlTransaction tx, CancellationToken ct)
    {
        if (ids.Any(id => id <= 0) || ids.Distinct().Count() != ids.Length) return false;
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM habilidades WHERE id_habilidad = ANY(@ids)", conn, tx);
        cmd.Parameters.AddWithValue("ids", ids);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) == ids.Length;
    }
    private static void NullableMoney(NpgsqlCommand cmd, string name, decimal? value) =>
        cmd.Parameters.Add(name, NpgsqlDbType.Numeric).Value = (object?)value ?? DBNull.Value;

    [HttpGet("habilidades")]
    public async Task<IActionResult> Catalogo(CancellationToken ct)
    {
        await using var conn = await Connect(ct);
        await using var cmd = new NpgsqlCommand("SELECT id_habilidad, nombre FROM habilidades ORDER BY nombre", conn);
        return Ok(await Read(cmd, ct));
    }

    [HttpGet("perfiles/{id:int}/habilidades")]
    public async Task<IActionResult> Perfil(int id, CancellationToken ct)
    {
        
        await using var conn = await Connect(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT h.id_habilidad, h.nombre, uh.nivel, uh.detalle FROM usuario_habilidades uh
            JOIN habilidades h USING(id_habilidad) WHERE uh.id_usuario = @id ORDER BY h.nombre
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        return Ok(await Read(cmd, ct));
    }

    [HttpPut("mi-perfil/habilidades")]
    public async Task<IActionResult> Guardar(GuardarHabilidadesDTO dto, CancellationToken ct)
    {
        await using var conn = await Connect(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (!await ValidSkills(dto.habilidades.Select(h => h.id_habilidad).ToArray(), conn, tx, ct))
            return BadRequest(new { error = "Habilidades duplicadas o inexistentes" });
        // Serializa dos reemplazos concurrentes de un mismo perfil.
        await using (var mutex = new NpgsqlCommand("SELECT id_usuario FROM usuarios WHERE id_usuario = @id FOR UPDATE", conn, tx))
        {
            mutex.Parameters.AddWithValue("id", UserId); await mutex.ExecuteScalarAsync(ct);
        }
        await using (var delete = new NpgsqlCommand("DELETE FROM usuario_habilidades WHERE id_usuario = @id", conn, tx))
        {
            delete.Parameters.AddWithValue("id", UserId); await delete.ExecuteNonQueryAsync(ct);
        }
        foreach (var skill in dto.habilidades)
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO usuario_habilidades(id_usuario, id_habilidad, nivel, detalle) VALUES (@id, @skill, @nivel, @detalle)
                """, conn, tx);
            insert.Parameters.AddWithValue("id", UserId); insert.Parameters.AddWithValue("skill", skill.id_habilidad);
            insert.Parameters.AddWithValue("nivel", skill.nivel); insert.Parameters.AddWithValue("detalle", skill.detalle.Trim());
            await insert.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return Ok(new { ok = true });
    }

    [HttpPost("peticiones")]
    public async Task<IActionResult> Crear(CrearPeticionDTO dto, CancellationToken ct)
    {
        if (dto.fecha_limite <= DateTimeOffset.UtcNow || dto.fecha_limite > DateTimeOffset.UtcNow.AddDays(90) ||
            dto.titulo.Trim().Length < 5 || dto.descripcion.Trim().Length < 20)
            return BadRequest(new { error = "Revisa los textos y el plazo: debe estar entre ahora y 90 días" });
        await using var conn = await Connect(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        if (!await ValidSkills(dto.habilidades, conn, tx, ct)) return BadRequest(new { error = "Habilidades inválidas" });
        await using var insert = new NpgsqlCommand("""
            INSERT INTO peticiones_servicio(id_autor, titulo, descripcion, presupuesto, modalidad, fecha_limite)
            VALUES (@autor, @titulo, @descripcion, @presupuesto, @modalidad, @limite) RETURNING id_peticion
            """, conn, tx);
        insert.Parameters.AddWithValue("autor", UserId); insert.Parameters.AddWithValue("titulo", dto.titulo.Trim());
        insert.Parameters.AddWithValue("descripcion", dto.descripcion.Trim()); NullableMoney(insert, "presupuesto", dto.presupuesto);
        insert.Parameters.AddWithValue("modalidad", dto.modalidad); insert.Parameters.AddWithValue("limite", dto.fecha_limite.UtcDateTime);
        var id = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
        await using var skills = new NpgsqlCommand("""
            INSERT INTO peticion_habilidades(id_peticion, id_habilidad) SELECT @id, unnest(@skills)
            """, conn, tx);
        skills.Parameters.AddWithValue("id", id); skills.Parameters.AddWithValue("skills", dto.habilidades);
        await skills.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return Created($"/api/bolsa/peticiones/{id}", new { id_peticion = id });
    }

    // Matching por al menos una habilidad; permite explorar todas o ver las propias.
    [HttpGet("peticiones")]
    public async Task<IActionResult> Feed([FromQuery] bool recomendadas = true, [FromQuery] bool propias = false,
        [FromQuery] int pagina = 1, [FromQuery] int limite = 20, CancellationToken ct = default)
    {
        if (pagina < 1 || pagina > 10000 || limite < 1 || limite > 50) return BadRequest(new { error = "Paginación inválida" });
        await using var conn = await Connect(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT p.*, u.nombre AS autor,
              ARRAY(SELECT h.nombre FROM peticion_habilidades ph JOIN habilidades h USING(id_habilidad)
                    WHERE ph.id_peticion = p.id_peticion ORDER BY h.nombre) AS habilidades,
              (SELECT count(*) FROM peticion_habilidades ph JOIN usuario_habilidades uh USING(id_habilidad)
                    WHERE ph.id_peticion = p.id_peticion AND uh.id_usuario = @user) AS coincidencias,
              EXISTS(SELECT 1 FROM postulaciones_servicio ps WHERE ps.id_peticion = p.id_peticion AND ps.id_usuario = @user) AS ya_postulado
            FROM peticiones_servicio p JOIN usuarios u ON u.id_usuario = p.id_autor
            WHERE u.estado = true AND
              ((@propias AND p.id_autor = @user) OR
               (NOT @propias AND p.estado = 'abierta' AND p.fecha_limite > now() AND p.id_autor <> @user
                AND (NOT @recomendadas OR EXISTS(
                    SELECT 1 FROM peticion_habilidades ph JOIN usuario_habilidades uh USING(id_habilidad)
                    WHERE ph.id_peticion = p.id_peticion AND uh.id_usuario = @user))))
            ORDER BY coincidencias DESC, p.creado_en DESC, p.id_peticion DESC LIMIT @limit OFFSET @offset
            """, conn);
        cmd.Parameters.AddWithValue("user", UserId); cmd.Parameters.AddWithValue("propias", propias);
        cmd.Parameters.AddWithValue("recomendadas", recomendadas); cmd.Parameters.AddWithValue("limit", limite);
        cmd.Parameters.AddWithValue("offset", (pagina - 1) * limite);
        return Ok(await Read(cmd, ct));
    }

    [HttpGet("peticiones/{id:int}")]
    public async Task<IActionResult> Detalle(int id, CancellationToken ct)
    {
        await using var conn = await Connect(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT p.*, u.nombre AS autor,
            ARRAY(SELECT id_habilidad FROM peticion_habilidades WHERE id_peticion = p.id_peticion) AS habilidades
            FROM peticiones_servicio p JOIN usuarios u ON u.id_usuario = p.id_autor WHERE p.id_peticion = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await Read(cmd, ct);
        return rows.Count == 0 ? NotFound() : Ok(rows[0]);
    }

    [HttpPost("peticiones/{id:int}/postulaciones")]
    public async Task<IActionResult> Postular(int id, CrearPostulacionDTO dto, CancellationToken ct)
    {
        if (dto.mensaje.Trim().Length < 10) return BadRequest(new { error = "Describe tu propuesta" });
        await using var conn = await Connect(ct); await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var check = new NpgsqlCommand("""
            SELECT id_autor, estado = 'abierta' AND fecha_limite > now() AS abierta
            FROM peticiones_servicio WHERE id_peticion = @id FOR UPDATE
            """, conn, tx))
        {
            check.Parameters.AddWithValue("id", id); await using var reader = await check.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return NotFound();
            if (reader.GetInt32(0) == UserId) return BadRequest(new { error = "No puedes postularte a tu petición" });
            if (!reader.GetBoolean(1)) return Conflict(new { error = "Petición cerrada o vencida" });
        }
        await using (var match = new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM peticion_habilidades ph JOIN usuario_habilidades uh USING(id_habilidad)
            WHERE ph.id_peticion = @id AND uh.id_usuario = @user)
            """, conn, tx))
        {
            match.Parameters.AddWithValue("id", id); match.Parameters.AddWithValue("user", UserId);
            if (await match.ExecuteScalarAsync(ct) is not true) return BadRequest(new { error = "Añade una habilidad relacionada a tu perfil" });
        }
        await using var insert = new NpgsqlCommand("""
            INSERT INTO postulaciones_servicio(id_peticion, id_usuario, mensaje, precio_propuesto)
            VALUES (@id, @user, @mensaje, @precio) ON CONFLICT (id_peticion, id_usuario) DO NOTHING RETURNING id_postulacion
            """, conn, tx);
        insert.Parameters.AddWithValue("id", id); insert.Parameters.AddWithValue("user", UserId);
        insert.Parameters.AddWithValue("mensaje", dto.mensaje.Trim()); NullableMoney(insert, "precio", dto.precio_propuesto);
        var result = await insert.ExecuteScalarAsync(ct);
        if (result == null) return Conflict(new { error = "Ya te postulaste" });
        await tx.CommitAsync(ct); return Ok(new { id_postulacion = result });
    }

    [HttpGet("peticiones/{id:int}/postulaciones")]
    public async Task<IActionResult> Postulaciones(int id, CancellationToken ct)
    {
        await using var conn = await Connect(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT ps.*, u.nombre FROM postulaciones_servicio ps JOIN usuarios u ON u.id_usuario = ps.id_usuario
            JOIN peticiones_servicio p USING(id_peticion)
            WHERE p.id_peticion = @id AND (p.id_autor = @user OR ps.id_usuario = @user)
            ORDER BY ps.creado_en, ps.id_postulacion LIMIT 200
            """, conn);
        cmd.Parameters.AddWithValue("id", id); cmd.Parameters.AddWithValue("user", UserId);
        return Ok(await Read(cmd, ct));
    }

    [HttpPost("peticiones/{id:int}/postulaciones/{postulacion:int}/aceptar")]
    public async Task<IActionResult> Aceptar(int id, int postulacion, CancellationToken ct)
    {
        await using var conn = await Connect(ct); await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var check = new NpgsqlCommand("""
            SELECT id_autor, estado = 'abierta' AND fecha_limite > now() FROM peticiones_servicio
            WHERE id_peticion = @id FOR UPDATE
            """, conn, tx))
        {
            check.Parameters.AddWithValue("id", id); await using var reader = await check.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return NotFound();
            if (reader.GetInt32(0) != UserId) return StatusCode(403);
            if (!reader.GetBoolean(1)) return Conflict(new { error = "Petición cerrada o vencida" });
        }
        int provider;
        await using (var selected = new NpgsqlCommand("""
            SELECT ps.id_usuario FROM postulaciones_servicio ps JOIN usuarios u ON u.id_usuario = ps.id_usuario
            WHERE ps.id_postulacion = @post AND ps.id_peticion = @id AND ps.estado = 'pendiente'
            AND u.estado = true AND (
              EXISTS (SELECT 1 FROM verificaciones_correo_institucional v WHERE v.id_usuario = u.id_usuario
                AND v.correo = lower(trim(u.correo)) AND v.verificado_hasta > now())
              OR EXISTS (SELECT 1 FROM identidades_institucionales i WHERE i.id_usuario = u.id_usuario AND i.verificado_hasta > now())
            )
            """, conn, tx))
        {
            selected.Parameters.AddWithValue("post", postulacion); selected.Parameters.AddWithValue("id", id);
            var result = await selected.ExecuteScalarAsync(ct);
            if (result == null) return Conflict(new { error = "Postulación no disponible o correo institucional sin verificación vigente" });
            provider = Convert.ToInt32(result);
        }
        await using (var update = new NpgsqlCommand("""
            UPDATE postulaciones_servicio SET estado = CASE WHEN id_postulacion = @post THEN 'aceptada' ELSE 'rechazada' END
            WHERE id_peticion = @id AND estado = 'pendiente';
            UPDATE peticiones_servicio SET estado = 'asignada' WHERE id_peticion = @id
            """, conn, tx))
        {
            update.Parameters.AddWithValue("post", postulacion); update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
        }
        await using var chat = new NpgsqlCommand("""
            INSERT INTO chats(id_usuario1, id_usuario2) VALUES (@u1, @u2)
            ON CONFLICT (id_usuario1, id_usuario2) DO UPDATE SET id_usuario1 = EXCLUDED.id_usuario1 RETURNING id_chat
            """, conn, tx);
        chat.Parameters.AddWithValue("u1", Math.Min(UserId, provider)); chat.Parameters.AddWithValue("u2", Math.Max(UserId, provider));
        var chatId = await chat.ExecuteScalarAsync(ct);
        await tx.CommitAsync(ct); return Ok(new { ok = true, id_chat = chatId });
    }

    [HttpPatch("peticiones/{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, EstadoPeticionDTO dto, CancellationToken ct)
    {
        await using var conn = await Connect(ct); await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE peticiones_servicio SET estado = @estado WHERE id_peticion = @id AND id_autor = @user
            AND ((@estado = 'cancelada' AND estado IN ('abierta', 'asignada')) OR (@estado = 'completada' AND estado = 'asignada'))
            RETURNING id_peticion
            """, conn, tx);
        cmd.Parameters.AddWithValue("id", id); cmd.Parameters.AddWithValue("user", UserId); cmd.Parameters.AddWithValue("estado", dto.estado);
        if (await cmd.ExecuteScalarAsync(ct) == null) return Conflict(new { error = "No puedes cambiar el estado de esta petición" });
        if (dto.estado == "cancelada")
        {
            await using var reject = new NpgsqlCommand("UPDATE postulaciones_servicio SET estado = 'rechazada' WHERE id_peticion = @id", conn, tx);
            reject.Parameters.AddWithValue("id", id); await reject.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct); return Ok(new { ok = true });
    }
}
