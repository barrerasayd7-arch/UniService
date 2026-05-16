using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UniserviceAPI.DTOs;
using System.Linq;

[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly IConfiguration _config;

    public ServicesController(IConfiguration config)
    {
        _config = config;
    }

    // =========================
    // GET TODOS LOS SERVICIOS
    // =========================
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            var servicios = new List<object>();

            using var cmd = new SqlCommand(@"
            SELECT 
                s.id_servicio,
                s.id_proveedor, 
                s.titulo,
                s.descripcion,
                s.precio_hora,
                s.icono,
                s.fecha_publicacion,
                s.modalidad,
                s.disponibilidad,
                c.nombre_categoria,
                u.nombre AS proveedor,
                u.universidad,
                COUNT(cal.id_calificacion)      AS num_resenas,
                ISNULL(AVG(CAST(cal.puntuacion AS FLOAT)), 0) AS promedio_estrellas
            FROM servicios s
            LEFT JOIN usuarios u ON s.id_proveedor = u.id_usuario
            LEFT JOIN categorias c ON s.id_categoria = c.id_categoria
            LEFT JOIN calificaciones cal ON cal.id_servicio = s.id_servicio
            GROUP BY
                s.id_servicio, s.id_proveedor, s.titulo, s.descripcion,
                s.precio_hora, s.icono, s.fecha_publicacion, s.modalidad,
                s.disponibilidad, c.nombre_categoria, u.nombre, u.universidad
            ORDER BY s.fecha_publicacion DESC
        ", conn);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                double prom = (double)reader["promedio_estrellas"];
                int numResenas = (int)reader["num_resenas"];

                // Construimos el array de estrellas que espera el frontend
                // (repite el promedio tantas veces como reseñas, que es lo que usa calcularEstrellas())
                var estrellasArr = Enumerable.Repeat(prom, numResenas).ToArray();

                servicios.Add(new
                {
                    id_servicio = reader["id_servicio"],
                    id_proveedor = (int)reader["id_proveedor"],
                    titulo = reader["titulo"]?.ToString(),
                    descripcion = reader["descripcion"]?.ToString(),
                    precio_hora = reader["precio_hora"],
                    icono = reader["icono"]?.ToString() ?? "bi-pin",
                    fecha_publicacion = Convert.ToDateTime(reader["fecha_publicacion"]).ToString("yyyy-MM-dd"),
                    modalidad = MapModalidad(reader["modalidad"]),
                    disponibilidad = MapDisponibilidad(reader["disponibilidad"]),
                    nombre_categoria = reader["nombre_categoria"]?.ToString(),
                    proveedor = reader["proveedor"]?.ToString(),
                    universidad = reader["universidad"]?.ToString(),
                    estrellas = estrellasArr
                });
            }

            return Ok(servicios);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
    // =========================
    // GET POR ID
    // =========================
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            // 1. Datos del servicio
            using var cmd = new SqlCommand(@"
            SELECT 
                s.id_servicio,
                s.id_proveedor,
                s.titulo,
                s.descripcion,
                s.precio_hora,
                s.icono,
                s.contacto,
                s.fecha_publicacion,
                s.modalidad,
                s.disponibilidad,
                c.nombre_categoria,
                u.nombre AS proveedor,
                u.universidad
            FROM servicios s
            LEFT JOIN usuarios u ON s.id_proveedor = u.id_usuario
            LEFT JOIN categorias c ON s.id_categoria = c.id_categoria
            WHERE s.id_servicio = @id
        ", conn);
            cmd.Parameters.AddWithValue("@id", id);

            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return NotFound(new { error = "Servicio no encontrado" });

            var servicio = new
            {
                id_servicio = (int)reader["id_servicio"],
                id_proveedor = (int)reader["id_proveedor"],
                titulo = reader["titulo"]?.ToString(),
                descripcion = reader["descripcion"]?.ToString(),
                precio_hora = reader["precio_hora"],
                icono = reader["icono"]?.ToString() ?? "📌",
                contacto = reader["contacto"]?.ToString(),
                fecha_publicacion = Convert.ToDateTime(reader["fecha_publicacion"]).ToString("yyyy-MM-dd"),
                modalidad = MapModalidad(reader["modalidad"]),
                disponibilidad = MapDisponibilidad(reader["disponibilidad"]),
                nombre_categoria = reader["nombre_categoria"]?.ToString(),
                proveedor = reader["proveedor"]?.ToString(),
                universidad = reader["universidad"]
            };
            reader.Close();

            // 2. Reseñas
            using var cmdResenas = new SqlCommand(@"
            SELECT 
                c.puntuacion,
                c.comentario,
                c.fecha_calificacion,
                u.nombre AS autor
            FROM calificaciones c
            INNER JOIN usuarios u ON c.id_cliente = u.id_usuario
            WHERE c.id_servicio = @id
            ORDER BY c.fecha_calificacion DESC
        ", conn);
            cmdResenas.Parameters.AddWithValue("@id", id);

            var resenas = new List<object>();
            using var rReader = await cmdResenas.ExecuteReaderAsync();
            while (await rReader.ReadAsync())
            {
                resenas.Add(new
                {
                    estrellas = (byte)rReader["puntuacion"],
                    comentario = rReader["comentario"]?.ToString(),
                    fecha = ((DateTime)rReader["fecha_calificacion"]).ToString("dd MMM yyyy"),
                    autor = rReader["autor"]?.ToString()
                });
            }
            rReader.Close();

            // 3. Promedio
            double prom = resenas.Count > 0
                ? resenas.Average(r => (double)((dynamic)r).estrellas)
                : 0;

            return Ok(new
            {
                servicio.id_servicio,
                servicio.id_proveedor,
                servicio.titulo,
                servicio.descripcion,
                servicio.precio_hora,
                servicio.icono,
                servicio.contacto,
                servicio.fecha_publicacion,
                servicio.modalidad,
                servicio.disponibilidad,
                servicio.nombre_categoria,
                servicio.proveedor,
                servicio.universidad,
                resenas,
                estrellas = prom.ToString("0.0")
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // =========================
    // CREATE SERVICIO
    // =========================
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ServicioDTO dto)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            using var cmd = new SqlCommand(@"
                INSERT INTO servicios
                (id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, icono, disponibilidad, fecha_publicacion)
                VALUES
                (@id_proveedor, @titulo, @descripcion, @id_categoria, @precio_hora, @contacto, @modalidad, @icono, @disponibilidad, GETDATE())
            ", conn);

            cmd.Parameters.AddWithValue("@id_proveedor", dto.id_proveedor);
            cmd.Parameters.AddWithValue("@titulo", dto.titulo);
            cmd.Parameters.AddWithValue("@descripcion", dto.descripcion);
            cmd.Parameters.AddWithValue("@id_categoria", dto.id_categoria);
            cmd.Parameters.AddWithValue("@precio_hora", dto.precio_hora);
            cmd.Parameters.AddWithValue("@contacto", dto.contacto ?? "");
            cmd.Parameters.AddWithValue("@modalidad", dto.modalidad);
            cmd.Parameters.AddWithValue("@icono", dto.icono ?? "📌");
            cmd.Parameters.AddWithValue("@disponibilidad", dto.disponibilidad);

            await cmd.ExecuteNonQueryAsync();

            return Ok(new { ok = true, message = "Servicio creado correctamente" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private string MapModalidad(object value)
    {
        if (value == null || value == DBNull.Value) return "🏫 Presencial";

        string str = value.ToString();
        return str switch
        {
            "0" => "🏫 Presencial",
            "1" => "💻 Virtual",
            "2" => "🔄 Mixta",
            "Presencial" => "🏫 Presencial",
            "Virtual" => "💻 Virtual",
            "Mixta" => "🔄 Mixta",
            _ => "🏫 Presencial"
        };
    }

    private string MapDisponibilidad(object value)
    {
        if (value == null || value == DBNull.Value) return "📆 Entre semana";

        string str = value.ToString();
        return str switch
        {
            "0" => "📆 Entre semana",
            "1" => "🎉 Fines de semana",
            "2" => "⏰ Siempre disponible",
            "Entre semana" => "📆 Entre semana",
            "Fines de semana" => "🎉 Fines de semana",
            "Siempre disponible" => "⏰ Siempre disponible",
            _ => "📆 Entre semana"
        };
    }



    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] EditarServicioDTO dto)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            using var cmd = new SqlCommand(@"
            UPDATE servicios
            SET titulo = @titulo,
                descripcion = @descripcion,
                precio_hora = @precio_hora,
                contacto = @contacto,
                icono = @icono
            WHERE id_servicio = @id AND id_proveedor = @id_proveedor
        ", conn);

            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@id_proveedor", dto.id_proveedor);
            cmd.Parameters.AddWithValue("@titulo", dto.titulo ?? "");
            cmd.Parameters.AddWithValue("@descripcion", dto.descripcion ?? "");
            cmd.Parameters.AddWithValue("@precio_hora", dto.precio_hora);
            cmd.Parameters.AddWithValue("@contacto", dto.contacto ?? "");
            cmd.Parameters.AddWithValue("@icono", dto.icono ?? "");

            int filas = await cmd.ExecuteNonQueryAsync();
            if (filas == 0)
                return NotFound(new { error = "Servicio no encontrado o no tienes permiso" });

            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── DELETE /api/services/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int id_proveedor)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            // 1. Verificar que el servicio pertenece al proveedor
            using var cmdCheck = new SqlCommand(
                "SELECT COUNT(1) FROM servicios WHERE id_servicio = @id AND id_proveedor = @id_proveedor",
                conn);
            cmdCheck.Parameters.AddWithValue("@id", id);
            cmdCheck.Parameters.AddWithValue("@id_proveedor", id_proveedor);
            int existe = (int)await cmdCheck.ExecuteScalarAsync();
            if (existe == 0)
                return NotFound(new { error = "Servicio no encontrado o no tienes permiso" });

            // 2. Eliminar calificaciones del servicio
            using var cmdCalif = new SqlCommand(
                "DELETE FROM calificaciones WHERE id_servicio = @id", conn);
            cmdCalif.Parameters.AddWithValue("@id", id);
            await cmdCalif.ExecuteNonQueryAsync();

            // 3. Eliminar solicitudes del servicio
            using var cmdSol = new SqlCommand(
                "DELETE FROM solicitudes WHERE id_servicio = @id", conn);
            cmdSol.Parameters.AddWithValue("@id", id);
            await cmdSol.ExecuteNonQueryAsync();

            // 4. Ahora sí eliminar el servicio
            using var cmd = new SqlCommand(
                "DELETE FROM servicios WHERE id_servicio = @id AND id_proveedor = @id_proveedor",
                conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@id_proveedor", id_proveedor);
            await cmd.ExecuteNonQueryAsync();

            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}