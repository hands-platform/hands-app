import '../../../core/provider_value_helpers.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';

bool isProviderClosedBooking(Map<String, dynamic> booking) {
  return const {'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'}
      .contains(booking['status']);
}

bool isProviderAppChatVisible(Map<String, dynamic>? booking) {
  if (booking == null) {
    return false;
  }
  return asMap(booking['chatRoom']) != null &&
      !isProviderClosedBooking(booking);
}

int providerMarketplaceParticipantCount(Map<String, dynamic> booking) {
  final preferredProviderId =
      asMap(booking['preferredProvider'])?['id']?.toString();
  return asList(booking['participants']).where((item) {
    final participant = asMap(item);
    if (participant == null) {
      return false;
    }
    return preferredProviderId == null ||
        participant['providerProfileId']?.toString() != preferredProviderId;
  }).length;
}

String providerClosedBookingMessage(Map<String, dynamic> booking) {
  final cancellation = asMap(booking['cancellation']);
  return switch (cancellation?['reasonCode']) {
    'PREFERRED_PARTNER_DECLINED' =>
      'Bạn đã từ chối yêu cầu trực tiếp. Đặt lịch đã đóng.',
    'PARTNER_RESPONSE_EXPIRED' =>
      'Yêu cầu trực tiếp đã hết hạn trước khi đối tác phản hồi.',
    _ when booking['closedReason'] == 'preferred_provider_rejected' =>
      'Bạn đã từ chối yêu cầu trực tiếp. Đặt lịch đã đóng.',
    _ when booking['closedReason'] == 'preferred_provider_no_response' =>
      'Yêu cầu trực tiếp đã hết hạn trước khi đối tác phản hồi.',
    'CUSTOMER_CANCELLED_BEFORE_MATCH' =>
      'Khách hàng đã hủy trước khi ghép đôi. Bạn không cần xử lý.',
    _ when booking['status'] == 'EXPIRED' =>
      'Yêu cầu đã hết hạn trước khi xác nhận đối tác.',
    _ => 'Đặt lịch đã đóng. Bạn không cần xử lý dịch vụ.',
  };
}

bool providerAcceptanceConfirmedBooking(Map<String, dynamic> response) {
  final booking = asMap(response['booking']);
  return response['event'] == 'booking.matched' ||
      const {'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'}
          .contains(response['status']) ||
      const {'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'}
          .contains(booking?['status']);
}

String providerBookingDecisionStatusMessage({
  required bool accepted,
  required Map<String, dynamic> response,
}) {
  if (!accepted) {
    return providerClosedBookingMessage(response);
  }
  if (providerAcceptanceConfirmedBooking(response)) {
    return 'Đặt lịch đã được xác nhận. Trò chuyện và theo dõi dịch vụ đã hoạt động.';
  }
  return 'Bạn đã tham gia yêu cầu. Đang chờ khách hàng chọn đối tác.';
}

class ProviderRequestGuidance {
  const ProviderRequestGuidance({
    required this.modeLabel,
    required this.priorityLabel,
    required this.roleLabel,
    required this.decisionLabel,
    required this.nextAction,
    required this.contextMessage,
    required this.detailMessage,
    required this.infoMessage,
  });

  final String modeLabel;
  final String priorityLabel;
  final String roleLabel;
  final String decisionLabel;
  final String nextAction;
  final String contextMessage;
  final String detailMessage;
  final String infoMessage;
}

