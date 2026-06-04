import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/provider_app.dart';
export 'src/provider_app.dart';

void main() {
  runApp(const ProviderScope(child: ProviderApp()));
}
