import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/fcm_message_handling_service.dart';

void main() {
  test('provider local notification payload keeps push data as strings', () {
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

  test('provider local notification payload ignores malformed data', () {
    final notificationOpen =
        FcmNotificationOpen.fromLocalPayload('not-json-payload');

    expect(notificationOpen.source, 'local_notification');
    expect(notificationOpen.messageId, isNull);
    expect(notificationOpen.data, isEmpty);
  });
}
