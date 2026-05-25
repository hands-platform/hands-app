import '../../../../core/api_client.dart';
import '../../domain/entities/provider_service_price.dart';
import '../../domain/repositories/provider_service_price_repository.dart';
import '../models/provider_service_price_model.dart';

class ProviderServicePriceRepositoryImpl
    implements ProviderServicePriceRepository {
  const ProviderServicePriceRepositoryImpl(this._api);

  final ApiClient _api;

  @override
  Future<List<ProviderServicePrice>> listServices() async {
    final result = await _api.getJson('/provider/services');
    final items = result is List<dynamic> ? result : const <dynamic>[];
    return items
        .whereType<Map>()
        .map((item) =>
            ProviderServicePriceModel.fromJson(Map<String, dynamic>.from(item)))
        .where((item) => item.id.isNotEmpty)
        .toList();
  }

  @override
  Future<ProviderServicePrice> updateService({
    required String serviceId,
    required int price,
    required bool active,
  }) async {
    final result = await _api.patchJson('/provider/services/$serviceId', {
      'price': price,
      'active': active,
    });
    final record =
        result is Map ? Map<String, dynamic>.from(result) : <String, dynamic>{};
    final service = record['service'] is Map
        ? Map<String, dynamic>.from(record['service'] as Map)
        : <String, dynamic>{};
    final payoutRules = service['payoutRules'] is List<dynamic>
        ? service['payoutRules'] as List<dynamic>
        : const <dynamic>[];
    final selectedPrice =
        _asInt(record['price']) ?? _asInt(service['basePrice']);
    final payoutRule = _payoutRuleForPrice(payoutRules, selectedPrice);
    return ProviderServicePriceModel.fromJson({
      ...service,
      'providerServiceId': record['id'],
      'providerPrice': selectedPrice,
      'effectivePrice': selectedPrice,
      'active': record['active'],
      'payoutRuleConfigured': payoutRule != null,
      'payoutOptions': payoutRule == null
          ? const []
          : [
              {
                ...payoutRule,
                'platformFee': (record['price'] is int &&
                        payoutRule['providerPayoutAmount'] is int)
                    ? (record['price'] as int) -
                        (payoutRule['providerPayoutAmount'] as int)
                    : null,
              }
            ],
      'payoutRule': payoutRule == null
          ? null
          : {
              ...payoutRule,
              'platformFee': (record['price'] is int &&
                      payoutRule['providerPayoutAmount'] is int)
                  ? (record['price'] as int) -
                      (payoutRule['providerPayoutAmount'] as int)
                  : null,
            },
    });
  }
}

Map<String, dynamic>? _payoutRuleForPrice(List<dynamic> rules, int? price) {
  if (price == null) {
    return null;
  }
  for (final rule in rules) {
    if (rule is! Map) {
      continue;
    }
    final mapped = Map<String, dynamic>.from(rule);
    if (_asInt(mapped['customerPrice']) == price) {
      return mapped;
    }
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
