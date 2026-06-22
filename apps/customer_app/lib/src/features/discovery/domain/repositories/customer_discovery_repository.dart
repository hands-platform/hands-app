abstract class CustomerDiscoveryRepository {
  Future<List<dynamic>> listServices();

  Future<List<dynamic>> nearbyProviders({
    required double lat,
    required double lng,
  });

  Future<Map<String, dynamic>?> saveSelectedLocation({
    required double lat,
    required double lng,
    required String addressText,
  });

  Future<Map<String, dynamic>> getProviderDetail(String providerId);

  Future<Set<String>> listFavoriteProviderIds();

  Future<void> setFavoriteProvider({
    required String providerId,
    required bool favorite,
  });
}
