import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/fcm_message_handling_service.dart';

void main() {
  test('Partner local notification payload keeps push data as strings', () {
    final notificationOpen = FcmNotificationOpen.fromLocalPayload(
      '{"messageId":"message-1","data":{"bookingId":"booking-1","payoutBatchId":42}}',
    );

    expect(notificationOpen.source, 'local_notification');
    expect(notificationOpen.messageId, 'message-1');
    expect(notificationOpen.data, {
      'bookingId': 'booking-1',
      'payoutBatchId': '42',
    });
  });

  test('Partner local notification payload ignores malformed data', () {
    final notificationOpen =
        FcmNotificationOpen.fromLocalPayload('not-json-payload');

    expect(notificationOpen.source, 'local_notification');
    expect(notificationOpen.messageId, isNull);
    expect(notificationOpen.data, isEmpty);
  });

  test('Partner notification relay preserves cold-start and live open order',
      () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'cold-start',
        data: {'chatRoomId': 'chat-cold'},
      ),
    );

    final received = <FcmNotificationOpen>[];
    final subscription = relay.notificationOpens.listen(received.add);
    addTearDown(subscription.cancel);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'warm-open',
        data: {'chatRoomId': 'chat-warm'},
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(
      received.map((notificationOpen) => notificationOpen.messageId),
      ['cold-start', 'warm-open'],
    );
  });

  test('Partner notification relay ignores duplicate message ids only',
      () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'shared-message',
        data: {'chatRoomId': 'chat-1'},
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        messageId: 'shared-message',
        data: {'chatRoomId': 'chat-1'},
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        data: {'chatRoomId': 'chat-without-id'},
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        data: {'chatRoomId': 'chat-without-id'},
      ),
    );

    final received = <FcmNotificationOpen>[];
    final subscription = relay.notificationOpens.listen(received.add);
    addTearDown(subscription.cancel);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'shared-message',
        data: {'chatRoomId': 'chat-1'},
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'new-message',
        data: {'chatRoomId': 'chat-2'},
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(
      received.map((notificationOpen) => notificationOpen.messageId),
      ['shared-message', null, null, 'new-message'],
    );
  });

  test(
      'Partner notification relay prefers stable notification ids over changing FCM message ids',
      () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'fcm-attempt-1',
        data: {
          'notificationId': 'notification-1',
          'chatRoomId': 'chat-1',
        },
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        messageId: 'fcm-attempt-2',
        data: {
          'notificationId': 'notification-1',
          'chatRoomId': 'chat-1',
        },
      ),
    );

    final received = <FcmNotificationOpen>[];
    final subscription = relay.notificationOpens.listen(received.add);
    addTearDown(subscription.cancel);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'fcm-attempt-3',
        data: {
          'notificationId': 'notification-1',
          'chatRoomId': 'chat-1',
        },
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'fcm-attempt-4',
        data: {
          'notificationId': 'notification-2',
          'chatRoomId': 'chat-2',
        },
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(
      received
          .map((notificationOpen) => notificationOpen.data['notificationId']),
      ['notification-1', 'notification-2'],
    );
  });
}
