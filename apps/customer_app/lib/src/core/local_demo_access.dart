import 'package:flutter/foundation.dart';

const bool localDemoAccessEnabled = kDebugMode;

void ensureLocalDemoAccessEnabled() {
  if (!localDemoAccessEnabled) {
    throw StateError('Local demo access is disabled outside debug builds.');
  }
}
