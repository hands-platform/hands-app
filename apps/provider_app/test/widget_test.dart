import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider_app/main.dart';
import 'package:provider_app/src/core/api_client.dart';

void main() {
  testWidgets('renders partner requests screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ProviderApp()));

    expect(find.text('Booking requests'), findsOneWidget);
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
        'displayMessage': providerWalletBlockFallbackReasonClean,
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

  testWidgets('locks marketplace join action when wallet is negative',
      (tester) async {
    var joinTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: OpenBookingCard(
              booking: {
                'id': 'booking-marketplace-wallet-lock',
                'status': 'OPEN_MATCHING',
                'createdAt': '2026-06-04T00:00:00.000Z',
                'updatedAt': '2026-06-04T00:00:00.000Z',
                'preferredProvider': {'displayName': 'Linh Wellness'},
                'participants': <dynamic>[],
                'payment': {
                  'method': 'CASH',
                  'amount': 450000,
                },
                'address': {
                  'name': 'Demo Customer',
                  'phone': '0865907184',
                  'line1': 'District 1, Ho Chi Minh City',
                },
                'services': [
                  {
                    'service': {
                      'name': 'Foot Massage',
                      'durationMin': 60,
                      'basePrice': 450000,
                    },
                  },
                ],
              },
              isPreferredRequest: false,
              joined: false,
              loading: false,
              walletBlocked: true,
              onJoin: () => joinTapped = true,
              onAccept: () {},
              onReject: () {},
              onStart: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Marketplace visible, join locked'), findsOneWidget);
    expect(find.text(providerWalletBlockFallbackReasonClean), findsOneWidget);
    expect(
        find.text(providerMarketplaceJoinBlockedButtonLabel), findsOneWidget);

    await tester.ensureVisible(
      find.text(providerMarketplaceJoinBlockedButtonLabel),
    );
    await tester.tap(find.text(providerMarketplaceJoinBlockedButtonLabel));
    await tester.pump();

    expect(joinTapped, isFalse);
  });
}
