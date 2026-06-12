enum PushNotificationOpenDestination {
  chat,
  payment,
  earnings,
  booking,
  providerProfile,
  notificationCenter,
}

class PushNotificationOpenIntent {
  const PushNotificationOpenIntent._({
    required this.destination,
    this.bookingId,
    this.chatRoomId,
    this.paymentId,
    this.earningId,
    this.payoutBatchId,
    this.providerProfileId,
  });

  factory PushNotificationOpenIntent.fromData(Map<String, Object?> data) {
    final chatRoomId = _stringValue(data, 'chatRoomId');
    final paymentId = _stringValue(data, 'paymentId');
    final earningId = _stringValue(data, 'earningId');
    final payoutBatchId = _stringValue(data, 'payoutBatchId');
    final bookingId = _stringValue(data, 'bookingId');
    final providerProfileId = _stringValue(data, 'providerProfileId');

    if (chatRoomId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.chat,
        bookingId: bookingId,
        chatRoomId: chatRoomId,
        providerProfileId: providerProfileId,
      );
    }

    if (paymentId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.payment,
        bookingId: bookingId,
        paymentId: paymentId,
        providerProfileId: providerProfileId,
      );
    }

    if (earningId != null || payoutBatchId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.earnings,
        bookingId: bookingId,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
        providerProfileId: providerProfileId,
      );
    }

    if (bookingId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.booking,
        bookingId: bookingId,
        providerProfileId: providerProfileId,
      );
    }

    if (providerProfileId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.providerProfile,
        providerProfileId: providerProfileId,
      );
    }

    return const PushNotificationOpenIntent._(
      destination: PushNotificationOpenDestination.notificationCenter,
    );
  }

  final PushNotificationOpenDestination destination;
  final String? bookingId;
  final String? chatRoomId;
  final String? paymentId;
  final String? earningId;
  final String? payoutBatchId;
  final String? providerProfileId;

  bool get hasBooking => bookingId != null;
}

String? _stringValue(Map<String, Object?> data, String key) {
  final value = data[key];
  if (value == null) {
    return null;
  }

  final stringValue = value.toString().trim();
  return stringValue.isEmpty ? null : stringValue;
}
