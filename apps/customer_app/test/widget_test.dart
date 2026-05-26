import 'package:customer_app/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  testWidgets('renders customer booking entry screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: CustomerApp()));

    expect(find.text('Demo customer login'), findsOneWidget);
    expect(find.text('Providers'), findsWidgets);
  });

  test('customer service price prefers provider and booking prices', () {
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
  });
}
