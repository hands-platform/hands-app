import '../../../core/provider_value_helpers.dart';

const providerWalletBlockFallbackReasonClean =
    'Phí HANDS chưa được thanh toán nên bạn không thể tham gia đặt lịch này.';

const providerWalletBlockHintClean =
    'Bạn vẫn có thể xem yêu cầu đặt lịch và phản hồi yêu cầu chỉ định trực tiếp. Hãy thanh toán phí HANDS còn thiếu trước khi tham gia đặt lịch công khai.';

const providerMarketplaceJoinBlockReasonClean =
    'Phí HANDS chưa được thanh toán nên bạn không thể tham gia đặt lịch này.';

bool providerWalletBlocksMarketplaceParticipation({
  required bool walletBlocked,
  required bool isPreferredRequest,
  required bool isMatched,
}) {
  return walletBlocked && !isPreferredRequest && !isMatched;
}

String providerMarketplaceJoinButtonLabel({
  required bool hasPreferredProvider,
}) {
  return hasPreferredProvider
      ? 'Tham gia hỗ trợ đặt lịch'
      : 'Tham gia đặt lịch';
}

num providerWalletBalance(Map<String, dynamic> summary) {
  return asNum(summary['walletBalance']) ??
      ((asNum(summary['pendingNetAmount']) ?? 0) +
          (asNum(summary['availableNetAmount']) ?? 0));
}

bool providerWalletMarketplaceJoinBlocked(Map<String, dynamic> summary) {
  final explicit = summary['marketplaceJoinBlocked'];
  if (explicit is bool) {
    return explicit;
  }
  return false;
}

String? providerWalletBlockReason(Map<String, dynamic> summary) {
  final walletBalance = providerWalletBalance(summary);
  final walletBlocked = summary['marketplaceJoinBlocked'] == true ||
      summary['walletBlocked'] == true ||
      walletBalance < 0;
  if (!walletBlocked) {
    return null;
  }

  final displayMessage =
      (summary['walletBlockDisplayMessage'] ?? summary['displayMessage'])
          ?.toString()
          .trim();
  if (displayMessage != null && displayMessage.isNotEmpty) {
    return displayMessage;
  }

  final reason = summary['walletBlockReason']?.toString().trim();
  if (reason != null && reason.isNotEmpty) {
    return reason;
  }

  final message = summary['message'];
  if (message is String && message.trim().isNotEmpty) {
    return message.trim();
  }

  return providerWalletBlockFallbackReasonClean;
}

String providerWalletSettlementInstruction(Map<String, dynamic> summary) {
  final bankCorrection = providerWalletBankCorrectionRequest(summary);
  if (bankCorrection != null && providerWalletBlockReason(summary) == null) {
    return providerWalletBankCorrectionReason(summary);
  }

  final instruction = summary['walletSettlementInstruction']?.toString().trim();
  if (instruction != null && instruction.isNotEmpty) {
    return instruction;
  }
  return providerWalletBlockHintClean;
}

String? providerWalletSettlementReference(Map<String, dynamic> summary) {
  if (providerWalletBlockReason(summary) == null) {
    return null;
  }

  for (final key in [
    'walletSettlementReference',
    'settlementReference',
    'settlementRef',
  ]) {
    final reference = summary[key]?.toString().trim();
    if (reference != null && reference.isNotEmpty) {
      return reference;
    }
  }

  return null;
}

class ProviderWalletSettlementView {
  const ProviderWalletSettlementView({
    required this.currency,
    required this.walletBalance,
    required this.debtAmount,
    required this.blocked,
    required this.statusLabel,
    required this.instruction,
    required this.steps,
    required this.bankCorrectionRequired,
    this.reason,
    this.reference,
    this.bankCorrectionReason,
  });

  factory ProviderWalletSettlementView.fromSummary(
    Map<String, dynamic> summary,
  ) {
    final currency = summary['currency']?.toString().trim();
    final walletBalance = providerWalletBalance(summary);
    final debtAmount = asNum(summary['walletDebtAmount']) ??
        (walletBalance < 0 ? walletBalance.abs() : 0);
    final reason = providerWalletBlockReason(summary);
    final bankCorrection = providerWalletBankCorrectionRequest(summary);
    final bankCorrectionReason = bankCorrection == null
        ? null
        : providerWalletBankCorrectionReason(summary);

    return ProviderWalletSettlementView(
      currency: currency == null || currency.isEmpty ? 'VND' : currency,
      walletBalance: walletBalance,
      debtAmount: debtAmount,
      blocked: reason != null,
      reason: reason,
      reference: providerWalletSettlementReference(summary),
      statusLabel: providerWalletStatusLabel(summary),
      instruction: providerWalletSettlementInstruction(summary),
      steps: providerWalletSettlementSteps(summary),
      bankCorrectionRequired: bankCorrection != null,
      bankCorrectionReason: bankCorrectionReason,
    );
  }

