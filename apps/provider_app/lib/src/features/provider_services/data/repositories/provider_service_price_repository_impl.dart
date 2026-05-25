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
    final payoutRule = payoutRules.isNotEmpty && payoutRules.first is Map
        ? Map<String, dynamic>.from(payoutRules.first as Map)
        : null;
    return ProviderServicePriceModel.fromJson({
      ...service,
      'providerServiceId': record['id'],
      'providerPrice': record['price'],
      'effectivePrice': record['price'],
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
