using System.ComponentModel.DataAnnotations;

public class ResetPasswordVerificadoDTO
{
    [Required(ErrorMessage = "El correo es requerido")]
    [StringLength(100)]
    public string correo { get; set; } = null!;

    [Required(ErrorMessage = "El token de verificación es requerido")]
    public string verificacion_token { get; set; } = null!;

    [Required(ErrorMessage = "La nueva contraseña es requerida")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Usa una contraseña de al menos 8 caracteres")]
    public string nueva_password { get; set; } = null!;
}
