import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider_app/main.dart';
import 'package:provider_app/src/core/api_client.dart';

void main() {
  testWidgets('renders partner requests screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProviderApp()));

    expect(find.text('Direct booking requests'), findsOneWidget);
    expect(find.text('Demo partner login'), findsOneWidget);
  });

  test('partner service option labels tolerate numeric strings', () {
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

  test('partner wallet settlement labels tolerate numeric strings', () {
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

  test('partner booking gate errors are converted to readable action blocks',
      () {
    final walletMessage = providerAppErrorMessage(ApiException(400, {
      'message': {
        'code': 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
        'message': 'Partner has unpaid HANDS cash-service fees',
      },
      'error': 'Bad Request',
      'statusCode': 400,
    }));

    expect(walletMessage, providerWalletBlockFallbackReasonClean);
    expect(providerActionBlockCopy(walletMessage)?.title,
        'Fee settlement required');

    final kycMessage = providerAppErrorMessage(ApiException(403, {
      'message': 'Partner KYC must be approved before receiving paid work.',
      'error': 'Forbidden',
      'statusCode': 403,
    }));

    expect(providerActionBlockCopy(kycMessage)?.title, 'KYC approval required');

    final bankMessage = providerAppErrorMessage(ApiException(403, {
      'message':
          'Partner bank account must be approved before receiving paid work.',
    }));

    expect(providerActionBlockCopy(bankMessage)?.title,
        'Bank account approval required');
  });
}