  final String currency;
  final num walletBalance;
  final num debtAmount;
  final bool blocked;
  final String statusLabel;
  final String instruction;
  final List<String> steps;
  final bool bankCorrectionRequired;
  final String? reason;
  final String? reference;
  final String? bankCorrectionReason;

  String get amountLabel => '${formatCurrency(debtAmount)} $currency';

  String get balanceLabel => '${formatCurrency(walletBalance)} $currency';

  String get reasonLabel => reason ?? providerWalletBlockFallbackReasonClean;

  String get bankCorrectionReasonLabel =>
      bankCorrectionReason ??
      'Cập nhật thông tin ngân hàng trước khi tiếp tục hỗ trợ rút hoặc nộp tiền.';
}

String providerWalletStatusLabel(Map<String, dynamic> summary) {
  final walletBalance = providerWalletBalance(summary);
  if (providerWalletBlockReason(summary) != null) {
    return 'Cần thanh toán phí';
  }
  if (providerWalletBankCorrectionRequest(summary) != null) {
    return 'Cần sửa thông tin ngân hàng';
  }
  if (walletBalance == 0) {
    return 'Không có số dư chưa thanh toán';
  }
  return walletBalance > 0 ? 'Sẵn sàng để xét chi trả' : 'Đang xem xét';
}

List<String> providerWalletSettlementSteps(Map<String, dynamic> summary) {
  final serverSteps = asList(summary['walletSettlementSteps'])
      .map((item) => item?.toString().trim() ?? '')
      .where((item) => item.isNotEmpty)
      .toList();
  if (serverSteps.isNotEmpty) {
    return serverSteps;
  }
  if (providerWalletBankCorrectionRequest(summary) != null &&
      providerWalletBlockReason(summary) == null) {
    return const [
      'Mở thông tin ngân hàng của ví trong mục Thu nhập.',
      'Gửi lại thông tin tài khoản ngân hàng đã sửa.',
      'Quản trị viên HANDS sẽ kiểm tra trước khi tiếp tục hỗ trợ rút hoặc nộp tiền.',
    ];
  }
  if (providerWalletBlockReason(summary) == null) {
    return const [
      'Phí đặt lịch tiền mặt đã được thanh toán.',
      'Bạn có thể tham gia các yêu cầu đặt lịch công khai.',
      'Khoản chi trả ví được kiểm tra khi bạn yêu cầu rút tiền hoặc báo cáo khoản nộp.',
    ];
  }
  final debtAmount = asNum(summary['walletDebtAmount']) ??
      providerWalletBalance(summary).abs();
  final currency = summary['currency']?.toString() ?? 'VND';
  final reference = providerWalletSettlementReference(summary);
  return [
    'Thanh toán ${formatCurrency(debtAmount)} $currency phí HANDS còn thiếu.',
    if (reference != null)
      'Dùng mã $reference khi gửi khoản nộp hoặc yêu cầu bù trừ.',
    'Sau khi quản trị viên xác nhận khoản nộp hoặc bù trừ, hãy làm mới trạng thái ví.',
    'Quyền tham gia đặt lịch và nhận tiền chi trả sẽ được khôi phục khi số dư ví không còn âm.',
  ];
}

Map<String, dynamic>? providerWalletBankCorrectionRequest(
    Map<String, dynamic> summary) {
  final correction = asMap(summary['bankCorrectionRequest']);
  if (correction?['required'] != true) {
    return null;
  }
  return correction;
}

String providerWalletBankCorrectionReason(Map<String, dynamic> summary) {
  final correction = providerWalletBankCorrectionRequest(summary);
  final reason = correction?['reason']?.toString().trim();
  if (reason != null && reason.isNotEmpty) {
    return reason;
  }
  final message = correction?['message']?.toString().trim();
  if (message != null && message.isNotEmpty) {
    return message;
  }
  return 'Cập nhật thông tin ngân hàng trước khi tiếp tục hỗ trợ rút hoặc nộp tiền.';
}
