import '../entities/provider_service_price.dart';

abstract class ProviderServicePriceRepository {
  Future<List<ProviderServicePrice>> listServices();

  Future<ProviderServicePrice> updateService({
    required String serviceId,
    required int price,
    required bool active,
  });
}
