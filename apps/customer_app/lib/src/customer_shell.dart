import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/fcm_message_handling_service.dart';
import 'features/booking/presentation/customer_bookings_screen.dart';
import 'features/chat/presentation/customer_chat_screen.dart';
import 'features/discovery/presentation/customer_home_screen.dart';
import 'features/discovery/presentation/customer_providers_screen.dart';
import 'features/notification/domain/entities/push_notification_open_intent.dart';
import 'features/profile/presentation/customer_profile_screen.dart';

class CustomerShell extends ConsumerStatefulWidget {
  const CustomerShell({super.key});

  @override
  ConsumerState<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends ConsumerState<CustomerShell> {
  static const _homeIndex = 0;
  static const _partnersIndex = 1;
  static const _bookingsIndex = 2;
  static const _chatIndex = 3;

  int index = 0;
  String? _notificationChatRoomId;
  String? _notificationBookingId;
  int _chatOpenVersion = 0;
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
    final screens = [
      const HomeScreen(),
      const ProvidersScreen(),
      const BookingsScreen(),
      ChatScreen(
        key: ValueKey('customer-push-chat-$_chatOpenVersion'),
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
          NavigationDestination(icon: Icon(Icons.spa_outlined), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.groups_outlined), label: 'Partners'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined), label: 'Bookings'),
          NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Profile'),
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
      index = value;
    });
  }

  int _tabIndexForNotificationDestination(
    PushNotificationOpenDestination destination,
  ) {
    switch (destination) {
      case PushNotificationOpenDestination.chat:
        return _chatIndex;
      case PushNotificationOpenDestination.payment:
      case PushNotificationOpenDestination.earnings:
      case PushNotificationOpenDestination.booking:
        return _bookingsIndex;
      case PushNotificationOpenDestination.providerProfile:
        return _partnersIndex;
      case PushNotificationOpenDestination.notificationCenter:
        return _homeIndex;
    }
  }
}
