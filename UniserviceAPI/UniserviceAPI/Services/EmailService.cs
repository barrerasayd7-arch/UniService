using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace UniserviceAPI.Services
{
    public class EmailService
    {
        private static readonly string LogoUrl = "https://mpdeejiivmctbqcfflbz.supabase.co/storage/v1/object/public/imagenes-servicios/logo_uniservice.png";
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _config;
        private static readonly HttpClient _httpClient = new()
        {
            BaseAddress = new Uri("https://api.brevo.com/")
        };
        private static readonly ConcurrentDictionary<string, (DateTime ultimoEnvio, CancellationTokenSource cts)> _spamControl = new();
        private static bool _httpClientInitialized;

        public EmailService(IWebHostEnvironment env, IConfiguration config)
        {
            _env = env;
            _config = config;

            if (!_httpClientInitialized)
            {
                var apiKey = _config["Brevo:ApiKey"] ?? "";
                if (!string.IsNullOrEmpty(apiKey))
                {
                    _httpClient.DefaultRequestHeaders.Remove("api-key");
                    _httpClient.DefaultRequestHeaders.Add("api-key", apiKey);
                }
                _httpClientInitialized = true;
            }
        }

        private async Task<string> SendViaBrevoAsync(string to, string subject, string htmlBody)
        {
            var fromEmail = _config["Brevo:FromEmail"] ?? "";
            var fromName = _config["Brevo:FromName"] ?? "UniService";

            var payload = new
            {
                sender = new { name = fromName, email = fromEmail },
                to = new[] { new { email = to } },
                subject,
                htmlContent = htmlBody
            };

            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PostAsync("v3/smtp/email", content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    Console.WriteLine($"[BREVO] Correo enviado a {to}: {subject}");
                else
                    Console.WriteLine($"[BREVO] Error {response.StatusCode}: {responseBody}");

                return responseBody;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BREVO] Error enviando a {to}: {ex.Message}");
                return "";
            }
        }


        public void EnviarNotificacionChat(string emailDestino, string nombreDestinatario, string nombreRemitente, string previewMensaje)
        {
            string key = $"chat_{emailDestino}";

            if (_spamControl.TryGetValue(key, out var existing))
            {
                existing.cts.Cancel();
            }

            var cts = new CancellationTokenSource();
            _spamControl[key] = (DateTime.UtcNow, cts);

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(45000, cts.Token);
                    if (cts.Token.IsCancellationRequested) return;

                    await EnviarEmailChativo(emailDestino, nombreDestinatario, nombreRemitente, previewMensaje);
                }
                catch (OperationCanceledException)
                {
                    // Cancelado por nuevo mensaje, no es error
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[EMAIL CHAT] ERROR: {ex.Message}");
                }
                finally
                {
                    _spamControl.TryRemove(key, out _);
                }
            });
        }

        private async Task EnviarEmailChativo(string emailDestino, string nombreDestinatario, string nombreRemitente, string previewMensaje)
        {
            string htmlBody = $@"
            <html>
            <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
                <div style='max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px;'>
                    <h2 style='color: #2ecc71;'>Tienes un nuevo mensaje</h2>
                    <p><strong>{nombreRemitente}</strong> te ha enviado un mensaje:</p>
                    <div style='background: #f0f0f0; padding: 12px; border-radius: 8px; margin: 16px 0;'>
                        <p style='margin: 0; color: #333;'>{previewMensaje}</p>
                    </div>
                    <p style='color: #666; font-size: 14px;'>Inicia sesión en UniService para responder.</p>
                    <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
                    <p style='color: #999; font-size: 12px;'>UniService &copy; {DateTime.Now.Year}</p>
                </div>
            </body>
            </html>";

            await SendViaBrevoAsync(emailDestino, $"Nuevo mensaje de {nombreRemitente} - UniService", htmlBody);
        }

        public async Task EnviarNotificacionSolicitud(
            string emailProveedor,
            string nombreProveedor,
            string nombreCliente,
            string tituloServicio,
            string tipoServicio,
            string descripcion,
            string presupuesto = "",
            string urgencia = "")
        {
            try
            {
                string pathHtml = Path.Combine(_env.WebRootPath, "templates", "email_solicitud.html");

                if (!File.Exists(pathHtml))
                {
                    Console.WriteLine($"[EMAIL] Plantilla no encontrada: {pathHtml}");
                    return;
                }

                string htmlBody = await File.ReadAllTextAsync(pathHtml);

                string presupuestoTexto = string.IsNullOrEmpty(presupuesto) ? "No especificado" : $"${presupuesto}";
                string urgenciaTexto = string.IsNullOrEmpty(urgencia) ? "Normal" : urgencia;

                htmlBody = htmlBody.Replace("{{nombreProveedor}}", nombreProveedor)
                                   .Replace("{{nombreCliente}}", nombreCliente)
                                   .Replace("{{tituloServicio}}", tituloServicio)
                                   .Replace("{{tipoServicio}}", tipoServicio)
                                   .Replace("{{descripcion}}", descripcion)
                                   .Replace("{{presupuesto}}", presupuestoTexto)
                                   .Replace("{{urgencia}}", urgenciaTexto);

                htmlBody = htmlBody.Replace("cid:logo_uniservice", LogoUrl);

                await SendViaBrevoAsync(emailProveedor, $"Nueva solicitud de servicio - UniService", htmlBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL] Error en notificación de solicitud: {ex.Message}");
            }
        }

        public async Task EnviarCodigoVerificacion(string emailDestino, string codigo)
        {
            try
            {
                string pathHtml = Path.Combine(_env.WebRootPath, "templates", "email_verificacion.html");

                if (!File.Exists(pathHtml))
                {
                    Console.WriteLine($"[EMAIL] Plantilla no encontrada: {pathHtml}");
                    return;
                }

                string htmlBody = await File.ReadAllTextAsync(pathHtml);
                htmlBody = htmlBody.Replace("{{codigo}}", codigo);

                htmlBody = htmlBody.Replace("cid:logo_uniservice", LogoUrl);

                await SendViaBrevoAsync(emailDestino, "Verifica tu cuenta - UniService", htmlBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL] Error enviando código: {ex.Message}");
            }
        }
        public async Task EnviarNotificacionNuevoServicio(
        string emailAdmin,
        string nombreAdmin,
        string nombreProveedor,
        string tituloServicio,
        int idServicio)
        {
            try
            {
                string htmlBody = $@"
    <html>
    <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
        <div style='max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px;'>
            <h2 style='color: #f59e0b;'>⏳ Nuevo servicio pendiente</h2>
            <p>El usuario <strong>{nombreProveedor}</strong> ha enviado un nuevo servicio para aprobación:</p>
            <div style='background: #f0f0f0; padding: 14px; border-radius: 8px; margin: 16px 0;'>
                <p style='margin: 0; font-size: 1rem;'><strong>{tituloServicio}</strong></p>
                <p style='margin: 6px 0 0; color: #666; font-size: 0.85rem;'>ID del servicio: #{idServicio}</p>
            </div>
            <p style='color: #555;'>Ingresa al panel de administración para revisar y aprobar o rechazar el servicio.</p>
            <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
            <p style='color: #999; font-size: 12px;'>UniService &copy; {DateTime.Now.Year}</p>
        </div>
    </body>
    </html>";

                await SendViaBrevoAsync(emailAdmin, $"Nuevo servicio pendiente de revisión - UniService", htmlBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL] ERROR: {ex.Message}");
            }
        }

        public async Task EnviarResultadoRevision(
    string emailProveedor,
    string nombreProveedor,
    string tituloServicio,
    bool aprobado,
    string? razonRechazo = null)
        {
            try
            {
                string colorTitulo = aprobado ? "#4ac7b6" : "#ef4444";
                string titulo = aprobado ? "¡Tu servicio fue aprobado!" : "Tu servicio fue rechazado";
                string cuerpo = aprobado
                    ? $"Tu servicio ha sido revisado por nuestro equipo y ha sido <strong style='color:#4ac7b6;'>aprobado</strong>. Ya está visible para todos los usuarios de UniService."
                    : $"Tu servicio ha sido revisado por nuestro equipo y lamentablemente <strong style='color:#ef4444;'>no pudo ser aprobado</strong> en esta ocasión.";

                string bloqueRazon = (!aprobado && !string.IsNullOrEmpty(razonRechazo))
                    ? $@"<div style='background-color:#1a0a0a;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;margin:20px 0;'>
                <p style='color:#ef4444;font-size:13px;font-weight:700;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;'>Motivo del rechazo</p>
                <p style='color:#ffffff;font-size:14px;line-height:1.6;margin:0;opacity:0.9;'>{razonRechazo}</p>
             </div>"
                    : "";

                string bloqueExtra = aprobado
                    ? @"<div style='text-align:center;margin:24px 0 8px 0;'>
                <a href='https://localhost:5173/home'
                   style='background-color:#4ac7b6;color:#031424;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block;'>
                    Ver mi servicio
                </a>
            </div>"
                    : @"<p style='color:#ffffff;font-size:14px;line-height:1.6;opacity:0.75;margin:16px 0 0 0;'>
                Puedes crear un nuevo servicio corrigiendo los puntos mencionados y enviarlo nuevamente para revisión.
            </p>";

                string logoSrc = LogoUrl;

                string htmlBody = $@"
<!DOCTYPE html>
<html lang='es'>
<body style='margin:0;padding:0;background-color:#031424;font-family:""Helvetica Neue"",Helvetica,Arial,sans-serif;'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='background-color:#031424;'>
        <tr>
            <td align='center' style='padding:20px 0;'>
                <table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='max-width:500px;margin:0 auto;background-color:#051a2d;border-radius:16px;overflow:hidden;border:1px solid #10304a;'>
                    <!-- Logo -->
                    <tr>
                        <td align='center' style='padding:36px 40px 20px 40px;'>
                            <img src='{logoSrc}' alt='UniService Logo' style='width:300px;height:auto;display:block;margin:0 auto;'>
                        </td>
                    </tr>
                    <tr>
                        <td align='center' style='padding:0;'>
                            <div style='height:1px;background:#10304a;margin:0 40px;'></div>
                        </td>
                    </tr>
                    <!-- Contenido -->
                    <tr>
                        <td align='left' style='padding:28px 40px 20px 40px;'>
                            <h2 style='color:{colorTitulo};font-size:22px;font-weight:700;margin:0 0 12px 0;letter-spacing:-0.5px;'>{titulo}</h2>
                            <p style='color:#ffffff;font-size:15px;line-height:1.7;margin:0 0 20px 0;opacity:0.85;'>
                                Hola, <strong style='color:#4ac7b6;'>{nombreProveedor}</strong>.
                            </p>

                            <!-- Card del servicio -->
                            <div style='background-color:#031424;border-radius:14px;padding:24px;margin-bottom:20px;border:1px solid #10304a;'>
                                <p style='color:#ffffff;font-size:13px;opacity:0.5;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;'>Servicio</p>
                                <h3 style='color:#4ac7b6;font-size:18px;margin:0 0 16px 0;'>{tituloServicio}</h3>
                                <p style='color:#ffffff;font-size:14px;line-height:1.7;margin:0;opacity:0.85;'>{cuerpo}</p>
                            </div>

                            {bloqueRazon}
                            {bloqueExtra}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align='center' style='padding:16px 20px;background-color:#031424;border-top:1px solid #10304a;'>
                            <p style='color:#4ac7b6;font-size:12px;margin:0;font-weight:600;opacity:0.8;'>© {DateTime.Now.Year} UniService. Tu socio de confianza.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";

                string subject = aprobado
                    ? "Tu servicio fue aprobado - UniService"
                    : "Tu servicio fue rechazado - UniService";

                await SendViaBrevoAsync(emailProveedor, subject, htmlBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL] ERROR al enviar resultado: {ex.Message}");
            }
        }
    }
}
