import '../../../app_state.dart';
import '../../../core/provider_value_helpers.dart';
import 'provider_request_guidance_helpers.dart';

Map<String, dynamic>? providerBookingService(Map<String, dynamic> booking) {
  final services = asList(booking['services']);
  if (services.isEmpty) {
    return null;
  }
  return asMap(asMap(services.first)?['service']);
}

bool isProviderActiveBooking(Map<String, dynamic> booking) {
  return const {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  }.contains(booking['status']);
}

String partnerJobNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' => 'Waiting for the guest to confirm a partner.',
    'MATCHED' =>
      'Use chat to coordinate details, then start the service when ready.',
    'PROVIDER_ON_THE_WAY' => 'Keep location sharing active until arrival.',
    'ARRIVED' => 'Mark the service started when the guest is ready.',
    'IN_SERVICE' => 'Complete the service after work is finished.',
    'COMPLETED' => 'Service complete. Check earnings and payout status.',
    'CANCELLED' => 'Customer cancelled. No service action is needed.',
    'REFUNDED' => 'Refunded booking. Review any admin notes if needed.',
    _ => 'Monitor this booking from Requests if action is required.',
  };
}

int providerRequestPriority(
  Map<String, dynamic> booking,
  String? currentUserId,
) {
  final preferredProvider = booking['preferredProvider'];
  final isPreferredRequest = preferredProvider is Map<String, dynamic> &&
      preferredProvider['userId'] == currentUserId;
  if (isProviderAppChatVisible(booking)) {
    return 1;
  }
  if (booking['status'] == 'MATCHED' && isPreferredRequest) {
    return 5;
  }
  if (booking['status'] == 'OPEN_MATCHING' && isPreferredRequest) {
    return 4;
  }
  if (booking['status'] == 'OPEN_MATCHING') {
    return 3;
  }
  if (booking['status'] == 'MATCHED') {
    return 2;
  }
  return 0;
}

int bookingTimestamp(Map<String, dynamic> booking) {
  final value = booking['updatedAt'] ??
      booking['createdAt'] ??
      booking['scheduledStartAt'];
  if (value is String) {
    return DateTime.tryParse(value)?.millisecondsSinceEpoch ?? 0;
  }
  return 0;
}

dynamic providerBookingRequestOpenedAt(Map<String, dynamic> booking) {
  return booking['openedAt'] ?? booking['createdAt'] ?? booking['scheduledStartAt'];
}

String formatRelativeMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Updated just now';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Updated just now';
  }
  final diff = DateTime.now().difference(parsed);
  if (diff.inMinutes < 1) {
    return 'Updated just now';
  }
  if (diff.inHours < 1) {
    return 'Updated ${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return 'Updated ${diff.inHours}h ago';
  }
  return 'Updated ${diff.inDays}d ago';
}

String providerLocationHeartbeatLabel(
  ProviderLocationHeartbeatSnapshot snapshot,
) {
  if (snapshot.lastError != null) {
    final retryLabel = formatNextLocationRefresh(snapshot.nextUpdateAt);
    return 'Location refresh failed. $retryLabel';
  }
  final lastSuccess = snapshot.lastSuccessAt;
  if (lastSuccess == null) {
    return snapshot.active
        ? 'Sharing location now. Idle refresh runs every 60 minutes.'
        : 'Your last known location is saved when you go online.';
  }
  return '${formatRelativeMoment(lastSuccess.toIso8601String())}. ${formatNextLocationRefresh(snapshot.nextUpdateAt)}';
}

String formatNextLocationRefresh(DateTime? value) {
  if (value == null) {
    return 'Next refresh starts after going online.';
  }
  final diff = value.difference(DateTime.now());
  if (diff.inSeconds <= 0) {
    return 'Next refresh is due now.';
  }
  if (diff.inMinutes < 1) {
    return 'Next refresh in under 1m.';
  }
  return 'Next refresh in ${diff.inMinutes}m.';
}

String formatRequestOpenedMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Soon';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Soon';
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  final month = parsed.month.toString().padLeft(2, '0');
  final day = parsed.day.toString().padLeft(2, '0');
  return '${parsed.year}-$month-$day $hour:$minute';
}
