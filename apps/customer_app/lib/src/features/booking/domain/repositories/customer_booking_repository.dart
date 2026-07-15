class CustomerPaymentMethodOption {
  const CustomerPaymentMethodOption({
    required this.method,
    required this.label,
    required this.requiresRedirect,
  });

  static const cash = CustomerPaymentMethodOption(
    method: 'CASH',
    label: 'Cash',
    requiresRedirect: false,
  );

  final String method;
  final String label;
  final bool requiresRedirect;

  factory CustomerPaymentMethodOption.fromJson(Map<String, dynamic> json) {
    return CustomerPaymentMethodOption(
      method: (json['method'] as String? ?? '').trim().toUpperCase(),
      label: (json['label'] as String? ?? '').trim(),
      requiresRedirect: json['requiresRedirect'] == true,
    );
  }
}

abstract class CustomerBookingRepository {
  Future<Map<String, dynamic>> getBooking(String bookingId);

  Future<List<dynamic>> listBookings();

  Future<List<CustomerPaymentMethodOption>> listPaymentMethods();

  void joinBookingRoom(String bookingId);

  Future<Map<String, dynamic>> cancelBooking(String bookingId);

  Future<Map<String, dynamic>> createReview({
    required String bookingId,
    required int rating,
    String? comment,
  });

  Future<Map<String, dynamic>> createBooking(
    String serviceId, {
    String? providerId,
    String? couponCode,
    String? selectedLocationId,
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    required String addressLine,
    required double lat,
    required double lng,
    double? currentLat,
    double? currentLng,
    DateTime? currentLocationUpdatedAt,
  });

  Future<Map<String, dynamic>> selectProvider(
      String bookingId, String providerProfileId);
}
