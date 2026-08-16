import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/notification/domain/entities/push_notification_open_intent.dart';

void main() {
  test('Partner notification opens chat when chatRoomId is present', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'chatRoomId': ' chat-room-1 ',
    });

    expect(intent.destination, PushNotificationOpenDestination.chat);
    expect(intent.bookingId, 'booking-1');
    expect(intent.chatRoomId, 'chat-room-1');
    expect(intent.hasBooking, isTrue);
  });

  test('Partner notification opens earnings for payout payloads', () {
    final intent = PushNotificationOpenIntent.fromData({
      'payoutBatchId': 'payout-batch-1',
      'providerProfileId': 'provider-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.earnings);
    expect(intent.payoutBatchId, 'payout-batch-1');
    expect(intent.providerProfileId, 'provider-1');
  });

  test('Partner notification uses earning type before booking fallback', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'type': 'earning.created',
    });

    expect(intent.destination, PushNotificationOpenDestination.earnings);
    expect(intent.bookingId, 'booking-1');
  });

  test('Partner open-request notification opens Requests from booking payload',
      () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'providerProfileId': 'provider-1',
      'type': 'booking.requested',
    });

    expect(intent.destination, PushNotificationOpenDestination.booking);
    expect(intent.bookingId, 'booking-1');
    expect(intent.providerProfileId, 'provider-1');
  });

  test('Partner matched notification opens Jobs from legacy typed payload', () {
    final intent = PushNotificationOpenIntent.fromData({
      'bookingId': 'booking-1',
      'type': 'booking.matched',
    });

    expect(intent.destination, PushNotificationOpenDestination.jobs);
    expect(intent.bookingId, 'booking-1');
  });

  test('Partner notification honors explicit destination and retains ids', () {
    final intent = PushNotificationOpenIntent.fromData({
      'destination': 'jobs',
      'bookingId': 'booking-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.jobs);
    expect(intent.bookingId, 'booking-1');
    expect(intent.hasBooking, isTrue);
  });

  test('Partner manual Push allowlist destinations route without required ids', () {
    const destinations = {
      'notificationCenter': PushNotificationOpenDestination.notificationCenter,
      'booking': PushNotificationOpenDestination.booking,
      'jobs': PushNotificationOpenDestination.jobs,
      'earnings': PushNotificationOpenDestination.earnings,
      'profile': PushNotificationOpenDestination.profile,
    };

    for (final entry in destinations.entries) {
      final intent = PushNotificationOpenIntent.fromData({
        'destination': entry.key,
        'source': 'admin_manual_push',
      });
      expect(intent.destination, entry.value);
    }
  });

  test('Partner chat destination without room falls back to Jobs', () {
    final intent = PushNotificationOpenIntent.fromData({
      'destination': 'chat',
      'bookingId': 'booking-1',
      'chatRoomId': ' ',
    });

    expect(intent.destination, PushNotificationOpenDestination.jobs);
    expect(intent.bookingId, 'booking-1');
    expect(intent.chatRoomId, isNull);
  });

  test('Partner empty chat destination falls back to notification center', () {
    final intent = PushNotificationOpenIntent.fromData({
      'destination': 'chat',
    });

    expect(
      intent.destination,
      PushNotificationOpenDestination.notificationCenter,
    );
    expect(intent.hasBooking, isFalse);
    expect(intent.chatRoomId, isNull);
  });

  test('Partner service notification opens chat when room id is present', () {
    final intent = PushNotificationOpenIntent.fromData({
      'type': 'service.started',
      'bookingId': 'booking-1',
      'chatRoomId': 'chat-room-1',
    });

    expect(intent.destination, PushNotificationOpenDestination.chat);
    expect(intent.chatRoomId, 'chat-room-1');
  });

  test('Partner notification falls back to notification center', () {
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
