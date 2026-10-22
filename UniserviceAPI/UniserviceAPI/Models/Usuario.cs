namespace UniServiceAPI.Models
{
    public class Usuario
    {
        public int id_usuario { get; set; }
        public string nombre { get; set; } = null!;
        public string correo { get; set; } = null!;
        public string telefono { get; set; } = null!;
        public string universidad { get; set; } = null!;
    }
}