import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/booking/presentation/customer_bookings_screen.dart';
import 'features/chat/presentation/customer_chat_screen.dart';
import 'features/discovery/presentation/customer_home_screen.dart';
import 'features/discovery/presentation/customer_providers_screen.dart';
import 'features/profile/presentation/customer_profile_screen.dart';

export 'core/customer_value_helpers.dart';
export 'features/discovery/presentation/customer_service_option_helpers.dart';
export 'features/booking/presentation/customer_booking_ui_helpers.dart';
export 'features/map/presentation/customer_location_helpers.dart';

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HANDS Customer',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF5E8E4A)),
        useMaterial3: true,
      ),
      home: const CustomerShell(),
    );
  }
}

class CustomerShell extends ConsumerStatefulWidget {
  const CustomerShell({super.key});

  @override
  ConsumerState<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends ConsumerState<CustomerShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      const HomeScreen(),
      const ProvidersScreen(),
      const BookingsScreen(),
      const ChatScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
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
}
