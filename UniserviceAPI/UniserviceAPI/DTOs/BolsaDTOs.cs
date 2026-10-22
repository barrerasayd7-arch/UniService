using System.ComponentModel.DataAnnotations;

namespace UniserviceAPI.DTOs;

public class HabilidadPerfilDTO
{
    [Range(1, int.MaxValue)] public int id_habilidad { get; set; }
    [Required, RegularExpression("^(basico|intermedio|avanzado)$")]
    public string nivel { get; set; } = "intermedio";
    [StringLength(500)] public string detalle { get; set; } = "";
}
public class GuardarHabilidadesDTO
{
    [Required, MaxLength(20)] public HabilidadPerfilDTO[] habilidades { get; set; } = [];
}
public class CrearPeticionDTO
{
    [Required, StringLength(120, MinimumLength = 5)] public string titulo { get; set; } = "";
    [Required, StringLength(4000, MinimumLength = 20)] public string descripcion { get; set; } = "";
    [Range(typeof(decimal), "0", "9999999999.99")] public decimal? presupuesto { get; set; }
    [Required, RegularExpression("^(virtual|presencial|mixta)$")] public string modalidad { get; set; } = "virtual";
    public DateTimeOffset fecha_limite { get; set; }
    [Required, MinLength(1), MaxLength(10)] public int[] habilidades { get; set; } = [];
}
public class CrearPostulacionDTO
{
    [Required, StringLength(2000, MinimumLength = 10)] public string mensaje { get; set; } = "";
    [Range(typeof(decimal), "0", "9999999999.99")] public decimal? precio_propuesto { get; set; }
}
public class EstadoPeticionDTO
{
    [Required, RegularExpression("^(completada|cancelada)$")] public string estado { get; set; } = "";
}
