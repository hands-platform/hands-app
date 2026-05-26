import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider_app/main.dart';

void main() {
  testWidgets('renders provider requests screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProviderApp()));

    expect(find.text('Direct booking requests'), findsOneWidget);
    expect(find.text('Demo provider login'), findsOneWidget);
  });

  test('provider service option labels tolerate numeric strings', () {
    final service = {
      'name': 'Foot Massage',
      'durationMin': '90',
      'bookingPrice': '700000',
      'basePrice': '500000',
    };

    expect(providerServiceOptionLabel(service), 'Foot Massage / 90 min');
    expect(providerServiceDurationLabel(service), '90 min');
    expect(providerServiceOptionPriceLabel(service),
        'Foot Massage / 90 min / 700.000 VND');
  });

  test('provider wallet settlement labels tolerate numeric strings', () {
    final summary = {
      'walletBalance': '-120000',
      'walletDebtAmount': '120000',
      'currency': 'VND',
      'walletBlocked': true,
      'walletBlockReason': 'Unpaid HANDS fee',
    };

    expect(providerWalletBalance(summary), -120000);
    expect(providerWalletStatusLabel(summary), 'Settlement required');
    expect(providerWalletSettlementSteps(summary).first,
        'Settle 120.000 VND for unpaid HANDS fees.');
  });
}
