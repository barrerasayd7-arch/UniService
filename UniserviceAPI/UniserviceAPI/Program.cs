using Microsoft.EntityFrameworkCore;
using UniServiceAPI.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using UniserviceAPI.Services;
using UniserviceAPI.Hubs;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

// Cargar variables de entorno desde archivo .env si existe (solo desarrollo local).
// Se busca junto al proyecto (UniserviceAPI/UniserviceAPI/.env) y, si no está, en UniserviceAPI/.env.
var envPath = new[] { builder.Environment.ContentRootPath, Path.Combine(builder.Environment.ContentRootPath, "..") }
    .Select(dir => Path.GetFullPath(Path.Combine(dir, ".env")))
    .FirstOrDefault(File.Exists);
if (envPath != null)
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
        
        var parts = trimmed.Split('=', 2);
        if (parts.Length == 2)
        {
            var key = parts[0].Trim();
            var value = parts[1].Trim();
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}

// Incorporar también las variables cargadas desde .env al proveedor de configuración.
builder.Configuration.AddEnvironmentVariables();
var signingKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32 ||
    signingKey == "uniservice_super_secret_key_2026_segura_12345")
    throw new InvalidOperationException("Configura Jwt__Key con una clave privada de al menos 32 bytes.");

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("InstitutionalEmail", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            AutoReplenishment = true
        }));
    options.AddPolicy("AdminLogin", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            AutoReplenishment = true
        }));

    // Cupos ajustables con RateLimit__<Política> (las pruebas e2e los suben: todo sale de una misma IP).
    var cupo = (string nombre, int porDefecto) => builder.Configuration.GetValue($"RateLimit:{nombre}", porDefecto);

    // Por IP: login y registro (además del bloqueo por cuenta que aplica AuthController).
    var cupoLogin = cupo("Login", 10);
    options.AddPolicy("Login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = cupoLogin, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
        }));
    // Por usuario autenticado (o IP si no lo está). Requiere UseRateLimiter después de UseAuthentication.
    void PorUsuario(string nombre, int permitidos, TimeSpan ventana)
    {
        var limite = cupo(nombre, permitidos);
        options.AddPolicy(nombre, context => RateLimitPartition.GetFixedWindowLimiter(
            InstitutionalAccess.UserId(context.User) is { } id ? $"u:{id}" : $"ip:{context.Connection.RemoteIpAddress}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limite, Window = ventana, QueueLimit = 0, AutoReplenishment = true
            }));
    }
    PorUsuario("Password", 5, TimeSpan.FromMinutes(10));
    PorUsuario("Perfil", 30, TimeSpan.FromMinutes(1));
    PorUsuario("Avatar", 5, TimeSpan.FromMinutes(10));
    PorUsuario("Chat", 40, TimeSpan.FromMinutes(1));
    PorUsuario("Reportes", 5, TimeSpan.FromMinutes(10));
});
builder.Services.AddHttpClient("InstitutionalEmail", client => client.Timeout = TimeSpan.FromSeconds(15));