ProviderRequestGuidance providerRequestGuidance({
  required Map<String, dynamic> booking,
  required bool isPreferredRequest,
  required bool joined,
  required bool walletBlocked,
}) {
  final preferredProvider = asMap(booking['preferredProvider']);
  final hasPreferredProvider = preferredProvider != null;
  final preferredProviderName =
      preferredProvider?['displayName']?.toString().trim();
  final hasChat = isProviderAppChatVisible(booking);
  final isMatched = const {
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  }.contains(booking['status']);
  final actionBlockedByWallet = providerWalletBlocksMarketplaceParticipation(
    walletBlocked: walletBlocked,
    isPreferredRequest: isPreferredRequest,
    isMatched: isMatched,
  );
  final responseWindowLabel = providerMatchingWindowText(booking);
  final marketplaceRadiusLabel = providerMarketplaceRadiusText(booking);

  final modeLabel = isPreferredRequest
      ? 'Yêu cầu trực tiếp'
      : hasPreferredProvider
          ? 'Cơ hội đặt lịch công khai'
          : 'Danh sách ứng viên mở';
  final priorityLabel = isPreferredRequest
      ? 'Phản hồi trước'
      : hasPreferredProvider
          ? 'Lựa chọn công khai'
          : 'Hàng chờ mở';
  final roleLabel = isPreferredRequest
      ? 'Đối tác được chọn đầu tiên'
      : hasPreferredProvider
          ? 'Ứng viên công khai'
          : 'Ứng viên mở';

  if (actionBlockedByWallet) {
    return ProviderRequestGuidance(
      modeLabel: 'Cơ hội đặt lịch',
      priorityLabel: 'Cần xử lý ví',
      roleLabel: 'Ứng viên công khai',
      decisionLabel: 'Cần thanh toán phí',
      nextAction: 'Thanh toán phí HANDS còn thiếu trước khi tham gia đặt lịch.',
      contextMessage:
          'Bạn vẫn có thể xem đặt lịch này, nhưng phải thanh toán phí HANDS còn thiếu trước khi tham gia.',
      detailMessage: providerMarketplaceJoinBlockReasonClean,
      infoMessage: providerWalletBlockHintClean,
    );
  }

  if (isPreferredRequest && hasChat) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Trò chuyện đang mở',
      nextAction: 'Tiếp tục trao đổi với khách hàng trong trò chuyện.',
      contextMessage:
          'Khách hàng đã chọn hồ sơ của bạn trước và trò chuyện dịch vụ đã mở.',
      detailMessage:
          'Bạn được chọn đầu tiên và trò chuyện dịch vụ đã hoạt động.',
      infoMessage: 'Trò chuyện đã sẵn sàng cho đặt lịch này.',
    );
  }

  if (isPreferredRequest && isMatched) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Đã chấp nhận',
      nextAction: 'Mở trò chuyện và phối hợp lịch hẹn với khách hàng.',
      contextMessage:
          'Khách hàng đã chọn hồ sơ của bạn và trò chuyện đã sẵn sàng.',
      detailMessage:
          'Bạn được chọn đầu tiên. Ghép đôi sẽ mở trò chuyện và bắt đầu quy trình dịch vụ.',
      infoMessage:
          'Trò chuyện và theo dõi dịch vụ đã hoạt động sau khi ghép đôi.',
    );
  }

  if (isPreferredRequest) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Xác nhận ngay',
      nextAction: 'Chấp nhận để xác nhận đặt lịch ngay.',
      contextMessage:
          'Khách hàng đã chọn hồ sơ của bạn trước và đang chờ phản hồi.',
      detailMessage:
          'Bạn là đối tác đầu tiên khách hàng chọn. Chấp nhận trong $responseWindowLabel sẽ xác nhận đặt lịch ngay; các đối tác trong phạm vi $marketplaceRadiusLabel vẫn có thể tham gia khi khách hàng chờ.',
      infoMessage:
          'Khách hàng đã chọn bạn. Chấp nhận để xác nhận ngay hoặc từ chối để đóng yêu cầu.',
    );
  }

  if (joined) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Đang hiển thị',
      nextAction: 'Tiếp tục hiển thị và chờ khách hàng chọn bạn.',
      contextMessage: hasPreferredProvider
          ? 'Một đối tác khác được chọn trước. Bạn đang hiển thị như lựa chọn thay thế.'
          : 'Bạn đang hiển thị trong yêu cầu mở này. Khách hàng sẽ chọn đối tác cuối cùng.',
      detailMessage:
          'Bạn đang trong danh sách ứng viên. Hãy giữ ứng dụng mở và chờ khách hàng chọn.',
      infoMessage:
          'Khách hàng đã thấy hồ sơ của bạn. Hãy chờ lựa chọn cuối cùng.',
    );
  }

  if (hasPreferredProvider) {
    final name = preferredProviderName == null || preferredProviderName.isEmpty
        ? 'đối tác được chọn trước'
        : preferredProviderName;
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Có thể tham gia',
      nextAction: 'Tham gia nếu bạn có thể nhận yêu cầu này.',
      contextMessage:
          'Một đối tác khác được chọn trước. Bạn vẫn có thể tham gia như lựa chọn thay thế trong phạm vi $marketplaceRadiusLabel.',
      detailMessage:
          'Khách hàng vẫn đang chờ $name. Tham gia ngay để xuất hiện trong danh sách lựa chọn.',
      infoMessage:
          'Đối tác được chọn trước: $name. Chỉ đối tác trong phạm vi $marketplaceRadiusLabel có thể tham gia.',
    );
  }

  return ProviderRequestGuidance(
    modeLabel: modeLabel,
    priorityLabel: priorityLabel,
    roleLabel: roleLabel,
    decisionLabel: 'Có thể tham gia',
    nextAction:
        'Tham gia yêu cầu mở này để vào danh sách lựa chọn của khách hàng.',
    contextMessage:
        'Yêu cầu này mở cho các đối tác gần trong phạm vi $marketplaceRadiusLabel. Khách hàng sẽ chọn đối tác cuối cùng.',
    detailMessage:
        'Không có đối tác được chọn trước. Đối tác gần có thể tham gia và chờ khách hàng chọn.',
    infoMessage:
        'Khách hàng đang chờ và các đối tác gần có thể tham gia yêu cầu này.',
  );
}

