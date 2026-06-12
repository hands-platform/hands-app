abstract class PushTokenDataSource {
  Future<DevicePushToken?> getCurrentDeviceToken();

  Stream<DevicePushToken> get tokenRefreshes;
}

class DevicePushToken {
  const DevicePushToken({
    required this.token,
    required this.platform,
    this.remoteRegistrationRequired = true,
  });

  final String token;
  final String platform;
  final bool remoteRegistrationRequired;
}
