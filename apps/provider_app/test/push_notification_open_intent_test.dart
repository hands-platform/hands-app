import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/notification/domain/entities/push_notification_open_intent.dart';

void main() {
  test('provider notification opens chat when chatRoomId is present', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'chatRoomId': ' chat-room-1 ',
    });

    expect(intent.destination, PushNotificationOpenDestination.chat);
    expect(intent.bookingId, 'booking-1');
    expect(intent.chatRoomId, 'chat-room-1');
    expect(intent.hasBooking, isTrue);
  });

  test('provider notification opens earnings for payout payloads', () {
    final intent = PushNotificationOpenIntent.fromData({
      'payoutBatchId': 'payout-batch-1',
      'providerProfileId': 'provider-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.earnings);
    expect(intent.payoutBatchId, 'payout-batch-1');
    expect(intent.providerProfileId, 'provider-1');
  });

  test('provider notification uses earning type before booking fallback', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'type': 'earning.created',
    });

    expect(intent.destination, PushNotificationOpenDestination.earnings);
    expect(intent.bookingId, 'booking-1');
  });

  test('provider notification opens booking from booking payload', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'providerProfileId': 'provider-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.booking);
    expect(intent.bookingId, 'booking-1');
    expect(intent.providerProfileId, 'provider-1');
  });

  test('provider notification falls back to notification center', () {
    final intent = PushNotificationOpenIntent.fromData({
      'chatRoomId': '',
      'unused': 123,
    });

    expect(
      intent.destination,
      PushNotificationOpenDestination.notificationCenter,
    );
    expect(intent.hasBooking, isFalse);
  });
}
