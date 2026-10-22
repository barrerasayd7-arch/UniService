using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
using Npgsql;

namespace UniserviceAPI.Services;

// SesionesDesde: segundos Unix; los tokens con "iat" anterior están revocados (0 = ninguno).
public sealed record AccountState(bool Activa, int Rol, long SesionesDesde = 0);

// Estado de cuenta leído de la BD (no del JWT): una suspensión, un cambio de rol o un cierre
// de sesión aplica en segundos aunque el token del usuario siga vigente.
public sealed class AccountStatus(IConfiguration config, IMemoryCache cache)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
    private static string Key(int id) => $"cuenta:{id}";

    public async Task<AccountState?> Get(int id, CancellationToken ct)
    {
        if (cache.TryGetValue(Key(id), out AccountState? cached)) return cached;
        await using var conn = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT estado IS TRUE, COALESCE(id_rol, 2),
                   COALESCE(floor(extract(epoch FROM sesiones_validas_desde))::bigint, 0)
            FROM usuarios WHERE id_usuario = @id
            """, conn);
        cmd.Parameters.AddWithValue("id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        AccountState? state = await reader.ReadAsync(ct)
            ? new(reader.GetBoolean(0), reader.GetInt32(1), reader.GetInt64(2)) : null;
        cache.Set(Key(id), state, Ttl);
        return state;
    }

    public void Invalidate(int id) => cache.Remove(Key(id));
}

// Filtro global: rechaza peticiones autenticadas de cuentas suspendidas o eliminadas.
public sealed class ActiveAccountFilter(AccountStatus status) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var anonymous = context.ActionDescriptor.EndpointMetadata.Any(m => m is IAllowAnonymous);
        var id = InstitutionalAccess.UserId(context.HttpContext.User);
        if (!anonymous && id != null)
        {
            var state = await status.Get(id.Value, context.HttpContext.RequestAborted);
            if (state is not { Activa: true })
            {
                context.Result = new ObjectResult(new { error = "Tu cuenta ha sido suspendida. Contacta al administrador.", suspendida = true }) { StatusCode = 403 };
                return;
            }
        }
        await next();
    }
}

public sealed class AdminFilter(AccountStatus status, AdminElevation elevation, bool requiereElevacion) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var id = InstitutionalAccess.UserId(http.User);
        var state = id == null ? null : await status.Get(id.Value, http.RequestAborted);
        if (state is not { Activa: true, Rol: 1 })
        {
            context.Result = new ObjectResult(new { error = "No tienes permisos de administrador" }) { StatusCode = 403 };
            return;
        }
        // 403 y no 401: la sesión sigue siendo válida, sólo falta (o venció) la contraseña de admin.
        if (requiereElevacion && !await elevation.Valida(http.Request.Headers[AdminElevation.Header].ToString(), id!.Value, http.RequestAborted))
        {
            context.Result = new ObjectResult(new { error = "Confirma tu contraseña de administrador para continuar", requiere_elevacion = true }) { StatusCode = 403 };
            return;
        }
        await next();
    }
}

// Exige rol administrador (id_rol = 1) y cuenta activa, comprobados contra la BD, y por defecto
// también la contraseña de admin (cabecera X-Admin-Elevacion). elevacion: false sólo para el acceso.
public sealed class AdminOnlyAttribute : TypeFilterAttribute
{
    public AdminOnlyAttribute(bool elevacion = true) : base(typeof(AdminFilter)) => Arguments = [elevacion];
}
