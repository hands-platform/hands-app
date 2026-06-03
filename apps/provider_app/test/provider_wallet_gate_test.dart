import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/main.dart';

void main() {
  test('holds marketplace participation when wallet balance is negative', () {
    final summary = {
      'walletBalance': -120000,
      'walletBlocked': true,
      'walletBlockReason': 'Custom settlement message',
      'walletSettlementInstruction': 'Pay the HANDS fee to join bookings.',
      'walletSettlementReference': 'HANDS-WALLET-TEST1234',
    };

    expect(providerWalletBalance(summary), -120000);
    expect(providerWalletBlockReason(summary), 'Custom settlement message');
    expect(providerWalletMarketplaceJoinBlocked(summary), isTrue);
    expect(providerWalletStatusLabel(summary), 'Settlement required');
    expect(
      providerWalletSettlementInstruction(summary),
      'Pay the HANDS fee to join bookings.',
    );
    expect(
      providerWalletSettlementSteps(summary),
      contains(
          'Use reference HANDS-WALLET-TEST1234 when sending the deposit or requesting admin offset.'),
    );
    expect(providerWalletSettlementReference(summary), 'HANDS-WALLET-TEST1234');
  });

  test('builds reusable wallet settlement view labels', () {
    final summary = {
      'walletBalance': '-120000',
      'walletDebtAmount': '120000',
      'walletBlocked': true,
      'walletBlockReason': 'Custom settlement message',
      'walletSettlementReference': 'HANDS-WALLET-TEST1234',
      'currency': 'VND',
    };

    final view = ProviderWalletSettlementView.fromSummary(summary);

    expect(view.blocked, isTrue);
    expect(view.balanceLabel, startsWith('-'));
    expect(view.balanceLabel, contains('120.000 VND'));
    expect(view.amountLabel, '120.000 VND');
    expect(view.reasonLabel, 'Custom settlement message');
    expect(view.reference, 'HANDS-WALLET-TEST1234');
    expect(
      view.steps,
      contains(
          'Marketplace participation and payout release unlock when the wallet is no longer negative.'),
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
      providerWalletBlockFallbackReasonClean,
    );
    expect(
      providerWalletSettlementInstruction(summary),
      providerWalletBlockHintClean,
    );
    expect(providerWalletSettlementReference(summary), isNull);
  });

  test('uses server settlement steps when provided', () {
    final summary = {
      'walletBalance': -60000,
      'walletBlocked': true,
      'walletSettlementSteps': [
        'Settle 60.000 VND for unpaid HANDS fees.',
        'Use reference HANDS-WALLET-ABC12345 when reporting the deposit.',
        'Refresh wallet status after admin confirms the deposit.',
      ],
    };

    expect(
      providerWalletSettlementSteps(summary),
      contains(
          'Use reference HANDS-WALLET-ABC12345 when reporting the deposit.'),
    );
  });

  test('extracts wallet settlement details from server API block response', () {
    final exception = ApiException(400, {
      'message': {
        'code': 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
        'message':
            'Outstanding HANDS fee settlement must be completed before marketplace participation or payout release.',
        'displayMessage': providerWalletBlockFallbackReasonClean,
        'walletBlocked': true,
        'marketplaceVisibilityBlocked': false,
        'marketplaceJoinBlocked': true,
        'directFirstPickBlocked': false,
        'alreadyMatchedServiceBlocked': false,
        'payoutReleaseBlocked': true,
        'walletBalance': -80000,
        'walletDebtAmount': 80000,
        'walletSettlementRequired': true,
        'walletSettlementReference': 'HANDS-WALLET-BLOCKED',
        'walletSettlementInstruction':
            'Marketplace requests stay visible for review, but participation is blocked until settlement.',
      },
      'error': 'Bad Request',
      'statusCode': 400,
    });

    final summary = providerApiExceptionWalletSummary(exception);
    final walletSummary = summary!;

    expect(summary, isNotNull);
    expect(walletSummary['walletBlocked'], isTrue);
    expect(walletSummary['marketplaceJoinBlocked'], isTrue);
    expect(walletSummary['directFirstPickBlocked'], isFalse);
    expect(walletSummary['alreadyMatchedServiceBlocked'], isFalse);
    expect(providerWalletMarketplaceJoinBlocked(walletSummary), isTrue);
    expect(walletSummary['walletDebtAmount'], 80000);
    expect(walletSummary['displayMessage'],
        providerWalletBlockFallbackReasonClean);
    expect(
      providerWalletBlockReason(walletSummary),
      providerWalletBlockFallbackReasonClean,
    );
    expect(providerAppErrorMessage(exception),
        providerWalletBlockFallbackReasonClean);
    expect(
      providerWalletSettlementInstruction(walletSummary),
      contains('participation is blocked'),
    );
    expect(providerWalletSettlementReference(walletSummary),
        'HANDS-WALLET-BLOCKED');
  });

  test('clears marketplace gate when unsettled wallet is non-negative', () {
    final summary = {
      'pendingNetAmount': -50000,
      'availableNetAmount': 70000,
    };

    expect(providerWalletBalance(summary), 20000);
    expect(providerWalletBlockReason(summary), isNull);
    expect(providerWalletMarketplaceJoinBlocked(summary), isFalse);
    expect(providerWalletStatusLabel(summary), 'Available for payout review');
    expect(providerWalletSettlementSteps(summary),
        contains('Cash booking fees are settled.'));
  });

  test('prefers explicit marketplace join policy from API summary', () {
    final explicitOpen = <String, dynamic>{
      'walletBalance': -120000,
      'walletBlocked': true,
      'marketplaceJoinBlocked': false,
      'walletBlockReason': 'Wallet needs settlement, but policy allows join.',
    };
    final explicitBlocked = <String, dynamic>{
      'walletBalance': 20000,
      'walletBlocked': false,
      'marketplaceJoinBlocked': true,
      'walletBlockDisplayMessage': providerWalletBlockFallbackReasonClean,
    };

    expect(providerWalletMarketplaceJoinBlocked(explicitOpen), isFalse);
    expect(providerWalletBlockReason(explicitOpen), isNotNull);
    expect(providerWalletMarketplaceJoinBlocked(explicitBlocked), isTrue);
    expect(
      providerWalletBlockReason(explicitBlocked),
      providerWalletBlockFallbackReasonClean,
    );
  });

  test('identifies cash bookings and explains settlement handling', () {
    final booking = {
      'payment': {
        'method': 'CASH',
        'amount': 450000,
      },
    };

    expect(providerBookingIsCash(booking), isTrue);
    expect(providerCashBookingSettlementHint(booking), contains('450.000 VND'));
    expect(providerCashBookingSettlementHint(booking), contains('wallet debt'));
  });

  test('explains direct requests as first partner decisions', () {
    final guidance = providerRequestGuidance(
      booking: {'status': 'OPEN_MATCHING'},
      isPreferredRequest: true,
      joined: false,
      walletBlocked: false,
    );

    expect(guidance.modeLabel, 'Direct request');
    expect(guidance.roleLabel, 'First partner');
    expect(guidance.decisionLabel, 'Reply now');
    expect(guidance.nextAction, contains('Reply now'));
    expect(guidance.detailMessage, contains('10 min'));
    expect(guidance.detailMessage, contains('10 km'));
    expect(guidance.infoMessage, contains('Accept or decline'));
  });

  test('uses booking matching policy snapshot in request guidance', () {
    final booking = {
      'status': 'OPEN_MATCHING',
      'metadata': {
        'matchingPolicy': {
          'providerResponseWindowMinutes': 7,
          'backupProviderRadiusMeters': 5000,
        },
      },
    };

    final guidance = providerRequestGuidance(
      booking: booking,
      isPreferredRequest: true,
      joined: false,
      walletBlocked: false,
    );

    expect(providerMatchingWindowTagLabel(booking), '7 min first-pick');
    expect(providerBackupRadiusTagLabel(booking), '5 km marketplace');
    expect(guidance.detailMessage, contains('7 min'));
    expect(guidance.detailMessage, contains('5 km'));
  });

  test('keeps direct request guidance when wallet is negative', () {
    final guidance = providerRequestGuidance(
      booking: {'status': 'OPEN_MATCHING'},
      isPreferredRequest: true,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Direct request');
    expect(guidance.decisionLabel, 'Reply now');
    expect(guidance.nextAction, contains('Reply now'));
    expect(guidance.infoMessage, contains('Accept or decline'));
  });

  test('blocks marketplace join guidance when wallet is negative', () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'OPEN_MATCHING',
        'preferredProvider': {'displayName': 'Linh Wellness'},
      },
      isPreferredRequest: false,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Marketplace opportunity');
    expect(guidance.decisionLabel, 'Settlement required');
    expect(guidance.contextMessage, contains('unpaid HANDS fees'));
    expect(
      providerMarketplaceJoinButtonLabel(
        walletBlocksMarketplaceJoin: true,
        hasPreferredProvider: true,
      ),
      providerMarketplaceJoinBlockedButtonLabel,
    );
    expect(
      providerWalletBlockFallbackReasonClean,
      '수수료를 입금하지 않아 예약에 참여 할수 없습니다.',
    );
    expect(guidance.detailMessage, providerWalletBlockFallbackReasonClean);
    expect(providerActionBlockCopy(guidance.detailMessage)?.title,
        'Fee settlement required');
    expect(
      providerActionBlockCopy('수수료를 입금하지 않아 예약에 참여 할수 없습니다.')?.detail,
      providerWalletBlockFallbackReasonClean,
    );
  });

  test('wallet gate only blocks joining marketplace before participation', () {
    expect(
      providerWalletBlocksMarketplaceJoin(
        walletBlocked: true,
        isPreferredRequest: false,
        isMatched: false,
        joined: false,
      ),
      isTrue,
    );
    expect(
      providerWalletBlocksMarketplaceJoin(
        walletBlocked: true,
        isPreferredRequest: true,
        isMatched: false,
        joined: false,
      ),
      isFalse,
      reason: 'Direct first-pick accept/reject is not marketplace join.',
    );
    expect(
      providerWalletBlocksMarketplaceJoin(
        walletBlocked: true,
        isPreferredRequest: false,
        isMatched: false,
        joined: true,
      ),
      isFalse,
      reason: 'Already joined participants stay visible for customer choice.',
    );
    expect(
      providerWalletBlocksMarketplaceJoin(
        walletBlocked: true,
        isPreferredRequest: false,
        isMatched: true,
        joined: false,
      ),
      isFalse,
      reason: 'Already matched bookings are handled by service workflow.',
    );
    expect(
      providerMarketplaceJoinButtonLabel(
        walletBlocksMarketplaceJoin: false,
        hasPreferredProvider: true,
      ),
      'Offer marketplace support',
    );
  });

  test('keeps marketplace booking visible but explains join is blocked', () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'OPEN_MATCHING',
        'preferredProvider': {'displayName': 'Sen ne'},
      },
      isPreferredRequest: false,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Marketplace opportunity');
    expect(guidance.nextAction, contains('Settle unpaid HANDS fees'));
    expect(guidance.contextMessage, contains('visible'));
    expect(guidance.contextMessage, contains('before you can join'));
    expect(guidance.detailMessage, '수수료를 입금하지 않아 예약에 참여 할수 없습니다.');
  });

  test('explains marketplace opportunities after preferred partner exists', () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'OPEN_MATCHING',
        'preferredProvider': {'displayName': 'Linh Wellness'},
      },
      isPreferredRequest: false,
      joined: false,
      walletBlocked: false,
    );

    expect(guidance.modeLabel, 'Marketplace opportunity');
    expect(guidance.roleLabel, 'Marketplace option');
    expect(guidance.decisionLabel, 'Can join');
    expect(guidance.detailMessage, contains('Linh Wellness'));
    expect(guidance.infoMessage, contains('10 km'));
  });

  test('explains chat-ready accepted requests', () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'MATCHED',
        'chatRoom': {'id': 'room-1'},
      },
      isPreferredRequest: true,
      joined: true,
      walletBlocked: false,
    );

    expect(guidance.decisionLabel, 'Chat live');
    expect(guidance.nextAction, contains('Continue'));
    expect(guidance.infoMessage, 'Service started. Chat is ready.');
  });

  test('partner app hides service chat after booking is closed', () {
    final liveBooking = {
      'status': 'IN_SERVICE',
      'chatRoom': {'id': 'room-live'},
    };
    final completedBooking = {
      'status': 'COMPLETED',
      'chatRoom': {'id': 'room-archive'},
    };

    expect(isProviderAppChatVisible(liveBooking), isTrue);
    expect(isProviderAppChatVisible(completedBooking), isFalse);
    expect(partnerJobNextAction(completedBooking),
        'Service complete. Check earnings and payout status.');
  });

  test('formats partner booking service option labels consistently', () {
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

  test('keeps partner booking service labels safe for missing values', () {
    expect(providerServiceOptionLabel(null), 'Massage booking');
    expect(providerServiceOptionPriceLabel(null), 'Massage booking');
    expect(providerServiceDurationLabel(null), '- min');
  });
}
