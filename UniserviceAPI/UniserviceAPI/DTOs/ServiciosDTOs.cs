using System.ComponentModel.DataAnnotations;

namespace UniserviceAPI.DTOs;

// Datos que escribe el proveedor. Su id sale del JWT, nunca del cuerpo.
public class GuardarServicioDTO
{
    [Required, StringLength(100, MinimumLength = 5, ErrorMessage = "El título debe tener entre 5 y 100 caracteres")]
    public string titulo { get; set; } = "";
    [Required, StringLength(2000, MinimumLength = 20, ErrorMessage = "La descripción debe tener entre 20 y 2000 caracteres")]
    public string descripcion { get; set; } = "";
    [Range(1, int.MaxValue, ErrorMessage = "Elige una categoría")]
    public int id_categoria { get; set; }
    [Range(typeof(decimal), "1000", "99999999", ErrorMessage = "El precio debe estar entre $1.000 y $99.999.999")]
    public decimal precio { get; set; }
    [RegularExpression("^(hora|mes|proyecto)$", ErrorMessage = "La unidad de precio debe ser hora, mes o proyecto")]
    public string? unidad_precio { get; set; }
    [Required, RegularExpression("^(presencial|virtual|mixta)$", ErrorMessage = "Modalidad inválida")]
    public string modalidad { get; set; } = "presencial";
    [Required, RegularExpression("^(entre_semana|fines_de_semana|siempre)$", ErrorMessage = "Disponibilidad inválida")]
    public string disponibilidad { get; set; } = "siempre";
    [Required, StringLength(150, MinimumLength = 5, ErrorMessage = "Indica un correo o teléfono de contacto")]
    public string contacto { get; set; } = "";
    [StringLength(300)] public string? direccion { get; set; }
    [Range(-90, 90, ErrorMessage = "Latitud inválida")] public decimal? ubicacion_lat { get; set; }
    [Range(-180, 180, ErrorMessage = "Longitud inválida")] public decimal? ubicacion_lng { get; set; }
}

public class PausarServicioDTO
{
    public bool pausado { get; set; }
}

public class OrdenImagenesDTO
{
    [Required, MinLength(1), MaxLength(5)] public int[] imagenes { get; set; } = [];
}

public class CrearSolicitudDTO
{
    [Range(1, int.MaxValue)] public int id_servicio { get; set; }
    [Required, StringLength(2000, MinimumLength = 10, ErrorMessage = "Describe lo que necesitas (mínimo 10 caracteres)")]
    public string descripcion { get; set; } = "";
    [Range(typeof(decimal), "1", "99999999", ErrorMessage = "El presupuesto debe ser mayor a 0")]
    public decimal presupuesto { get; set; }
    public DateOnly? fecha_deseada { get; set; }
    [RegularExpression("^([01][0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "Hora inválida (HH:mm)")]
    public string? hora_deseada { get; set; }
    // Campos propios de la categoría (páginas, lenguaje, duración de estadía, fecha de inicio).
    [MaxLength(10)] public Dictionary<string, string>? campos { get; set; }
}

public class AceptarSolicitudDTO
{
    [Range(typeof(decimal), "1", "99999999", ErrorMessage = "La contraoferta debe ser mayor a 0")]
    public decimal? contraoferta { get; set; }
}

public class RechazarSolicitudDTO
{
    [Required, StringLength(1000, MinimumLength = 5, ErrorMessage = "Explica el motivo (mínimo 5 caracteres)")]
    public string motivo { get; set; } = "";
}

public class GuardarCalificacionDTO
{
    [Range(1, 5, ErrorMessage = "La puntuación debe ser entre 1 y 5")] public int puntuacion { get; set; }
    [StringLength(1000, ErrorMessage = "El comentario no puede exceder 1000 caracteres")] public string? comentario { get; set; }
}

public class CrearCalificacionDTO : GuardarCalificacionDTO
{
    [Range(1, int.MaxValue)] public int id_servicio { get; set; }
}
