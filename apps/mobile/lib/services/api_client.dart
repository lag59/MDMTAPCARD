import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8000');

class ApiClient {
  static const _storage = FlutterSecureStorage();
  static late final Dio _dio;

  static String get baseUrl => _baseUrl;

  static void init() {
    _dio = Dio(BaseOptions(baseUrl: _baseUrl))
      ..interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ));
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _dio.post('/api/v1/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = res.data as Map<String, dynamic>;
    await _storage.write(key: 'access_token', value: data['access_token']);
    await _storage.write(key: 'role', value: data['role']);
    return data;
  }

  static Future<void> logout() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'role');
  }

  static Future<String?> getRole() async {
    return _storage.read(key: 'role');
  }

  static Future<bool> canProgramNfc() async {
    final role = await getRole();
    return role == 'super_admin' || role == 'business_owner';
  }

  // ── Profiles ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> createProfile(Map<String, dynamic> body) async {
    final res = await _dio.post('/api/v1/profiles/', data: body);
    return res.data;
  }

  static Future<Map<String, dynamic>> getProfile(String slug) async {
    final res = await _dio.get('/api/v1/profiles/$slug');
    return res.data;
  }

  // ── NFC ───────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> prepareTag(String profileId) async {
    final res = await _dio.post('/api/v1/profiles/$profileId/nfc/prepare');
    return res.data;
  }

  static Future<Map<String, dynamic>> confirmWrite({
    required String tagId,
    required String verifiedUrl,
    String? tagUid,
    String? tagType,
    int? capacityBytes,
  }) async {
    final res = await _dio.post(
      '/api/v1/nfc-tags/$tagId/confirm',
      data: {
        'verified_url': verifiedUrl,
        if (tagUid != null) 'tag_uid': tagUid,
        if (tagType != null) 'tag_type': tagType,
        if (capacityBytes != null) 'capacity_bytes': capacityBytes,
      },
    );
    return res.data;
  }

  static Future<void> finalizeTag(String tagId) async {
    await _dio.post('/api/v1/nfc/lock', data: {'tag_id': tagId});
  }

  static Future<void> disableTag(String tagId, {String? reason}) async {
    await _dio.post('/api/v1/nfc-tags/$tagId/disable', data: {'reason': reason});
  }

  static Future<void> replaceTag(String tagId, {String? reason}) async {
    await _dio.post('/api/v1/nfc-tags/$tagId/replace', data: {'reason': reason});
  }

  static Future<Map<String, dynamic>> getProfileNfcStatus(String profileId) async {
    final res = await _dio.get('/api/v1/profiles/$profileId/nfc');
    return res.data;
  }

  static Future<List<dynamic>> getInventory() async {
    final res = await _dio.get('/api/v1/nfc/inventory');
    return res.data as List<dynamic>;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getDashboard() async {
    final res = await _dio.get('/api/v1/admin/dashboard');
    return res.data;
  }

  static Future<List<dynamic>> getCompanies() async {
    final res = await _dio.get('/api/v1/admin/companies');
    return res.data as List<dynamic>;
  }
}
