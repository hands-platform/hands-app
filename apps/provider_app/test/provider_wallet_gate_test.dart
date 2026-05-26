import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/main.dart';

void main() {
  test('blocks booking actions when wallet balance is negative', () {
    final summary = {
      'walletBalance': -120000,
      'walletBlocked': true,
      'walletBlockReason': 'Custom settlement message',
      'walletSettlementInstruction': 'Pay the HANDS fee to reopen requests.',
    };

    expect(providerWalletBalance(summary), -120000);
    expect(providerWalletBlockReason(summary), 'Custom settlement message');
    expect(
      providerWalletSettlementInstruction(summary),
      'Pay the HANDS fee to reopen requests.',
    );
  });

  test('falls back to computed wallet balance and default block message', () {
    final summary = {
      'pendingNetAmount': -50000,
      'availableNetAmount': -70000,
    };

    expect(providerWalletBalance(summary), -120000);
    expect(
      providerWalletBlockReason(summary),
      providerWalletBlockFallbackReasonKo,
    );
    expect(
      providerWalletSettlementInstruction(summary),
      providerWalletBlockHintKo,
    );
  });

  test('allows booking actions when unsettled wallet is non-negative', () {
    final summary = {
      'pendingNetAmount': -50000,
      'availableNetAmount': 70000,
    };

    expect(providerWalletBalance(summary), 20000);
    expect(providerWalletBlockReason(summary), isNull);
  });

  test('identifies cash bookings and explains settlement risk', () {
    final booking = {
      'payment': {
        'method': 'CASH',
        'amount': 450000,
      },
    };

    expect(providerBookingIsCash(booking), isTrue);
    expect(providerCashBookingRiskHint(booking), contains('450.000 VND'));
    expect(providerCashBookingRiskHint(booking), contains('wallet debt'));
  });

  test('formats provider booking service option labels consistently', () {
    final service = {
      'name': 'Foot Massage',
      'durationMin': 90,
      'basePrice': 700000,
    };

    expect(providerServiceOptionLabel(service), 'Foot Massage / 90 min');
    expect(
      providerServiceOptionPriceLabel(service),
      'Foot Massage / 90 min / 700.000 VND',
    );
    expect(
      providerServiceOptionPriceLabel(service, amount: 750000),
      'Foot Massage / 90 min / 750.000 VND',
    );
  });

  test('keeps provider booking service labels safe for missing values', () {
    expect(providerServiceOptionLabel(null), 'Massage booking');
    expect(providerServiceOptionPriceLabel(null), 'Massage booking');
    expect(providerServiceDurationLabel(null), '- min');
  });
}
