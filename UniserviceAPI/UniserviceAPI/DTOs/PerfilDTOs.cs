namespace UniserviceAPI.DTOs;

// Campos editables del propio perfil. null = no cambiar; "" = borrar (semestre: 0 = borrar).
// Correo, rol, estado y avatar no están aquí a propósito: no se pueden cambiar por esta vía
// aunque el cliente los envíe (el JSON desconocido se ignora).
public sealed class ActualizarPerfilDTO
{
    public string? nombre { get; set; }
    public string? descripcion { get; set; }
    public string? telefono { get; set; }
    public string? programa { get; set; }
    public int? semestre { get; set; }
    public string? sede { get; set; }
    public string? disponibilidad { get; set; }
    public string? portafolio_url { get; set; }
}
