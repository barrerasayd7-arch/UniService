using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using NpgsqlTypes;
using UniserviceAPI.DTOs;
using UniserviceAPI.Services;

namespace UniserviceAPI.Controllers;

// Login exclusivo del panel: sólo acepta cuentas con id_rol = 1 y activas.
[ApiController, Route("api/admin/auth"), AllowAnonymous]
[EnableRateLimiting("AdminLogin")]
public sealed class AdminAuthController(IConfiguration config) : ControllerBase
{
    // Se verifica aunque el correo no exista para no revelar qué cuentas existen por tiempo de respuesta.
    private static readonly Lazy<string> DummyHash = new(() => BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()));

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDTO dto, CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);

        int id = 0, rol = 0;
        string? nombre = null, correo = null, hash = null;
        bool activa = false;
        await using (var cmd = new NpgsqlCommand("""
            SELECT id_usuario, nombre, correo, password_hash, estado IS TRUE, COALESCE(id_rol, 2)
            FROM usuarios WHERE lower(trim(correo)) = @correo
            """, conn))
        {
            cmd.Parameters.AddWithValue("correo", dto.correo.Trim().ToLowerInvariant());
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                id = reader.GetInt32(0);
                nombre = reader.IsDBNull(1) ? null : reader.GetString(1);
                correo = reader.IsDBNull(2) ? null : reader.GetString(2);
                hash = reader.IsDBNull(3) ? null : reader.GetString(3).Trim();
                activa = reader.GetBoolean(4);
                rol = reader.GetInt32(5);
            }
        }

        var passwordOk = BCrypt.Net.BCrypt.Verify(dto.password, string.IsNullOrEmpty(hash) ? DummyHash.Value : hash)
            && !string.IsNullOrEmpty(hash);
        if (!passwordOk || rol != 1)
            return Unauthorized(new { error = "Credenciales inválidas" });
        if (!activa)
            return StatusCode(403, new { error = "Esta cuenta de administrador está desactivada" });

        await using (var cmd = new NpgsqlCommand("""
            UPDATE usuarios SET ultima_actividad = NOW() WHERE id_usuario = @id;
            INSERT INTO auditoria_admin(id_admin, accion, entidad, id_entidad) VALUES (@id, 'login', 'admin', @id);
            """, conn))
        {
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        var ahora = DateTime.UtcNow;
        var expires = ahora.AddHours(8);

        return Ok(new
        {
            token = Sesiones.Emitir(config, id, 1, ahora, expires),
            expires_at = expires,
            admin = new { id, nombre, correo }
        });
    }
}

[ApiController, Route("api/admin"), AdminOnly]
public sealed class AdminController(IConfiguration config, AccountStatus accounts, EmailService email) : ControllerBase
{
    private int AdminId => InstitutionalAccess.UserId(User)!.Value;

    private async Task<NpgsqlConnection> Open(CancellationToken ct)
    {
        var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        return conn;
    }

    private static void Param(NpgsqlCommand cmd, string name, NpgsqlDbType type, object? value) =>
        cmd.Parameters.Add(new NpgsqlParameter(name, type) { Value = value ?? DBNull.Value });

    private static Dictionary<string, object?> Row(NpgsqlDataReader r)
    {
        var row = new Dictionary<string, object?>(r.FieldCount);
        for (var i = 0; i < r.FieldCount; i++) row[r.GetName(i)] = r.IsDBNull(i) ? null : r.GetValue(i);
        return row;
    }

    private static async Task<List<Dictionary<string, object?>>> Rows(NpgsqlCommand cmd, CancellationToken ct)
    {
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(Row(reader));
        return rows;
    }

    // La consulta debe incluir "count(*) OVER() AS total_filas" y "LIMIT @limit OFFSET @offset".
    private static async Task<object> Paged(NpgsqlCommand cmd, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        cmd.Parameters.AddWithValue("limit", pageSize);
        cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        var items = await Rows(cmd, ct);
        var total = items.Count > 0 ? Convert.ToInt64(items[0]["total_filas"]) : 0;
        foreach (var item in items) item.Remove("total_filas");
        return new { items, total, page, pageSize };
    }

