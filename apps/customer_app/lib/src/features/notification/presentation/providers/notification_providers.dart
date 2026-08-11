import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../core/push_messaging_platform.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/datasources/fcm_push_token_datasource.dart';
import '../../data/datasources/in_app_notification_token_datasource.dart';
import '../../data/datasources/notification_remote_datasource.dart';
import '../../data/datasources/push_token_datasource.dart';
import '../../data/repositories/push_notification_repository_impl.dart';
import '../../data/repositories/customer_notification_inbox_repository_impl.dart';
import '../../domain/repositories/customer_notification_inbox_repository.dart';
import '../../domain/repositories/push_notification_repository.dart';
import '../../domain/usecases/register_current_device_push_token.dart';

final pushTokenDataSourceProvider = Provider<PushTokenDataSource>((ref) {
  if (isNativeFcmPushPlatform) {
    return FcmPushTokenDataSource();
  }

  return InAppNotificationTokenDataSource();
});

final notificationRemoteDataSourceProvider =
    Provider<NotificationRemoteDataSource>((ref) {
  return NotificationRemoteDataSource(ref.read(apiClientProvider));
});

final pushNotificationRepositoryProvider =
    Provider<PushNotificationRepository>((ref) {
  return PushNotificationRepositoryImpl(
    pushTokenDataSource: ref.read(pushTokenDataSourceProvider),
    remoteDataSource: ref.read(notificationRemoteDataSourceProvider),
  );
});

final customerNotificationInboxRepositoryProvider =
    Provider<CustomerNotificationInboxRepository>((ref) {
  return CustomerNotificationInboxRepositoryImpl(
    ref.read(notificationRemoteDataSourceProvider),
  );
});

final registerCurrentDevicePushTokenProvider =
    Provider<RegisterCurrentDevicePushToken>((ref) {
  return RegisterCurrentDevicePushToken(
      ref.read(pushNotificationRepositoryProvider));
});

final unregisterCurrentDevicePushTokenProvider =
    Provider<Future<void> Function()>((ref) {
  final pushTokenDataSource = ref.read(pushTokenDataSourceProvider);
  final remoteDataSource = ref.read(notificationRemoteDataSourceProvider);
  return () => unregisterCurrentPushDevice(
        pushTokenDataSource: pushTokenDataSource,
        remoteDataSource: remoteDataSource,
      );
});

final pushTokenRefreshRegistrationProvider = Provider<void>((ref) {
  final pushTokenDataSource = ref.read(pushTokenDataSourceProvider);
  final repository = ref.read(pushNotificationRepositoryProvider);
  final subscription = pushTokenDataSource.tokenRefreshes.listen(
    (deviceToken) {
      if (ref.read(authControllerProvider) == null ||
          !deviceToken.remoteRegistrationRequired) {
        return;
      }

      unawaited(repository
          .registerDeviceToken(
            token: deviceToken.token,
            platform: deviceToken.platform,
          )
          .catchError((_) {}));
    },
    onError: (_) {},
  );

  ref.onDispose(() {
    unawaited(subscription.cancel());
  });
});
