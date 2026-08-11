import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/customer_design_system.dart';
import 'core/customer_locale.dart';
import 'customer_shell.dart';

export 'core/customer_value_helpers.dart';
export 'features/discovery/presentation/customer_service_option_helpers.dart';
export 'features/booking/presentation/customer_booking_ui_helpers.dart';
export 'features/map/presentation/customer_location_helpers.dart';

class CustomerApp extends ConsumerWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'HANDS Customer',
      debugShowCheckedModeBanner: false,
      theme: buildCustomerTheme(),
      darkTheme: buildCustomerTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      locale: ref.watch(customerLocaleProvider),
      supportedLocales: customerSupportedLocales,
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const CustomerShell(),
    );
  }
}
