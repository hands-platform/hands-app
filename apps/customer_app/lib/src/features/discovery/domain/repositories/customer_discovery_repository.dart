abstract class CustomerDiscoveryRepository {
  Future<List<dynamic>> listServices();

  Future<List<dynamic>> nearbyProviders({
    required double lat,
    required double lng,
  });

  Future<Map<String, dynamic>> getHomeSummary({
    required double lat,
    required double lng,
  });

  Future<Map<String, dynamic>> getWallet();

  Future<Map<String, dynamic>?> saveSelectedLocation({
    required double lat,
    required double lng,
    required String addressText,
  });

  Future<List<Map<String, dynamic>>> listSavedLocations();

  Future<void> deleteSavedLocation(String locationId);

  Future<Map<String, dynamic>> getProviderDetail(String providerId);

  Future<void> recordProviderProfileView(String providerId);

  Future<Set<String>> listFavoriteProviderIds();

  Future<void> setFavoriteProvider({
    required String providerId,
    required bool favorite,
  });
}
