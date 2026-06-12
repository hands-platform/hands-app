import 'package:flutter/foundation.dart';

bool get isNativeFcmPushPlatform {
  if (kIsWeb) {
    return false;
  }

  return defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS;
}

String? get nativeFcmPushPlatformName {
  if (!isNativeFcmPushPlatform) {
    return null;
  }

  return defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
}
