import '../../../../core/api_client.dart';
import '../../domain/repositories/customer_discovery_repository.dart';

class CustomerDiscoveryRepositoryImpl implements CustomerDiscoveryRepository {
  const CustomerDiscoveryRepositoryImpl(this._api);

  final ApiClient _api;

  @override
  Future<List<dynamic>> listServices() async {
    final result = await _api.getJson('/services/groups');
    return _serviceItemsFromResult(result).toList();
  }

  @override
  Future<List<dynamic>> nearbyProviders({
    required double lat,
    required double lng,
  }) async {
    final result =
        await _api.getJson('/customer/partners/nearby?lat=$lat&lng=$lng');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<Map<String, dynamic>?> saveSelectedLocation({
    required double lat,
    required double lng,
    required String addressText,
  }) async {
    final result = await _api.postJson('/customer/locations/selected', {
      'lat': lat,
      'lng': lng,
      'addressText': addressText,
    });
    return result is Map<String, dynamic> ? result : null;
  }

  @override
  Future<Map<String, dynamic>> getProviderDetail(String providerId) async {
    final result = await _api.getJson('/customer/partners/$providerId');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }
}

Iterable<Map<String, dynamic>> _serviceItemsFromResult(dynamic result) sync* {
  if (result is! List<dynamic>) {
    return;
  }
  for (final item in result) {
    if (item is! Map) {
      continue;
    }
    final options = item['options'];
    if (options is List<dynamic>) {
      for (final option in options) {
        if (option is Map) {
          yield Map<String, dynamic>.from(option);
        }
      }
      continue;
    }
    yield Map<String, dynamic>.from(item);
  }
}
