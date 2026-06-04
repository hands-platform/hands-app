import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/booking/presentation/partner_jobs_screen.dart';
import 'features/booking/presentation/provider_requests_screen.dart';
import 'features/chat/presentation/provider_chat_screen.dart';
import 'features/earnings/presentation/provider_earnings_screen.dart';
import 'features/provider_profile/presentation/provider_profile_screen.dart';

export 'core/provider_value_helpers.dart';
export 'features/booking/presentation/provider_booking_service_helpers.dart';
export 'features/booking/presentation/provider_jobs_helpers.dart';
export 'features/booking/presentation/provider_request_cards.dart';
export 'features/booking/presentation/provider_request_guidance_helpers.dart';
export 'features/booking/presentation/provider_request_panels.dart';
export 'features/booking/presentation/provider_requests_screen.dart';
export 'features/earnings/presentation/provider_wallet_gate_helpers.dart';
export 'features/map/presentation/provider_location_preview.dart';
export 'features/provider_profile/presentation/provider_error_helpers.dart';
export 'features/provider_profile/presentation/provider_feedback_cards.dart';
export 'features/provider_profile/presentation/provider_profile_screen.dart';
export 'features/provider_profile/presentation/provider_public_media_review_helpers.dart';

class ProviderApp extends StatelessWidget {
  const ProviderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Partner',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const ProviderShell(),
    );
  }
}

class ProviderShell extends ConsumerStatefulWidget {
  const ProviderShell({super.key});

  @override
  ConsumerState<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends ConsumerState<ProviderShell> {
  int index = 0;

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
}
