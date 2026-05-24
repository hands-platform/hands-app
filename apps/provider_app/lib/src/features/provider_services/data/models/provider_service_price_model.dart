import '../../domain/entities/provider_service_price.dart';

class ProviderServicePriceModel extends ProviderServicePrice {
  const ProviderServicePriceModel({
    required super.id,
    required super.name,
    required super.durationMin,
    required super.basePrice,
    required super.priceStep,
    required super.effectivePrice,
    required super.active,
    required super.payoutRuleConfigured,
    super.serviceGroupKey,
    super.description,
    super.providerPrice,
    super.providerPayoutAmount,
    super.platformFee,
  });

  factory ProviderServicePriceModel.fromJson(Map<String, dynamic> json) {
    final payoutRule = _asMap(json['payoutRule']);
    return ProviderServicePriceModel(
      id: json['id']?.toString() ?? '',
      serviceGroupKey: json['serviceGroupKey']?.toString(),
      name: json['name']?.toString() ?? 'Service',
      description: json['description']?.toString(),
      durationMin: _asInt(json['durationMin']) ?? 0,
      basePrice: _asInt(json['basePrice']) ?? 0,
      priceStep: _asInt(json['priceStep']) ?? 100000,
      providerPrice: _asInt(json['providerPrice']),
      effectivePrice: _asInt(json['effectivePrice']) ??
          _asInt(json['providerPrice']) ??
          _asInt(json['basePrice']) ??
          0,
      active: json['active'] != false,
      payoutRuleConfigured: json['payoutRuleConfigured'] == true,
      providerPayoutAmount: _asInt(payoutRule?['providerPayoutAmount']),
      platformFee: _asInt(payoutRule?['platformFee']),
    );
  }
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

int? _asInt(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}
