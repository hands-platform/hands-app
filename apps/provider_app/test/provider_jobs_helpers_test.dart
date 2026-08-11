import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/booking/presentation/provider_jobs_helpers.dart';
import 'package:provider_app/src/features/booking/presentation/provider_request_guidance_helpers.dart';

void main() {
  group('partner booking request time helpers', () {
    test(
        'prefers createdAt and treats scheduledStartAt only as a legacy fallback',
        () {
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

  test('uses the privacy-safe server flag for preferred requests', () {
    expect(
      providerIsPreferredRequest(
        {
          'isPreferredRequest': true,
          'preferredProvider': {'id': 'provider-1'}
        },
        'provider-user-1',
      ),
      isTrue,
    );
    expect(
      providerIsPreferredRequest(
        {
          'isPreferredRequest': false,
          'preferredProvider': {'userId': 'provider-user-1'},
        },
        'provider-user-1',
      ),
      isFalse,
    );
  });

  test('restores participation and explains direct-request closure', () {
    expect(
      providerHasJoinedRequest({'participationStatus': 'JOINED'}),
      isTrue,
    );
    expect(
      providerClosedBookingMessage({
        'status': 'CANCELLED',
        'cancellation': {'reasonCode': 'PREFERRED_PARTNER_DECLINED'},
      }),
      'Bạn đã từ chối yêu cầu trực tiếp. Đặt lịch đã đóng.',
    );
    expect(
      providerClosedBookingMessage({
        'status': 'EXPIRED',
        'closedReason': 'preferred_provider_no_response',
      }),
      'Yêu cầu trực tiếp đã hết hạn trước khi đối tác phản hồi.',
    );
  });
}
