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

    test('blocks cancel after a partner accepts', () {
      expect(
        canCustomerDirectlyCancelBooking({
          'status': 'OPEN_MATCHING',
          'participants': [
            {'status': 'ACCEPTED'},
          ],
        }),
        isFalse,
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

    test('allows joined marketplace participants for final customer choice', () {
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
}
