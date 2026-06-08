import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/booking/presentation/provider_jobs_helpers.dart';

void main() {
  group('partner booking request time helpers', () {
    test('prefers createdAt and treats scheduledStartAt only as a legacy fallback', () {
      expect(
        providerBookingRequestOpenedAt({
          'createdAt': '2026-06-01T09:55:00.000Z',
          'scheduledStartAt': '2026-06-01T12:00:00.000Z',
        }),
        '2026-06-01T09:55:00.000Z',
      );

      expect(
        providerBookingRequestOpenedAt({
          'scheduledStartAt': '2026-06-01T12:00:00.000Z',
        }),
        '2026-06-01T12:00:00.000Z',
      );
    });
  });
}
