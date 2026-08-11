import '../../../core/provider_value_helpers.dart';
import '../../booking/presentation/provider_request_guidance_helpers.dart';

Map<String, dynamic>? selectProviderPriorityChatBooking(
  Iterable<dynamic> bookings,
) {
  final candidates = providerActiveChatBookings(bookings);
  return candidates.isEmpty ? null : candidates.first;
}

List<Map<String, dynamic>> providerActiveChatBookings(
  Iterable<dynamic> bookings,
) {
  final candidates = bookings
      .whereType<Map<String, dynamic>>()
      .where(isProviderAppChatVisible)
      .where((booking) {
    final roomId = asMap(booking['chatRoom'])?['id']?.toString();
    return roomId != null && roomId.isNotEmpty;
  }).toList();

  candidates.sort((left, right) {
    final priority = providerChatStatusPriority(right)
        .compareTo(providerChatStatusPriority(left));
    if (priority != 0) {
      return priority;
    }
    return providerChatTimestamp(right).compareTo(providerChatTimestamp(left));
  });
  return candidates;
}

int providerChatStatusPriority(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'IN_SERVICE' => 4,
    'ARRIVED' => 3,
    'PROVIDER_ON_THE_WAY' => 2,
    'MATCHED' => 1,
    _ => 0,
  };
}

int providerChatTimestamp(Map<String, dynamic> booking) {
  final value = booking['updatedAt'] ??
      booking['createdAt'] ??
      booking['scheduledStartAt'];
  return value is String
      ? DateTime.tryParse(value)?.millisecondsSinceEpoch ?? 0
      : 0;
}

String providerChatStatusLabel(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'IN_SERVICE' => 'Đang phục vụ',
    'ARRIVED' => 'Đã đến',
    'PROVIDER_ON_THE_WAY' => 'Đang di chuyển',
    'MATCHED' => 'Đã ghép đôi',
    _ => 'Đang hoạt động',
  };
}

int providerUnreadChatCount(Object? summary) {
  final value = asMap(summary)?['unreadCount'];
  return value is num && value > 0 ? value.toInt() : 0;
}

Map<String, int> providerRoomUnreadCounts(Object? summary) {
  final counts = <String, int>{};
  for (final row in asList(asMap(summary)?['rooms'])) {
    final room = asMap(row);
    final roomId = room?['chatRoomId']?.toString();
    final unreadCount = room?['unreadCount'];
    if (roomId == null ||
        roomId.isEmpty ||
        unreadCount is! num ||
        unreadCount <= 0) {
      continue;
    }
    counts[roomId] = unreadCount.toInt();
  }
  return counts;
}
