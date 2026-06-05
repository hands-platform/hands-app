import '../../../core/provider_value_helpers.dart';

const providerWalletBlockFallbackReasonClean =
    'Unpaid HANDS fees must be settled before you can join this booking.';

const providerWalletBlockHintClean =
    'Cash jobs are paid directly to you. Deposit the unpaid HANDS fee or wait for an admin offset, then refresh wallet status before joining marketplace requests.';

const providerMarketplaceJoinBlockedButtonLabel = 'Fee settlement required';

bool providerWalletBlocksMarketplaceJoin({
  required bool walletBlocked,
  required bool isPreferredRequest,
  required bool isMatched,
  required bool joined,
}) {
  return walletBlocked && !isPreferredRequest && !isMatched && !joined;
}

String providerMarketplaceJoinButtonLabel({
  required bool walletBlocksMarketplaceJoin,
  required bool hasPreferredProvider,
}) {
  if (walletBlocksMarketplaceJoin) {
    return providerMarketplaceJoinBlockedButtonLabel;
  }
  return hasPreferredProvider
      ? 'Offer marketplace support'
      : 'Join open matching';
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
  return providerWalletBlockReason(summary) != null;
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
    this.reason,
    this.reference,
  });

  factory ProviderWalletSettlementView.fromSummary(
    Map<String, dynamic> summary,
  ) {
    final currency = summary['currency']?.toString().trim();
    final walletBalance = providerWalletBalance(summary);
    final debtAmount = asNum(summary['walletDebtAmount']) ??
        (walletBalance < 0 ? walletBalance.abs() : 0);
    final reason = providerWalletBlockReason(summary);

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
    );
  }

  final String currency;
  final num walletBalance;
  final num debtAmount;
  final bool blocked;
  final String statusLabel;
  final String instruction;
  final List<String> steps;
  final String? reason;
  final String? reference;

  String get amountLabel => '${formatCurrency(debtAmount)} $currency';

  String get balanceLabel => '${formatCurrency(walletBalance)} $currency';

  String get reasonLabel => reason ?? providerWalletBlockFallbackReasonClean;
}

String providerWalletStatusLabel(Map<String, dynamic> summary) {
  final walletBalance = providerWalletBalance(summary);
  if (providerWalletBlockReason(summary) != null) {
    return 'Settlement required';
  }
  if (walletBalance == 0) {
    return 'No unsettled balance';
  }
  return walletBalance > 0 ? 'Available for payout review' : 'Under review';
}

List<String> providerWalletSettlementSteps(Map<String, dynamic> summary) {
  final serverSteps = asList(summary['walletSettlementSteps'])
      .map((item) => item?.toString().trim() ?? '')
      .where((item) => item.isNotEmpty)
      .toList();
  if (serverSteps.isNotEmpty) {
    return serverSteps;
  }
  if (providerWalletBlockReason(summary) == null) {
    return const [
      'Cash booking fees are settled.',
      'You can join marketplace requests.',
      'Payout still needs tax, bank, and agreement checks.',
    ];
  }
  final debtAmount = asNum(summary['walletDebtAmount']) ??
      providerWalletBalance(summary).abs();
  final currency = summary['currency']?.toString() ?? 'VND';
  final reference = providerWalletSettlementReference(summary);
  return [
    'Settle ${formatCurrency(debtAmount)} $currency for unpaid HANDS fees.',
    if (reference != null)
      'Use reference $reference when sending the deposit or requesting admin offset.',
    'After admin confirms the deposit or offset, refresh wallet status.',
    'Marketplace participation and payout release unlock when the wallet is no longer negative.',
  ];
}
