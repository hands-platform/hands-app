import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/local_demo_access.dart';

const double demoCustomerLat = 10.7769;
const double demoCustomerLng = 106.7009;
const String demoCustomerCity = 'Ho Chi Minh City';
const String demoCustomerAddress = 'District 1, Ho Chi Minh City, Vietnam';

final selectedCustomerLocationProvider =
    StateProvider<SelectedCustomerLocation?>((ref) => null);

class SelectedCustomerLocation {
  const SelectedCustomerLocation({
    this.id,
    required this.latitude,
    required this.longitude,
    required this.addressText,
  });

  final String? id;
  final double latitude;
  final double longitude;
  final String addressText;

  SelectedCustomerLocation copyWith({
    String? id,
    double? latitude,
    double? longitude,
    String? addressText,
  }) {
    return SelectedCustomerLocation(
      id: id ?? this.id,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      addressText: addressText ?? this.addressText,
    );
  }
}

class CustomerLocationSnapshot {
  const CustomerLocationSnapshot({
    required this.latitude,
    required this.longitude,
    this.addressText,
    this.isDemoLocation = false,
    this.currentLatitude,
    this.currentLongitude,
  });

  final double latitude;
  final double longitude;
  final String? addressText;
  final bool isDemoLocation;
  final double? currentLatitude;
  final double? currentLongitude;
}

CustomerLocationSnapshot defaultVietnamDiscoveryLocation() {
  if (!localDemoAccessEnabled) {
    throw StateError(
      'Choose a Vietnam service location before browsing nearby partners.',
    );
  }
  return const CustomerLocationSnapshot(
    latitude: demoCustomerLat,
    longitude: demoCustomerLng,
    addressText: demoCustomerAddress,
    isDemoLocation: true,
  );
}

CustomerLocationSnapshot discoveryLocationFromSelected(
  SelectedCustomerLocation selected,
) {
  if (isVietnamCoordinate(selected.latitude, selected.longitude)) {
    return CustomerLocationSnapshot(
      latitude: selected.latitude,
      longitude: selected.longitude,
      addressText: selected.addressText,
    );
  }
  return defaultVietnamDiscoveryLocation();
}

String locationTitle(String addressText, bool isDemoLocation) {
  if (isDemoLocation) {
    return demoCustomerCity;
  }
  final first = addressText.split(',').first.trim();
  if (first.isEmpty || first.startsWith('Map pin:')) {
    return 'Selected location';
  }
  return first;
}

bool isVietnamCoordinate(double lat, double lng) {
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0;
}
