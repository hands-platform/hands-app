import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/app_state.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/realtime_socket.dart';
import 'package:provider_app/src/features/auth/domain/entities/otp_request.dart';
import 'package:provider_app/src/features/auth/domain/repositories/auth_repository.dart';
import 'package:provider_app/src/features/auth/domain/usecases/request_otp.dart';
import 'package:provider_app/src/features/auth/domain/usecases/restore_auth_session.dart';
import 'package:provider_app/src/features/auth/domain/usecases/sign_in_with_otp.dart';
import 'package:provider_app/src/features/auth/domain/usecases/sign_out.dart';
import 'package:provider_app/src/features/booking/domain/repositories/provider_booking_repository.dart';
import 'package:provider_app/src/features/booking/presentation/partner_jobs_screen.dart';
import 'package:provider_app/src/features/booking/presentation/provider_requests_screen.dart';
import 'package:provider_app/src/features/chat/presentation/provider_chat_screen.dart';
import 'package:provider_app/src/features/chat/domain/repositories/chat_repository.dart';
import 'package:provider_app/src/features/earnings/domain/repositories/provider_earnings_repository.dart';
import 'package:provider_app/src/features/earnings/presentation/provider_wallet_gate_helpers.dart';
import 'package:provider_app/src/features/notification/domain/entities/push_token_registration_result.dart';
import 'package:provider_app/src/features/notification/domain/repositories/push_notification_repository.dart';
import 'package:provider_app/src/features/provider_onboarding/domain/repositories/provider_onboarding_repository.dart';
import 'package:provider_app/src/features/provider_profile/domain/repositories/provider_profile_repository.dart';
import 'package:provider_app/src/features/verification/domain/repositories/provider_verification_repository.dart';

void main() {
  testWidgets('formats partner jobs API errors with partner-safe copy',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            _PartnerJobsFailureRepository(),
          ),
        ],
        child: const MaterialApp(home: PartnerJobsScreen()),
      ),
    );

    await tester.tap(find.text('Demo partner login'));
    await tester.pumpAndSettle();

    expect(find.text(providerWalletBlockFallbackReasonClean), findsOneWidget);
    expect(find.textContaining('ApiException'), findsNothing);
  });

  testWidgets('records request detail view telemetry for visible request cards',
      (tester) async {
    final bookingRepository = _RequestTelemetryBookingRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              _FakeProviderProfileRepository(),
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          pushNotificationRepositoryProvider.overrideWithValue(
            _FakePushNotificationRepository(),
          ),
          pushTokenRefreshRegistrationProvider.overrideWithValue(null),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: RequestsScreen())),
      ),
    );

    await tester.tap(find.byIcon(Icons.login).first);
    await tester.pumpAndSettle();

    expect(find.text('HANDS Massage / 60 min'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();

    expect(bookingRepository.detailViewTelemetryRecords, hasLength(1));
    expect(bookingRepository.detailViewTelemetryRecords.single, {
      'bookingId': 'booking-request-1',
      'eventType': ProviderBookingDetailViewTelemetryEvent.closed,
      'durationSeconds': 0,
    });
  });

  testWidgets('formats partner chat location API errors with partner-safe copy',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            _ChatLocationFailureRepository(),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Share current location'));
    await tester.pumpAndSettle();

    expect(find.text('KYC approval required'), findsOneWidget);
    expect(find.textContaining('ApiException'), findsNothing);
  });

  testWidgets('sends post-match cancellation from the chat screen',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _CancellableBookingRepository();
    final profileRepository = _FakeProviderProfileRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              profileRepository,
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();

    expect(find.text('Cancel this booking'), findsOneWidget);
    await tester.tap(find.text('Cancel this booking'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Cancellation reason'),
      'Customer asked to change the appointment after matching.',
    );
    await tester.tap(find.text('Send cancellation'));
    await tester.pumpAndSettle();

    expect(bookingRepository.cancelledBookingId, 'booking-chat-ready');
    expect(profileRepository.lastLocationBookingId, 'booking-chat-ready');
    expect(bookingRepository.cancellationLat, 10.7769);
    expect(bookingRepository.cancellationLng, 106.7009);
    expect(bookingRepository.cancellationAddressText,
        'District 1, Ho Chi Minh City');
    expect(
      bookingRepository.cancellationNote,
      'Customer asked to change the appointment after matching.',
    );
    expect(find.textContaining('HANDS operations for review'), findsOneWidget);
  });

  testWidgets('starts a matched service from the chat screen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _StartableBookingRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              _FakeProviderProfileRepository(),
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();

    expect(find.text('Start service'), findsOneWidget);
    await tester.tap(find.text('Start service'));
    await tester.pumpAndSettle();

    expect(bookingRepository.startedBookingId, 'booking-chat-ready');
    expect(find.text('Complete service'), findsOneWidget);
    expect(find.textContaining('Service started'), findsOneWidget);
  });

  testWidgets(
      'blocks post-match cancellation when action location capture fails',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _CancellableBookingRepository();
    final profileRepository = _LocationFailureProviderProfileRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              profileRepository,
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel this booking'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Cancellation reason'),
      'Customer asked to change the appointment after matching.',
    );
    await tester.tap(find.text('Send cancellation'));
    await tester.pumpAndSettle();

    expect(bookingRepository.cancelledBookingId, isNull);
    expect(find.text('KYC approval required'), findsOneWidget);
  });

  testWidgets(
      'captures location before completing service from the chat screen',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _CompletableBookingRepository();
    final profileRepository = _FakeProviderProfileRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              profileRepository,
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();

    expect(find.text('Complete service'), findsOneWidget);
    await tester.tap(find.text('Complete service'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, 'booking-chat-ready');
    expect(profileRepository.lastLocationBookingId, 'booking-chat-ready');
    expect(bookingRepository.completionLat, 10.7769);
    expect(bookingRepository.completionLng, 106.7009);
    expect(bookingRepository.completionAddressText,
        'District 1, Ho Chi Minh City');
    expect(find.textContaining('Service completed'), findsOneWidget);
  });

  testWidgets('blocks completion when action location capture fails',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _CompletableBookingRepository();
    final profileRepository = _LocationFailureProviderProfileRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) {
            final repository = _FakeAuthRepository();
            return AuthController(
              restoreAuthSession: RestoreAuthSession(repository),
              requestOtp: RequestOtp(repository),
              signInWithOtp: SignInWithOtp(repository),
              signOut: SignOut(repository),
            );
          }),
          providerRepositoryProvider.overrideWithValue(
            ProviderRepository(
              profileRepository,
              bookingRepository,
              _FakeChatRepository(),
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Open latest chat'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Complete service'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, isNull);
    expect(find.text('KYC approval required'), findsOneWidget);
  });
}

