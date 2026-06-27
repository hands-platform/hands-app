import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/fcm_message_handling_service.dart';
import 'features/auth/presentation/providers/auth_providers.dart';
import 'features/booking/presentation/partner_jobs_screen.dart';
import 'features/booking/presentation/provider_requests_screen.dart';
import 'features/chat/presentation/provider_chat_screen.dart';
import 'features/earnings/presentation/provider_earnings_screen.dart';
import 'features/notification/domain/entities/push_notification_open_intent.dart';
import 'features/notification/presentation/providers/notification_providers.dart';
import 'features/provider_profile/presentation/provider_profile_screen.dart';

class ProviderShell extends ConsumerStatefulWidget {
  const ProviderShell({super.key});

  @override
  ConsumerState<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends ConsumerState<ProviderShell> {
  static const _requestsIndex = 0;
  static const _jobsIndex = 1;
  static const _earningsIndex = 2;
  static const _chatIndex = 3;
  static const _profileIndex = 4;

  int index = 0;
  String? _notificationChatRoomId;
  String? _notificationBookingId;
  String? _notificationEarningId;
  String? _notificationPayoutBatchId;
  int _chatOpenVersion = 0;
  int _requestsOpenVersion = 0;
  int _earningsOpenVersion = 0;
  bool _pushRegistrationStarted = false;
  StreamSubscription<FcmNotificationOpen>? _notificationOpenSubscription;

  @override
  void initState() {
    super.initState();
    _notificationOpenSubscription =
        handsFcmNotificationOpens.listen(_handleNotificationOpen);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || ref.read(authControllerProvider) == null) {
        return;
      }
      _startPushRegistration();
    });
  }

  @override
  void dispose() {
    unawaited(_notificationOpenSubscription?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (_, next) {
      if (next == null) {
        _pushRegistrationStarted = false;
        return;
      }
      _startPushRegistration();
    });

    final screens = [
      RequestsScreen(
        key: ValueKey('provider-push-requests-$_requestsOpenVersion'),
        initialBookingId: _notificationBookingId,
      ),
      const PartnerJobsScreen(),
      EarningsScreen(
        key: ValueKey('provider-push-earnings-$_earningsOpenVersion'),
        initialEarningId: _notificationEarningId,
        initialPayoutBatchId: _notificationPayoutBatchId,
      ),
      ChatScreen(
        key: ValueKey('provider-push-chat-$_chatOpenVersion'),
        initialChatRoomId: _notificationChatRoomId,
        initialBookingId: _notificationBookingId,
      ),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: _selectDestination,
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.radar_outlined), label: 'Requests'),
          NavigationDestination(
              icon: Icon(Icons.work_history_outlined), label: 'Jobs'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined), label: 'Earnings'),
          NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(
              icon: Icon(Icons.verified_user_outlined), label: 'Profile'),
        ],
      ),
    );
  }

  void _handleNotificationOpen(FcmNotificationOpen notificationOpen) {
    final intent = PushNotificationOpenIntent.fromData(notificationOpen.data);
    final nextIndex = _tabIndexForNotificationDestination(intent.destination);
    if (!mounted) {
      return;
    }

    setState(() {
      if (intent.destination == PushNotificationOpenDestination.chat) {
        _notificationChatRoomId = intent.chatRoomId;
        _notificationBookingId = intent.bookingId;
        _chatOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.booking) {
        _notificationBookingId = intent.bookingId;
        _requestsOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.earnings) {
        _notificationEarningId = intent.earningId;
        _notificationPayoutBatchId = intent.payoutBatchId;
        _earningsOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.payment) {
        _notificationEarningId = null;
        _notificationPayoutBatchId = null;
        _earningsOpenVersion += 1;
      }
      index = nextIndex;
    });
  }

  void _selectDestination(int value) {
    setState(() {
      if (value == _chatIndex) {
        _notificationChatRoomId = null;
        _notificationBookingId = null;
        _chatOpenVersion += 1;
      }
      if (value == _requestsIndex) {
        _notificationBookingId = null;
        _requestsOpenVersion += 1;
      }
      if (value == _earningsIndex) {
        _notificationEarningId = null;
        _notificationPayoutBatchId = null;
        _earningsOpenVersion += 1;
      }
      index = value;
    });
  }

  void _startPushRegistration() {
    if (_pushRegistrationStarted) {
      return;
    }
    _pushRegistrationStarted = true;
    ref.read(pushTokenRefreshRegistrationProvider);
    unawaited(ref.read(registerCurrentDevicePushTokenProvider).call());
  }

  int _tabIndexForNotificationDestination(
    PushNotificationOpenDestination destination,
  ) {
    switch (destination) {
      case PushNotificationOpenDestination.chat:
        return _chatIndex;
      case PushNotificationOpenDestination.payment:
      case PushNotificationOpenDestination.earnings:
        return _earningsIndex;
      case PushNotificationOpenDestination.booking:
      case PushNotificationOpenDestination.notificationCenter:
        return _requestsIndex;
      case PushNotificationOpenDestination.jobs:
        return _jobsIndex;
      case PushNotificationOpenDestination.providerProfile:
      case PushNotificationOpenDestination.profile:
        return _profileIndex;
    }
  }
}
