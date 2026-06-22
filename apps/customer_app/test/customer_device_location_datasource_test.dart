import 'package:customer_app/src/features/map/data/datasources/customer_device_location_datasource.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  test('reuses customer GPS for 15 minutes before refreshing', () async {
    var now = DateTime.utc(2026, 6, 23, 1);
    var currentPositionCalls = 0;
    final dataSource = CustomerDeviceLocationDataSource(
      now: () => now,
      isLocationServiceEnabled: () async => true,
      checkPermission: () async => LocationPermission.always,
      requestPermission: () async => LocationPermission.always,
      getCurrentPosition: ({LocationSettings? locationSettings}) async {
        currentPositionCalls += 1;
        return _position(
          latitude: 10.7769 + currentPositionCalls,
          longitude: 106.7009,
          timestamp: now,
        );
      },
    );

    final first = await dataSource.currentPosition();
    now = now.add(const Duration(minutes: 14));
    final second = await dataSource.currentPosition();

    expect(identical(first, second), isTrue);
    expect(currentPositionCalls, 1);

    now = now.add(const Duration(minutes: 2));
    final third = await dataSource.currentPosition();

    expect(identical(first, third), isFalse);
    expect(currentPositionCalls, 2);
  });
}

Position _position({
  required double latitude,
  required double longitude,
  required DateTime timestamp,
}) {
  return Position(
    longitude: longitude,
    latitude: latitude,
    timestamp: timestamp,
    accuracy: 1,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}
