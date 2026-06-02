import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../domain/repositories/customer_booking_repository.dart';

class CustomerBookingRepositoryImpl implements CustomerBookingRepository {
  const CustomerBookingRepositoryImpl(this._api, this._socket);

  final ApiClient _api;
  final RealtimeSocket _socket;

  @override
  Future<Map<String, dynamic>> getBooking(String bookingId) async {
    final result = await _api.getJson('/customer/bookings/$bookingId');
    return result as Map<String, dynamic>;
  }

  @override
  Future<List<dynamic>> listBookings() async {
    final result = await _api.getJson('/customer/bookings');
    return result is List<dynamic> ? result : [];
  }

  @override
  void joinBookingRoom(String bookingId) {
    _socket.joinBooking(bookingId);
  }

  @override
  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    final result =
        await _api.postJson('/customer/bookings/$bookingId/cancel', {});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
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
    double? currentLat,
    double? currentLng,
    DateTime? currentLocationUpdatedAt,
  }) async {
    final result = await _api.postJson('/customer/bookings', {
      'serviceId': serviceId,
      if (providerId != null) 'providerId': providerId,
      if (selectedLocationId != null) 'selectedLocationId': selectedLocationId,
      if (couponCode != null && couponCode.trim().isNotEmpty)
        'couponCode': couponCode.trim().toUpperCase(),
      'address': {
        'name': customerName,
        'phone': customerPhone,
        'line1': addressLine,
      },
      'lat': lat,
      'lng': lng,
      if (currentLat != null) 'currentLat': currentLat,
      if (currentLng != null) 'currentLng': currentLng,
      if (currentLocationUpdatedAt != null)
        'currentLocationUpdatedAt': currentLocationUpdatedAt.toUtc().toIso8601String(),
      'paymentMethod': 'CASH',
    });
    final bookingId = result['id'] as String;
    _socket.joinBooking(bookingId);
    return getBooking(bookingId);
  }

  @override
  Future<Map<String, dynamic>> selectProvider(
      String bookingId, String providerProfileId) async {
    final result = await _api.postJson(
      '/customer/bookings/$bookingId/select-provider',
      {'providerId': providerProfileId},
    );
    return result as Map<String, dynamic>;
  }
}
