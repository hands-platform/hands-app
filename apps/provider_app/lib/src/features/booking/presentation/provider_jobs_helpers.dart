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
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  }.contains(booking['status']);
}

int providerOpenRequestCount(Iterable<dynamic> bookings) {
  return bookings
      .whereType<Map<String, dynamic>>()
      .where((booking) => booking['status'] == 'OPEN_MATCHING')
      .length;
}

int providerActiveJobCount(Iterable<dynamic> bookings) {
  return bookings
      .whereType<Map<String, dynamic>>()
      .where(isProviderActiveBooking)
      .length;
}

bool providerHasJoinedRequest(Map<String, dynamic> booking) {
  return const {'JOINED', 'ACCEPTED'}.contains(booking['participationStatus']);
}

String providerBookingStatusLabel(Object? status) => switch (status) {
      'OPEN_MATCHING' => 'Đang chờ ghép đôi',
      'MATCHED' => 'Đã ghép đôi',
      'PROVIDER_ON_THE_WAY' => 'Đang di chuyển',
      'ARRIVED' => 'Đã đến',
      'IN_SERVICE' => 'Đang phục vụ',
      'COMPLETED' => 'Đã hoàn tất',
      'CANCELLED' => 'Đã hủy',
      'EXPIRED' => 'Đã hết hạn',
      'REFUNDED' => 'Đã hoàn tiền',
      'NO_SHOW' => 'Không gặp được khách hàng',
      _ => 'Chưa xác định',
    };

String providerPaymentMethodLabel(Object? method) => switch (method) {
      'CASH' => 'Tiền mặt',
      'WALLET' => 'Ví',
      'CARD' => 'Thẻ',
      'MOMO' => 'MoMo',
      'VNPAY' => 'VNPay',
      _ => 'Chưa có phương thức',
    };

String providerPaymentStatusLabel(Object? status) => switch (status) {
      'PENDING' => 'Đang chờ thanh toán',
      'AUTHORIZED' => 'Đã xác thực',
      'PAID' || 'CAPTURED' || 'COMPLETED' => 'Đã thanh toán',
      'FAILED' => 'Thanh toán thất bại',
      'CANCELLED' => 'Đã hủy',
      'REFUNDED' => 'Đã hoàn tiền',
      _ => 'Chưa thanh toán',
    };

String partnerJobNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' => 'Đang chờ khách hàng chọn đối tác.',
    'MATCHED' =>
      'Trò chuyện đã mở. Hãy phối hợp với khách hàng và hoàn tất dịch vụ sau khi kết thúc.',
    'PROVIDER_ON_THE_WAY' =>
      'Trò chuyện đã mở. Hãy tiếp tục chia sẻ vị trí cho đặt lịch này.',
    'ARRIVED' =>
      'Trò chuyện đã mở. Hãy hoàn tất đặt lịch sau khi kết thúc dịch vụ.',
    'IN_SERVICE' => 'Hoàn tất dịch vụ sau khi công việc kết thúc.',
    'COMPLETED' =>
      'Dịch vụ đã hoàn tất. Hãy kiểm tra thu nhập và trạng thái chi trả.',
    'CANCELLED' => providerClosedBookingMessage(booking),
    'EXPIRED' => providerClosedBookingMessage(booking),
    'REFUNDED' =>
      'Đặt lịch đã được hoàn tiền. Kiểm tra ghi chú của quản trị viên nếu cần.',
    _ => 'Theo dõi đặt lịch này trong mục Yêu cầu nếu cần xử lý.',
  };
}

int providerRequestPriority(
  Map<String, dynamic> booking,
  String? currentUserId,
) {
  final isPreferredRequest = providerIsPreferredRequest(booking, currentUserId);
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

bool providerIsPreferredRequest(
  Map<String, dynamic> booking,
  String? currentUserId,
) {
  final serverValue = booking['isPreferredRequest'];
  if (serverValue is bool) {
    return serverValue;
  }
  final preferredProvider = booking['preferredProvider'];
  return preferredProvider is Map<String, dynamic> &&
      preferredProvider['userId'] == currentUserId;
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
  return booking['openedAt'] ??
      booking['createdAt'] ??
      booking['scheduledStartAt'];
}

String formatRelativeMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Vừa cập nhật';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Vừa cập nhật';
  }
  final diff = DateTime.now().difference(parsed);
  if (diff.inMinutes < 1) {
    return 'Vừa cập nhật';
  }
  if (diff.inHours < 1) {
    return 'Cập nhật ${diff.inMinutes} phút trước';
  }
  if (diff.inDays < 1) {
    return 'Cập nhật ${diff.inHours} giờ trước';
  }
  return 'Cập nhật ${diff.inDays} ngày trước';
}

String providerLocationHeartbeatLabel(
  ProviderLocationHeartbeatSnapshot snapshot,
) {
  if (snapshot.lastError != null) {
    final retryLabel = formatNextLocationRefresh(snapshot.nextUpdateAt);
    return 'Không thể cập nhật vị trí. $retryLabel';
  }
  final lastSuccess = snapshot.lastSuccessAt;
  if (lastSuccess == null) {
    return snapshot.active
        ? 'Đang chia sẻ vị trí. Vị trí được cập nhật mỗi 60 phút khi chờ.'
        : 'Vị trí gần nhất được lưu khi bạn bật trực tuyến.';
  }
  return '${formatRelativeMoment(lastSuccess.toIso8601String())}. ${formatNextLocationRefresh(snapshot.nextUpdateAt)}';
}

String formatNextLocationRefresh(DateTime? value) {
  if (value == null) {
    return 'Vị trí sẽ được cập nhật sau khi bạn bật trực tuyến.';
  }
  final diff = value.difference(DateTime.now());
  if (diff.inSeconds <= 0) {
    return 'Đang đến thời điểm cập nhật vị trí.';
  }
  if (diff.inMinutes < 1) {
    return 'Cập nhật tiếp theo trong chưa đầy 1 phút.';
  }
  return 'Cập nhật tiếp theo sau ${diff.inMinutes} phút.';
}

String formatRequestOpenedMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Sắp tới';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Sắp tới';
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  final month = parsed.month.toString().padLeft(2, '0');
  final day = parsed.day.toString().padLeft(2, '0');
  return '${parsed.year}-$month-$day $hour:$minute';
}
