import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../../map/data/datasources/provider_device_location_datasource.dart';
import '../../domain/repositories/provider_profile_repository.dart';

class ProviderProfileRepositoryImpl implements ProviderProfileRepository {
  const ProviderProfileRepositoryImpl({
    required ApiClient api,
    required RealtimeSocket socket,
    required ProviderDeviceLocationDataSource locationDataSource,
  })  : _api = api,
        _socket = socket,
        _locationDataSource = locationDataSource;

  final ApiClient _api;
  final RealtimeSocket _socket;
  final ProviderDeviceLocationDataSource _locationDataSource;

  @override
  Future<void> goOnline() async {
    await _api.postJson('/provider/online', {});
    try {
      await updateLocation();
    } catch (_) {
      await _api.postJson('/provider/offline', {});
      rethrow;
    }
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
          'Location permission is required before sharing provider location.');
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