// 1. Configuración de Autenticación JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    var key = signingKey;
    
    Console.WriteLine($"[CONFIG] JWT Key: {(key.Length >= 16 ? "OK" : "ERROR - clave muy corta")}");
    
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
    options.MapInboundClaims = false;
    options.Events = new JwtBearerEvents
    {
        // SignalR (WebSocket) no puede enviar cabeceras: el token llega en ?access_token= sólo para /chathub.
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["access_token"].ToString();
            if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/chathub"))
                context.Token = token;
            return Task.CompletedTask;
        },
        // Firma y vigencia no bastan: el token debe ser de una cuenta que existe y no estar revocado
        // (cerrar sesión, cambio o recuperación de contraseña). La suspensión la responde ActiveAccountFilter.
        OnTokenValidated = async context =>
        {
            var id = InstitutionalAccess.UserId(context.Principal!);
            if (id == null) { context.Fail("Token sin usuario"); return; }
            var estado = await context.HttpContext.RequestServices.GetRequiredService<AccountStatus>()
                .Get(id.Value, context.HttpContext.RequestAborted);
            if (estado == null) { context.Fail("La cuenta no existe"); return; }
            if (Sesiones.EmitidoEn(context.Principal!) < estado.SesionesDesde) context.Fail("Sesión cerrada");
        }
    };
})
.AddJwtBearer("MicrosoftInstitutional", options =>
{
    var tenant = builder.Configuration["Microsoft:TenantId"];
    var audience = builder.Configuration["Microsoft:ApiClientId"];
    var client = builder.Configuration["Microsoft:MobileClientId"];
    options.MapInboundClaims = false;
    if (Guid.TryParse(tenant, out _) && Guid.TryParse(audience, out _) && Guid.TryParse(client, out _))
    {
        options.Authority = $"https://login.microsoftonline.com/{tenant}/v2.0";
        options.Audience = audience;
        options.TokenValidationParameters.ValidIssuer = $"https://login.microsoftonline.com/{tenant}/v2.0";
        options.TokenValidationParameters.ClockSkew = TimeSpan.Zero;
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var user = context.Principal!;
                var requiredRole = builder.Configuration["Microsoft:StudentRole"] ?? "EstudianteActivo";
                var scopes = (user.FindFirst("scp")?.Value ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (user.FindFirst("tid")?.Value != tenant || !Guid.TryParse(user.FindFirst("oid")?.Value, out _) ||
                    user.FindFirst("azp")?.Value != client || !scopes.Contains("access_as_user") ||
                    !user.HasClaim("roles", requiredRole))
                    context.Fail("Se requiere identidad institucional y rol de estudiante activo");
                return Task.CompletedTask;
            }
        };
    }
    else
    {
        // Sin configuración institucional, rechazar todas las sesiones Microsoft.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context => { context.Fail("Microsoft institucional no configurado"); return Task.CompletedTask; }
        };
    }
});

builder.Services.AddScoped<ActiveStudentFilter>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<AccountStatus>();
builder.Services.AddSingleton<AdminElevation>();
builder.Services.AddAuthorization();

// 2. Configuración de Base de Datos (PostgreSQL - Supabase)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                       ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

// Agregar parámetros de pooling si no están presentes
if (!string.IsNullOrEmpty(connectionString) && !connectionString.Contains("Pooling"))
{
    connectionString += ";Pooling=true;Minimum Pool Size=5;Maximum Pool Size=50;Connection Idle Lifetime=300;Connection Pruning Interval=10";
}

if (string.IsNullOrEmpty(connectionString))
{
    Console.WriteLine("[ERROR] No se encontró ConnectionString. Verifica appsettings.json o variables de entorno.");
}
else
{
    Console.WriteLine("[CONFIG] ConnectionString configurada correctamente con pooling optimizado");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString)
);

builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<SupabaseStorageService>();
builder.Services.AddHttpClient();

// 3. Configuración de CORS
// Development: cualquier origen (Vite cambia de puerto, Flutter web, etc.).
// Producción: sólo los dominios de AllowedOrigins (separados por coma). La app móvil nativa no usa CORS.
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
if (!builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
    Console.WriteLine("[CONFIG] AllowedOrigins vacío: ninguna web podrá llamar a la API (la app móvil sí).");
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact",
        policy =>
        {
            if (builder.Environment.IsDevelopment())
                policy.SetIsOriginAllowed(_ => true);
            else
                policy.WithOrigins(allowedOrigins);
            policy.AllowAnyHeader()
                  .AllowCredentials()
                  .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH");
        });
});

// Detrás del proxy del hosting, la IP del cliente llega en X-Forwarded-For. Sin esto,
// los límites de intentos por IP tratarían a todos los usuarios como uno solo.
// ForwardLimit = 1 toma sólo la IP que añade el proxy, no la que pueda inventar el cliente.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddControllers
    (options =>
    {
        //creamos una politica de ocultacion global de los endenpoints que el usuario solo acceda al iniciar sesion
        var policy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();

        options.Filters.Add(new AuthorizeFilter(policy));
        // Bloquea al instante las cuentas suspendidas aunque su JWT siga vigente.
        options.Filters.Add<ActiveAccountFilter>();

    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value != null && e.Value.Errors.Count > 0)
                .Select(e => new { campo = e.Key, error = e.Value!.Errors.First().ErrorMessage })
                .ToList();
            
            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new
            {
                error = "Datos de entrada inválidos",
                detalles = errors
            });
        };
    });

