using System.ComponentModel.DataAnnotations;

namespace UniserviceAPI.DTOs;

public sealed record AdminMotivoRequest(
    [Required(ErrorMessage = "Indica el motivo"), StringLength(500, MinimumLength = 5, ErrorMessage = "El motivo debe tener entre 5 y 500 caracteres")]
    string motivo);

public sealed record AdminRechazoRequest([StringLength(500)] string? razon);

public sealed record AdminReporteRequest(
    [Required, RegularExpression("^(Pendiente|En_revision|Resuelto|Rechazado|Cerrado)$", ErrorMessage = "Estado no válido")]
    string estado,
    [StringLength(2000)] string? resolucion_notas);

public sealed record AdminClaveRequest(
    [Required(ErrorMessage = "Escribe tu contraseña de administrador"), StringLength(200)]
    string clave);

public sealed record AdminNuevaClaveRequest(
    [Required(ErrorMessage = "Confirma tu correo con el código")] string verificacion_token,
    [Required(ErrorMessage = "Escribe la contraseña de administrador"), StringLength(200)] string clave);
