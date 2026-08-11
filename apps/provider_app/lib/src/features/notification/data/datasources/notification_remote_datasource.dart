import 'dart:ui';

import '../../../../core/api_client.dart';
import '../../../../core/mobile_app_version.dart';

class NotificationRemoteDataSource {
  const NotificationRemoteDataSource(this._api);

  final ApiClient _api;

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
  }) async {
    await _api.postJson('/mobile/devices/register', {
      'token': token,
      'platform': platform.toUpperCase(),
      'pushProvider': 'FCM',
      'appVersion': currentProviderAppVersion,
      'locale': PlatformDispatcher.instance.locale.toLanguageTag(),
      'timezone': DateTime.now().timeZoneName,
    });
  }

  Future<void> disableDeviceToken(String token) async {
    await _api.deleteJson('/mobile/devices', {
      'token': token,
    });
  }
}
