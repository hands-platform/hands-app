import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../domain/repositories/customer_booking_repository.dart';

class CustomerPaymentActionRepositoryImpl
    implements CustomerPaymentActionRepository {
  const CustomerPaymentActionRepositoryImpl(this._api);

  final ApiClient _api;

  @override
  Future<CustomerPaymentAction> getForBooking(String bookingId) async {
    final result =
        await _api.getJson('/customer/bookings/$bookingId/payment-action')
            as Map<String, dynamic>;
    final rawUrl = result['checkoutUrl']?.toString() ?? '';
    final parsed = Uri.parse(rawUrl);
    return CustomerPaymentAction(
      bookingId: result['bookingId']?.toString() ?? bookingId,
      checkoutUri:
          parsed.hasScheme ? parsed : Uri.parse(_api.baseUrl).resolve(rawUrl),
      method: result['method']?.toString() ?? '',
      paymentId: result['paymentId']?.toString() ?? '',
      status: result['status']?.toString() ?? '',
    );
  }
}

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
  Future<List<dynamic>> listBookings({String? cursor, int take = 20}) async {
    final path = Uri(
      path: '/customer/bookings',
      queryParameters: {
        'take': '$take',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    ).toString();
    final result = await _api.getJson(path);
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<List<CustomerPaymentMethodOption>> listPaymentMethods() async {
    final result = await _api.getJson('/customer/payment-methods');
    final methods = result is Map<String, dynamic> ? result['methods'] : null;
    if (methods is! List<dynamic>) {
      return const [CustomerPaymentMethodOption.cash];
    }

    final parsed = methods
        .whereType<Map<String, dynamic>>()
        .map(CustomerPaymentMethodOption.fromJson)
        .where((item) => item.method.isNotEmpty && item.label.isNotEmpty)
        .toList(growable: false);
    return parsed.isEmpty ? const [CustomerPaymentMethodOption.cash] : parsed;
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
  Future<Map<String, dynamic>> createReview({
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    final result = await _api.postJson('/customer/reviews', {
      'bookingId': bookingId,
      'rating': rating,
      if (comment != null && comment.trim().isNotEmpty)
        'comment': comment.trim(),
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> createBooking(
    String serviceId, {
    required String idempotencyKey,
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
  }) async {
    final result = await _api.postJson('/customer/bookings', {
      'idempotencyKey': idempotencyKey,
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
        'currentLocationUpdatedAt':
            currentLocationUpdatedAt.toUtc().toIso8601String(),
      'paymentMethod': paymentMethod,
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
    if (result is! Map) {
      throw const FormatException('Invalid booking selection response');
    }
    final envelope = Map<String, dynamic>.from(result);
    final nestedBooking = envelope['booking'];
    final booking = nestedBooking is Map
        ? Map<String, dynamic>.from(nestedBooking)
        : envelope;
    if (booking['id']?.toString() != bookingId) {
      throw const FormatException(
          'Booking selection response is missing the booking');
    }
    return booking;
  }
}
