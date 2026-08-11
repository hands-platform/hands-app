import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'push_messaging_platform.dart';

const handsFcmNotificationChannelId = 'hands_priority_alerts';
const handsFcmNotificationChannelName = 'HANDS priority alerts';
const handsFcmNotificationChannelDescription =
    'Booking, payment, and account alerts from HANDS.';
const handsFcmNotificationIcon = 'ic_stat_hands_notification';

FcmMessageHandlingService? _handsFcmMessageHandlingService;

FcmMessageHandlingService get handsFcmMessageHandlingService =>
    _handsFcmMessageHandlingService ??= FcmMessageHandlingService();

Stream<FcmNotificationOpen> get handsFcmNotificationOpens {
  if (!isNativeFcmPushPlatform || Firebase.apps.isEmpty) {
    return const Stream.empty();
  }

  return handsFcmMessageHandlingService.notificationOpens;
}

@pragma('vm:entry-point')
Future<void> handsFcmBackgroundMessageHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class FcmNotificationOpen {
  const FcmNotificationOpen({
    required this.source,
    required this.data,
    this.messageId,
  });

  factory FcmNotificationOpen.fromRemoteMessage(
    RemoteMessage message, {
    required String source,
  }) {
    return FcmNotificationOpen(
      source: source,
      data: Map<String, String>.from(message.data),
      messageId: message.messageId,
    );
  }

  factory FcmNotificationOpen.fromLocalPayload(String? payload) {
    if (payload == null || payload.isEmpty) {
      return const FcmNotificationOpen(source: 'local_notification', data: {});
    }

    final Object? decoded;
    try {
      decoded = jsonDecode(payload);
    } on FormatException {
      return const FcmNotificationOpen(source: 'local_notification', data: {});
    }

    if (decoded is! Map<String, dynamic>) {
      return const FcmNotificationOpen(source: 'local_notification', data: {});
    }

    final data = decoded['data'];
    return FcmNotificationOpen(
      source: 'local_notification',
      data: data is Map<String, dynamic>
          ? data.map((key, value) => MapEntry(key, value.toString()))
          : {},
      messageId: decoded['messageId']?.toString(),
    );
  }

  final String source;
  final Map<String, String> data;
  final String? messageId;
}

class FcmNotificationOpenRelay {
  static const _maxRememberedOpenKeys = 128;

  final _pendingNotificationOpens = <FcmNotificationOpen>[];
  final _seenOpenKeys = <String>{};
  late final StreamController<FcmNotificationOpen> _notificationOpens =
      StreamController<FcmNotificationOpen>.broadcast(
    onListen: _flushPendingNotificationOpens,
  );

  Stream<FcmNotificationOpen> get notificationOpens =>
      _notificationOpens.stream;

  void add(FcmNotificationOpen notificationOpen) {
    if (!_rememberOpen(notificationOpen)) {
      return;
    }

    if (_notificationOpens.hasListener) {
      _notificationOpens.add(notificationOpen);
      return;
    }

    _pendingNotificationOpens.add(notificationOpen);
  }

  Future<void> dispose() {
    _pendingNotificationOpens.clear();
    _seenOpenKeys.clear();
    return _notificationOpens.close();
  }

  void _flushPendingNotificationOpens() {
    if (_pendingNotificationOpens.isEmpty) {
      return;
    }

    final pending = List<FcmNotificationOpen>.from(_pendingNotificationOpens);
    _pendingNotificationOpens.clear();
    for (final notificationOpen in pending) {
      _notificationOpens.add(notificationOpen);
    }
  }

  bool _rememberOpen(FcmNotificationOpen notificationOpen) {
    final notificationId = notificationOpen.data['notificationId']?.trim();
    final messageId = notificationOpen.messageId?.trim();
    final openKey = notificationId != null && notificationId.isNotEmpty
        ? 'notification:$notificationId'
        : messageId != null && messageId.isNotEmpty
            ? 'message:$messageId'
            : null;
    if (openKey == null) {
      return true;
    }
    if (!_seenOpenKeys.add(openKey)) {
      return false;
    }

    while (_seenOpenKeys.length > _maxRememberedOpenKeys) {
      _seenOpenKeys.remove(_seenOpenKeys.first);
    }
    return true;
  }
}

class FcmMessageHandlingService {
  FcmMessageHandlingService({
    FirebaseMessaging? messaging,
    FlutterLocalNotificationsPlugin? localNotifications,
    FcmNotificationOpenRelay? notificationOpenRelay,
  })  : _messaging = messaging ?? FirebaseMessaging.instance,
        _localNotifications =
            localNotifications ?? FlutterLocalNotificationsPlugin(),
        _notificationOpenRelay =
            notificationOpenRelay ?? FcmNotificationOpenRelay();

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final FcmNotificationOpenRelay _notificationOpenRelay;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  bool _started = false;

  Stream<FcmNotificationOpen> get notificationOpens =>
      _notificationOpenRelay.notificationOpens;

  Future<void> start() async {
    if (!isNativeFcmPushPlatform || _started) {
      return;
    }

    FirebaseMessaging.onBackgroundMessage(handsFcmBackgroundMessageHandler);
    await _setupLocalNotifications();
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    _foregroundSubscription =
        FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      (message) => _addNotificationOpen(
        FcmNotificationOpen.fromRemoteMessage(
          message,
          source: 'fcm_notification_opened_app',
        ),
      ),
    );

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _addNotificationOpen(
        FcmNotificationOpen.fromRemoteMessage(
          initialMessage,
          source: 'fcm_initial_message',
        ),
      );
    }

    _started = true;
  }

  Future<void> dispose() async {
    await _foregroundSubscription?.cancel();
    await _openedSubscription?.cancel();
    await _notificationOpenRelay.dispose();
  }

  Future<void> _setupLocalNotifications() async {
    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings(handsFcmNotificationIcon),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) {
        _addNotificationOpen(
          FcmNotificationOpen.fromLocalPayload(response.payload),
        );
      },
    );

    const channel = AndroidNotificationChannel(
      handsFcmNotificationChannelId,
      handsFcmNotificationChannelName,
      description: handsFcmNotificationChannelDescription,
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  void _showForegroundNotification(RemoteMessage message) {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'];
    final body = notification?.body ?? message.data['body'];
    if (title == null && body == null) {
      return;
    }

    unawaited(
      _localNotifications.show(
        id: _notificationId(message),
        title: title,
        body: body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            handsFcmNotificationChannelId,
            handsFcmNotificationChannelName,
            channelDescription: handsFcmNotificationChannelDescription,
            importance: Importance.high,
            priority: Priority.high,
            icon: handsFcmNotificationIcon,
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: _notificationPayload(message),
      ),
    );
  }

  int _notificationId(RemoteMessage message) {
    final notificationId = message.data['notificationId']?.trim();
    return (notificationId != null && notificationId.isNotEmpty
                ? notificationId
                : message.messageId ?? jsonEncode(message.data))
            .hashCode &
        0x7fffffff;
  }

  String _notificationPayload(RemoteMessage message) {
    return jsonEncode({
      'messageId': message.messageId,
      'data': message.data,
    });
  }

  void _addNotificationOpen(FcmNotificationOpen notificationOpen) {
    _notificationOpenRelay.add(notificationOpen);
  }
}
