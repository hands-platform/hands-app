import 'package:customer_app/src/features/booking/presentation/customer_booking_ui_helpers.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('customer direct cancellation policy', () {
    test('allows cancel only before partner commitment', () {
      expect(
        canCustomerDirectlyCancelBooking({'status': 'OPEN_MATCHING'}),
        isTrue,
      );
    });

    test(
        'keeps cancel available while a marketplace partner awaits customer selection',
        () {
      expect(
        canCustomerDirectlyCancelBooking({
          'status': 'OPEN_MATCHING',
          'participants': [
            {'status': 'ACCEPTED'},
          ],
        }),
        isTrue,
      );
    });

    test('blocks cancel after final partner selection', () {
      expect(
        canCustomerDirectlyCancelBooking({
          'status': 'MATCHED',
          'selectedProvider': {'id': 'partner-1'},
        }),
        isFalse,
      );
      expect(customerCancellationNeedsOpsReview('MATCHED'), isTrue);
      expect(
        canCustomerDirectlyCancelBooking({
          'status': 'IN_SERVICE',
          'selectedProviderId': 'partner-1',
        }),
        isFalse,
      );
    });
  });

  group('customer final partner choice policy', () {
    test('excludes the preferred first-pick join row until accepted', () {
      final participants = [
        {
          'providerProfileId': 'preferred-1',
          'status': 'JOINED',
        },
        {
          'providerProfileId': 'marketplace-1',
          'status': 'JOINED',
        },
      ];

      final selectable = customerSelectableMarketplaceParticipants(
        participants,
        preferredProviderId: 'preferred-1',
      );

      expect(selectable, hasLength(1));
      expect(selectable.single['providerProfileId'], 'marketplace-1');
    });

    test('allows accepted participants for final customer choice', () {
      expect(
        customerParticipantSelectableForFinalChoice({
          'providerProfileId': 'partner-1',
          'status': 'ACCEPTED',
        }),
        isTrue,
      );
    });

    test('allows joined marketplace participants for final customer choice',
        () {
      expect(
        customerParticipantSelectableForFinalChoice(
          {
            'providerProfileId': 'marketplace-1',
            'status': 'JOINED',
          },
          preferredProviderId: 'preferred-1',
        ),
        isTrue,
      );
    });

    test('reads partner id from nested partner profile rows', () {
      expect(
        customerParticipantSelectableForFinalChoice(
          {
            'providerProfile': {'id': 'marketplace-1'},
            'status': 'JOINED',
          },
          preferredProviderId: 'preferred-1',
        ),
        isTrue,
      );
    });

    test('deduplicates final choices and keeps accepted participant state', () {
      final participants = [
        {
          'providerProfileId': 'marketplace-1',
          'status': 'JOINED',
        },
        {
          'providerProfileId': 'marketplace-1',
          'status': 'ACCEPTED',
        },
        {
          'providerProfileId': 'marketplace-2',
          'status': 'JOINED',
        },
      ];

      final selectable = customerSelectableMarketplaceParticipants(
        participants,
        preferredProviderId: 'preferred-1',
      );

      expect(selectable, hasLength(2));
      expect(selectable.first['providerProfileId'], 'marketplace-1');
      expect(selectable.first['status'], 'ACCEPTED');
      expect(selectable.last['providerProfileId'], 'marketplace-2');
    });

    test('rejects blocked or incomplete participant rows', () {
      expect(
        customerParticipantSelectableForFinalChoice({
          'providerProfileId': 'partner-1',
          'status': 'REJECTED',
        }),
        isFalse,
      );
      expect(
        customerParticipantSelectableForFinalChoice({'status': 'JOINED'}),
        isFalse,
      );
    });
  });

  group('customer chat visibility policy', () {
    test('shows chat for active matched bookings only', () {
      expect(
        isCustomerAppChatVisible({
          'status': 'MATCHED',
          'chatRoom': {'id': 'room-1'},
        }),
        isTrue,
      );
      expect(
        isCustomerAppChatVisible({
          'status': 'COMPLETED',
          'chatRoom': {'id': 'room-1'},
        }),
        isFalse,
      );
    });
  });

  group('customer booking list presentation', () {
    final bookings = <Map<String, dynamic>>[
      {'id': 'active-1', 'status': 'OPEN_MATCHING'},
      {'id': 'active-2', 'status': 'IN_SERVICE'},
      {'id': 'history-1', 'status': 'COMPLETED'},
      {'id': 'history-2', 'status': 'CANCELLED'},
    ];

    test('separates active work from booking history', () {
      expect(
        customerBookingsForListTab(
          bookings,
          CustomerBookingListTab.active,
        ).map((booking) => booking['id']),
        ['active-1', 'active-2'],
      );
      expect(
        customerBookingsForListTab(
          bookings,
          CustomerBookingListTab.history,
        ).map((booking) => booking['id']),
        ['history-1', 'history-2'],
      );
    });

    test('filters booking history by customer outcome', () {
      final history = [
        {'id': 'completed', 'status': 'COMPLETED'},
        {'id': 'cancelled', 'status': 'CANCELLED'},
        {'id': 'expired', 'status': 'EXPIRED'},
        {'id': 'no-show', 'status': 'NO_SHOW'},
        {'id': 'refunded', 'status': 'REFUNDED'},
      ];

      expect(
        customerBookingsForHistoryFilter(
          history,
          CustomerBookingHistoryFilter.completed,
        ).map((booking) => booking['id']),
        ['completed'],
      );
      expect(
        customerBookingsForHistoryFilter(
          history,
          CustomerBookingHistoryFilter.notCompleted,
        ).map((booking) => booking['id']),
        ['cancelled', 'expired', 'no-show'],
      );
      expect(
        customerBookingsForHistoryFilter(
          history,
          CustomerBookingHistoryFilter.refunded,
        ).map((booking) => booking['id']),
        ['refunded'],
      );
    });

    test('uses customer-facing status and payment labels', () {
      expect(customerBookingStatusLabel('OPEN_MATCHING'), 'Finding a partner');
      expect(customerBookingStatusLabel('PROVIDER_ON_THE_WAY'), 'On the way');
      expect(customerBookingStatusLabel('REFUNDED'), 'Refunded');
      expect(
        customerBookingPaymentLabel({
          'payment': {'method': 'MOMO'},
        }),
        'MoMo',
      );
    });

    test('formats same-day and historical booking dates', () {
      final now = DateTime(2026, 7, 28, 12);
      expect(
        formatCustomerBookingListMoment(
          '2026-07-28T09:15:00',
          now: now,
        ),
        'Today, 9:15 AM',
      );
      expect(
        formatCustomerBookingListMoment(
          '2026-07-22T18:05:00',
          now: now,
        ),
        'Jul 22, 6:05 PM',
      );
    });

    test('does not expose marketplace policy in the next action', () {
      expect(
        customerBookingNextAction({'status': 'OPEN_MATCHING'}),
        'Waiting for confirmation. We will notify you when a partner accepts.',
      );
    });

    test('keeps expired booking copy customer-facing', () {
      expect(waitingStepLabel('EXPIRED'), 'Not confirmed');
      expect(
        waitingCustomerAction(
          status: 'EXPIRED',
          fallbackCount: 0,
          hasChatRoom: false,
        ).body,
        'No partner confirmed this request in time.',
      );
    });

    test('explains preferred partner rejection and no-response closure', () {
      expect(
        waitingCustomerAction(
          status: 'CANCELLED',
          fallbackCount: 0,
          hasChatRoom: false,
          cancellationReasonCode: 'PREFERRED_PARTNER_DECLINED',
        ).title,
        'Partner unavailable',
      );
      expect(
        waitingCustomerAction(
          status: 'EXPIRED',
          fallbackCount: 0,
          hasChatRoom: false,
          cancellationReasonCode: 'PARTNER_RESPONSE_EXPIRED',
        ).title,
        'Partner did not respond',
      );
    });

    test('formats the server deadline as MM:SS', () {
      final now = DateTime.utc(2026, 8, 3, 10);
      expect(
        formatRemainingTime(
          now.add(const Duration(minutes: 9, seconds: 7)).toIso8601String(),
          now: now,
        ),
        '09:07',
      );
      expect(
        formatRemainingTime(
          now.subtract(const Duration(seconds: 1)).toIso8601String(),
          now: now,
        ),
        '00:00',
      );
    });
  });

  group('booking service address pin', () {
    test('prefers immutable address snapshot over legacy booking coordinates',
        () {
      final point = deriveBookingLatLng({
        'lat': 13.7563,
        'lng': 100.5018,
        'addressSnapshot': {
          'lat': 10.7769,
          'lng': 106.7009,
        },
      });

      expect(point?.latitude, closeTo(10.7769, 0.000001));
      expect(point?.longitude, closeTo(106.7009, 0.000001));
    });
  });

  group('customer marketplace policy copy', () {
    test('prefers marketplace radius over legacy radius', () {
      final policy = {
        'marketplaceRadiusMeters': 5000,
        'backupProviderRadiusMeters': 10000,
      };

      expect(marketplaceRadiusLabel(policy), 'within 5 km');
    });

    test('describes immediate marketplace participation with current wording',
        () {
      final policy = {
        'backupProviderRadiusMeters': 10000,
        'backupOpenMode': 'IMMEDIATE_WITHIN_WINDOW',
      };

      expect(marketplaceRadiusLabel(policy), 'within 10 km');
      expect(marketplaceOpensImmediately(policy), isTrue);
      expect(
        marketplaceWindowDescription(policy),
        'marketplace partners within 10 km can also join during this window',
      );
      expect(
        marketplaceStandbyDescription(policy),
        'Marketplace partners within 10 km can appear as soon as they offer support.',
      );
      expect(marketplaceParticipationLabel(policy), 'marketplace options open');
    });
  });

  group('Partner review summary', () {
    test('prefers aggregate rating and review count from the public API', () {
      final provider = {
        'ratingAvg': 4.7,
        'reviewCount': 29,
        'reviews': [
          {'rating': 5},
          {'rating': 3},
        ],
      };

      expect(providerAverageRating(provider), 4.7);
      expect(providerReviewCount(provider), 29);
    });

    test('falls back to loaded reviews when aggregate values are missing', () {
      final provider = {
        'reviews': [
          {'rating': 4},
          {'rating': 5},
          {'rating': 3},
        ],
      };

      expect(providerAverageRating(provider), 4);
      expect(providerReviewCount(provider), 3);
    });
  });
}
