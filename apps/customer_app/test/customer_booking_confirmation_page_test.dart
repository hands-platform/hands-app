import 'package:customer_app/src/app_state.dart';
import 'package:customer_app/src/features/booking/domain/repositories/customer_booking_repository.dart';
import 'package:customer_app/src/features/booking/presentation/customer_booking_flow_screens.dart';
import 'package:customer_app/src/features/chat/domain/repositories/chat_repository.dart';
import 'package:customer_app/src/features/coupon/domain/repositories/customer_coupon_repository.dart';
import 'package:customer_app/src/features/discovery/domain/repositories/customer_discovery_repository.dart';
import 'package:customer_app/src/features/map/data/datasources/customer_device_location_datasource.dart';
import 'package:customer_app/src/features/notification/domain/entities/push_token_registration_result.dart';
import 'package:customer_app/src/features/notification/domain/repositories/push_notification_repository.dart';
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
            customerRepositoryProvider.overrideWithValue(CustomerRepository(
              _FakeDiscoveryRepository(),
              _RecordingBookingRepository(),
              _FakeChatRepository(),
              _FakeCouponRepository(),
              _FakePushNotificationRepository(),
            )),
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

  testWidgets(
    'refreshes current gps evidence only when the customer submits booking',
    (tester) async {
      var currentPositionCalls = 0;
      final locationSource = CustomerDeviceLocationDataSource(
        isLocationServiceEnabled: () async => true,
        checkPermission: () async => LocationPermission.whileInUse,
        getCurrentPosition: ({LocationSettings? locationSettings}) async {
          currentPositionCalls++;
          return _position(
            latitude: 10.777,
            longitude: 106.701,
          );
        },
      );
      final bookingRepository = _RecordingBookingRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            customerLocationProvider.overrideWithValue(locationSource),
            customerRepositoryProvider.overrideWithValue(CustomerRepository(
              _FakeDiscoveryRepository(),
              bookingRepository,
              _FakeChatRepository(),
              _FakeCouponRepository(),
              _FakePushNotificationRepository(),
            )),
          ],
          child: MaterialApp(
            home: BookingConfirmationPage(
              initialCustomerLat: 10.7769,
              initialCustomerLng: 106.7009,
              initialCustomerAddress: 'District 1, Ho Chi Minh City',
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

      await tester.tap(find.byType(FilledButton).last);
      await tester.pumpAndSettle();

      expect(currentPositionCalls, 1);
      expect(bookingRepository.currentLat, 10.777);
      expect(bookingRepository.currentLng, 106.701);
      expect(bookingRepository.currentLocationUpdatedAt, isNotNull);
      expect(bookingRepository.paymentMethod, 'CASH');
    },
  );

  testWidgets('sends the payment method selected from the API catalog',
      (tester) async {
    final bookingRepository = _RecordingBookingRepository(
      paymentMethods: const [
        CustomerPaymentMethodOption.cash,
        CustomerPaymentMethodOption(
          method: 'MOMO',
          label: 'MoMo',
          requiresRedirect: true,
        ),
      ],
    );
    final locationSource = CustomerDeviceLocationDataSource(
      isLocationServiceEnabled: () async => true,
      checkPermission: () async => LocationPermission.whileInUse,
      getCurrentPosition: ({LocationSettings? locationSettings}) async =>
          _position(latitude: 10.777, longitude: 106.701),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerLocationProvider.overrideWithValue(locationSource),
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(),
            bookingRepository,
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: MaterialApp(
          home: BookingConfirmationPage(
            initialCustomerLat: 10.7769,
            initialCustomerLng: 106.7009,
            initialCustomerAddress: 'District 1, Ho Chi Minh City',
            providerDetail: const {
              'id': 'partner-1',
              'displayName': 'Smoke Partner',
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
    await tester.pumpAndSettle();

    final paymentField = find.byType(DropdownButtonFormField<String>);
    for (var attempt = 0;
        attempt < 6 && paymentField.evaluate().isEmpty;
        attempt++) {
      await tester.drag(find.byType(ListView), const Offset(0, -400));
      await tester.pumpAndSettle();
    }
    expect(paymentField, findsOneWidget);
    await tester.tap(paymentField);
    await tester.pumpAndSettle();
    await tester.tap(find.text('MoMo').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton).last);
    await tester.pumpAndSettle();

    expect(bookingRepository.paymentMethod, 'MOMO');
  });
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

class _RecordingBookingRepository implements CustomerBookingRepository {
  _RecordingBookingRepository({
    this.paymentMethods = const [CustomerPaymentMethodOption.cash],
  });

  final List<CustomerPaymentMethodOption> paymentMethods;
  double? currentLat;
  double? currentLng;
  DateTime? currentLocationUpdatedAt;
  String? paymentMethod;

  @override
  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    return {'id': bookingId};
  }

  @override
  Future<Map<String, dynamic>> createReview({
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    return {
      'bookingId': bookingId,
      'rating': rating,
      'comment': comment,
    };
  }

  @override
  Future<Map<String, dynamic>> createBooking(
    String serviceId, {
    String? providerId,
    String? couponCode,
    String? selectedLocationId,
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    required String addressLine,
    required double lat,
    required double lng,
    double? currentLat,
    double? currentLng,
    DateTime? currentLocationUpdatedAt,
  }) async {
    this.currentLat = currentLat;
    this.currentLng = currentLng;
    this.currentLocationUpdatedAt = currentLocationUpdatedAt;
    this.paymentMethod = paymentMethod;
    return {'id': 'booking-1'};
  }

  @override
  Future<Map<String, dynamic>> getBooking(String bookingId) async {
    return {'id': bookingId};
  }

  @override
  void joinBookingRoom(String bookingId) {}

  @override
  Future<List<dynamic>> listBookings() async {
    return [];
  }

  @override
  Future<List<CustomerPaymentMethodOption>> listPaymentMethods() async {
    return paymentMethods;
  }

  @override
  Future<Map<String, dynamic>> selectProvider(
      String bookingId, String providerProfileId) async {
    return {'id': bookingId, 'providerId': providerProfileId};
  }
}

class _FakeDiscoveryRepository implements CustomerDiscoveryRepository {
  @override
  Future<Map<String, dynamic>> getProviderDetail(String providerId) async {
    return {'id': providerId};
  }

  @override
  Future<Set<String>> listFavoriteProviderIds() async {
    return {};
  }

  @override
  Future<List<dynamic>> listServices() async {
    return [];
  }

  @override
  Future<List<dynamic>> nearbyProviders({
    required double lat,
    required double lng,
  }) async {
    return [];
  }

  @override
  Future<void> recordProviderProfileView(String providerId) async {}

  @override
  Future<Map<String, dynamic>?> saveSelectedLocation({
    required double lat,
    required double lng,
    required String addressText,
  }) async {
    return {'id': 'location-1'};
  }

  @override
  Future<void> setFavoriteProvider({
    required String providerId,
    required bool favorite,
  }) async {}
}

class _FakeChatRepository implements ChatRepository {
  @override
  void joinChat(String chatRoomId) {}

  @override
  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    return [];
  }

  @override
  void sendChatMessage(String chatRoomId, String text) {}
}

class _FakeCouponRepository implements CustomerCouponRepository {
  @override
  Future<Map<String, dynamic>> previewCoupon({
    required String code,
    required String serviceId,
    required int subtotal,
  }) async {
    return {};
  }
}

class _FakePushNotificationRepository implements PushNotificationRepository {
  @override
  Future<void> registerDeviceToken({
    required String token,
    String platform = 'android',
  }) async {}

  @override
  Future<PushTokenRegistrationResult> registerCurrentDevice() async {
    return const PushTokenRegistrationResult(
      registered: false,
      message: 'not registered in test',
    );
  }
}
