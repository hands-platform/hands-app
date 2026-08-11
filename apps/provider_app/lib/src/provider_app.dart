import 'package:flutter/material.dart';

import 'core/provider_design_system.dart';
import 'provider_shell.dart';

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
      title: 'HANDS Partner',
      debugShowCheckedModeBanner: false,
      theme: buildProviderTheme(),
      darkTheme: buildProviderTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      home: const ProviderShell(),
    );
  }
}
