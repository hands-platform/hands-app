abstract class CustomerBookingRepository {
  Future<Map<String, dynamic>> getBooking(String bookingId);

  Future<List<dynamic>> listBookings();

  void joinBookingRoom(String bookingId);

  Future<Map<String, dynamic>> cancelBooking(String bookingId);

  Future<Map<String, dynamic>> createBooking(
    String serviceId, {
    String? providerId,
    String? couponCode,
    String? selectedLocationId,
    required String customerName,
    required String customerPhone,
    required String addressLine,
    required double lat,
    required double lng,
  });

  Future<Map<String, dynamic>> selectProvider(
      String bookingId, String providerProfileId);
}
