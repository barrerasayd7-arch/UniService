import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

class Api {
  Api({required this.baseUrl, required this.token, required this.onExpired, http.Client? client}) : _client = client ?? http.Client();
  final String baseUrl;
  final String? Function() token;
  final Future<void> Function() onExpired;
  final http.Client _client;

  Future<dynamic> request(String method, String path, {Object? body, String? bearer}) async {
    final uri = Uri.parse('$baseUrl$path');
    if (uri.scheme != 'https') throw const ApiException('Configura una dirección HTTPS para la API.', 0);
    final request = http.Request(method, uri)
      ..headers['Accept'] = 'application/json'
      ..headers['Authorization'] = 'Bearer ${bearer ?? token() ?? ''}';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final response = await (() async {
      final streamed = await _client.send(request);
      return http.Response.fromStream(streamed);
    })().timeout(const Duration(seconds: 25));
    dynamic data;
    try { data = response.body.isEmpty ? null : jsonDecode(response.body); }
    on FormatException { throw ApiException('El servidor devolvió una respuesta inesperada.', response.statusCode); }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (bearer == null && (response.statusCode == 401 || (data is Map && data['code'] == 'institutional_session_required'))) await onExpired();
      throw ApiException(data is Map ? (data['error'] ?? 'No se pudo completar la solicitud.').toString() : 'No se pudo completar la solicitud.', response.statusCode);
    }
    return data;
  }
  Future<List<Map<String, dynamic>>> list(String path) async => (await request('GET', path) as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  void dispose() => _client.close();
}
