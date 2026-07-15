import 'package:customer_app/customer_app.dart';
import 'package:customer_app/src/features/booking/presentation/customer_bookings_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  testWidgets('renders customer booking entry screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: CustomerApp()));

    expect(find.text('Home'), findsWidgets);
    expect(find.text('Partners'), findsWidgets);
  });

  test('customer service price prefers partner and booking prices', () {
    final providerService = customerBookableService({
      'id': 'provider-service-1',
      'price': 600000,
      'active': true,
      'service': {
        'id': 'service-1',
        'name': 'Foot Massage',
        'durationMin': 60,
        'basePrice': 500000,
      },
    });

    expect(providerService['effectivePrice'], 600000);
    expect(customerServicePrice(providerService), 600000);
    expect(customerServicePrice({'basePrice': 500000}), 500000);
    expect(customerServicePrice({'bookingPrice': 450000, 'basePrice': 500000}),
        450000);
  });

  test('customer service option labels keep service name and duration together',
      () {
    final service = {
      'name': 'Foot Massage',
      'durationMin': 90,
      'effectivePrice': 700000,
    };

    expect(customerServiceOptionLabel(service), 'Foot Massage / 90 min');
    expect(customerServiceOptionPriceLabel(service),
        'Foot Massage / 90 min / 700.000 VND');
    expect(customerServiceOptionPriceLabel(service, amount: 750000),
        'Foot Massage / 90 min / 750.000 VND');
    expect(customerServiceName(service), 'Foot Massage');
    expect(customerServiceDurationLabel(service), '90 min');
    expect(customerServiceDurationLabel({'name': 'Foot Massage'}),
        'Duration not set');
  });

  test('customer service groups hide inactive and payout-missing options', () {
    final groups = customerServiceOptionGroups([
      {
        'id': 'provider-service-1',
        'price': 600000,
        'active': true,
        'service': {
          'id': 'service-foot-60',
          'serviceGroupKey': 'foot_massage',
          'name': 'Foot Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'active': true,
          'payoutRules': [
            {'customerPrice': 600000},
          ],
        },
      },
      {
        'id': 'provider-service-2',
        'price': 700000,
        'active': true,
        'service': {
          'id': 'service-foot-90',
          'serviceGroupKey': 'foot_massage',
          'name': 'Foot Massage',
          'durationMin': 90,
          'basePrice': 700000,
          'active': true,
          'payoutRules': [
            {'customerPrice': 800000},
          ],
        },
      },
      {
        'id': 'provider-service-3',
        'price': 500000,
        'active': false,
        'service': {
          'id': 'service-head-60',
          'serviceGroupKey': 'head_massage',
          'name': 'Head Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'active': true,
          'payoutRules': [
            {'customerPrice': 500000},
          ],
        },
      },
      {
        'id': 'provider-service-4',
        'price': 450000,
        'active': true,
        'service': {
          'id': 'service-swedish-60',
          'serviceGroupKey': 'swedish',
          'name': 'Swedish Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'priceStep': 100000,
          'active': true,
          'payoutRules': [
            {'customerPrice': 450000},
          ],
        },
      },
      {
        'id': 'provider-service-5',
        'price': 500000,
        'active': true,
        'service': {
          'id': 'service-no-rule-60',
          'serviceGroupKey': 'no_rule',
          'name': 'No Rule Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'priceStep': 100000,
          'active': true,
        },
      },
      {
        'id': 'provider-service-6',
        'price': 500000,
        'active': true,
        'service': {
          'id': 'service-inactive-rule-60',
          'serviceGroupKey': 'inactive_rule',
          'name': 'Inactive Rule Massage',
          'durationMin': 60,
          'basePrice': 500000,
          'priceStep': 100000,
          'active': true,
          'payoutRules': [
            {'customerPrice': 500000, 'active': false},
          ],
        },
      },
    ]);

    expect(groups, hasLength(1));
    expect(groups.single.key, 'foot_massage');
    expect(groups.single.options, hasLength(1));
    expect(groups.single.options.single['id'], 'service-foot-60');
  });

  test('customer service groups tolerate numeric strings from API responses',
      () {
    final groups = customerServiceOptionGroups([
      {
        'id': 'provider-service-90',
        'price': '700000',
        'active': true,
        'service': {
          'id': 'service-foot-90',
          'serviceGroupKey': 'foot_massage',
          'name': 'Foot Massage',
          'durationMin': '90',
          'basePrice': '700000',
          'priceStep': '100000',
          'active': true,
          'payoutRules': [
            {'customerPrice': '700000'},
          ],
        },
      },
      {
        'id': 'provider-service-60',
        'price': '600000',
        'active': true,
        'service': {
          'id': 'service-foot-60',
          'serviceGroupKey': 'foot_massage',
          'name': 'Foot Massage',
          'durationMin': '60',
          'basePrice': '500000',
          'priceStep': '100000',
          'active': true,
          'payoutRules': [
            {'customerPrice': '600000'},
          ],
        },
      },
    ]);

    expect(groups, hasLength(1));
    expect(groups.single.options.map((option) => option['id']), [
      'service-foot-60',
      'service-foot-90',
    ]);
    expect(customerServiceOptionLabel(groups.single.options.first),
        'Foot Massage / 60 min');
    expect(customerServicePrice(groups.single.options.last), 700000);
    expect(
        customerServiceGroupDurationSummary(groups.single), '60 min / 90 min');
    expect(customerServiceGroupPriceRangeLabel(groups.single),
        '600.000-700.000 VND');
    expect(customerServicePricePolicyLabel(groups.single.options.first),
        'Partner price');
    expect(customerServicePricePolicyLabel(groups.single.options.last),
        'Admin minimum');
  });

  test(
      'waiting customer action explains marketplace choices and confirmed bookings',
      () {
    final marketplaceAction = waitingCustomerAction(
      status: 'OPEN_MATCHING',
      fallbackCount: 1,
      hasChatRoom: false,
    );
    expect(marketplaceAction.title, 'Marketplace options are ready');
    expect(marketplaceAction.body, contains('switch to a marketplace partner'));

    final waitingAction = waitingCustomerAction(
      status: 'OPEN_MATCHING',
      fallbackCount: 0,
      hasChatRoom: false,
    );
    expect(waitingAction.title, 'Waiting for partner response');
    expect(waitingAction.body, contains('No action is needed yet'));

    final confirmedAction = waitingCustomerAction(
      status: 'MATCHED',
      fallbackCount: 0,
      hasChatRoom: true,
    );
    expect(confirmedAction.title, 'Booking confirmed');

    final completedAction = waitingCustomerAction(
      status: 'COMPLETED',
      fallbackCount: 0,
      hasChatRoom: false,
    );
    expect(completedAction.title, 'Service complete');
    expect(completedAction.body, contains('Review your service'));
  });

  test('hydrates the last booking-specific partner location snapshot', () {
    final location = bookingLatestProviderLocation({
      'snapshots': [
        {
          'lat': '10.7769',
          'lng': '106.7009',
          'recordedAt': '2026-07-14T15:00:00.000Z',
        },
      ],
    });

    expect(location, isNotNull);
    expect(
        deriveRealtimeLatLng(location)?.latitude, closeTo(10.7769, 0.000001));
    expect(
        deriveRealtimeLatLng(location)?.longitude, closeTo(106.7009, 0.000001));
    expect(bookingLatestProviderLocation({'snapshots': []}), isNull);
  });

  test('customer app hides service chat after booking is closed', () {
    final matchedBooking = {
      'status': 'MATCHED',
      'chatRoom': {'id': 'room-matched'},
    };
    final liveBooking = {
      'status': 'IN_SERVICE',
      'chatRoom': {'id': 'room-live'},
    };
    final completedBooking = {
      'status': 'COMPLETED',
      'chatRoom': {'id': 'room-archive'},
    };
    final noShowBooking = {
      'status': 'NO_SHOW',
      'chatRoom': {'id': 'room-no-show'},
    };

    expect(customerBookingNextAction(matchedBooking),
        'Partner confirmed. Chat is ready to coordinate service start.');
    expect(isCustomerAppChatVisible(liveBooking), isTrue);
    expect(isCustomerAppChatVisible(completedBooking), isFalse);
    expect(isCustomerAppChatVisible(noShowBooking), isFalse);
    expect(customerBookingNextAction(completedBooking),
        'Service complete. Review when ready.');
    expect(customerBookingNextAction(noShowBooking),
        contains('No-show recorded by HANDS operations'));
  });

  test('customer discovery falls back to Vietnam when selected pin is overseas',
      () {
    final fallback = defaultVietnamDiscoveryLocation();
    expect(fallback.isDemoLocation, isTrue);
    expect(fallback.addressText, contains('Vietnam'));

    final vietnam = discoveryLocationFromSelected(
      const SelectedCustomerLocation(
        latitude: 10.7769,
        longitude: 106.7009,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
      ),
    );
    expect(vietnam.isDemoLocation, isFalse);
    expect(vietnam.addressText, contains('Ho Chi Minh City'));

    final overseas = discoveryLocationFromSelected(
      const SelectedCustomerLocation(
        latitude: 37.5665,
        longitude: 126.9780,
        addressText: 'Overseas address outside Vietnam',
      ),
    );
    expect(overseas.isDemoLocation, isTrue);
    expect(overseas.latitude, demoCustomerLat);
    expect(overseas.longitude, demoCustomerLng);
  });

  test('customer direct cancel is only available before partner commitment',
      () {
    expect(
        canCustomerDirectlyCancelBooking({
          'status': 'OPEN_MATCHING',
          'participants': [],
        }),
        isTrue);

    expect(
        canCustomerDirectlyCancelBooking({
          'status': 'OPEN_MATCHING',
          'participants': [
            {'providerProfileId': 'partner-1', 'status': 'JOINED'},
          ],
        }),
        isTrue);

    expect(
        canCustomerDirectlyCancelBooking({
          'status': 'OPEN_MATCHING',
          'participants': [
            {'providerProfileId': 'partner-1', 'status': 'ACCEPTED'},
          ],
        }),
        isFalse);

    expect(
        canCustomerDirectlyCancelBooking({
          'status': 'MATCHED',
          'selectedProvider': {'id': 'partner-1'},
        }),
        isFalse);
    expect(customerCancellationNeedsOpsReview('MATCHED'), isTrue);
    expect(customerCancellationNeedsOpsReview('COMPLETED'), isFalse);
  });

  test('customer final choice only shows active marketplace participants', () {
    final participants = [
      {
        'providerProfileId': 'preferred-1',
        'status': 'ACCEPTED',
        'providerProfile': {'displayName': 'Preferred Partner'},
      },
      {
        'providerProfileId': 'preferred-1',
        'status': 'JOINED',
        'providerProfile': {'displayName': 'Preferred Waiting Partner'},
      },
      {
        'providerProfileId': 'joined-1',
        'status': 'JOINED',
        'providerProfile': {'displayName': 'Joined Partner'},
      },
      {
        'providerProfileId': 'accepted-1',
        'status': 'ACCEPTED',
        'providerProfile': {'displayName': 'Accepted Partner'},
      },
      {
        'providerProfileId': 'rejected-1',
        'status': 'REJECTED',
        'providerProfile': {'displayName': 'Rejected Partner'},
      },
      {
        'providerProfileId': 'expired-1',
        'status': 'EXPIRED',
        'providerProfile': {'displayName': 'Expired Partner'},
      },
      {
        'providerProfileId': 'selected-1',
        'status': 'SELECTED',
        'providerProfile': {'displayName': 'Already Selected Partner'},
      },
      {
        'providerProfileId': '',
        'status': 'JOINED',
      },
    ];

    final selectable = customerSelectableMarketplaceParticipants(
      participants,
      preferredProviderId: 'preferred-1',
    );

    expect(selectable.map((item) => item['providerProfileId']), [
      'preferred-1',
      'joined-1',
      'accepted-1',
    ]);
    expect(
      customerParticipantSelectableForFinalChoice({
        'providerProfileId': 'joined-1',
        'status': 'JOINED',
      }),
      isTrue,
    );
    expect(
      customerParticipantSelectableForFinalChoice(
        {
          'providerProfileId': 'preferred-1',
          'status': 'JOINED',
        },
        preferredProviderId: 'preferred-1',
      ),
      isFalse,
    );
    expect(
      customerParticipantSelectableForFinalChoice(
        {
          'providerProfileId': 'preferred-1',
          'status': 'ACCEPTED',
        },
        preferredProviderId: 'preferred-1',
      ),
      isTrue,
    );
    expect(
      customerParticipantSelectableForFinalChoice({
        'providerProfileId': 'expired-1',
        'status': 'EXPIRED',
      }),
      isFalse,
    );
  });

  test('booking display name ignores inactive participant evidence', () {
    final booking = {
      'status': 'OPEN_MATCHING',
      'participants': [
        {
          'providerProfileId': 'rejected-1',
          'status': 'REJECTED',
          'providerProfile': {'displayName': 'Rejected Partner'},
        },
        {
          'providerProfileId': 'joined-1',
          'status': 'JOINED',
          'providerProfile': {'displayName': 'Joined Partner'},
        },
      ],
    };

    expect(providerDisplayName(booking), 'Joined Partner');
    expect(
      providerDisplayName({
        'status': 'OPEN_MATCHING',
        'participants': [
          {
            'providerProfileId': 'expired-1',
            'status': 'EXPIRED',
            'providerProfile': {'displayName': 'Expired Partner'},
          },
        ],
      }),
      'Booking request',
    );
  });

  test('customer booking target sort moves push booking first', () {
    final bookings = sortedCustomerBookingsForTarget([
      {
        'id': 'booking-newer',
        'createdAt': '2026-06-11T00:00:00.000Z',
        'payment': {'id': 'payment-newer'},
      },
      {
        'id': 'booking-target',
        'createdAt': '2026-06-10T00:00:00.000Z',
        'payment': {'id': 'payment-target'},
      },
    ], bookingId: 'booking-target');

    expect(bookings.first['id'], 'booking-target');
  });

  test('customer booking target sort can match push payment id', () {
    final bookings = sortedCustomerBookingsForTarget([
      {
        'id': 'booking-newer',
        'createdAt': '2026-06-11T00:00:00.000Z',
        'payment': {'id': 'payment-newer'},
      },
      {
        'id': 'booking-payment-target',
        'createdAt': '2026-06-10T00:00:00.000Z',
        'payment': {'id': 'payment-target'},
      },
    ], paymentId: 'payment-target');

    expect(bookings.first['id'], 'booking-payment-target');
  });
}
