abstract class ProviderProfileRepository {
  Future<void> goOnline();

  Future<void> goOffline();

  Future<Map<String, double>> updateLocation({String? bookingId});

  Future<Map<String, dynamic>> providerMe();

  Future<Map<String, dynamic>> uploadProfileImage({
    required List<int> bytes,
    required String contentType,
  });
}
