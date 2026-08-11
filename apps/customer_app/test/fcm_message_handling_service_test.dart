import 'package:customer_app/src/core/fcm_message_handling_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('customer local notification payload keeps push data as strings', () {
    final notificationOpen = FcmNotificationOpen.fromLocalPayload(
      '{"messageId":"message-1","data":{"bookingId":"booking-1","paymentId":42}}',
    );

    expect(notificationOpen.source, 'local_notification');
    expect(notificationOpen.messageId, 'message-1');
    expect(notificationOpen.data, {
      'bookingId': 'booking-1',
      'paymentId': '42',
    });
  });

  test('customer local notification payload ignores malformed data', () {
    final notificationOpen =
        FcmNotificationOpen.fromLocalPayload('not-json-payload');

    expect(notificationOpen.source, 'local_notification');
    expect(notificationOpen.messageId, isNull);
    expect(notificationOpen.data, isEmpty);
  });

  test('customer notification relay preserves cold-start open order', () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'cold-start',
        data: {'bookingId': 'booking-cold'},
      ),
    );

    final received = <FcmNotificationOpen>[];
    final subscription = relay.notificationOpens.listen(received.add);
    addTearDown(subscription.cancel);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'warm-open',
        data: {'bookingId': 'booking-warm'},
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(
      received.map((notificationOpen) => notificationOpen.messageId),
      ['cold-start', 'warm-open'],
    );
  });

  test(
      'customer notification relay deduplicates stable notification ids across FCM attempts',
      () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_initial_message',
        messageId: 'fcm-attempt-1',
        data: {
          'notificationId': 'notification-1',
          'bookingId': 'booking-1',
        },
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        messageId: 'fcm-attempt-2',
        data: {
          'notificationId': 'notification-1',
          'bookingId': 'booking-1',
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
          'bookingId': 'booking-1',
        },
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'fcm_notification_opened_app',
        messageId: 'fcm-attempt-4',
        data: {
          'notificationId': 'notification-2',
          'bookingId': 'booking-2',
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

  test('customer notification relay keeps opens without stable ids', () async {
    final relay = FcmNotificationOpenRelay();
    addTearDown(relay.dispose);
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        data: {'bookingId': 'booking-1'},
      ),
    );
    relay.add(
      const FcmNotificationOpen(
        source: 'local_notification',
        data: {'bookingId': 'booking-1'},
      ),
    );

    final received = <FcmNotificationOpen>[];
    final subscription = relay.notificationOpens.listen(received.add);
    addTearDown(subscription.cancel);
    await Future<void>.delayed(Duration.zero);

    expect(received, hasLength(2));
  });
}
