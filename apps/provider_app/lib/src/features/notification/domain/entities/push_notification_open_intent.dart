enum PushNotificationOpenDestination {
  chat,
  payment,
  earnings,
  booking,
  jobs,
  providerProfile,
  profile,
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
    final notificationType =
        _stringValue(data, 'type') ?? _stringValue(data, 'notificationType');
    final chatRoomId = _stringValue(data, 'chatRoomId');
    final paymentId = _stringValue(data, 'paymentId');
    final earningId = _stringValue(data, 'earningId');
    final payoutBatchId = _stringValue(data, 'payoutBatchId');
    final bookingId = _stringValue(data, 'bookingId');
    final providerProfileId = _stringValue(data, 'providerProfileId');
    final explicitDestination = _destinationValue(
      _stringValue(data, 'destination') ?? _stringValue(data, 'appDestination'),
    );

    if (explicitDestination != null) {
      return PushNotificationOpenIntent._(
        destination: explicitDestination,
        bookingId: bookingId,
        chatRoomId: chatRoomId,
        paymentId: paymentId,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
        providerProfileId: providerProfileId,
      );
    }

    if (chatRoomId != null) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.chat,
        bookingId: bookingId,
        chatRoomId: chatRoomId,
        providerProfileId: providerProfileId,
      );
    }

    if (paymentId != null || _isPaymentNotification(notificationType)) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.payment,
        bookingId: bookingId,
        paymentId: paymentId,
        providerProfileId: providerProfileId,
      );
    }

    if (earningId != null ||
        payoutBatchId != null ||
        _isEarningsNotification(notificationType)) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.earnings,
        bookingId: bookingId,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
        providerProfileId: providerProfileId,
      );
    }

    if (_isJobsNotification(notificationType)) {
      return PushNotificationOpenIntent._(
        destination: PushNotificationOpenDestination.jobs,
        bookingId: bookingId,
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

bool _isPaymentNotification(String? type) {
  return type == 'payment.updated' || type == 'payment.failed';
}

bool _isEarningsNotification(String? type) {
  return type == 'earning.created' || type == 'provider.payout_batch.updated';
}

bool _isJobsNotification(String? type) {
  return type == 'booking.matched' || type == 'service.started';
}

String? _stringValue(Map<String, Object?> data, String key) {
  final value = data[key];
  if (value == null) {
    return null;
  }

  final stringValue = value.toString().trim();
  return stringValue.isEmpty ? null : stringValue;
}

PushNotificationOpenDestination? _destinationValue(String? value) {
  final normalized = value?.replaceAll('_', '').toLowerCase();
  switch (normalized) {
    case 'home':
    case 'notificationcenter':
      return PushNotificationOpenDestination.notificationCenter;
    case 'booking':
    case 'bookings':
    case 'requests':
      return PushNotificationOpenDestination.booking;
    case 'jobs':
      return PushNotificationOpenDestination.jobs;
    case 'chat':
      return PushNotificationOpenDestination.chat;
    case 'payment':
      return PushNotificationOpenDestination.payment;
    case 'earnings':
    case 'wallet':
      return PushNotificationOpenDestination.earnings;
    case 'partners':
    case 'providerprofile':
      return PushNotificationOpenDestination.providerProfile;
    case 'profile':
      return PushNotificationOpenDestination.profile;
  }
  return null;
}
