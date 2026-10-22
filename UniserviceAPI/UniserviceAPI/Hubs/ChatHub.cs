using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using UniserviceAPI.Services;

namespace UniserviceAPI.Hubs;

// Tiempo real del chat. Exige JWT (?access_token= en la conexión) y el usuario sale del token,
// nunca de un parámetro. Cada conexión entra sola al grupo de su usuario; los mensajes se envían
// por REST (ChatController), que los guarda y los reenvía aquí sólo a los dos participantes.
[Authorize]
public sealed class ChatHub(IConfiguration config, AccountStatus cuentas) : Hub
{
    public static string GrupoUsuario(int id) => $"usuario_{id}";
    public static string GrupoChat(int id) => $"chat_{id}";
    private int Yo => InstitutionalAccess.UserId(Context.User!)!.Value;

    public override async Task OnConnectedAsync()
    {
        // Las cuentas suspendidas no reciben nada en tiempo real.
        if (await cuentas.Get(Yo, Context.ConnectionAborted) is not { Activa: true })
        {
            Context.Abort();
            return;
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, GrupoUsuario(Yo));
        await base.OnConnectedAsync();
    }

    // Grupo por chat (lo usa SolicitudesController para el mensaje del sistema). Sólo participantes.
    public async Task UnirseChat(int chatId)
    {
        if (await OtroParticipante(chatId) == null) throw new HubException("Chat no encontrado");
        await Groups.AddToGroupAsync(Context.ConnectionId, GrupoChat(chatId));
    }

    public Task SalirChat(int chatId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, GrupoChat(chatId));

    public async Task EnviarEscribiendo(int chatId, bool escribiendo)
    {
        if (await OtroParticipante(chatId) is not { } otro) throw new HubException("Chat no encontrado");
        await Clients.Group(GrupoUsuario(otro)).SendAsync("UsuarioEscribiendo", new { id_chat = chatId, id_usuario = Yo, escribiendo });
    }

    private async Task<int?> OtroParticipante(int chatId)
    {
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(Context.ConnectionAborted);
        await using var cmd = new NpgsqlCommand("""
            SELECT CASE WHEN id_usuario1 = @yo THEN id_usuario2 ELSE id_usuario1 END
            FROM chats WHERE id_chat = @chat AND @yo IN (id_usuario1, id_usuario2)
            """, conn);
        cmd.Parameters.AddWithValue("chat", chatId);
        cmd.Parameters.AddWithValue("yo", Yo);
        return await cmd.ExecuteScalarAsync(Context.ConnectionAborted) as int?;
    }
}
