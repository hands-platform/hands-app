import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/customer_app.dart';
export 'src/customer_app.dart';

void main() {
  runApp(const ProviderScope(child: CustomerApp()));
}
