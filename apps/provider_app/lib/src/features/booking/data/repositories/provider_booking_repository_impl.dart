import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../domain/repositories/provider_booking_repository.dart';
import '../../domain/services/provider_booking_detail_view_tracker.dart';

class ProviderBookingRepositoryImpl implements ProviderBookingRepository {
  const ProviderBookingRepositoryImpl(this._api, this._socket);

  final ApiClient _api;
  final RealtimeSocket _socket;

  @override
  Future<List<dynamic>> openBookings() async {
    final result = await _api.getJson('/partner/bookings/open');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<List<dynamic>> listBookings() async {
    final result = await _api.getJson('/partner/bookings');
    return result is List<dynamic> ? result : [];
  }

  @override
  Future<List<dynamic>> requestBookings() async {
    final openItems = await openBookings();
    return openItems
        .whereType<Map<String, dynamic>>()
        .where((booking) => booking['status'] == 'OPEN_MATCHING')
        .toList()
      ..sort((left, right) {
        final leftValue =
            (left['openedAt'] ?? left['createdAt'] ?? '') as String;
        final rightValue =
            (right['openedAt'] ?? right['createdAt'] ?? '') as String;
        return rightValue.compareTo(leftValue);
      });
  }

  @override
  Future<Map<String, dynamic>> joinBooking(String bookingId) async {
    final result = await _api.postJson('/partner/bookings/$bookingId/join', {})
        as Map<String, dynamic>;
    _socket.joinBooking(bookingId);
    return result;
  }

  @override
  Future<Map<String, dynamic>> acceptBooking(String bookingId) async {
    final result =
        await _api.postJson('/partner/bookings/$bookingId/accept', {});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> rejectBooking(String bookingId) async {
    final result =
        await _api.postJson('/partner/bookings/$bookingId/reject', {});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> startBooking(String bookingId) async {
    final result =
        await _api.postJson('/partner/bookings/$bookingId/start', {});
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    final result = await _api.postJson(
      '/partner/bookings/$bookingId/complete',
      _bookingActionPayload(
        lat: lat,
        lng: lng,
        addressText: addressText,
      ),
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    final result = await _api.postJson(
      '/partner/bookings/$bookingId/cancel',
      _bookingActionPayload(
        note: note,
        lat: lat,
        lng: lng,
        addressText: addressText,
      ),
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> recordDetailViewTelemetry(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  }) async {
    final result = await _api.postJson(
      '/partner/bookings/$bookingId/detail-view',
      {
        'eventType': eventType.name,
        if (duration != null) 'durationSeconds': duration.inSeconds,
      },
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }
}

Map<String, dynamic> _bookingActionPayload({
  String? note,
  double? lat,
  double? lng,
  String? addressText,
}) {
  final payload = <String, dynamic>{};
  if (note != null) {
    payload['note'] = note;
  }
  if (lat != null && lng != null) {
    payload['lat'] = lat;
    payload['lng'] = lng;
  }

  final normalizedAddressText = addressText?.trim();
  if (normalizedAddressText != null && normalizedAddressText.isNotEmpty) {
    payload['addressText'] = normalizedAddressText;
  }
  return payload;
}