class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthSession?> restoreSession() async => null;

  @override
  Future<OtpRequest> requestOtp({
    required String phone,
    required String role,
  }) async {
    return OtpRequest(phone: phone, role: role, status: 'SENT');
  }

  @override
  Future<AuthSession> signInWithOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    return const AuthSession(
      userId: 'provider-user-1',
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {'role': 'PROVIDER'},
    );
  }

  @override
  Future<void> signOut() async {}
}

class _PartnerJobsFailureRepository extends ProviderRepository {
  _PartnerJobsFailureRepository()
      : super(
          _FakeProviderProfileRepository(),
          _WalletBlockedBookingRepository(),
          _FakeChatRepository(),
          _FakeProviderEarningsRepository(),
          _FakePushNotificationRepository(),
          _FakeProviderVerificationRepository(),
          _FakeProviderOnboardingRepository(),
        );
}

class _ChatLocationFailureRepository extends ProviderRepository {
  _ChatLocationFailureRepository()
      : super(
          _LocationFailureProviderProfileRepository(),
          _ChatReadyBookingRepository(),
          _FakeChatRepository(),
          _FakeProviderEarningsRepository(),
          _FakePushNotificationRepository(),
          _FakeProviderVerificationRepository(),
          _FakeProviderOnboardingRepository(),
        );
}

class _WalletBlockedBookingRepository implements ProviderBookingRepository {
  @override
  Future<List<dynamic>> openBookings() async => const [];

  @override
  Future<List<dynamic>> listBookings() async {
    throw ApiException(400, {
      'message': {
        'code': 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
        'displayMessage': providerWalletBlockFallbackReasonClean,
        'walletBlocked': true,
        'marketplaceJoinBlocked': true,
      },
      'error': 'Bad Request',
      'statusCode': 400,
    });
  }

