import '../../../../core/api_client.dart';
import '../../domain/repositories/provider_verification_repository.dart';
import 'package:http/http.dart' as http;

class ProviderVerificationRepositoryImpl
    implements ProviderVerificationRepository {
  const ProviderVerificationRepositoryImpl(this._api);

  final ApiClient _api;

  @override
  Future<Map<String, dynamic>> verification() async {
    final result = await _api.getJson('/partner/verification');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> createVerificationUpload({
    String contentType = 'image/jpeg',
    required int sizeBytes,
  }) async {
    final result = await _api.postJson('/files/presign', {
      'contentType': contentType,
      'visibility': 'PRIVATE',
      'purpose': 'provider-verification',
      'sizeBytes': sizeBytes,
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> uploadVerificationFile({
    required List<int> bytes,
    required String contentType,
  }) async {
    final uploadContract = await createVerificationUpload(
        contentType: contentType, sizeBytes: bytes.length);
    final file = _asMap(uploadContract['file']);
    final upload = _asMap(uploadContract['upload']);
    final fileId = file?['id']?.toString();
    final uploadUrl = upload?['url']?.toString();
    final method = upload?['method']?.toString().toUpperCase() ?? 'PUT';
    final headers = _stringHeaders(upload?['headers']);

    if (fileId == null || fileId.isEmpty) {
      throw StateError('Verification upload did not return a file id.');
    }
    if (uploadUrl == null || uploadUrl.isEmpty || uploadUrl.startsWith('/')) {
      throw StateError(
          'Storage upload URL is not configured. Run local storage or set S3/R2 env values.');
    }
    if (method != 'PUT') {
      throw StateError('Unsupported upload method: $method');
    }

    final response = await http.put(
      Uri.parse(uploadUrl),
      headers: headers,
      body: bytes,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
          'Verification file upload failed (${response.statusCode}).');
    }

    final completed = await _api.postJson('/files/$fileId/complete', {
      'sizeBytes': bytes.length,
    });
    return completed is Map<String, dynamic>
        ? completed
        : <String, dynamic>{'id': fileId};
  }

  @override
  Future<Map<String, dynamic>> submitVerification({
    List<String> fileIds = const [],
  }) async {
    final result = await _api
        .postJson('/partner/verification/submit', {'fileIds': fileIds});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

Map<String, String> _stringHeaders(dynamic value) {
  final map = _asMap(value);
  if (map == null) {
    return const <String, String>{};
  }
  return map.map((key, value) => MapEntry(key.toString(), value.toString()));
}
