import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'customer_app.dart';

void bootstrapCustomerApp() {
  runApp(const ProviderScope(child: CustomerApp()));
}
