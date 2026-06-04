import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'provider_app.dart';

void bootstrapProviderApp() {
  runApp(const ProviderScope(child: ProviderApp()));
}
