import 'package:geolocator/geolocator.dart';

typedef CustomerDeviceGetCurrentPosition = Future<Position> Function({
  LocationSettings? locationSettings,
});

class CustomerDeviceLocationDataSource {
  CustomerDeviceLocationDataSource({
    DateTime Function()? now,
    Duration minRefreshInterval = const Duration(minutes: 15),
    Future<bool> Function()? isLocationServiceEnabled,
    Future<LocationPermission> Function()? checkPermission,
    Future<LocationPermission> Function()? requestPermission,
    CustomerDeviceGetCurrentPosition? getCurrentPosition,
  })  : _now = now ?? DateTime.now,
        _minRefreshInterval = minRefreshInterval,
        _isLocationServiceEnabled =
            isLocationServiceEnabled ?? Geolocator.isLocationServiceEnabled,
        _checkPermission = checkPermission ?? Geolocator.checkPermission,
        _requestPermission = requestPermission ?? Geolocator.requestPermission,
        _getCurrentPosition =
            getCurrentPosition ?? Geolocator.getCurrentPosition;

  final DateTime Function() _now;
  final Duration _minRefreshInterval;
  final Future<bool> Function() _isLocationServiceEnabled;
  final Future<LocationPermission> Function() _checkPermission;
  final Future<LocationPermission> Function() _requestPermission;
  final CustomerDeviceGetCurrentPosition _getCurrentPosition;

  Position? _cachedPosition;
  DateTime? _cachedAt;

  Future<Position?> currentPosition() async {
    final cachedPosition = _cachedPosition;
    final cachedAt = _cachedAt;
    if (cachedPosition != null &&
        cachedAt != null &&
        _now().difference(cachedAt) < _minRefreshInterval) {
      return cachedPosition;
    }

    if (!await _isLocationServiceEnabled()) {
      return null;
    }

    var permission = await _checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await _requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    final position = await _getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
    _cachedPosition = position;
    _cachedAt = _now();
    return position;
  }
}
