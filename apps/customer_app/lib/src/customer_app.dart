import 'package:flutter/material.dart';

import 'customer_shell.dart';

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
