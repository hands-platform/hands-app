import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'core/fcm_message_handling_service.dart';
import 'core/app_config.dart';
import 'core/customer_marketing_attribution.dart';
import 'core/push_messaging_platform.dart';
import 'customer_app.dart';

final customerMarketingAttributionCapture = CustomerMarketingAttributionCapture(
  store: CustomerMarketingAttributionStore(
    storage: FlutterSecureStorage(),
  ),
);

Future<void> bootstrapCustomerApp() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.validateForCurrentBuild();
  await customerMarketingAttributionCapture.start();
  if (isNativeFcmPushPlatform) {
    await Firebase.initializeApp();
    await handsFcmMessageHandlingService.start();
  }
  runApp(const ProviderScope(child: CustomerApp()));
}
