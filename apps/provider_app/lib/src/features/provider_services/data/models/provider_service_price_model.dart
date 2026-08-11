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
    super.vatBps,
    super.otherCostAmount,
    super.currency,
    super.payoutOptions,
  });

  factory ProviderServicePriceModel.fromJson(Map<String, dynamic> json) {
    final payoutRule = _asMap(json['payoutRule']);
    final payoutOptions = _asList(json['payoutOptions'])
        .map(_asMap)
        .whereType<Map<String, dynamic>>()
        .map(_payoutOptionFromJson)
        .whereType<ProviderServicePayoutOption>()
        .toList(growable: false);
    return ProviderServicePriceModel(
      id: json['id']?.toString() ?? '',
      serviceGroupKey: json['serviceGroupKey']?.toString(),
      name: json['name']?.toString() ?? 'Dịch vụ',
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
      vatBps: _asInt(payoutRule?['vatBps']),
      otherCostAmount: _asInt(payoutRule?['otherCostAmount']),
      currency: payoutRule?['currency']?.toString() ?? 'VND',
      payoutOptions: payoutOptions,
    );
  }
}

ProviderServicePayoutOption? _payoutOptionFromJson(Map<String, dynamic> json) {
  final customerPrice = _asInt(json['customerPrice']);
  final providerPayoutAmount = _asInt(json['providerPayoutAmount']);
  final platformFee = _asInt(json['platformFee']);
  if (customerPrice == null ||
      providerPayoutAmount == null ||
      platformFee == null) {
    return null;
  }
  return ProviderServicePayoutOption(
    customerPrice: customerPrice,
    providerPayoutAmount: providerPayoutAmount,
    platformFee: platformFee,
    currency: json['currency']?.toString() ?? 'VND',
  );
}

List<dynamic> _asList(dynamic value) {
  return value is List<dynamic> ? value : const <dynamic>[];
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
