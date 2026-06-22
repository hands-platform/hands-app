import 'package:customer_app/src/features/booking/presentation/customer_booking_flow_screens.dart';
import 'package:customer_app/src/features/map/data/datasources/customer_device_location_datasource.dart';
import 'package:customer_app/src/features/map/presentation/providers/map_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  testWidgets(
    'does not refresh gps before the service location is explicitly chosen',
    (tester) async {
      var currentPositionCalls = 0;
      final locationSource = CustomerDeviceLocationDataSource(
        isLocationServiceEnabled: () async => true,
        checkPermission: () async => LocationPermission.whileInUse,
        getCurrentPosition: ({LocationSettings? locationSettings}) async {
          currentPositionCalls++;
          return _position(
            latitude: 10.7769,
            longitude: 106.7009,
          );
        },
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerLocationProvider.overrideWithValue(locationSource),
          ],
          child: MaterialApp(
            home: BookingConfirmationPage(
              providerDetail: const {
                'id': 'partner-1',
                'displayName': 'Smoke Partner',
                'distanceMeters': 1200,
                'ratingAvg': 4.8,
                'reviewCount': 12,
              },
              selectedService: const {
                'id': 'service-1',
                'name': 'Aroma Massage',
                'durationMinutes': 60,
                'basePrice': 300000,
              },
            ),
          ),
        ),
      );
      await tester.pump();

      expect(currentPositionCalls, 0);
      expect(
          find.text(
              'Please confirm the service location on the map before booking.'),
          findsNothing);
    },
  );
}

Position _position({
  required double latitude,
  required double longitude,
}) {
  return Position(
    longitude: longitude,
    latitude: latitude,
    timestamp: DateTime.utc(2026),
    accuracy: 12,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}
