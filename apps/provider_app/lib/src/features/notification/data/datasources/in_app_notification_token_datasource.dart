import 'dart:io';

import 'push_token_datasource.dart';

class InAppNotificationTokenDataSource implements PushTokenDataSource {
  @override
  Stream<DevicePushToken> get tokenRefreshes => const Stream.empty();

  @override
  Future<DevicePushToken?> getCurrentDeviceToken() async {
    return DevicePushToken(
      token: 'in_app_notifications',
      platform: Platform.isIOS ? 'ios_in_app' : 'android_in_app',
      remoteRegistrationRequired: false,
    );
  }
}
