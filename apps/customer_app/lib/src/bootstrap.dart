import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push_messaging_platform.dart';
import 'customer_app.dart';

Future<void> bootstrapCustomerApp() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (isNativeFcmPushPlatform) {
    await Firebase.initializeApp();
  }
  runApp(const ProviderScope(child: CustomerApp()));
}
