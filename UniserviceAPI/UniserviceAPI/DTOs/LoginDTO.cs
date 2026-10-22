using System.ComponentModel.DataAnnotations;

public class LoginDTO
{
    [Required(ErrorMessage = "El correo es requerido")]
    [EmailAddress(ErrorMessage = "El correo no es válido")]
    public string correo { get; set; } = null!;

    [Required(ErrorMessage = "La contraseña es requerida")]
    public string password { get; set; } = null!;
}
