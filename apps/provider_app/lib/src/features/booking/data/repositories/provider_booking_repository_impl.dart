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
  Future<List<dynamic>> listBookings({
    String? scope,
    String? cursor,
    int? take,
  }) async {
    final query = <String, String>{
      if (scope != null && scope.isNotEmpty) 'scope': scope,
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      if (take != null) 'take': '$take',
    };
    final path = Uri(
      path: '/partner/bookings',
      queryParameters: query.isEmpty ? null : query,
    ).toString();
    final result = await _api.getJson(path);
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
  Future<Map<String, dynamic>> bookingAlertPreferences() async {
    final result = await _api.getJson('/partner/booking-alert-preferences');
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> updateBookingAlertPreferences(
    Map<String, dynamic> preferences,
  ) async {
    final result = await _api.patchJson(
      '/partner/booking-alert-preferences',
      preferences,
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
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
  Future<Map<String, dynamic>> rejectBooking(
    String bookingId, {
    String? reasonCode,
    String? reasonDetail,
  }) async {
    final result = await _api.postJson('/partner/bookings/$bookingId/reject', {
      if (reasonCode != null) 'reasonCode': reasonCode,
      if (reasonDetail != null) 'reasonDetail': reasonDetail.trim(),
    });
    _socket.leaveBooking(bookingId);
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
    _socket.leaveBooking(bookingId);
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String reasonCode,
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  }) async {
    final result = await _api.postJson(
      '/partner/bookings/$bookingId/cancel',
      _bookingActionPayload(
        reasonCode: reasonCode,
        note: note,
        lat: lat,
        lng: lng,
        addressText: addressText,
      ),
    );
    _socket.leaveBooking(bookingId);
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
  String? reasonCode,
  String? note,
  double? lat,
  double? lng,
  String? addressText,
}) {
  final payload = <String, dynamic>{};
  if (reasonCode != null) {
    payload['reasonCode'] = reasonCode;
  }
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
