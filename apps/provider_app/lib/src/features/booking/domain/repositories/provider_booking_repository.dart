import '../services/provider_booking_detail_view_tracker.dart';

abstract class ProviderBookingRepository {
  Future<List<dynamic>> openBookings();

  Future<List<dynamic>> listBookings();

  Future<List<dynamic>> requestBookings();

  Future<Map<String, dynamic>> joinBooking(String bookingId);

  Future<Map<String, dynamic>> acceptBooking(String bookingId);

  Future<Map<String, dynamic>> rejectBooking(String bookingId);

  Future<Map<String, dynamic>> startBooking(String bookingId);

  Future<Map<String, dynamic>> completeBooking(
    String bookingId, {
    double? lat,
    double? lng,
    String? addressText,
  });

  Future<Map<String, dynamic>> cancelBooking(
    String bookingId, {
    required String note,
    double? lat,
    double? lng,
    String? addressText,
  });

  Future<Map<String, dynamic>> recordDetailViewTelemetry(
    String bookingId, {
    required ProviderBookingDetailViewTelemetryEvent eventType,
    Duration? duration,
  });
}
