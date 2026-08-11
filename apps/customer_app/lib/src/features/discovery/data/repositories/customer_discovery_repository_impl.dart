import '../../../../core/api_client.dart';
import '../../../../core/app_session_reporter.dart';
import '../../domain/repositories/customer_discovery_repository.dart';

class CustomerDiscoveryRepositoryImpl implements CustomerDiscoveryRepository {
  const CustomerDiscoveryRepositoryImpl(this._api, this._appSessionReporter);

  final ApiClient _api;
  final AppSessionReporter _appSessionReporter;

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
  Future<Map<String, dynamic>> getHomeSummary({
    required double lat,
    required double lng,
  }) async {
    final result =
        await _api.getJson('/customer/home-summary?lat=$lat&lng=$lng');
    return result is Map<String, dynamic>
        ? result
        : <String, dynamic>{
            'wallet': {'balance': 0, 'currency': 'VND'},
            'favoritePartners': <dynamic>[],
            'completedPartners': <dynamic>[],
          };
  }

  @override
  Future<Map<String, dynamic>> getWallet() async {
    final result = await _api.getJson('/customer/wallet');
    return result is Map<String, dynamic>
        ? result
        : <String, dynamic>{
            'balance': 0,
            'currency': 'VND',
            'entries': <dynamic>[],
          };
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
    await _appSessionReporter.saveLastKnownAddress(addressText);
    return result is Map<String, dynamic> ? result : null;
  }

  @override
  Future<List<Map<String, dynamic>>> listSavedLocations() async {
    final result = await _api.getJson('/customer/locations');
    return result is List
        ? result
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
        : [];
  }

  @override
  Future<void> deleteSavedLocation(String locationId) async {
    await _api.deleteJson('/customer/locations/$locationId', {});
  }

  @override
  Future<Map<String, dynamic>> getProviderDetail(String providerId) async {
    final result = await _api.getJson('/customer/partners/$providerId');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<void> recordProviderProfileView(String providerId) async {
    await _api.postJson('/customer/partners/$providerId/view', {
      'clientEventId':
          _appSessionReporter.createClientEventId('PROVIDER_PROFILE_VIEW'),
    });
  }

  @override
  Future<Set<String>> listFavoriteProviderIds() async {
    final result = await _api.getJson('/customer/partner-favorites');
    if (result is! List<dynamic>) {
      return <String>{};
    }
    return result
        .map((item) => item is Map ? item['providerProfileId'] : null)
        .whereType<String>()
        .toSet();
  }

  @override
  Future<void> setFavoriteProvider({
    required String providerId,
    required bool favorite,
  }) async {
    await _api.postJson('/customer/partners/$providerId/favorite', {
      'favorite': favorite,
    });
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