int providerMatchingWindowMinutes(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['providerResponseWindowMinutes']) ??
      asNum(booking['providerResponseWindowMinutes']) ??
      asNum(booking['earlyAcceptMin']);
  final minutes = value?.round();
  if (minutes == null || minutes <= 0) {
    return 10;
  }
  return minutes;
}

int providerMarketplaceRadiusMeters(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['marketplaceRadiusMeters']) ??
      asNum(policy?['backupProviderRadiusMeters']) ??
      asNum(booking['marketplaceRadiusMeters']) ??
      asNum(booking['backupProviderRadiusMeters']);
  final meters = value?.round();
  if (meters == null || meters <= 0) {
    return 10000;
  }
  return meters;
}

String providerMatchingWindowText(Map<String, dynamic> booking) {
  final minutes = providerMatchingWindowMinutes(booking);
  return '$minutes phút';
}

String providerMatchingWindowTagLabel(Map<String, dynamic> booking) {
  return '${providerMatchingWindowText(booking)} phản hồi trực tiếp';
}

String providerMarketplaceRadiusText(Map<String, dynamic> booking) {
  final meters = providerMarketplaceRadiusMeters(booking);
  if (meters >= 1000) {
    final km = meters / 1000;
    final value = km == km.roundToDouble()
        ? km.toInt().toString()
        : km.toStringAsFixed(1);
    return '$value km';
  }
  return '$meters m';
}

String providerMarketplaceRadiusTagLabel(Map<String, dynamic> booking) {
  return '${providerMarketplaceRadiusText(booking)} phạm vi công khai';
}

@Deprecated('Use providerMarketplaceRadiusMeters. Reads legacy policy keys.')
int providerBackupRadiusMeters(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusMeters(booking);

@Deprecated('Use providerMarketplaceRadiusText. Reads legacy policy keys.')
String providerBackupRadiusText(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusText(booking);

@Deprecated('Use providerMarketplaceRadiusTagLabel. Reads legacy policy keys.')
String providerBackupRadiusTagLabel(Map<String, dynamic> booking) =>
    providerMarketplaceRadiusTagLabel(booking);
