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

  bool get usesAdminMinimum => providerPrice == null || providerPrice == basePrice;
}
