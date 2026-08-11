import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/notification/data/datasources/notification_remote_datasource.dart';
import 'package:provider_app/src/features/notification/data/datasources/push_token_datasource.dart';
import 'package:provider_app/src/features/notification/data/repositories/push_notification_repository_impl.dart';

void main() {
  test('Partner registers remote FCM tokens through the API', () async {
    final remoteDataSource = _RecordingNotificationRemoteDataSource();
    final repository = PushNotificationRepositoryImpl(
      pushTokenDataSource: _FakePushTokenDataSource(
        const DevicePushToken(token: 'fcm-token-1', platform: 'android'),
      ),
      remoteDataSource: remoteDataSource,
    );

    final result = await repository.registerCurrentDevice();

    expect(result.registered, isTrue);
    expect(remoteDataSource.registeredTokens, hasLength(1));
    expect(remoteDataSource.registeredTokens.single.token, 'fcm-token-1');
    expect(remoteDataSource.registeredTokens.single.platform, 'android');
  });

  test('Partner skips remote registration for in-app-only tokens', () async {
    final remoteDataSource = _RecordingNotificationRemoteDataSource();
    final repository = PushNotificationRepositoryImpl(
      pushTokenDataSource: _FakePushTokenDataSource(
        const DevicePushToken(
          token: 'in_app_notifications',
          platform: 'android_in_app',
          remoteRegistrationRequired: false,
        ),
      ),
      remoteDataSource: remoteDataSource,
    );

    final result = await repository.registerCurrentDevice();

    expect(result.registered, isTrue);
    expect(result.message, 'In-app notifications enabled.');
    expect(remoteDataSource.registeredTokens, isEmpty);
  });

  test('Partner disables the current remote token before logout', () async {
    final remoteDataSource = _RecordingNotificationRemoteDataSource();

    await unregisterCurrentPushDevice(
      pushTokenDataSource: _FakePushTokenDataSource(
        const DevicePushToken(token: 'fcm-token-1', platform: 'android'),
      ),
      remoteDataSource: remoteDataSource,
    );

    expect(remoteDataSource.disabledTokens, ['fcm-token-1']);
  });

  test('Partner does not unregister an in-app-only token', () async {
    final remoteDataSource = _RecordingNotificationRemoteDataSource();

    await unregisterCurrentPushDevice(
      pushTokenDataSource: _FakePushTokenDataSource(
        const DevicePushToken(
          token: 'in_app_notifications',
          platform: 'android_in_app',
          remoteRegistrationRequired: false,
        ),
      ),
      remoteDataSource: remoteDataSource,
    );

    expect(remoteDataSource.disabledTokens, isEmpty);
  });
}

class _FakePushTokenDataSource implements PushTokenDataSource {
  const _FakePushTokenDataSource(this.deviceToken);

  final DevicePushToken? deviceToken;

  @override
  Stream<DevicePushToken> get tokenRefreshes => const Stream.empty();

  @override
  Future<DevicePushToken?> getCurrentDeviceToken() async => deviceToken;
}

class _RecordingNotificationRemoteDataSource
    extends NotificationRemoteDataSource {
  _RecordingNotificationRemoteDataSource()
      : super(ApiClient(baseUrl: 'http://localhost'));

  final registeredTokens = <DevicePushToken>[];
  final disabledTokens = <String>[];

  @override
  Future<void> registerDeviceToken({
    required String token,
    required String platform,
  }) async {
    registeredTokens.add(DevicePushToken(token: token, platform: platform));
  }

  @override
  Future<void> disableDeviceToken(String token) async {
    disabledTokens.add(token);
  }
}
