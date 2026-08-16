import 'package:customer_app/src/features/notification/domain/entities/push_notification_open_intent.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('customer notification opens chat when chatRoomId is present', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': ' booking-1 ',
      'chatRoomId': 'chat-room-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.chat);
    expect(intent.bookingId, 'booking-1');
    expect(intent.chatRoomId, 'chat-room-1');
    expect(intent.hasBooking, isTrue);
  });

  test('customer notification keeps payment context before booking fallback',
      () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'paymentId': 'payment-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.payment);
    expect(intent.bookingId, 'booking-1');
    expect(intent.paymentId, 'payment-1');
  });

  test('customer notification uses payment type before booking fallback', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'type': 'payment.updated',
    });

    expect(intent.destination, PushNotificationOpenDestination.payment);
    expect(intent.bookingId, 'booking-1');
  });

  test('customer notification opens booking from booking payload', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'providerProfileId': 'provider-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.booking);
    expect(intent.bookingId, 'booking-1');
    expect(intent.providerProfileId, 'provider-1');
  });

  test('customer notification opens explicit app destination without ids', () {
    final intent = PushNotificationOpenIntent.fromData({
      'destination': 'profile',
    });

    expect(intent.destination, PushNotificationOpenDestination.profile);
    expect(intent.hasBooking, isFalse);
  });

  test('customer manual Push allowlist destinations route without required ids', () {
    for (final destination in ['notificationCenter', 'booking']) {
      final intent = PushNotificationOpenIntent.fromData({
        'destination': destination,
        'source': 'admin_manual_push',
      });

      expect(
        intent.destination,
        destination == 'booking'
            ? PushNotificationOpenDestination.booking
            : PushNotificationOpenDestination.notificationCenter,
      );
    }
  });

  test('customer notification falls back to notification center', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': ' ',
      'unused': 'value',
    });

    expect(
      intent.destination,
      PushNotificationOpenDestination.notificationCenter,
    );
    expect(intent.hasBooking, isFalse);
  });
}
