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
    ]);

    expect(groups, hasLength(1));
    expect(groups.single.key, 'foot_massage');
    expect(groups.single.options, hasLength(1));
    expect(groups.single.options.single['id'], 'service-foot-60');
  });
}