  @override
  Future<List<dynamic>> requestBookings() async => const [];

  @override
  Future<Map<String, dynamic>> joinBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> acceptBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> rejectBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> startBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> recordDetailViewTelemetry(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async =>
      {};
}

class _FakeProviderProfileRepository implements ProviderProfileRepository {
  String? lastLocationBookingId;
  bool? lastIncludeAddressText;

  @override
  Future<void> goOnline() async {}

  @override
  Future<void> goOffline() async {}

  @override
  Future<Map<String, dynamic>> recordDeviceSession() async => {};

  @override
  Future<Map<String, dynamic>> updateLocation({
    String? bookingId,
    bool includeAddressText = false,
  }) async {
    lastLocationBookingId = bookingId;
    lastIncludeAddressText = includeAddressText;
    return {
      'latitude': 10.7769,
      'longitude': 106.7009,
      if (includeAddressText) 'addressText': 'District 1, Ho Chi Minh City',
    };
  }

  @override
  Future<Map<String, dynamic>> providerMe() async => {};

  @override
  Future<Map<String, dynamic>> uploadProfileImage({
    required List<int> bytes,
    required String contentType,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> uploadGalleryImage({
    required List<int> bytes,
    required String contentType,
  }) async =>
      {};
}

class _LocationFailureProviderProfileRepository
    extends _FakeProviderProfileRepository {
  @override
  Future<Map<String, dynamic>> updateLocation({
    String? bookingId,
    bool includeAddressText = false,
  }) async {
    throw ApiException(403, {
      'message': 'Partner KYC must be approved before sharing live location.',
      'error': 'Forbidden',
      'statusCode': 403,
    });
  }
}

class _ChatReadyBookingRepository implements ProviderBookingRepository {
  @override
  Future<List<dynamic>> openBookings() async => const [];

  @override
  Future<List<dynamic>> listBookings() async => [
        {
          'id': 'booking-chat-ready',
          'status': 'IN_SERVICE',
          'chatRoom': {'id': 'chat-room-1'},
          'addressSnapshot': {
            'latitude': 10.7769,
            'longitude': 106.7009,
          },
        },
      ];

  @override
  Future<List<dynamic>> requestBookings() async => const [];

  @override
  Future<Map<String, dynamic>> joinBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> acceptBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> rejectBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> startBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> recordDetailViewTelemetry(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async =>
      {};
}

class _RequestTelemetryBookingRepository extends _ChatReadyBookingRepository {
  final detailViewTelemetryRecords = <Map<String, dynamic>>[];

  @override
  Future<List<dynamic>> listBookings() async => const [];

  @override
  Future<List<dynamic>> requestBookings() async => [
        {
          'id': 'booking-request-1',
          'status': 'OPEN_MATCHING',
          'createdAt': '2026-07-02T01:00:00.000Z',
          'openedAt': '2026-07-02T01:00:00.000Z',
          'address': {'addressPreview': 'District 1'},
          'services': [
            {
              'service': {
                'name': 'HANDS Massage',
                'durationMin': 60,
                'basePrice': 500000,
              },
              'price': 500000,
            },
          ],
          'payment': {
            'amount': 500000,
            'method': 'CASH',
            'status': 'AUTHORIZED',
          },
          'participants': const [],
          'preferredProvider': null,
          'selectedProvider': null,
        },
      ];

  @override
  Future<Map<String, dynamic>> recordDetailViewTelemetry(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async {
    detailViewTelemetryRecords.add({
      'bookingId': bookingId,
      'eventType': eventType,
      if (duration != null) 'durationSeconds': duration.inSeconds,
    });
    return {'recorded': true};
  }
}

class _CompletableBookingRepository extends _ChatReadyBookingRepository {
  String? completedBookingId;
  double? completionLat;
  double? completionLng;
  String? completionAddressText;

  @override
  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    completedBookingId = bookingId;
    completionLat = lat;
    completionLng = lng;
    completionAddressText = addressText;
    return {
      'id': bookingId,
      'status': 'COMPLETED',
    };
  }
}

class _StartableBookingRepository extends _ChatReadyBookingRepository {
  String? startedBookingId;

  @override
  Future<List<dynamic>> listBookings() async => [
        {
          'id': 'booking-chat-ready',
          'status': 'MATCHED',
          'chatRoom': {'id': 'chat-room-1'},
          'addressSnapshot': {
            'latitude': 10.7769,
            'longitude': 106.7009,
          },
        },
      ];

  @override
  Future<Map<String, dynamic>> startBooking(String bookingId) async {
    startedBookingId = bookingId;
    return {'id': bookingId, 'status': 'IN_SERVICE'};
  }
}

class _CancellableBookingRepository extends _ChatReadyBookingRepository {
  String? cancelledBookingId;
  String? cancellationNote;
  double? cancellationLat;
  double? cancellationLng;
  String? cancellationAddressText;

  @override
  Future<List<dynamic>> listBookings() async => [
        {
          'id': 'booking-chat-ready',
          'status': 'MATCHED',
          'chatRoom': {'id': 'chat-room-1'},
          'addressSnapshot': {
            'latitude': 10.7769,
            'longitude': 106.7009,
          },
        },
      ];

  @override
  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    cancelledBookingId = bookingId;
    cancellationNote = note;
    cancellationLat = lat;
    cancellationLng = lng;
    cancellationAddressText = addressText;
    return {
      'id': bookingId,
      'status': 'CANCELLED',
      'postMatchCancellation': {
        'autoApproved': false,
        'adminReviewRequired': true,
      },
    };
  }
}

class _FakeChatRepository implements ChatRepository {
  @override
  Future<List<dynamic>> listChatMessages(String chatRoomId) async => const [];

  @override
  void joinChat(String chatRoomId) {}

  @override
  void sendChatMessage(String chatRoomId, String text) {}
}

class _NoopRealtimeSocket implements RealtimeSocket {
  @override
  String get baseUrl => 'test-socket';

  @override
  bool get connected => false;

  @override
  void connect(String accessToken) {}

  @override
  void dispose() {}

  @override
  void joinBooking(String bookingId) {}

  @override
  void joinChat(String chatRoomId) {}

  @override
  void offEvent(String event) {}

  @override
  void onEvent(String event, void Function(dynamic payload) handler) {}

  @override
  void sendChatMessage(String chatRoomId, String text) {}

  @override
  void updateLocation({
    required double lat,
    required double lng,
    String? bookingId,
  }) {}
}

class _FakeProviderEarningsRepository implements ProviderEarningsRepository {
  @override
  Future<Map<String, dynamic>> earningsSummary() async => {};

  @override
  Future<List<dynamic>> earnings() async => const [];

  @override
  Future<List<dynamic>> payoutBatches() async => const [];
}

class _FakePushNotificationRepository implements PushNotificationRepository {
  @override
  Future<PushTokenRegistrationResult> registerCurrentDevice() async {
    return const PushTokenRegistrationResult(
      registered: false,
      message: 'Push unavailable in test.',
    );
  }

  @override
  Future<void> registerDeviceToken({
    required String token,
    String platform = 'android',
  }) async {}
}

class _FakeProviderVerificationRepository
    implements ProviderVerificationRepository {
  @override
  Future<Map<String, dynamic>> verification() async => {};

  @override
  Future<Map<String, dynamic>> createVerificationUpload({
    String contentType = 'image/jpeg',
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> uploadVerificationFile({
    required List<int> bytes,
    required String contentType,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> submitVerification({
    List<String> fileIds = const [],
  }) async =>
      {};
}

class _FakeProviderOnboardingRepository
    implements ProviderOnboardingRepository {
  @override
  Future<Map<String, dynamic>> snapshot() async => {};

  @override
  Future<Map<String, dynamic>> updateBasicProfile(
          Map<String, dynamic> input) async =>
      {};

  @override
  Future<Map<String, dynamic>> submitKyc({
    String? cccdNumber,
    List<Map<String, String>> documents = const [],
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> createBankAccount({
    required String bankName,
    String? accountNumber,
    required String accountHolderName,
    Map<String, dynamic>? qrBankingInfo,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> upsertTaxProfile({
    String? taxCode,
    required String legalName,
    required String registeredAddress,
  }) async =>
      {};

  @override
  Future<Map<String, dynamic>> acceptAgreement({
    required String type,
    required String version,
    String? deviceId,
  }) async =>
      {};
}
