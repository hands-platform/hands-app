import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/app_state.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/app_session_reporter.dart';
import 'package:provider_app/src/core/fcm_message_handling_service.dart';
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
import 'package:provider_app/src/provider_shell.dart';

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

    await tester.tap(find.text('Đăng nhập thử nghiệm'));
    await tester.pumpAndSettle();

    expect(find.text(providerWalletBlockFallbackReasonClean), findsOneWidget);
    expect(find.textContaining('ApiException'), findsNothing);
  });

  testWidgets('opens chat without a separate start action from Jobs',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _StartableBookingRepository();
    String? openedBookingId;
    String? openedChatRoomId;

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
        ],
        child: MaterialApp(
          home: PartnerJobsScreen(
            onOpenChat: (bookingId, chatRoomId) {
              openedBookingId = bookingId;
              openedChatRoomId = chatRoomId;
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('Đăng nhập thử nghiệm'));
    await tester.pumpAndSettle();

    expect(find.text('Mở trò chuyện'), findsOneWidget);
    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
    expect(find.text('Đánh dấu đã đến'), findsNothing);
    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
    await tester.tap(find.text('Mở trò chuyện'));
    expect(openedBookingId, 'booking-chat-ready');
    expect(openedChatRoomId, 'chat-room-1');
  });

  testWidgets('does not require arrival for an on-the-way legacy job from Jobs',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _ArrivableBookingRepository();

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
        ],
        child: const MaterialApp(home: PartnerJobsScreen()),
      ),
    );

    await tester.tap(find.text('Đăng nhập thử nghiệm'));
    await tester.pumpAndSettle();

    expect(find.text('Đánh dấu đã đến'), findsNothing);
    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
  });

  testWidgets('captures location before completing a job from Jobs',
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
        ],
        child: const MaterialApp(home: PartnerJobsScreen()),
      ),
    );

    await tester.tap(find.text('Đăng nhập thử nghiệm'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hoàn tất dịch vụ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận hoàn tất'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, 'booking-chat-ready');
    expect(profileRepository.lastLocationBookingId, 'booking-chat-ready');
    expect(bookingRepository.completionLat, 10.7769);
    expect(bookingRepository.completionLng, 106.7009);
    expect(bookingRepository.completionAddressText,
        'District 1, Ho Chi Minh City');
    expect(find.textContaining('Dịch vụ đã hoàn tất'), findsOneWidget);
  });

  testWidgets('records request detail view telemetry for visible request cards',
      (tester) async {
    final bookingRepository = _RequestTelemetryBookingRepository();
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

    expect(find.text('HANDS Massage / 60 phút'), findsOneWidget);
    expect(profileRepository.goOnlineCalls, 0);
    expect(find.text('Bật trực tuyến'), findsOneWidget);

    await tester.tap(find.text('Bật trực tuyến'));
    await tester.pumpAndSettle();

    expect(profileRepository.goOnlineCalls, 1);
    expect(find.text('Tắt trực tuyến'), findsOneWidget);

    await tester.tap(find.text('Tắt trực tuyến'));
    await tester.pumpAndSettle();

    expect(profileRepository.goOfflineCalls, 1);
    expect(find.text('Bật trực tuyến'), findsOneWidget);

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

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chia sẻ vị trí hiện tại'));
    await tester.pumpAndSettle();

    expect(find.text('Cần phê duyệt KYC'), findsOneWidget);
    expect(find.textContaining('ApiException'), findsNothing);
  });

  testWidgets('switches active booking chats and clears only the opened room',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final chatRepository = _MultipleChatRepository();
    final realtimeSocket = _ReconnectableRealtimeSocket();
    addTearDown(realtimeSocket.close);
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
              _MultipleChatBookingRepository(),
              chatRepository,
              _FakeProviderEarningsRepository(),
              _FakePushNotificationRepository(),
              _FakeProviderVerificationRepository(),
              _FakeProviderOnboardingRepository(),
            ),
          ),
          realtimeSocketProvider.overrideWithValue(realtimeSocket),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatScreen())),
      ),
    );

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();

    expect(find.text('Trò chuyện đặt lịch đang hoạt động'), findsOneWidget);
    expect(chatRepository.loadedRoomIds.first, 'chat-live');
    expect(chatRepository.markedRoomIds, ['chat-live']);
    expect(find.text('1 tin nhắn mới'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('provider-chat-booking-booking-matched')),
    );
    await tester.pumpAndSettle();

    expect(chatRepository.loadedRoomIds.last, 'chat-matched');
    expect(chatRepository.markedRoomIds, ['chat-live', 'chat-matched']);
    expect(find.text('1 tin nhắn mới'), findsNothing);

    final liveJoinsBeforeReconnect = chatRepository.joinedRoomIds
        .where((roomId) => roomId == 'chat-live')
        .length;
    realtimeSocket.triggerConnected();
    await tester.pumpAndSettle();

    expect(chatRepository.summaryCalls, 2);
    expect(chatRepository.loadedRoomIds.last, 'chat-matched');
    expect(
      chatRepository.joinedRoomIds.where((roomId) => roomId == 'chat-live'),
      hasLength(liveJoinsBeforeReconnect + 1),
    );

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(chatRepository.summaryCalls, 3);
    expect(chatRepository.loadedRoomIds.last, 'chat-matched');
  });

  testWidgets(
      'replays a cold-start chat push and clears only its persisted unread badge',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final notificationOpenRelay = FcmNotificationOpenRelay();
    final bookingRepository = _MultipleChatBookingRepository();
    final chatRepository = _MultipleChatRepository();
    final pushRepository = _FakePushNotificationRepository();
    final realtimeSocket = _NoopRealtimeSocket();
    final providerRepository = ProviderRepository(
      _FakeProviderProfileRepository(),
      bookingRepository,
      chatRepository,
      _FakeProviderEarningsRepository(),
      pushRepository,
      _FakeProviderVerificationRepository(),
      _FakeProviderOnboardingRepository(),
    );
    final container = ProviderContainer(
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
        providerRepositoryProvider.overrideWithValue(providerRepository),
        providerBookingRepositoryProvider.overrideWithValue(bookingRepository),
        pushNotificationRepositoryProvider.overrideWithValue(pushRepository),
        pushTokenRefreshRegistrationProvider.overrideWithValue(null),
        realtimeSocketProvider.overrideWithValue(realtimeSocket),
        appSessionReporterProvider.overrideWithValue(
          _NoopAppSessionReporter(),
        ),
      ],
    );
    addTearDown(() async {
      await notificationOpenRelay.dispose();
      container.dispose();
    });
    await container.read(authControllerProvider.notifier).signInDemoProvider();

    notificationOpenRelay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'push-chat-matched',
        data: {
          'destination': 'chat',
          'bookingId': 'booking-matched',
          'chatRoomId': 'chat-matched',
        },
      ),
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: ProviderShell(
            notificationOpens: notificationOpenRelay.notificationOpens,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    notificationOpenRelay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        messageId: 'push-chat-matched',
        data: {
          'destination': 'chat',
          'bookingId': 'booking-matched',
          'chatRoomId': 'chat-matched',
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(chatRepository.loadedRoomIds.last, 'chat-matched');
    expect(
      chatRepository.loadedRoomIds.where((roomId) => roomId == 'chat-matched'),
      hasLength(1),
    );
    expect(chatRepository.markedRoomIds, ['chat-matched']);
    expect(find.text('Trò chuyện đặt lịch đang hoạt động'), findsOneWidget);
    expect(find.text('2 tin nhắn mới'), findsOneWidget);

    final chatDestination = find.widgetWithText(
      NavigationDestination,
      'Trò chuyện',
    );
    expect(
      find.descendant(
        of: chatDestination,
        matching: find.text('2'),
      ),
      findsOneWidget,
    );

    container.read(providerLocationHeartbeatProvider).stop();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('routes a stale cold-start chat push to closed job history',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final notificationOpenRelay = FcmNotificationOpenRelay();
    final bookingRepository = _StaleChatBookingRepository();
    final chatRepository = _MultipleChatRepository();
    final pushRepository = _FakePushNotificationRepository();
    final providerRepository = ProviderRepository(
      _FakeProviderProfileRepository(),
      bookingRepository,
      chatRepository,
      _FakeProviderEarningsRepository(),
      pushRepository,
      _FakeProviderVerificationRepository(),
      _FakeProviderOnboardingRepository(),
    );
    final container = ProviderContainer(
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
        providerRepositoryProvider.overrideWithValue(providerRepository),
        providerBookingRepositoryProvider.overrideWithValue(bookingRepository),
        pushNotificationRepositoryProvider.overrideWithValue(pushRepository),
        pushTokenRefreshRegistrationProvider.overrideWithValue(null),
        realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
        appSessionReporterProvider.overrideWithValue(
          _NoopAppSessionReporter(),
        ),
      ],
    );
    addTearDown(() async {
      await notificationOpenRelay.dispose();
      container.dispose();
    });
    await container.read(authControllerProvider.notifier).signInDemoProvider();

    notificationOpenRelay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'push-chat-closed',
        data: {
          'destination': 'chat',
          'bookingId': 'booking-closed',
          'chatRoomId': 'chat-closed',
        },
      ),
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: ProviderShell(
            notificationOpens: notificationOpenRelay.notificationOpens,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining(
          'Cuộc trò chuyện của đặt lịch này không còn hoạt động'),
      findsOneWidget,
    );
    expect(chatRepository.loadedRoomIds, isEmpty);
    expect(chatRepository.markedRoomIds, ['chat-closed']);

    await tester.tap(find.text('Mở Công việc'));
    await tester.pumpAndSettle();

    expect(find.text('Lịch sử công việc'), findsOneWidget);
    expect(
      find.textContaining('Đặt lịch từ thông báo đã đóng'),
      findsOneWidget,
    );
    final closedBooking = find.textContaining('Closed booking massage');
    final recentBooking = find.textContaining('Recent history massage');
    expect(closedBooking, findsOneWidget);
    expect(recentBooking, findsOneWidget);
    expect(
      tester.getTopLeft(closedBooking).dy,
      lessThan(tester.getTopLeft(recentBooking).dy),
    );

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('rejects a chat push whose booking and room do not match',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _MultipleChatBookingRepository();
    final chatRepository = _MultipleChatRepository();
    final container = ProviderContainer(
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
            chatRepository,
            _FakeProviderEarningsRepository(),
            _FakePushNotificationRepository(),
            _FakeProviderVerificationRepository(),
            _FakeProviderOnboardingRepository(),
          ),
        ),
        realtimeSocketProvider.overrideWithValue(_NoopRealtimeSocket()),
      ],
    );
    addTearDown(container.dispose);
    await container.read(authControllerProvider.notifier).signInDemoProvider();
    var openJobsCount = 0;

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: ChatScreen(
              initialChatRoomId: 'chat-matched',
              initialBookingId: 'booking-live',
              onOpenJobs: () => openJobsCount += 1,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining('không khớp với đặt lịch đang hoạt động'),
      findsOneWidget,
    );
    expect(chatRepository.loadedRoomIds, isEmpty);
    expect(chatRepository.markedRoomIds, isEmpty);

    await tester.tap(find.text('Mở Công việc'));
    expect(openJobsCount, 1);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('opens the next active chat immediately after completion',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _MultipleCompletableChatBookingRepository();
    final chatRepository = _MultipleChatRepository();
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
              chatRepository,
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

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();
    expect(chatRepository.loadedRoomIds.last, 'chat-live');

    await tester.tap(find.text('Hoàn tất dịch vụ'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, 'booking-live');
    expect(
      find.byKey(const ValueKey('provider-chat-booking-booking-live')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('provider-chat-booking-booking-matched')),
      findsOneWidget,
    );
    expect(chatRepository.loadedRoomIds.last, 'chat-matched');
    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
    expect(
        find.textContaining('Đã mở cuộc trò chuyện tiếp theo'), findsOneWidget);
  });

  testWidgets('sends post-match cancellation from the chat screen',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _CancellableBookingRepository();
    final profileRepository = _FakeProviderProfileRepository();
    var queueRefreshCount = 0;

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
        child: MaterialApp(
          home: Scaffold(
            body: ChatScreen(
              onQueueStateChanged: () => queueRefreshCount += 1,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();

    expect(find.text('Hủy đặt lịch này'), findsOneWidget);
    await tester.tap(find.text('Hủy đặt lịch này'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Không gặp được khách hàng'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Lý do chi tiết'),
      'Arrived at the saved address and called twice without a response.',
    );
    await tester.tap(find.text('Gửi yêu cầu hủy'));
    await tester.pumpAndSettle();

    expect(bookingRepository.cancelledBookingId, 'booking-chat-ready');
    expect(profileRepository.lastLocationBookingId, 'booking-chat-ready');
    expect(bookingRepository.cancellationLat, 10.7769);
    expect(bookingRepository.cancellationLng, 106.7009);
    expect(bookingRepository.cancellationAddressText,
        'District 1, Ho Chi Minh City');
    expect(bookingRepository.cancellationReasonCode, 'CUSTOMER_NOT_FOUND');
    expect(
      bookingRepository.cancellationNote,
      'Arrived at the saved address and called twice without a response.',
    );
    expect(queueRefreshCount, 1);
    expect(
      find.byKey(
        const ValueKey('provider-chat-booking-booking-chat-ready'),
      ),
      findsNothing,
    );
    expect(find.textContaining('HANDS xem xét'), findsOneWidget);
  });

  testWidgets('shows arrived service as active in the chat screen',
      (tester) async {
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

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();

    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
    expect(find.text('Đánh dấu đã đến'), findsNothing);
    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
  });

  testWidgets('does not require arrival from chat or refresh the queue',
      (tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final bookingRepository = _ArrivableBookingRepository();
    var queueRefreshCount = 0;

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
        child: MaterialApp(
          home: Scaffold(
            body: ChatScreen(
              onQueueStateChanged: () => queueRefreshCount += 1,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();

    expect(find.text('Đánh dấu đã đến'), findsNothing);
    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
    expect(queueRefreshCount, 0);
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

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy đặt lịch này'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Khách hàng yêu cầu hủy'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Lý do chi tiết'),
      'Customer asked to change the appointment after matching.',
    );
    await tester.tap(find.text('Gửi yêu cầu hủy'));
    await tester.pumpAndSettle();

    expect(bookingRepository.cancelledBookingId, isNull);
    expect(find.text('Cần phê duyệt KYC'), findsOneWidget);
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
    var queueRefreshCount = 0;

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
        child: MaterialApp(
          home: Scaffold(
            body: ChatScreen(
              onQueueStateChanged: () => queueRefreshCount += 1,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();

    expect(find.text('Hoàn tất dịch vụ'), findsOneWidget);
    await tester.tap(find.text('Hoàn tất dịch vụ'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, 'booking-chat-ready');
    expect(profileRepository.lastLocationBookingId, 'booking-chat-ready');
    expect(bookingRepository.completionLat, 10.7769);
    expect(bookingRepository.completionLng, 106.7009);
    expect(bookingRepository.completionAddressText,
        'District 1, Ho Chi Minh City');
    expect(queueRefreshCount, 1);
    expect(
      find.byKey(
        const ValueKey('provider-chat-booking-booking-chat-ready'),
      ),
      findsNothing,
    );
    expect(find.textContaining('Dịch vụ đã hoàn tất'), findsOneWidget);
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

    await tester.tap(find.text('Mở trò chuyện đang hoạt động'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hoàn tất dịch vụ'));
    await tester.pumpAndSettle();

    expect(bookingRepository.completedBookingId, isNull);
    expect(find.text('Cần phê duyệt KYC'), findsOneWidget);
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

class _MultipleChatBookingRepository extends _ChatReadyBookingRepository {
  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      [
        {
          'id': 'booking-matched',
          'status': 'ARRIVED',
          'updatedAt': '2026-07-24T04:00:00.000Z',
          'scheduledStartAt': '2026-07-24T06:00:00.000Z',
          'chatRoom': {'id': 'chat-matched'},
          'services': [
            {
              'service': {
                'name': 'Aroma massage',
                'durationMin': 60,
              },
            },
          ],
        },
        {
          'id': 'booking-live',
          'status': 'IN_SERVICE',
          'updatedAt': '2026-07-24T03:00:00.000Z',
          'scheduledStartAt': '2026-07-24T05:00:00.000Z',
          'chatRoom': {'id': 'chat-live'},
          'services': [
            {
              'service': {
                'name': 'Thai massage',
                'durationMin': 90,
              },
            },
          ],
        },
      ];
}

class _StaleChatBookingRepository extends _MultipleChatBookingRepository {
  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async {
    if (scope != 'history') {
      return super.listBookings(scope: scope, cursor: cursor, take: take);
    }
    return [
      {
        'id': 'booking-other-history',
        'status': 'COMPLETED',
        'updatedAt': '2026-07-24T08:00:00.000Z',
        'scheduledStartAt': '2026-07-24T07:00:00.000Z',
        'services': [
          {
            'service': {
              'name': 'Recent history massage',
              'durationMin': 90,
            },
          },
        ],
      },
      {
        'id': 'booking-closed',
        'status': 'COMPLETED',
        'updatedAt': '2026-07-23T08:00:00.000Z',
        'scheduledStartAt': '2026-07-23T07:00:00.000Z',
        'chatRoom': {'id': 'chat-closed'},
        'services': [
          {
            'service': {
              'name': 'Closed booking massage',
              'durationMin': 60,
            },
          },
        ],
      },
    ];
  }
}

class _MultipleCompletableChatBookingRepository
    extends _MultipleChatBookingRepository {
  String? completedBookingId;

  @override
  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    completedBookingId = bookingId;
    return {'id': bookingId, 'status': 'COMPLETED'};
  }
}

class _WalletBlockedBookingRepository implements ProviderBookingRepository {
  @override
  Future<List<dynamic>> openBookings() async => const [];

  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async {
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
  Future<Map<String, dynamic>> bookingAlertPreferences() async => {};

  @override
  Future<Map<String, dynamic>> updateBookingAlertPreferences(
          Map<String, dynamic> preferences) async =>
      preferences;

  @override
  Future<Map<String, dynamic>> joinBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> acceptBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> rejectBooking(
    String bookingId, {
    String? reasonCode,
    String? reasonDetail,
  }) async =>
      {};

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
    required String reasonCode,
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
  int goOnlineCalls = 0;
  int goOfflineCalls = 0;
  bool availabilityEnabled = false;

  @override
  Future<Map<String, dynamic>> availability() async => {
        'availabilityIntent': availabilityEnabled ? 'AVAILABLE' : 'OFFLINE',
        'status': availabilityEnabled ? 'ONLINE_AVAILABLE' : 'OFFLINE',
      };

  @override
  Future<void> goOnline() async {
    goOnlineCalls += 1;
    availabilityEnabled = true;
  }

  @override
  Future<void> goOffline() async {
    goOfflineCalls += 1;
    availabilityEnabled = false;
  }

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
  Future<Map<String, dynamic>> updateWorkingHours(
          List<Map<String, dynamic>> workingHours) async =>
      {'workingHours': workingHours};

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
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      [
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
  Future<Map<String, dynamic>> bookingAlertPreferences() async => {};

  @override
  Future<Map<String, dynamic>> updateBookingAlertPreferences(
          Map<String, dynamic> preferences) async =>
      preferences;

  @override
  Future<Map<String, dynamic>> joinBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> acceptBooking(String bookingId) async => {};

  @override
  Future<Map<String, dynamic>> rejectBooking(
    String bookingId, {
    String? reasonCode,
    String? reasonDetail,
  }) async =>
      {};

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
    required String reasonCode,
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
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      const [];

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
  String currentStatus = 'ARRIVED';

  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      [
        {
          'id': 'booking-chat-ready',
          'status': currentStatus,
          'chatRoom': {'id': 'chat-room-1'},
          'addressSnapshot': {
            'latitude': 10.7769,
            'longitude': 106.7009,
          },
        },
      ];

}

class _ArrivableBookingRepository extends _ChatReadyBookingRepository {
  String currentStatus = 'PROVIDER_ON_THE_WAY';

  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      [
        {
          'id': 'booking-chat-ready',
          'status': currentStatus,
          'chatRoom': {'id': 'chat-room-1'},
          'addressSnapshot': {
            'latitude': 10.7769,
            'longitude': 106.7009,
          },
        },
      ];

}

class _CancellableBookingRepository extends _ChatReadyBookingRepository {
  String? cancelledBookingId;
  String? cancellationReasonCode;
  String? cancellationNote;
  double? cancellationLat;
  double? cancellationLng;
  String? cancellationAddressText;

  @override
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async =>
      [
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
    required String reasonCode,
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    cancelledBookingId = bookingId;
    cancellationReasonCode = reasonCode;
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
  Future<Map<String, dynamic>> notificationSummary() async =>
      {'unreadCount': 0};

  @override
  Future<Map<String, dynamic>> markNotificationsRead(String chatRoomId) async =>
      {'updated': 0, 'unreadCount': 0};

  @override
  void joinChat(String chatRoomId) {}

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
  }) async =>
      {};

  @override
  Future<Uri> getChatAttachmentUri(String fileId) async =>
      Uri.parse('https://example.test/$fileId');
}

class _MultipleChatRepository extends _FakeChatRepository {
  final loadedRoomIds = <String>[];
  final markedRoomIds = <String>[];
  final joinedRoomIds = <String>[];
  int summaryCalls = 0;

  Map<String, dynamic> _currentNotificationSummary() {
    final rooms = <Map<String, dynamic>>[];
    if (!markedRoomIds.contains('chat-live')) {
      rooms.add({'chatRoomId': 'chat-live', 'unreadCount': 2});
    }
    if (!markedRoomIds.contains('chat-matched')) {
      rooms.add({'chatRoomId': 'chat-matched', 'unreadCount': 1});
    }
    return {
      'unreadCount': rooms.fold<int>(
        0,
        (total, room) => total + (room['unreadCount'] as int),
      ),
      'rooms': rooms,
    };
  }

  @override
  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    loadedRoomIds.add(chatRoomId);
    return const [];
  }

  @override
  Future<Map<String, dynamic>> notificationSummary() async {
    summaryCalls += 1;
    return _currentNotificationSummary();
  }

  @override
  Future<Map<String, dynamic>> markNotificationsRead(String chatRoomId) async {
    markedRoomIds.add(chatRoomId);
    final summary = _currentNotificationSummary();
    return {
      'updated': chatRoomId == 'chat-live' ? 2 : 1,
      ...summary,
    };
  }

  @override
  void joinChat(String chatRoomId) {
    joinedRoomIds.add(chatRoomId);
  }
}

class _NoopRealtimeSocket implements RealtimeSocket {
  @override
  String get baseUrl => 'test-socket';

  @override
  bool get connected => false;

  @override
  Set<String> get joinedBookingRooms => const {};

  @override
  Set<String> get joinedChatRooms => const {};

  @override
  Stream<void> get connectionEvents => const Stream.empty();

  @override
  void connect(String accessToken) {}

  @override
  void dispose() {}

  @override
  void joinBooking(String bookingId) {}

  @override
  void joinChat(String chatRoomId) {}

  @override
  void leaveBooking(String bookingId) {}

  @override
  void leaveChat(String chatRoomId) {}

  @override
  int listenerCount(String event) => 0;

  @override
  void offEvent(String event) {}

  @override
  void Function() onEvent(
          String event, void Function(dynamic payload) handler) =>
      () {};

  @override
  void sendChatMessage(String chatRoomId, String text) {}

  @override
  void updateLocation({
    required double lat,
    required double lng,
    String? bookingId,
  }) {}
}

class _ReconnectableRealtimeSocket extends _NoopRealtimeSocket {
  final StreamController<void> _connections =
      StreamController<void>.broadcast();

  @override
  Stream<void> get connectionEvents => _connections.stream;

  void triggerConnected() {
    _connections.add(null);
  }

  Future<void> close() {
    return _connections.close();
  }
}

class _NoopAppSessionReporter extends AppSessionReporter {
  _NoopAppSessionReporter()
      : super(
          api: ApiClient(baseUrl: 'http://test.local'),
          storage: const FlutterSecureStorage(),
          role: 'PROVIDER',
          storageKey: 'provider-shell-push-test',
        );

  @override
  Future<void> recordAppOpen() async {}

  @override
  Future<void> recordHeartbeat() async {}

  @override
  Future<void> recordSessionStart() async {}
}

class _FakeProviderEarningsRepository implements ProviderEarningsRepository {
  @override
  Future<Map<String, dynamic>> earningsSummary() async => {};

  @override
  Future<List<dynamic>> earnings() async => const [];

  @override
  Future<List<dynamic>> payoutBatches() async => const [];

  @override
  Future<List<dynamic>> walletWithdrawalRequests() async => const [];

  @override
  Future<Map<String, dynamic>> createWalletWithdrawalRequest({
    required int amount,
    String? bankAccountId,
    String? requestNote,
  }) async =>
      const {};
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
