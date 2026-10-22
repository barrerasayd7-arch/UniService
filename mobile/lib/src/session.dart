import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api.dart';

class Session extends ChangeNotifier {
  Session() { api = Api(baseUrl: baseUrl, token: () => _token, onExpired: signOut); }
  static const baseUrl = String.fromEnvironment('API_BASE_URL');
  static const tenant = String.fromEnvironment('MICROSOFT_TENANT_ID');
  static const clientId = String.fromEnvironment('MICROSOFT_MOBILE_CLIENT_ID');
  static const apiId = String.fromEnvironment('MICROSOFT_API_CLIENT_ID');
  static const redirect = 'co.edu.unicesar.uniservice:/oauthredirect';
  final _storage = const FlutterSecureStorage();
  final _auth = const FlutterAppAuth();
  late final Api api;
  String? _token;
  Map<String, dynamic>? user;
  bool restoring = true;
  bool busy = false;
  String? error;
  bool get signedIn => _token != null;
  int get userId => user!['id'] as int;

  Future<void> restore() async {
    try {
      final raw = await _storage.read(key: 'uniservice_session');
      if (raw != null) {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        if (DateTime.parse(data['expires_at'] as String).isAfter(DateTime.now().toUtc())) {
          _token = data['token'] as String;
          user = Map<String, dynamic>.from(data['user'] as Map);
        } else { await _storage.delete(key: 'uniservice_session'); }
      }
    } catch (_) {
      _token = null; user = null;
      error = 'No se pudo restaurar la sesión. Vuelve a iniciar sesión.';
    } finally { restoring = false; notifyListeners(); }
  }
  Future<void> signIn() async {
    busy = true; error = null; notifyListeners();
    try {
      if (baseUrl.isEmpty || tenant.isEmpty || clientId.isEmpty || apiId.isEmpty) throw const ApiException('Falta configurar la API y el acceso institucional Microsoft. Consulta mobile/README.md.', 0);
      // AppAuth gestiona navegador externo, state y Authorization Code + PKCE.
      final result = await _auth.authorizeAndExchangeCode(AuthorizationTokenRequest(
        clientId, redirect,
        discoveryUrl: 'https://login.microsoftonline.com/$tenant/v2.0/.well-known/openid-configuration',
        scopes: ['openid', 'profile', 'email', 'api://$apiId/access_as_user'],
        promptValues: ['select_account'],
      ));
      if (result.accessToken == null) throw const ApiException('Microsoft no devolvió una sesión válida.', 401);
      final data = Map<String, dynamic>.from(await api.request('POST', '/api/auth/microsoft-login', bearer: result.accessToken) as Map);
      await _storage.write(key: 'uniservice_session', value: jsonEncode(data));
      _token = data['token'] as String; user = Map<String, dynamic>.from(data['user'] as Map);
    } on FlutterAppAuthUserCancelledException { error = null; }
    on ApiException catch (e) { error = e.message; }
    catch (_) { error = 'No se pudo conectar con Microsoft o con la API. Revisa tu conexión e inténtalo de nuevo.'; }
    finally { busy = false; notifyListeners(); }
  }
  Future<void> signOut() async {
    _token = null; user = null; notifyListeners();
    try { await _storage.delete(key: 'uniservice_session'); }
    catch (_) { error = 'La sesión se cerró, pero no se pudo limpiar el almacenamiento del dispositivo.'; notifyListeners(); }
  }
  @override
  void dispose() { api.dispose(); super.dispose(); }
}
