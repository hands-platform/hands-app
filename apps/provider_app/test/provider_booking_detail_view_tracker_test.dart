import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/booking/domain/services/provider_booking_detail_view_tracker.dart';

void main() {
  test('records heartbeat and close duration for visible booking detail cards',
      () async {
    var now = DateTime.utc(2026, 7, 2, 1);
    final records = <Map<String, dynamic>>[];
    final tracker = ProviderBookingDetailViewTracker(
      now: () => now,
      record: ({
        required String bookingId,
        required ProviderBookingDetailViewTelemetryEvent eventType,
        Duration? duration,
      }) async {
        records.add({
          'bookingId': bookingId,
          'eventType': eventType,
          'durationSeconds': duration?.inSeconds,
        });
      },
    );

    await tracker.syncVisibleBookingIds(['booking-1', 'booking-2']);
    now = now.add(const Duration(seconds: 61));
    await tracker.recordHeartbeat();

    expect(records, [
      {
        'bookingId': 'booking-1',
        'eventType': ProviderBookingDetailViewTelemetryEvent.heartbeat,
        'durationSeconds': 61,
      },
      {
        'bookingId': 'booking-2',
        'eventType': ProviderBookingDetailViewTelemetryEvent.heartbeat,
        'durationSeconds': 61,
      },
    ]);

    now = now.add(const Duration(seconds: 34));
    await tracker.syncVisibleBookingIds(['booking-2']);

    expect(records.last, {
      'bookingId': 'booking-1',
      'eventType': ProviderBookingDetailViewTelemetryEvent.closed,
      'durationSeconds': 95,
    });

    now = now.add(const Duration(seconds: 5));
    await tracker.closeAll();

    expect(records.last, {
      'bookingId': 'booking-2',
      'eventType': ProviderBookingDetailViewTelemetryEvent.closed,
      'durationSeconds': 100,
    });
  });
}
