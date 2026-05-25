import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/main.dart';

void main() {
  test('blocks booking actions when wallet balance is negative', () {
    final summary = {
      'walletBalance': -120000,
      'walletBlocked': true,
      'walletBlockReason': 'Custom settlement message',
    };

    expect(providerWalletBalance(summary), -120000);
    expect(providerWalletBlockReason(summary), 'Custom settlement message');
  });

  test('falls back to computed wallet balance and default block message', () {
    final summary = {
      'pendingNetAmount': -50000,
      'availableNetAmount': -70000,
    };

    expect(providerWalletBalance(summary), -120000);
    expect(
      providerWalletBlockReason(summary),
      providerWalletBlockFallbackReason,
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
}
