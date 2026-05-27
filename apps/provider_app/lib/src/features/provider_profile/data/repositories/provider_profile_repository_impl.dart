import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../../map/data/datasources/provider_device_location_datasource.dart';
import '../datasources/provider_device_identity_datasource.dart';
import '../../domain/repositories/provider_profile_repository.dart';
import 'package:http/http.dart' as http;

class ProviderProfileRepositoryImpl implements ProviderProfileRepository {
  const ProviderProfileRepositoryImpl({
    required ApiClient api,
    required RealtimeSocket socket,
    required ProviderDeviceLocationDataSource locationDataSource,
    required ProviderDeviceIdentityDataSource deviceIdentityDataSource,
  })  : _api = api,
        _socket = socket,
        _locationDataSource = locationDataSource,
        _deviceIdentityDataSource = deviceIdentityDataSource;

  final ApiClient _api;
  final RealtimeSocket _socket;
  final ProviderDeviceLocationDataSource _locationDataSource;
  final ProviderDeviceIdentityDataSource _deviceIdentityDataSource;

  @override
  Future<void> goOnline() async {
    await recordDeviceSession();
    await _api.postJson('/provider/online', {});
    try {
      await updateLocation();
    } catch (_) {
      await _api.postJson('/provider/offline', {});
      rethrow;
    }
  }

  @override
  Future<Map<String, dynamic>> recordDeviceSession() async {
    final identity = await _deviceIdentityDataSource.currentIdentity();
    final result =
        await _api.postJson('/provider/device-session', identity.toJson());
    final record = result is Map<String, dynamic>
        ? result
        : <String, dynamic>{'ok': true};
    final providerBlocked =
        record['providerBlocked'] == true || record['blockedScope'] == 'provider';
    if (record['blocked'] == true || providerBlocked) {
      final device = _asMap(record['device']);
      final reason = record['blockReason']?.toString() ??
          (providerBlocked ? null : device?['blockReason']?.toString());
      final subject = providerBlocked ? 'provider account' : 'device';
      throw StateError(
        reason == null || reason.isEmpty
            ? 'This $subject is blocked by admin review.'
            : 'This $subject is blocked by admin review: $reason',
      );
    }
    return record;
  }

  @override
  Future<void> goOffline() async {
    await _api.postJson('/provider/offline', {});
  }

  @override
  Future<Map<String, double>> updateLocation({String? bookingId}) async {
    final position = await _locationDataSource.currentPosition();
    final resolved = await _resolveProviderLocation(
      lat: position?.latitude,
      lng: position?.longitude,
    );
    final lat = resolved['lat'];
    final lng = resolved['lng'];
    if (lat == null || lng == null) {
      throw StateError(
          'Location permission is required before sharing partner location.');
    }
    await _api.postJson('/provider/location', {'lat': lat, 'lng': lng});
    _socket.updateLocation(lat: lat, lng: lng, bookingId: bookingId);
    return {'lat': lat, 'lng': lng};
  }

  @override
  Future<Map<String, dynamic>> providerMe() async {
    final result = await _api.getJson('/provider/me');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> uploadProfileImage({
    required List<int> bytes,
    required String contentType,
  }) async {
    return _uploadProviderMedia(
      bytes: bytes,
      contentType: contentType,
      purpose: 'profile-image',
      errorLabel: 'Profile image',
    );
  }

  @override
  Future<Map<String, dynamic>> uploadGalleryImage({
    required List<int> bytes,
    required String contentType,
  }) async {
    return _uploadProviderMedia(
      bytes: bytes,
      contentType: contentType,
      purpose: 'provider-gallery',
      errorLabel: 'Gallery image',
    );
  }

  Future<Map<String, dynamic>> _uploadProviderMedia({
    required List<int> bytes,
    required String contentType,
    required String purpose,
    required String errorLabel,
  }) async {
    final uploadContract = await _api.postJson('/files/presign', {
      'contentType': contentType,
      'visibility': 'PUBLIC',
      'purpose': purpose,
    });
    final contract = _asMap(uploadContract);
    final file = _asMap(contract?['file']);
    final upload = _asMap(contract?['upload']);
    final fileId = file?['id']?.toString();
    final uploadUrl = upload?['url']?.toString();
    final method = upload?['method']?.toString().toUpperCase() ?? 'PUT';
    final headers = _stringHeaders(upload?['headers']);

    if (fileId == null || fileId.isEmpty) {
      throw StateError('$errorLabel upload did not return a file id.');
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
      throw StateError('$errorLabel upload failed (${response.statusCode}).');
    }

    final completed = await _api.postJson('/files/$fileId/complete', {
      'sizeBytes': bytes.length,
    });
    return completed is Map<String, dynamic>
        ? completed
        : <String, dynamic>{'id': fileId};
  }

  Future<Map<String, double?>> _resolveProviderLocation({
    double? lat,
    double? lng,
  }) async {
    if (lat != null && lng != null && _isVietnamCoordinate(lat, lng)) {
      return {'lat': lat, 'lng': lng};
    }

    final me = await providerMe();
    final profile = me['providerProfile'] as Map<String, dynamic>?;
    final profileLat = _asNum(profile?['currentLat'])?.toDouble();
    final profileLng = _asNum(profile?['currentLng'])?.toDouble();
    if (profileLat != null &&
        profileLng != null &&
        _isVietnamCoordinate(profileLat, profileLng)) {
      return {'lat': profileLat, 'lng': profileLng};
    }

    return {'lat': null, 'lng': null};
  }
}

bool _isVietnamCoordinate(double lat, double lng) {
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0;
}

num? _asNum(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value);
  }
  return null;
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