    private async Task Audit(NpgsqlConnection conn, NpgsqlTransaction? tx, string accion, string entidad, int idEntidad, string? detalle, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO auditoria_admin(id_admin, accion, entidad, id_entidad, detalle)
            VALUES (@admin, @accion, @entidad, @id, @detalle)
            """, conn, tx);
        cmd.Parameters.AddWithValue("admin", AdminId);
        cmd.Parameters.AddWithValue("accion", accion);
        cmd.Parameters.AddWithValue("entidad", entidad);
        cmd.Parameters.AddWithValue("id", idEntidad);
        Param(cmd, "detalle", NpgsqlDbType.Text, detalle);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // =========================
    // SESIÓN Y RESUMEN
    // =========================
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id_usuario AS id, nombre, correo, ultima_actividad FROM usuarios WHERE id_usuario = @id", conn);
        cmd.Parameters.AddWithValue("id", AdminId);
        return Ok((await Rows(cmd, ct)).FirstOrDefault());
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var totals = new NpgsqlCommand("""
            SELECT
              (SELECT count(*) FROM usuarios) AS usuarios_total,
              (SELECT count(*) FROM usuarios WHERE estado IS TRUE) AS usuarios_activos,
              (SELECT count(*) FROM usuarios WHERE estado IS NOT TRUE) AS usuarios_suspendidos,
              (SELECT count(*) FROM usuarios WHERE fecha_registro >= now() - interval '7 days') AS usuarios_nuevos_7d,
              (SELECT count(*) FROM usuarios WHERE id_rol = 1) AS administradores,
              (SELECT count(*) FROM servicios) AS servicios_total,
              (SELECT count(*) FROM servicios WHERE estado = 'aprobado') AS servicios_publicados,
              (SELECT count(*) FROM servicios WHERE estado = 'pendiente') AS servicios_pendientes,
              (SELECT count(*) FROM reportes WHERE estado IN ('Pendiente', 'En_revision')) AS reportes_abiertos
            """, conn);
        var resumen = (await Rows(totals, ct)).Single();

        async Task<Dictionary<string, long>> PorEstado(string tabla)
        {
            await using var cmd = new NpgsqlCommand(
                $"SELECT COALESCE(estado, 'Sin estado'), count(*) FROM {tabla} GROUP BY 1 ORDER BY 1", conn);
            var result = new Dictionary<string, long>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) result[reader.GetString(0)] = reader.GetInt64(1);
            return result;
        }

        return Ok(new
        {
            resumen,
            solicitudes_por_estado = await PorEstado("solicitudes"),
            reportes_por_estado = await PorEstado("reportes")
        });
    }

    // =========================
    // USUARIOS
    // =========================
    [HttpGet("usuarios")]
    public async Task<IActionResult> Usuarios([FromQuery] string? busqueda, [FromQuery] string? estado, [FromQuery] int? rol,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (estado is not (null or "" or "activos" or "suspendidos"))
            return BadRequest(new { error = "estado debe ser 'activos' o 'suspendidos'" });
        bool? activa = string.IsNullOrEmpty(estado) ? null : estado == "activos";
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.id_rol, u.estado IS TRUE AS activa,
                   u.fecha_registro, u.ultima_actividad, u.motivo_suspension, u.suspendido_en,
                   (SELECT count(*) FROM servicios s WHERE s.id_proveedor = u.id_usuario) AS total_servicios,
                   (SELECT count(*) FROM reportes r WHERE r.id_usuario_reportado = u.id_usuario) AS reportes_recibidos,
                   count(*) OVER() AS total_filas
            FROM usuarios u
            WHERE (@q IS NULL OR u.nombre ILIKE '%' || @q || '%' OR u.correo ILIKE '%' || @q || '%')
              AND (@activa IS NULL OR (u.estado IS TRUE) = @activa)
              AND (@rol IS NULL OR u.id_rol = @rol)
            ORDER BY u.id_usuario DESC
            LIMIT @limit OFFSET @offset
            """, conn);
        Param(cmd, "q", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(busqueda) ? null : busqueda.Trim());
        Param(cmd, "activa", NpgsqlDbType.Boolean, activa);
        Param(cmd, "rol", NpgsqlDbType.Integer, rol);
        return Ok(await Paged(cmd, page, pageSize, ct));
    }

    [HttpGet("usuarios/{id:int}")]
    public async Task<IActionResult> Usuario(int id, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.universidad, u.descripcion, u.avatar, u.id_rol,
                   u.estado IS TRUE AS activa, u.fecha_registro, u.ultima_actividad,
                   u.motivo_suspension, u.suspendido_en, u.suspendido_por, a.nombre AS suspendido_por_nombre,
                   (SELECT count(*) FROM servicios WHERE id_proveedor = u.id_usuario) AS total_servicios,
                   (SELECT count(*) FROM solicitudes WHERE id_cliente = u.id_usuario) AS solicitudes_enviadas,
                   (SELECT count(*) FROM solicitudes WHERE id_proveedor = u.id_usuario) AS solicitudes_recibidas,
                   (SELECT count(*) FROM reportes WHERE id_usuario_reportado = u.id_usuario) AS reportes_recibidos,
                   (SELECT count(*) FROM reportes WHERE id_usuario = u.id_usuario) AS reportes_enviados
            FROM usuarios u LEFT JOIN usuarios a ON a.id_usuario = u.suspendido_por
            WHERE u.id_usuario = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        var usuario = (await Rows(cmd, ct)).FirstOrDefault();
        if (usuario == null) return NotFound(new { error = "Usuario no encontrado" });

        await using var reportes = new NpgsqlCommand("""
            SELECT id_reporte, tipo_reporte, titulo, estado, fecha_creacion
            FROM reportes WHERE id_usuario_reportado = @id ORDER BY fecha_creacion DESC LIMIT 10
            """, conn);
        reportes.Parameters.AddWithValue("id", id);
        await using var servicios = new NpgsqlCommand("""
            SELECT id_servicio, titulo, estado, estado = 'aprobado' AS publicado, motivo_rechazo, fecha_publicacion
            FROM servicios WHERE id_proveedor = @id ORDER BY fecha_publicacion DESC NULLS LAST LIMIT 20
            """, conn);
        servicios.Parameters.AddWithValue("id", id);

        return Ok(new
        {
            usuario,
            reportes_recibidos = await Rows(reportes, ct),
            servicios = await Rows(servicios, ct)
        });
    }

    [HttpPatch("usuarios/{id:int}/suspender")]
    public async Task<IActionResult> Suspender(int id, AdminMotivoRequest dto, CancellationToken ct)
    {
        if (id == AdminId) return BadRequest(new { error = "No puedes suspender tu propia cuenta" });
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        int rol; bool activa;
        await using (var check = new NpgsqlCommand(
            "SELECT COALESCE(id_rol, 2), estado IS TRUE FROM usuarios WHERE id_usuario = @id FOR UPDATE", conn, tx))
        {
            check.Parameters.AddWithValue("id", id);
            await using var reader = await check.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return NotFound(new { error = "Usuario no encontrado" });
            rol = reader.GetInt32(0); activa = reader.GetBoolean(1);
        }
        if (rol == 1) return StatusCode(403, new { error = "No puedes suspender a otro administrador" });
        if (!activa) return Conflict(new { error = "La cuenta ya está suspendida" });

        var motivo = dto.motivo.Trim();
        await using (var update = new NpgsqlCommand("""
            UPDATE usuarios SET estado = false, motivo_suspension = @motivo, suspendido_en = now(), suspendido_por = @admin
            WHERE id_usuario = @id
            """, conn, tx))
        {
            update.Parameters.AddWithValue("motivo", motivo);
            update.Parameters.AddWithValue("admin", AdminId);
            update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
        }
        await Audit(conn, tx, "suspender", "usuario", id, motivo, ct);
        await tx.CommitAsync(ct);
        accounts.Invalidate(id);
        return Ok(new { ok = true });
    }

    [HttpPatch("usuarios/{id:int}/reactivar")]
    public async Task<IActionResult> Reactivar(int id, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var update = new NpgsqlCommand("""
            UPDATE usuarios SET estado = true, motivo_suspension = NULL, suspendido_en = NULL, suspendido_por = NULL
            WHERE id_usuario = @id AND estado IS NOT TRUE
            """, conn, tx))
        {
            update.Parameters.AddWithValue("id", id);
            if (await update.ExecuteNonQueryAsync(ct) == 0)
            {
                await using var exists = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id)", conn, tx);
                exists.Parameters.AddWithValue("id", id);
                return await exists.ExecuteScalarAsync(ct) is true
                    ? Conflict(new { error = "La cuenta ya está activa" })
                    : NotFound(new { error = "Usuario no encontrado" });
            }
        }
        await Audit(conn, tx, "reactivar", "usuario", id, null, ct);
        await tx.CommitAsync(ct);
        accounts.Invalidate(id);
        return Ok(new { ok = true });
    }

    // =========================
    // SERVICIOS
    // estado: pendiente (espera revisión) → aprobado (público) ⇄ pausado (lo pausa el proveedor).
    // Rechazar u ocultar deja el servicio en 'rechazado' con motivo; el proveedor puede corregirlo
    // y vuelve a 'pendiente'. Ya no se borra nada al moderar.
    // =========================
    private static readonly string[] EstadosServicio = ["pendiente", "aprobado", "rechazado", "pausado"];

    [HttpGet("servicios")]
    public async Task<IActionResult> Servicios([FromQuery] string? estado, [FromQuery] string? busqueda,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        // 'publicados' y 'pendientes' se mantienen por compatibilidad con el panel.
        estado = estado switch { "publicados" => "aprobado", "pendientes" => "pendiente", "" => null, _ => estado };
        if (estado != null && !EstadosServicio.Contains(estado))
            return BadRequest(new { error = "estado debe ser pendiente, aprobado, rechazado o pausado" });
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT s.id_servicio, s.titulo, s.descripcion, s.precio_hora, s.unidad_precio, s.estado,
                   s.estado = 'aprobado' AS publicado, s.motivo_rechazo, s.revisado_en, s.fecha_publicacion, c.nombre_categoria,
                   s.id_proveedor, u.nombre AS proveedor, u.correo AS correo_proveedor, u.estado IS TRUE AS proveedor_activo,
                   (SELECT i.url_imagen FROM servicios_imagenes i WHERE i.id_servicio = s.id_servicio ORDER BY i.orden LIMIT 1) AS imagen,
                   (SELECT count(*) FROM reportes r WHERE r.id_servicio = s.id_servicio) AS reportes,
                   count(*) OVER() AS total_filas
            FROM servicios s
            LEFT JOIN usuarios u ON u.id_usuario = s.id_proveedor
            LEFT JOIN categorias c ON c.id_categoria = s.id_categoria
            WHERE (@estado IS NULL OR s.estado = @estado)
              AND (@q IS NULL OR s.titulo ILIKE '%' || @q || '%' OR u.nombre ILIKE '%' || @q || '%')
            ORDER BY (s.estado = 'pendiente') DESC,
                     CASE WHEN s.estado = 'pendiente' THEN s.fecha_publicacion END ASC,
                     s.fecha_publicacion DESC, s.id_servicio DESC
            LIMIT @limit OFFSET @offset
            """, conn);
        Param(cmd, "estado", NpgsqlDbType.Text, estado);
        Param(cmd, "q", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(busqueda) ? null : busqueda.Trim());
        return Ok(await Paged(cmd, page, pageSize, ct));
    }

    private sealed record ServicioInfo(string Estado, string Titulo, string? Correo, string? Nombre);

    private static async Task<ServicioInfo?> LockServicio(NpgsqlConnection conn, NpgsqlTransaction tx, int id, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT s.estado, COALESCE(s.titulo, ''), u.correo, u.nombre
            FROM servicios s LEFT JOIN usuarios u ON u.id_usuario = s.id_proveedor
            WHERE s.id_servicio = @id FOR UPDATE OF s
            """, conn, tx);
        cmd.Parameters.AddWithValue("id", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct)
            ? new(r.GetString(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3))
            : null;
    }

    private async Task Revisar(NpgsqlConnection conn, NpgsqlTransaction tx, int id, string estado, string? motivo, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            UPDATE servicios SET estado = @estado, motivo_rechazo = @motivo, revisado_en = now(), revisado_por = @admin
            WHERE id_servicio = @id
            """, conn, tx);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("estado", estado);
        cmd.Parameters.AddWithValue("admin", AdminId);
        Param(cmd, "motivo", NpgsqlDbType.Text, motivo);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private void NotificarRevision(ServicioInfo info, bool aprobado, string? razon)
    {
        if (string.IsNullOrEmpty(info.Correo)) return;
        _ = Task.Run(async () =>
        {
            try
            {
                await email.EnviarResultadoRevision(info.Correo, ServiciosComun.Html(info.Nombre),
                    ServiciosComun.Html(info.Titulo), aprobado, razon == null ? null : ServiciosComun.Html(razon));
            }
            catch (Exception ex) { Console.WriteLine($"[EMAIL] Error enviando revisión: {ex.Message}"); }
        });
    }

    [HttpPatch("servicios/{id:int}/aprobar")]
    public async Task<IActionResult> AprobarServicio(int id, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var info = await LockServicio(conn, tx, id, ct);
        if (info == null) return NotFound(new { error = "Servicio no encontrado" });
        if (info.Estado != "pendiente") return Conflict(new { error = $"Sólo se aprueban servicios pendientes (este está {info.Estado})" });

        await Revisar(conn, tx, id, "aprobado", null, ct);
        await Audit(conn, tx, "aprobar", "servicio", id, info.Titulo, ct);
        await tx.CommitAsync(ct);
        NotificarRevision(info, aprobado: true, razon: null);
        return Ok(new { ok = true, estado = "aprobado" });
    }

    // Retira de la vista pública un servicio ya publicado (o pausado) por incumplir las normas.
    [HttpPatch("servicios/{id:int}/ocultar")]
    public async Task<IActionResult> OcultarServicio(int id, AdminMotivoRequest dto, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var info = await LockServicio(conn, tx, id, ct);
        if (info == null) return NotFound(new { error = "Servicio no encontrado" });
        if (info.Estado is not ("aprobado" or "pausado")) return Conflict(new { error = $"El servicio no está publicado (está {info.Estado})" });

        var motivo = dto.motivo.Trim();
        await Revisar(conn, tx, id, "rechazado", motivo, ct);
        await Audit(conn, tx, "ocultar", "servicio", id, $"{info.Titulo}: {motivo}", ct);
        await tx.CommitAsync(ct);
        NotificarRevision(info, aprobado: false, motivo);
        return Ok(new { ok = true, estado = "rechazado" });
    }

    [HttpPost("servicios/{id:int}/rechazar")]
    public async Task<IActionResult> RechazarServicio(int id, AdminRechazoRequest dto, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var info = await LockServicio(conn, tx, id, ct);
        if (info == null) return NotFound(new { error = "Servicio no encontrado" });
        if (info.Estado != "pendiente") return Conflict(new { error = $"Sólo se rechazan servicios pendientes (este está {info.Estado}); usa ocultar" });

        var razon = string.IsNullOrWhiteSpace(dto.razon) ? "No cumple las normas de publicación" : dto.razon.Trim();
        await Revisar(conn, tx, id, "rechazado", razon, ct);
        await Audit(conn, tx, "rechazar", "servicio", id, $"{info.Titulo}: {razon}", ct);
        await tx.CommitAsync(ct);
        NotificarRevision(info, aprobado: false, razon);
        return Ok(new { ok = true, estado = "rechazado" });
    }

    // =========================
    // REPORTES Y QUEJAS
    // =========================
    private const string ReporteSelect = """
        SELECT {0}r.id_reporte, r.tipo_reporte, r.titulo, r.descripcion, r.estado, r.fecha_creacion,
               r.fecha_resolucion, r.resolucion_notas, r.evidencia,
               r.id_usuario, u.nombre AS nombre_usuario, u.correo AS correo_usuario,
               r.id_servicio, s.titulo AS titulo_servicio, r.id_solicitud,
               r.id_usuario_reportado, ur.nombre AS nombre_reportado, ur.correo AS correo_reportado,
               CASE WHEN ur.id_usuario IS NULL THEN NULL ELSE ur.estado IS TRUE END AS reportado_activo,
               r.id_admin_responde, a.nombre AS admin_responde
        FROM reportes r
        LEFT JOIN usuarios u ON u.id_usuario = r.id_usuario
        LEFT JOIN servicios s ON s.id_servicio = r.id_servicio
        LEFT JOIN usuarios ur ON ur.id_usuario = r.id_usuario_reportado
        LEFT JOIN usuarios a ON a.id_usuario = r.id_admin_responde
        """;

    [HttpGet("reportes")]
    public async Task<IActionResult> Reportes([FromQuery] string? estado, [FromQuery] string? tipo,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand(string.Format(ReporteSelect, "count(*) OVER() AS total_filas, ") + """

            WHERE (@estado IS NULL OR r.estado = @estado) AND (@tipo IS NULL OR r.tipo_reporte = @tipo)
            ORDER BY (r.estado IN ('Pendiente', 'En_revision')) DESC, r.fecha_creacion DESC
            LIMIT @limit OFFSET @offset
            """, conn);
        Param(cmd, "estado", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(estado) ? null : estado);
        Param(cmd, "tipo", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(tipo) ? null : tipo);
        return Ok(await Paged(cmd, page, pageSize, ct));
    }

    [HttpGet("reportes/{id:int}")]
    public async Task<IActionResult> Reporte(int id, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand(string.Format(ReporteSelect, "") + "\nWHERE r.id_reporte = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        var reporte = (await Rows(cmd, ct)).FirstOrDefault();
        return reporte == null ? NotFound(new { error = "Reporte no encontrado" }) : Ok(reporte);
    }

    [HttpPatch("reportes/{id:int}")]
    public async Task<IActionResult> ActualizarReporte(int id, AdminReporteRequest dto, CancellationToken ct)
    {
        await using var conn = await Open(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var cmd = new NpgsqlCommand("""
            UPDATE reportes SET estado = @estado,
                   resolucion_notas = COALESCE(@notas, resolucion_notas),
                   id_admin_responde = @admin,
                   fecha_resolucion = CASE WHEN @estado IN ('Resuelto', 'Rechazado', 'Cerrado') THEN now() ELSE NULL END
            WHERE id_reporte = @id
            """, conn, tx))
        {
            Param(cmd, "estado", NpgsqlDbType.Text, dto.estado);
            Param(cmd, "notas", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(dto.resolucion_notas) ? null : dto.resolucion_notas.Trim());
            cmd.Parameters.AddWithValue("admin", AdminId);
            cmd.Parameters.AddWithValue("id", id);
            if (await cmd.ExecuteNonQueryAsync(ct) == 0) return NotFound(new { error = "Reporte no encontrado" });
        }
        await Audit(conn, tx, "actualizar_reporte", "reporte", id, dto.estado, ct);
        await tx.CommitAsync(ct);
        return Ok(new { ok = true });
    }

    // =========================
    // SOLICITUDES (solo lectura)
    // =========================
    [HttpGet("solicitudes")]
    public async Task<IActionResult> Solicitudes([FromQuery] string? estado,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT sol.id_solicitud, sol.estado, sol.descripcion,
                   sol.id_servicio, se.titulo AS titulo_servicio,
                   sol.id_cliente, c.nombre AS cliente, sol.id_proveedor, p.nombre AS proveedor,
                   count(*) OVER() AS total_filas
            FROM solicitudes sol
            LEFT JOIN servicios se ON se.id_servicio = sol.id_servicio
            LEFT JOIN usuarios c ON c.id_usuario = sol.id_cliente
            LEFT JOIN usuarios p ON p.id_usuario = sol.id_proveedor
            WHERE (@estado IS NULL OR sol.estado = @estado)
            ORDER BY sol.id_solicitud DESC
            LIMIT @limit OFFSET @offset
            """, conn);
        Param(cmd, "estado", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(estado) ? null : estado);
        return Ok(await Paged(cmd, page, pageSize, ct));
    }

    // =========================
    // BITÁCORA
    // =========================
    [HttpGet("auditoria")]
    public async Task<IActionResult> Auditoria([FromQuery] string? entidad,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        await using var conn = await Open(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT a.id_auditoria, a.fecha, a.accion, a.entidad, a.id_entidad, a.detalle,
                   a.id_admin, u.nombre AS admin, count(*) OVER() AS total_filas
            FROM auditoria_admin a LEFT JOIN usuarios u ON u.id_usuario = a.id_admin
            WHERE (@entidad IS NULL OR a.entidad = @entidad)
            ORDER BY a.fecha DESC
            LIMIT @limit OFFSET @offset
            """, conn);
        Param(cmd, "entidad", NpgsqlDbType.Text, string.IsNullOrWhiteSpace(entidad) ? null : entidad);
        return Ok(await Paged(cmd, page, pageSize, ct));
    }
}
