import 'package:customer_app/src/app_state.dart';
import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:customer_app/src/features/auth/domain/entities/otp_request.dart';
import 'package:customer_app/src/features/auth/domain/repositories/auth_repository.dart';
import 'package:customer_app/src/features/auth/domain/usecases/request_otp.dart';
import 'package:customer_app/src/features/auth/domain/usecases/restore_auth_session.dart';
import 'package:customer_app/src/features/auth/domain/usecases/sign_in_with_otp.dart';
import 'package:customer_app/src/features/auth/domain/usecases/sign_out.dart';
import 'package:customer_app/src/features/booking/domain/repositories/customer_booking_repository.dart';
import 'package:customer_app/src/features/booking/presentation/customer_booking_flow_screens.dart';
import 'package:customer_app/src/features/chat/domain/repositories/chat_repository.dart';
import 'package:customer_app/src/features/chat/presentation/customer_chat_screen.dart';
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
      expect(find.text('Review booking'), findsOneWidget);
      expect(find.text('Your service'), findsOneWidget);
      expect(find.text('Direct request'), findsNothing);
      expect(find.textContaining('Marketplace matching'), findsNothing);
      expect(find.text('Selected service'), findsNothing);
      expect(find.text('Payment summary'), findsNothing);
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

    await tester.scrollUntilVisible(
      find.text('MoMo'),
      350,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('MoMo'));
    await tester.pumpAndSettle();

    final bookingButton = find.widgetWithText(FilledButton, 'Confirm booking');
    await tester.scrollUntilVisible(
      bookingButton,
      350,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(bookingButton);
    await tester.pumpAndSettle();

    expect(bookingRepository.paymentMethod, 'MOMO');
  });

  testWidgets('shows contact details separately and explains cash timing',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(walletBalance: 500000),
            _RecordingBookingRepository(),
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: const MaterialApp(
          home: BookingConfirmationPage(
            initialCustomerLat: 10.7769,
            initialCustomerLng: 106.7009,
            initialCustomerAddress: 'District 1, Ho Chi Minh City',
            providerDetail: {
              'id': 'partner-1',
              'displayName': 'Smoke Partner',
            },
            selectedService: {
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

    await tester.drag(
      find.byType(ListView),
      const Offset(0, -520),
    );
    await tester.pumpAndSettle();

    expect(find.text('Contact details'), findsOneWidget);
    expect(find.text('Contact for this booking'), findsNothing);

    await tester.drag(
      find.byType(ListView),
      const Offset(0, -420),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Pay the partner after the service. Nothing is charged now.'),
      findsOneWidget,
    );
  });

  testWidgets('shows wallet balance and blocks an insufficient wallet',
      (tester) async {
    final bookingRepository = _RecordingBookingRepository(
      paymentMethods: const [
        CustomerPaymentMethodOption.cash,
        CustomerPaymentMethodOption(
          method: 'CUSTOMER_WALLET',
          label: 'HANDS Wallet',
          requiresRedirect: false,
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(walletBalance: 170000),
            bookingRepository,
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: const MaterialApp(
          home: BookingConfirmationPage(
            initialCustomerLat: 10.7769,
            initialCustomerLng: 106.7009,
            initialCustomerAddress: 'District 1, Ho Chi Minh City',
            providerDetail: {
              'id': 'partner-1',
              'displayName': 'Smoke Partner',
            },
            selectedService: {
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

    await tester.drag(
      find.byType(ListView),
      const Offset(0, -980),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Balance: 170.000 VND · Insufficient'),
      findsOneWidget,
    );
    final walletTile = find.ancestor(
      of: find.text('HANDS Wallet'),
      matching: find.byType(InkWell),
    );
    await tester.tap(walletTile);
    await tester.pumpAndSettle();
    expect(bookingRepository.paymentMethod, isNull);
    expect(find.text('Request booking'), findsOneWidget);
  });

  testWidgets(
      'shows an open matching request without an empty partner location map',
      (tester) async {
    final bookingRepository = _RecordingBookingRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(),
            bookingRepository,
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: MaterialApp(
          home: BookingWaitingPage(
            initialBooking: _waitingBooking(),
            onBookingUpdated: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Waiting for confirmation'), findsOneWidget);
    expect(find.text('Smoke Partner'), findsOneWidget);
    expect(find.text('Requested'), findsOneWidget);
    expect(find.text('Your booking'), findsOneWidget);
    expect(find.text('Aroma Massage / 60 min / 300.000 VND'), findsOneWidget);
    expect(find.text('District 1, Ho Chi Minh City'), findsOneWidget);
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('Cancel booking request'), findsOneWidget);
    expect(find.text('Location will appear when shared'), findsNothing);

    final cancelRequest = find.text('Cancel booking request');
    await tester.scrollUntilVisible(
      cancelRequest,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.drag(
      find.byType(ListView),
      const Offset(0, -260),
    );
    await tester.pumpAndSettle();
    await tester.tap(cancelRequest);
    await tester.pumpAndSettle();
    expect(find.text('Cancel booking request?'), findsOneWidget);
    expect(find.text('Keep waiting'), findsOneWidget);
    expect(bookingRepository.cancelCalls, 0);

    await tester.tap(find.text('Keep waiting'));
    await tester.pumpAndSettle();
    expect(find.text('Cancel booking request?'), findsNothing);
    expect(bookingRepository.cancelCalls, 0);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('announces marketplace candidates once and keeps the list open',
      (tester) async {
    final waitingBooking = {
      ..._waitingBooking(),
      'participants': const [
        {
          'providerProfileId': 'partner-2',
          'status': 'JOINED',
          'distanceMeters': 1400,
          'providerProfile': {
            'id': 'partner-2',
            'displayName': 'Nearby Partner',
            'ratingAvg': 4.8,
            'reviewCount': 21,
          },
        },
      ],
    };

    await _pumpWaitingPage(tester, waitingBooking);
    await tester.pump();

    expect(find.text('1 more partner available'), findsOneWidget);
    expect(find.text('View partners'), findsOneWidget);

    await tester.tap(find.text('View partners'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.text('1 available partner'), findsOneWidget);
    expect(find.text('Nearby Partner'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('shows confirmed booking actions and removes direct cancel',
      (tester) async {
    final confirmed = {
      ..._waitingBooking(),
      'status': 'MATCHED',
      'selectedProvider': const {
        'id': 'partner-1',
        'displayName': 'Smoke Partner',
      },
      'chatRoom': const {'id': 'chat-1'},
    };

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(),
            _RecordingBookingRepository(),
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: MaterialApp(
          home: BookingWaitingPage(
            initialBooking: confirmed,
            onBookingUpdated: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Your booking is confirmed'), findsOneWidget);
    expect(find.text('Confirmed'), findsNWidgets(2));
    expect(find.text('Open chat room'), findsOneWidget);
    expect(find.text('Cancel booking request'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('shows on-the-way guidance and keeps chat available',
      (tester) async {
    await _pumpWaitingPage(
      tester,
      _waitingBookingAtStatus('PROVIDER_ON_THE_WAY'),
    );

    expect(find.text('Your partner is on the way'), findsOneWidget);
    expect(
      find.text(
          'Follow the latest location here and use chat for arrival details.'),
      findsOneWidget,
    );
    expect(find.text('Open chat room'), findsOneWidget);
    expect(find.text('Cancel booking request'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('shows arrived guidance before service starts', (tester) async {
    await _pumpWaitingPage(
      tester,
      _waitingBookingAtStatus('ARRIVED'),
    );

    expect(find.text('Your partner has arrived'), findsOneWidget);
    expect(
      find.text(
          'Meet your partner at the service address. Use chat if needed.'),
      findsOneWidget,
    );
    expect(find.text('Open chat room'), findsOneWidget);
    expect(find.text('Cancel booking request'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('refreshes arrival immediately from the booking realtime event',
      (tester) async {
    final initialBooking = _waitingBookingAtStatus('PROVIDER_ON_THE_WAY');
    final bookingRepository =
        _StatusTransitionBookingRepository(initialBooking);
    final socket = _ControllableRealtimeSocket();
    var updatedStatus = '';

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          realtimeSocketProvider.overrideWithValue(socket),
          customerRepositoryProvider.overrideWithValue(CustomerRepository(
            _FakeDiscoveryRepository(),
            bookingRepository,
            _FakeChatRepository(),
            _FakeCouponRepository(),
            _FakePushNotificationRepository(),
          )),
        ],
        child: MaterialApp(
          home: BookingWaitingPage(
            initialBooking: initialBooking,
            onBookingUpdated: (booking) {
              updatedStatus = booking['status']?.toString() ?? '';
            },
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('Your partner is on the way'), findsOneWidget);

    bookingRepository.status = 'ARRIVED';
    socket.emitEvent('provider.arrived', {
      'bookingId': initialBooking['id'],
      'status': 'ARRIVED',
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));

    expect(bookingRepository.getBookingCalls, 1);
    expect(updatedStatus, 'ARRIVED');
    expect(find.text('Your partner has arrived'), findsOneWidget);
    expect(
      find.text('Your partner has arrived at the service address.'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('keeps the customer chat status synchronized through completion',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final initialBooking = _waitingBookingAtStatus('PROVIDER_ON_THE_WAY');
    final bookingRepository =
        _StatusTransitionBookingRepository(initialBooking);
    final chatRepository = _FakeChatRepository();
    final socket = _ControllableRealtimeSocket();
    final authRepository = _SignedInAuthRepository();
    final container = ProviderContainer(
      overrides: [
        realtimeSocketProvider.overrideWithValue(socket),
        authControllerProvider.overrideWith((ref) {
          return AuthController(
            restoreAuthSession: RestoreAuthSession(authRepository),
            requestOtp: RequestOtp(authRepository),
            signInWithOtp: SignInWithOtp(authRepository),
            signOut: SignOut(authRepository),
          );
        }),
        customerRepositoryProvider.overrideWithValue(CustomerRepository(
          _FakeDiscoveryRepository(),
          bookingRepository,
          chatRepository,
          _FakeCouponRepository(),
          _FakePushNotificationRepository(),
        )),
      ],
    );
    addTearDown(container.dispose);
    await container.read(authControllerProvider.notifier).signInDemoCustomer();

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: ChatScreen(
            initialChatRoomId: 'chat-1',
            initialBookingId: 'booking-12345678',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('On the way'), findsOneWidget);
    expect(find.text('Your partner is on the way'), findsOneWidget);
    expect(find.byTooltip('Send'), findsOneWidget);

    chatRepository.messages = [
      {
        'id': 'message-after-resume',
        'body': 'Reply received while backgrounded',
        'createdAt': '2026-08-04T06:00:00.000Z',
        'sender': {
          'fullName': 'Demo Provider',
          'roles': ['PROVIDER'],
        },
        'attachments': <dynamic>[],
      },
    ];
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.text('Reply received while backgrounded'), findsOneWidget);

    bookingRepository.status = 'ARRIVED';
    socket.emitEvent('provider.arrived', {
      'bookingId': initialBooking['id'],
      'status': 'ARRIVED',
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('Arrived'), findsOneWidget);
    expect(find.text('Your partner has arrived'), findsOneWidget);

    bookingRepository.status = 'IN_SERVICE';
    socket.emitEvent('service.started', {
      'id': initialBooking['id'],
      'status': 'IN_SERVICE',
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('In service'), findsOneWidget);
    expect(find.text('Service in progress'), findsOneWidget);

    bookingRepository.status = 'COMPLETED';
    socket.emitEvent('service.completed', {
      'booking': {
        'id': initialBooking['id'],
        'status': 'COMPLETED',
      },
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Service complete'), findsOneWidget);
    expect(
      find.text('This booking chat is closed and retained in HANDS records.'),
      findsOneWidget,
    );
    expect(find.byTooltip('Send'), findsNothing);
  });

  testWidgets('shows in-service guidance and service chat action',
      (tester) async {
    await _pumpWaitingPage(
      tester,
      _waitingBookingAtStatus('IN_SERVICE'),
    );

    expect(find.text('Service in progress'), findsOneWidget);
    expect(find.text('Open service chat'), findsOneWidget);
    expect(find.text('Leave a review'), findsNothing);
    expect(find.text('Cancel booking request'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('shows completion review action and closes chat', (tester) async {
    await _pumpWaitingPage(
      tester,
      _waitingBookingAtStatus('COMPLETED'),
    );

    expect(find.text('Service complete'), findsOneWidget);
    expect(find.text('Leave a review'), findsOneWidget);
    expect(find.text('Book again'), findsOneWidget);
    expect(find.text('Contact HANDS support'), findsOneWidget);
    expect(find.text('Open chat room'), findsNothing);
    expect(find.text('Open service chat'), findsNothing);
    expect(find.text('Cancel booking request'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('shows a safe cancellation reason and payment result',
      (tester) async {
    await _pumpWaitingPage(tester, {
      ..._waitingBookingAtStatus('CANCELLED'),
      'cancellation': const {
        'reasonCode': 'CUSTOMER_NOT_FOUND',
        'reason': 'The partner could not meet you at the service location.',
        'paymentOutcome': 'UNDER_REVIEW',
        'supportRecommended': true,
      },
      'payment': const {
        'method': 'CUSTOMER_WALLET',
        'status': 'CAPTURED',
        'amount': 300000,
      },
    });

    expect(find.text('Cancellation result'), findsOneWidget);
    expect(
      find.text('The partner could not meet you at the service location.'),
      findsOneWidget,
    );
    expect(
      find.text('HANDS is reviewing the payment and refund.'),
      findsOneWidget,
    );
    expect(find.text('Book again'), findsOneWidget);
    expect(find.text('Contact HANDS support'), findsOneWidget);
    expect(find.text('Cancel booking request'), findsNothing);
  });
}

Map<String, dynamic> _waitingBooking() {
  return {
    'id': 'booking-12345678',
    'status': 'OPEN_MATCHING',
    'expiresAt': DateTime.now()
        .add(const Duration(minutes: 10))
        .toUtc()
        .toIso8601String(),
    'preferredProvider': const {
      'id': 'partner-1',
      'displayName': 'Smoke Partner',
    },
    'services': const [
      {
        'id': 'booking-service-1',
        'price': 300000,
        'service': {
          'id': 'service-1',
          'name': 'Aroma Massage',
          'durationMin': 60,
        },
      },
    ],
    'addressSnapshot': const {
      'addressText': 'District 1, Ho Chi Minh City',
      'lat': 10.7769,
      'lng': 106.7009,
    },
    'payment': const {'method': 'CASH'},
    'participants': <dynamic>[],
  };
}

Map<String, dynamic> _waitingBookingAtStatus(String status) {
  return {
    ..._waitingBooking(),
    'status': status,
    'selectedProvider': const {
      'id': 'partner-1',
      'displayName': 'Smoke Partner',
    },
    'chatRoom': const {'id': 'chat-1'},
  };
}

Future<void> _pumpWaitingPage(
  WidgetTester tester,
  Map<String, dynamic> booking,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        customerRepositoryProvider.overrideWithValue(CustomerRepository(
          _FakeDiscoveryRepository(),
          _RecordingBookingRepository(),
          _FakeChatRepository(),
          _FakeCouponRepository(),
          _FakePushNotificationRepository(),
        )),
      ],
      child: MaterialApp(
        home: BookingWaitingPage(
          initialBooking: booking,
          onBookingUpdated: (_) {},
        ),
      ),
    ),
  );
  await tester.pump();
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
  int cancelCalls = 0;

  @override
  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    cancelCalls++;
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
  Future<List<dynamic>> listBookings({String? cursor, int take = 20}) async {
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

class _StatusTransitionBookingRepository extends _RecordingBookingRepository {
  _StatusTransitionBookingRepository(this.initialBooking)
      : status = initialBooking['status']?.toString() ?? 'OPEN_MATCHING';

  final Map<String, dynamic> initialBooking;
  String status;
  int getBookingCalls = 0;

  @override
  Future<Map<String, dynamic>> getBooking(String bookingId) async {
    getBookingCalls += 1;
    return {
      ...initialBooking,
      'id': bookingId,
      'status': status,
    };
  }
}

class _SignedInAuthRepository implements AuthRepository {
  static const session = AuthSession(
    userId: 'customer-user-1',
    accessToken: 'customer-access-token',
    refreshToken: 'customer-refresh-token',
    user: {
      'id': 'customer-user-1',
      'phone': '+84900000001',
      'role': 'CUSTOMER',
    },
  );

  @override
  Future<AuthSession?> restoreSession() async => session;

  @override
  Future<OtpRequest> requestOtp({
    required String phone,
    required String role,
  }) async {
    return OtpRequest(
      phone: phone,
      role: role,
      status: 'OTP_REQUESTED',
    );
  }

  @override
  Future<AuthSession> signInWithOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    return session;
  }

  @override
  Future<AuthSession> updateProfile({
    required String fullName,
    required String email,
    String? gender,
    String? nationality,
  }) async {
    return session;
  }

  @override
  Future<void> signOut() async {}
}

class _ControllableRealtimeSocket extends RealtimeSocket {
  _ControllableRealtimeSocket() : super(baseUrl: 'http://socket.test');

  final Map<String, void Function(dynamic payload)> _handlers = {};

  @override
  void Function() onEvent(
      String event, void Function(dynamic payload) handler) {
    _handlers[event] = handler;
    return () {
      if (identical(_handlers[event], handler)) {
        _handlers.remove(event);
      }
    };
  }

  @override
  void offEvent(String event) {
    _handlers.remove(event);
  }

  void emitEvent(String event, dynamic payload) {
    _handlers[event]?.call(payload);
  }
}

class _FakeDiscoveryRepository implements CustomerDiscoveryRepository {
  _FakeDiscoveryRepository({this.walletBalance = 0});

  final int walletBalance;

  @override
  Future<void> deleteSavedLocation(String locationId) async {}

  @override
  Future<Map<String, dynamic>> getHomeSummary({
    required double lat,
    required double lng,
  }) async {
    return {
      'wallet': {'balance': walletBalance, 'currency': 'VND'},
      'favoritePartners': <dynamic>[],
      'completedPartners': <dynamic>[],
    };
  }

  @override
  Future<List<Map<String, dynamic>>> listSavedLocations() async => [];

  @override
  Future<Map<String, dynamic>> getWallet() async {
    return {
      'balance': walletBalance,
      'currency': 'VND',
      'entries': <dynamic>[],
    };
  }

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
  List<dynamic> messages = [];

  @override
  Future<Uri> getChatAttachmentUri(String fileId) async {
    return Uri.parse('https://example.com/$fileId');
  }

  @override
  void joinChat(String chatRoomId) {}

  @override
  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    return messages;
  }

  @override
  Future<Map<String, dynamic>> sendChatMessage(
    String chatRoomId,
    String text,
  ) async =>
      {};

  @override
  Future<Map<String, dynamic>> sendChatAttachment(
    String chatRoomId, {
    required List<int> bytes,
    required String contentType,
  }) async {
    return {};
  }
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
