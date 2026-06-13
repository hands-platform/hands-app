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

class FcmMessageHandlingService {
  FcmMessageHandlingService({
    FirebaseMessaging? messaging,
    FlutterLocalNotificationsPlugin? localNotifications,
  })  : _messaging = messaging ?? FirebaseMessaging.instance,
        _localNotifications =
            localNotifications ?? FlutterLocalNotificationsPlugin();

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final _notificationOpens = StreamController<FcmNotificationOpen>.broadcast();
  final _pendingNotificationOpens = <FcmNotificationOpen>[];
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  bool _started = false;

  Stream<FcmNotificationOpen> get notificationOpens async* {
    for (final notificationOpen in _drainPendingNotificationOpens()) {
      yield notificationOpen;
    }

    yield* _notificationOpens.stream;
  }

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
    await _notificationOpens.close();
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
    return (message.messageId ?? jsonEncode(message.data)).hashCode &
        0x7fffffff;
  }

  String _notificationPayload(RemoteMessage message) {
    return jsonEncode({
      'messageId': message.messageId,
      'data': message.data,
    });
  }

  List<FcmNotificationOpen> _drainPendingNotificationOpens() {
    final pending = List<FcmNotificationOpen>.from(_pendingNotificationOpens);
    _pendingNotificationOpens.clear();
    return pending;
  }

  void _addNotificationOpen(FcmNotificationOpen notificationOpen) {
    if (_notificationOpens.hasListener) {
      _notificationOpens.add(notificationOpen);
      return;
    }

    _pendingNotificationOpens.add(notificationOpen);
  }
}
