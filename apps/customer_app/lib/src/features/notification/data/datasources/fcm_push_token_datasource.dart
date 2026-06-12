import 'package:firebase_messaging/firebase_messaging.dart';

import '../../../../core/push_messaging_platform.dart';
import 'push_token_datasource.dart';

class FcmPushTokenDataSource implements PushTokenDataSource {
  FcmPushTokenDataSource({FirebaseMessaging? messaging})
      : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  @override
  Future<DevicePushToken?> getCurrentDeviceToken() async {
    final platform = nativeFcmPushPlatformName;
    if (platform == null) {
      return null;
    }

    await _messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) {
      return null;
    }

    return DevicePushToken(
      token: token,
      platform: platform,
    );
  }
}
