import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/fcm_message_handling_service.dart';
import 'features/booking/presentation/partner_jobs_screen.dart';
import 'features/booking/presentation/provider_requests_screen.dart';
import 'features/chat/presentation/provider_chat_screen.dart';
import 'features/earnings/presentation/provider_earnings_screen.dart';
import 'features/notification/domain/entities/push_notification_open_intent.dart';
import 'features/provider_profile/presentation/provider_profile_screen.dart';

class ProviderShell extends ConsumerStatefulWidget {
  const ProviderShell({super.key});

  @override
  ConsumerState<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends ConsumerState<ProviderShell> {
  static const _requestsIndex = 0;
  static const _earningsIndex = 2;
  static const _chatIndex = 3;
  static const _profileIndex = 4;

  int index = 0;
  StreamSubscription<FcmNotificationOpen>? _notificationOpenSubscription;

  @override
  void initState() {
    super.initState();
    _notificationOpenSubscription =
        handsFcmNotificationOpens.listen(_handleNotificationOpen);
  }

  @override
  void dispose() {
    unawaited(_notificationOpenSubscription?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screens = const [
      RequestsScreen(),
      PartnerJobsScreen(),
      EarningsScreen(),
      ChatScreen(),
      ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
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
    if (!mounted || index == nextIndex) {
      return;
    }

    setState(() => index = nextIndex);
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
      case PushNotificationOpenDestination.providerProfile:
        return _profileIndex;
    }
  }
}
