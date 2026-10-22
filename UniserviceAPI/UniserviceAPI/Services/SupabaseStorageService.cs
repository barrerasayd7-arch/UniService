using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace UniserviceAPI.Services
{
    public class SupabaseStorageService
    {
        private readonly HttpClient _httpClient;
        private readonly string _supabaseUrl;
        private readonly string _serviceKey;
        private readonly string _bucketName = "imagenes-servicios";

        public SupabaseStorageService(IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _supabaseUrl = (config["Supabase:Url"] ?? "https://mpdeejiivmctbqcfflbz.supabase.co").Trim();
            _serviceKey = (config["Supabase:ServiceKey"] ?? "").Trim();
            _httpClient = httpClientFactory.CreateClient();
        }

        public async Task<string> SubirImagenAsync(int idServicio, IFormFile archivo, int indice)
        {
            if (string.IsNullOrEmpty(_serviceKey))
                throw new System.Exception("Supabase Service Key no configurada");

            // Generar nombre único: servicios/{id_servicio}/imagen_{indice}_{timestamp}.{ext}
            var extension = System.IO.Path.GetExtension(archivo.FileName);
            var nombreArchivo = $"servicios/{idServicio}/imagen_{indice}_{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}{extension}";

            // URL del endpoint de Storage
            var url = $"{_supabaseUrl}/storage/v1/object/{_bucketName}/{nombreArchivo}";

            // Leer el contenido del archivo
            using var memoryStream = new System.IO.MemoryStream();
            await archivo.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();

            // Configurar request
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("apikey", _serviceKey);
            request.Headers.Add("Authorization", $"Bearer {_serviceKey}");
            request.Headers.Add("x-upsert", "true");
            request.Content = new ByteArrayContent(fileBytes);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue(archivo.ContentType);

            // Enviar request
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new System.Exception($"Error subiendo imagen a Supabase: {response.StatusCode} - {errorContent}");
            }

            // Retornar URL pública
            return $"{_supabaseUrl}/storage/v1/object/public/{_bucketName}/{nombreArchivo}";
        }

        // Sube bytes ya validados a {bucket}/{ruta} y devuelve la URL pública.
        public async Task<string> SubirAsync(string ruta, byte[] datos, string contentType, CancellationToken ct = default)
        {
            if (string.IsNullOrEmpty(_serviceKey))
                throw new InvalidOperationException("Supabase Service Key no configurada");

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_supabaseUrl}/storage/v1/object/{_bucketName}/{ruta}");
            request.Headers.Add("apikey", _serviceKey);
            request.Headers.Add("Authorization", $"Bearer {_serviceKey}");
            request.Content = new ByteArrayContent(datos);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

            using var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Supabase Storage respondió {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync(ct)}");
            return $"{_supabaseUrl}/storage/v1/object/public/{_bucketName}/{ruta}";
        }

        public async Task<bool> EliminarImagenAsync(string urlImagen)
        {
            if (string.IsNullOrEmpty(_serviceKey))
                return false;

            // Extraer el path del archivo desde la URL
            // URL formato: https://xxx.supabase.co/storage/v1/object/public/bucket/path/to/file.jpg
            var uri = new Uri(urlImagen);
            var pathSegments = uri.AbsolutePath.Split('/');
            
            // Encontrar el índice del bucket y construir el path
            var bucketIndex = System.Array.IndexOf(pathSegments, _bucketName);
            if (bucketIndex == -1) return false;
            
            // Lo que va después del nombre del bucket (antes se incluía el bucket y el borrado fallaba).
            var nombreArchivo = string.Join("/", pathSegments.Skip(bucketIndex + 1));

            var url = $"{_supabaseUrl}/storage/v1/object/{_bucketName}/{nombreArchivo}";

            var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", _serviceKey);
            request.Headers.Add("Authorization", $"Bearer {_serviceKey}");

            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }

        public async Task<List<string>> SubirMultiplesImagenesAsync(int idServicio, List<IFormFile> archivos)
        {
            var urls = new List<string>();
            
            Console.WriteLine($"[Supabase] Subiendo {archivos.Count} imágenes para servicio {idServicio}");
            
            for (int i = 0; i < archivos.Count; i++)
            {
                try
                {
                    Console.WriteLine($"[Supabase] Subiendo imagen {i + 1}/{archivos.Count}: {archivos[i].FileName}");
                    var url = await SubirImagenAsync(idServicio, archivos[i], i + 1);
                    urls.Add(url);
                    Console.WriteLine($"[Supabase] Imagen {i + 1} subida exitosamente");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Supabase] ERROR subiendo imagen {i + 1}: {ex.Message}");
                    throw;
                }
            }
            
            Console.WriteLine($"[Supabase] Total imágenes subidas: {urls.Count}");
            return urls;
        }
    }
}
