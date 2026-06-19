import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

class ProviderDeviceLocationDataSource {
  Future<Position?> currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return null;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
  }

  Future<String?> addressTextForPosition(Position position) async {
    try {
      await setLocaleIdentifier('vi_VN');
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (placemarks.isEmpty) {
        return null;
      }
      return _formatPartnerActionAddress(placemarks.first);
    } catch (_) {
      return null;
    }
  }
}

String? _formatPartnerActionAddress(Placemark placemark) {
  final area = _firstNonBlank([
    placemark.subLocality,
    placemark.locality,
    placemark.subAdministrativeArea,
  ]);
  final city = _firstNonBlank([
    placemark.administrativeArea,
    placemark.locality,
    placemark.country,
  ]);
  final parts = <String>[];
  if (area != null) {
    parts.add(area);
  }
  if (city != null && city != area) {
    parts.add(city);
  }
  return parts.isEmpty ? null : parts.join(', ');
}

String? _firstNonBlank(List<String?> values) {
  for (final value in values) {
    final normalized = value?.trim();
    if (normalized != null && normalized.isNotEmpty) {
      return normalized;
    }
  }
  return null;
}
