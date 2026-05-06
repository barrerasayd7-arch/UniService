using MailKit.Net.Smtp;
using MimeKit;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Threading.Tasks;

namespace UniserviceAPI.Services
{
    public class EmailService
    {
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _config;

        public EmailService(IWebHostEnvironment env, IConfiguration config)
        {
            _env = env;
            _config = config;
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
            var mensaje = new MimeMessage();

            mensaje.From.Add(new MailboxAddress("UniService", _config["EmailSettings:Email"]));
            mensaje.To.Add(new MailboxAddress(nombreProveedor, emailProveedor));
            mensaje.Subject = $"📩 Nueva solicitud para tu servicio: {tituloServicio}";

            string presupuestoTexto = string.IsNullOrEmpty(presupuesto) ? "No especificado" : $"${presupuesto}";
            string urgenciaTexto = string.IsNullOrEmpty(urgencia) ? "Normal" : urgencia;

            var builder = new BodyBuilder();
            builder.HtmlBody = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <div style='background: #0a1929; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;'>
                        <h1 style='color: #4ac7b6; margin: 0;'>UniService</h1>
                        <p style='color: #fff; margin: 5px 0 0;'>Nueva solicitud de servicio</p>
                    </div>
                    <div style='background: #0d1f33; padding: 30px; border-radius: 0 0 12px 12px; color: #fff;'>
                        <h2 style='color: #4ac7b6;'>Hola {nombreProveedor}!</h2>
                        <p><strong>{nombreCliente}</strong> ha enviado una solicitud para tu servicio:</p>
                        <div style='background: rgba(74, 199, 182, 0.1); border-left: 4px solid #4ac7b6; padding: 15px; margin: 15px 0; border-radius: 4px;'>
                            <h3 style='margin: 0 0 10px; color: #fff;'>{tituloServicio}</h3>
                            <p style='margin: 5px 0;'><strong>Tipo:</strong> {tipoServicio}</p>
                            <p style='margin: 5px 0;'><strong>Descripción:</strong> {descripcion}</p>
                            <p style='margin: 5px 0;'><strong>Presupuesto:</strong> {presupuestoTexto}</p>
                            <p style='margin: 5px 0;'><strong>Urgencia:</strong> {urgenciaTexto}</p>
                        </div>
                        <p>Puedes aceptar o rechazar esta solicitud desde tu panel de UniService.</p>
                        <div style='text-align: center; margin: 25px 0;'>
                            <a href='https://localhost:5173/home#solicitudes'
                               style='background: #4ac7b6; color: #0a1929; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;'>
                                Ver solicitudes en UniService
                            </a>
                        </div>
                        <p style='color: #888; font-size: 12px; margin-top: 20px;'>
                            Este es un mensaje automático, por favor no respondas a este correo.
                        </p>
                    </div>
                </div>";

            mensaje.Body = builder.ToMessageBody();

            using var client = new SmtpClient();
            try
            {
                await client.ConnectAsync(
                    _config["EmailSettings:Host"],
                    int.Parse(_config["EmailSettings:Port"]),
                    MailKit.Security.SecureSocketOptions.StartTls
                );

                await client.AuthenticateAsync(
                    _config["EmailSettings:Email"],
                    _config["EmailSettings:Password"]
                );

                await client.SendAsync(mensaje);
            }
            finally
            {
                await client.DisconnectAsync(true);
                client.Dispose();
            }
        }

        public async Task EnviarCodigoVerificacion(string emailDestino, string codigo)
        {
            var mensaje = new MimeMessage();

            // Configuraci�n del Remitente usando EmailSettings del JSON
            mensaje.From.Add(new MailboxAddress("UniService", _config["EmailSettings:Email"]));
            mensaje.To.Add(new MailboxAddress("", emailDestino));
            mensaje.Subject = "Verifica tu cuenta - UniService";

            var builder = new BodyBuilder();

            // 1. Cargar la plantilla HTML desde wwwroot/templates
            string pathHtml = Path.Combine(_env.WebRootPath, "templates", "email_verificacion.html");

            if (!File.Exists(pathHtml))
            {
                throw new FileNotFoundException("No se encontr� la plantilla HTML en la ruta: " + pathHtml);
            }

            string htmlBody = await File.ReadAllTextAsync(pathHtml);

            // 2. Inyectar el c�digo din�mico
            htmlBody = htmlBody.Replace("{{codigo}}", codigo);

            // 3. Embeber el logo local mediante Content-ID (CID)
            string pathLogo = Path.Combine(_env.WebRootPath, "img", "logo_uniservice.png");

            if (File.Exists(pathLogo))
            {
                var image = builder.LinkedResources.Add(pathLogo);
                image.ContentId = "logo_uniservice";
            }

            builder.HtmlBody = htmlBody;
            mensaje.Body = builder.ToMessageBody();

            // 4. Configuraci�n y env�o mediante SMTP
            using var client = new MailKit.Net.Smtp.SmtpClient();

            try
            {
                // Conexi�n usando las llaves exactas de tu appsettings.json
                await client.ConnectAsync(
                    _config["EmailSettings:Host"],
                    int.Parse(_config["EmailSettings:Port"]),
                    MailKit.Security.SecureSocketOptions.StartTls
                );

                await client.AuthenticateAsync(
                    _config["EmailSettings:Email"],
                    _config["EmailSettings:Password"]
                );

                await client.SendAsync(mensaje);
            }
            finally
            {
                await client.DisconnectAsync(true);
                client.Dispose();
            }
        }
    }
}