using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IConfiguration _config;

    public UsersController(IConfiguration config)
    {
        _config = config;
    }

    // 🔹 LOGIN ACTUALIZADO PARA ID_ROL (1=Admin, 2=User)
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDTO dto)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            // Buscamos al usuario incluyendo la columna id_rol que vimos en tu DB
            using var cmd = new SqlCommand("SELECT * FROM usuarios WHERE correo = @correo", conn);
            cmd.Parameters.AddWithValue("@correo", dto.correo);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return NotFound(new { message = "Usuario no existe" });

            string hash = reader["password_hash"]?.ToString()?.Trim() ?? "";
            bool valid = BCrypt.Net.BCrypt.Verify(dto.password, hash);

            if (!valid)
                return Unauthorized(new { message = "Contraseña incorrecta" });

            int id = (int)reader["id_usuario"];
            // Capturamos el id_rol (1 o 2)
            int idRol = reader["id_rol"] != DBNull.Value ? (int)reader["id_rol"] : 2;

            // 🔐 GENERAR TOKEN
            var jwtKey = _config["Jwt:Key"] ?? "ClaveSuperSecretaDeRespaldo_UniServices_2026";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim("id", id.ToString()),
                new Claim("id_rol", idRol.ToString()) // Guardamos el rol en el token
            };

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            // 3. Respuesta para React con id_rol
            return Ok(new
            {
                token = tokenString,
                user = new
                {
                    id = id,
                    nombre = reader["nombre"]?.ToString(),
                    correo = reader["correo"]?.ToString(),
                    id_rol = idRol // 👈 React usará esto para redirigir al admin
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // 🔹 GET USER BY ID (Para el Perfil)
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();

            string sql = @"
            SELECT 
                u.id_usuario, u.nombre, u.correo, u.estado, u.id_rol,
                ISNULL(u.avatar, '../src/img/default-avatar.png') as avatar, 
                ISNULL(u.descripcion, 'Sin descripción') as descripcion, 
                ISNULL(u.telefono, 'No disponible') as telefono, 
                ISNULL(u.fecha_registro, GETDATE()) as fecha_registro, 
                ISNULL(u.universidad, 'Sin universidad') as universidad,
                (SELECT COUNT(*) FROM seguidores WHERE id_seguido  = u.id_usuario) as total_seguidores,
                (SELECT COUNT(*) FROM seguidores WHERE id_seguidor = u.id_usuario) as total_siguiendo,
                (SELECT COUNT(*) FROM servicios  WHERE id_proveedor = u.id_usuario) as total_publicaciones,
                (SELECT AVG(CAST(puntuacion AS FLOAT)) FROM calificaciones WHERE id_servicio IN (SELECT id_servicio FROM servicios WHERE id_proveedor = u.id_usuario)) as reputacion
            FROM usuarios u
            WHERE u.id_usuario = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return Ok(new
                {
                    id = (int)reader["id_usuario"],
                    nombre = reader["nombre"]?.ToString(),
                    correo = reader["correo"]?.ToString(),
                    estado = reader["estado"],
                    id_rol = (int)reader["id_rol"],
                    avatar = reader["avatar"]?.ToString(),
                    descripcion = reader["descripcion"]?.ToString(),
                    telefono = reader["telefono"]?.ToString(),
                    fecha_registro = (DateTime)reader["fecha_registro"],
                    universidad = reader["universidad"]?.ToString(),
                    total_seguidores = reader["total_seguidores"] == DBNull.Value ? 0 : (int)reader["total_seguidores"],
                    total_siguiendo = reader["total_siguiendo"] == DBNull.Value ? 0 : (int)reader["total_siguiendo"],
                    total_publicaciones = reader["total_publicaciones"] == DBNull.Value ? 0 : (int)reader["total_publicaciones"],
                    reputacion = reader["reputacion"] == DBNull.Value ? (double?)null : (double)reader["reputacion"],
                });
            }
            return NotFound(new { message = "Usuario no encontrado" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Error en SQL: " + ex.Message });
        }
    }

    //METODO PARA OBTENER TODOS LOS USUARIOS (PARA ADMIN)
    [HttpGet]
    public async Task<IActionResult> GetAllUsers()
    {
        try
        {
            using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.OpenAsync();
            string sql = "SELECT id_usuario, nombre, correo, estado, id_rol FROM usuarios";
            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();
            var users = new List<object>();
            while (await reader.ReadAsync())
            {
                users.Add(new
                {
                    id = (int)reader["id_usuario"],
                    nombre = reader["nombre"]?.ToString(),
                    correo = reader["correo"]?.ToString(),
                    estado = reader["estado"],
                    id_rol = (int)reader["id_rol"]
                });
            }
            return Ok(users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Error en SQL: " + ex.Message });
        }
    }
}