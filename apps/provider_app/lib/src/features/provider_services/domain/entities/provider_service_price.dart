class ProviderServicePrice {
  const ProviderServicePrice({
    required this.id,
    required this.name,
    required this.durationMin,
    required this.basePrice,
    required this.priceStep,
    required this.effectivePrice,
    required this.active,
    required this.payoutRuleConfigured,
    this.serviceGroupKey,
    this.description,
    this.providerPrice,
    this.providerPayoutAmount,
    this.platformFee,
    this.vatBps,
    this.otherCostAmount,
    this.currency = 'VND',
    this.payoutOptions = const [],
  });

  final String id;
  final String? serviceGroupKey;
  final String name;
  final String? description;
  final int durationMin;
  final int basePrice;
  final int priceStep;
  final int? providerPrice;
  final int effectivePrice;
  final bool active;
  final bool payoutRuleConfigured;
  final int? providerPayoutAmount;
  final int? platformFee;
  final int? vatBps;
  final int? otherCostAmount;
  final String currency;
  final List<ProviderServicePayoutOption> payoutOptions;

  bool get usesAdminMinimum =>
      providerPrice == null || providerPrice == basePrice;

  int get estimatedVatAmount {
    final fee = platformFee ?? 0;
    final bps = vatBps ?? 0;
    return ((fee * bps) / 10000).round();
  }

  int get estimatedCompanyFeeAfterCosts {
    final fee = platformFee ?? 0;
    return fee - estimatedVatAmount - (otherCostAmount ?? 0);
  }
}

class ProviderServicePayoutOption {
  const ProviderServicePayoutOption({
    required this.customerPrice,
    required this.providerPayoutAmount,
    required this.platformFee,
    this.currency = 'VND',
  });

  final int customerPrice;
  final int providerPayoutAmount;
  final int platformFee;
  final String currency;
}
