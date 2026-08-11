abstract class ProviderProfileRepository {
  Future<void> goOnline();

  Future<void> goOffline();

  Future<Map<String, dynamic>> recordDeviceSession();

  Future<Map<String, dynamic>> updateLocation({
    String? bookingId,
    bool includeAddressText = false,
  });

  Future<Map<String, dynamic>> providerMe();

  Future<Map<String, dynamic>> availability();

  Future<Map<String, dynamic>> updateWorkingHours(
      List<Map<String, dynamic>> workingHours);

  Future<Map<String, dynamic>> uploadProfileImage({
    required List<int> bytes,
    required String contentType,
  });

  Future<Map<String, dynamic>> uploadGalleryImage({
    required List<int> bytes,
    required String contentType,
  });
}
