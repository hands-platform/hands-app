import 'package:customer_app/src/features/map/data/datasources/customer_device_location_datasource.dart';
import 'package:customer_app/src/features/map/presentation/customer_map_widgets.dart';
import 'package:customer_app/src/features/map/presentation/providers/map_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  testWidgets(
    'does not refresh gps until the customer taps current location',
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
          child: const MaterialApp(
            home: LocationSelectionPage(
              initialLatitude: 10.7769,
              initialLongitude: 106.7009,
              initialAddress: 'District 1, Ho Chi Minh City',
            ),
          ),
        ),
      );
      await tester.pump();

      expect(currentPositionCalls, 0);

      await tester.tap(find.byIcon(Icons.my_location_rounded));
      await tester.pumpAndSettle();

      expect(currentPositionCalls, 1);
    },
  );

  testWidgets(
    'requires an exact location action before confirming a fallback pin',
    (tester) async {
      final locationSource = CustomerDeviceLocationDataSource(
        isLocationServiceEnabled: () async => true,
        checkPermission: () async => LocationPermission.whileInUse,
        getCurrentPosition: ({LocationSettings? locationSettings}) async {
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
          child: const MaterialApp(
            home: LocationSelectionPage(
              initialLatitude: 10.7769,
              initialLongitude: 106.7009,
              initialAddress: 'District 1, Ho Chi Minh City',
              initialLocationRequiresConfirmation: true,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('SELECT SERVICE ADDRESS'), findsOneWidget);
      expect(find.text('Use this address'), findsOneWidget);
      var confirmButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Use this address'),
      );
      expect(confirmButton.onPressed, isNull);

      await tester.tap(find.byIcon(Icons.my_location_rounded));
      await tester.pumpAndSettle();

      confirmButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Use this address'),
      );
      expect(confirmButton.onPressed, isNotNull);
      expect(find.text('Current location selected.'), findsNothing);
      expect(
        find.textContaining('Current location selected'),
        findsOneWidget,
      );
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
