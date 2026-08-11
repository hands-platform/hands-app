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
      'appVersion': currentCustomerAppVersion,
      'locale': PlatformDispatcher.instance.locale.toLanguageTag(),
      'timezone': DateTime.now().timeZoneName,
    });
  }

  Future<void> disableDeviceToken(String token) async {
    await _api.deleteJson('/mobile/devices', {
      'token': token,
    });
  }

  Future<Map<String, dynamic>> listCustomerInbox({
    String? cursor,
    int take = 20,
  }) async {
    final query = <String, String>{'take': '$take'};
    if (cursor != null && cursor.isNotEmpty) {
      query['cursor'] = cursor;
    }
    final path = Uri(
      path: '/notifications/customer-inbox',
      queryParameters: query,
    ).toString();
    final result = await _api.getJson(path);
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  Future<void> markRead(String notificationId) async {
    await _api.patchJson('/notifications/$notificationId/read', {});
  }
}