builder.Services.AddSignalR();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
builder.Services.Configure<FormOptions>(options =>
{
    // Cada endpoint de subida fija además su propio RequestSizeLimit.
    options.MultipartBodyLengthLimit = 30 * 1024 * 1024;
    options.ValueLengthLimit = 64 * 1024;
    options.ValueCountLimit = 200;
});
builder.Services.AddEndpointsApiExplorer();

// 4. Configuración de Swagger
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Escribe: Bearer {tu_token}"
    });
    // Token de POST /api/admin/acceso/verificar: lo exige el resto de /api/admin/*.
    options.AddSecurityDefinition("AdminElevacion", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = UniserviceAPI.Services.AdminElevation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Token de /api/admin/acceso/verificar (contraseña de administrador)"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        },
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "AdminElevacion"
                }
            },
            new string[] {}
        }
    });
    // === OCULTAR AUTOMÁTICAMENTE LO PROTEGIDO EN EL SWAGGER ===
    options.DocInclusionPredicate((docName, apiDesc) =>
    {
        // Revisamos si el endpoint o el controlador tienen el atributo [AllowAnonymous]
        var hasAllowAnonymous = apiDesc.ActionDescriptor.EndpointMetadata
            .Any(em => em is Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute);

        // Si tiene [AllowAnonymous], se muestra en Swagger. Si no lo tiene (es privado), se oculta.
        // Excepción: el panel admin se muestra para poder probarlo con "Authorize" (Swagger sólo corre en Development).
        return hasAllowAnonymous || apiDesc.RelativePath?.StartsWith("api/admin", StringComparison.OrdinalIgnoreCase) == true;
    });
});

var app = builder.Build();

// --- CONFIGURACIÓN DEL PIPELINE DE HTTP (ORDEN CRÍTICO) ---

// En la nube siempre hay un proxy delante; en local no, y así no se aceptan cabeceras inventadas.
if (!app.Environment.IsDevelopment())
    app.UseForwardedHeaders();

// Middleware de manejo de errores global
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var ex = exceptionHandlerPathFeature?.Error;

        // Petición inválida del cliente (cuerpo demasiado grande, cortado...): su código, no un 500.
        if (ex is BadHttpRequestException bad)
        {
            context.Response.StatusCode = bad.StatusCode;
            await context.Response.WriteAsJsonAsync(new
            {
                error = bad.StatusCode == StatusCodes.Status413PayloadTooLarge ? "La petición es demasiado grande" : "Petición inválida"
            });
            return;
        }

        Console.WriteLine($"[ERROR GLOBAL] {ex?.GetType().Name}: {ex?.Message}");
        Console.WriteLine($"[ERROR GLOBAL] Stack: {ex?.StackTrace}");
        
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        // En producción, no exponer detalles del error
        var isDevelopment = app.Environment.IsDevelopment();
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Error interno del servidor",
            detalle = isDevelopment ? ex?.Message : null,
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
        });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseResponseCompression();

app.UseStaticFiles();



// A. EL CORS debe ir antes de cualquier middleware que maneje rutas o seguridad
app.Use(async (context, next) =>
{
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
    context.Response.Headers["Cross-Origin-Embedder-Policy"] = "unsafe-none";
    // El navegador no debe adivinar tipos (un archivo subido no se ejecuta como HTML) ni incrustar la API.
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.UseCors("AllowReact");
// B. El orden de estos es vital para el funcionamiento de los controladores
app.UseRouting();

app.UseAuthentication();
// Después de autenticar: las políticas por usuario necesitan el id del token.
app.UseRateLimiter();
app.UseAuthorization();

// C. Mantenemos comentada la redirección HTTPS para facilitar la conexión local
// app.UseHttpsRedirection();

app.MapControllers();

app.MapHub<ChatHub>("/chathub");

app.Run();

