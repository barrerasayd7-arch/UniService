namespace UniserviceAPI.DTOs;

// El autor del reporte sale del JWT. La evidencia sólo se añade subiendo imágenes
// (POST /api/reportes/{id}/imagenes), no como texto libre.
public sealed class CrearReporteDTO
{
    public int? id_servicio { get; set; }
    public int? id_solicitud { get; set; }
    public int? id_usuario_reportado { get; set; }
    public string tipo_reporte { get; set; } = "";
    public string titulo { get; set; } = "";
    public string descripcion { get; set; } = "";
}
