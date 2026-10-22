using System.ComponentModel.DataAnnotations;

public class RegisterDTO
{
    [Required(ErrorMessage = "El correo es requerido")]
    [EmailAddress(ErrorMessage = "El correo no es válido")]
    [StringLength(100, ErrorMessage = "El correo no puede exceder 100 caracteres")]
    public string correo { get; set; } = null!;

    [Required(ErrorMessage = "La contraseña es requerida")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres")]
    public string password { get; set; } = null!;

    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 50 caracteres")]
    public string nombre { get; set; } = null!;

    [Required(ErrorMessage = "El apellido es requerido")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "El apellido debe tener entre 2 y 50 caracteres")]
    public string apellido { get; set; } = null!;

    [Required(ErrorMessage = "El teléfono es requerido")]
    [StringLength(20, MinimumLength = 7, ErrorMessage = "El teléfono debe tener entre 7 y 20 caracteres")]
    [RegularExpression(@"^[0-9+\-\s()]+$", ErrorMessage = "El teléfono solo admite dígitos y los símbolos + - ( )")]
    public string telefono { get; set; } = null!;

    [Required(ErrorMessage = "El token de verificación es requerido")]
    public string verificacion_token { get; set; } = null!;
}
