import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/provider_app.dart';

void main() {
  test('separates open requests from confirmed active jobs', () {
    final bookings = [
      {'id': 'open', 'status': 'OPEN_MATCHING'},
      {'id': 'matched', 'status': 'MATCHED'},
      {'id': 'travelling', 'status': 'PROVIDER_ON_THE_WAY'},
      {'id': 'arrived', 'status': 'ARRIVED'},
      {'id': 'service', 'status': 'IN_SERVICE'},
      {'id': 'complete', 'status': 'COMPLETED'},
      {'id': 'cancelled', 'status': 'CANCELLED'},
    ];

    expect(providerOpenRequestCount(bookings), 1);
    expect(providerActiveJobCount(bookings), 4);
    expect(isProviderActiveBooking(bookings.first), isFalse);
  });

  test('does not infer marketplace gate from negative wallet balance', () {
    final summary = {
      'walletBalance': -120000,
      'walletBlocked': true,
      'walletBlockReason': 'Custom settlement message',
      'walletSettlementInstruction':
          'Pay the HANDS fee to participate in bookings.',
      'walletSettlementReference': 'HANDS-WALLET-TEST1234',
    };

    expect(providerWalletBalance(summary), -120000);
    expect(providerWalletBlockReason(summary), 'Custom settlement message');
    expect(providerWalletMarketplaceJoinBlocked(summary), isFalse);
    expect(providerWalletStatusLabel(summary), 'Cần thanh toán phí');
    expect(
      providerWalletSettlementInstruction(summary),
      'Pay the HANDS fee to participate in bookings.',
    );
    expect(
      providerWalletSettlementSteps(summary),
      contains(
          'Dùng mã HANDS-WALLET-TEST1234 khi gửi khoản nộp hoặc yêu cầu bù trừ.'),
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
          'Quyền xác nhận nhận lịch, bắt đầu dịch vụ và nhận tiền chi trả sẽ được khôi phục khi số dư ví không còn âm.'),
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
            'Outstanding HANDS fee settlement must be completed before final booking acceptance, service start, or payout release.',
        'displayMessage': providerWalletBlockFallbackReasonClean,
        'walletBlocked': true,
        'marketplaceVisibilityBlocked': false,
        'marketplaceJoinBlocked': false,
        'directFirstPickBlocked': true,
        'alreadyMatchedServiceBlocked': true,
        'payoutReleaseBlocked': true,
        'walletBalance': -80000,
        'walletDebtAmount': 80000,
        'walletSettlementRequired': true,
        'walletSettlementReference': 'HANDS-WALLET-BLOCKED',
        'walletSettlementInstruction':
            'Marketplace participation stays open, but final acceptance and service start are blocked until settlement.',
      },
      'error': 'Bad Request',
      'statusCode': 400,
    });

    final summary = providerApiExceptionWalletSummary(exception);
    final walletSummary = summary!;

    expect(summary, isNotNull);
    expect(walletSummary['walletBlocked'], isTrue);
    expect(walletSummary['marketplaceJoinBlocked'], isFalse);
    expect(walletSummary['directFirstPickBlocked'], isTrue);
    expect(walletSummary['alreadyMatchedServiceBlocked'], isTrue);
    expect(providerWalletMarketplaceJoinBlocked(walletSummary), isFalse);
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
      contains('final acceptance and service start are blocked'),
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
    expect(providerWalletStatusLabel(summary), 'Sẵn sàng để xét chi trả');
    expect(providerWalletSettlementSteps(summary),
        contains('Phí đặt lịch tiền mặt đã được thanh toán.'));
    expect(
      providerWalletSettlementSteps(summary),
      contains(
        'Khoản chi trả ví được kiểm tra khi bạn yêu cầu rút tiền hoặc báo cáo khoản nộp.',
      ),
    );
  });

  test(
      'shows bank correction request without blocking marketplace participation',
      () {
    final summary = {
      'walletBalance': 0,
      'bankCorrectionRequest': {
        'required': true,
        'reason': 'Account holder name does not match KYC.',
        'message': '입금 정보가 정확하지 않아 입금이 되지 않습니다.',
      },
    };

    final view = ProviderWalletSettlementView.fromSummary(summary);

    expect(view.blocked, isFalse);
    expect(view.bankCorrectionRequired, isTrue);
    expect(view.statusLabel, 'Cần sửa thông tin ngân hàng');
    expect(view.bankCorrectionReasonLabel,
        contains('Account holder name does not match KYC'));
    expect(providerWalletMarketplaceJoinBlocked(summary), isFalse);
  });

  test('explicit marketplace policy blocks participation for wallet debt', () {
    final summary = <String, dynamic>{
      'walletBalance': -120000,
      'walletBlocked': true,
      'marketplaceJoinBlocked': true,
      'walletBlockReason':
          'Wallet needs settlement before marketplace participation.',
    };

    expect(providerWalletMarketplaceJoinBlocked(summary), isTrue);
    expect(providerWalletBlockReason(summary), isNotNull);
  });

  test('does not count the direct first-pick row as a marketplace participant',
      () {
    expect(
      providerMarketplaceParticipantCount({
        'preferredProvider': {'id': 'preferred-1'},
        'participants': [
          {'providerProfileId': 'preferred-1', 'status': 'JOINED'},
          {'providerProfileId': 'marketplace-1', 'status': 'JOINED'},
        ],
      }),
      1,
    );
  });

  test('uses explicit marketplace policy only when wallet is settled', () {
    final explicitOpen = <String, dynamic>{
      'walletBalance': 20000,
      'walletBlocked': false,
      'marketplaceJoinBlocked': false,
    };
    final explicitBlocked = <String, dynamic>{
      'walletBalance': 20000,
      'walletBlocked': false,
      'marketplaceJoinBlocked': true,
      'walletBlockDisplayMessage': providerWalletBlockFallbackReasonClean,
    };

    expect(providerWalletMarketplaceJoinBlocked(explicitOpen), isFalse);
    expect(providerWalletBlockReason(explicitOpen), isNull);
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
    expect(providerCashBookingSettlementHint(booking), contains('số dư ví âm'));
  });

  test('explains direct requests as first partner decisions', () {
    final guidance = providerRequestGuidance(
      booking: {'status': 'OPEN_MATCHING'},
      isPreferredRequest: true,
      joined: false,
      walletBlocked: false,
    );

    expect(guidance.modeLabel, 'Yêu cầu trực tiếp');
    expect(guidance.roleLabel, 'Đối tác được chọn đầu tiên');
    expect(guidance.decisionLabel, 'Xác nhận ngay');
    expect(guidance.nextAction, contains('xác nhận đặt lịch ngay'));
    expect(guidance.detailMessage, contains('10 phút'));
    expect(guidance.detailMessage, contains('10 km'));
    expect(guidance.infoMessage, contains('Chấp nhận để xác nhận ngay'));
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

    expect(
        providerMatchingWindowTagLabel(booking), '7 phút phản hồi trực tiếp');
    expect(
        providerMarketplaceRadiusTagLabel(booking), '5 km phạm vi công khai');
    expect(guidance.detailMessage, contains('7 phút'));
    expect(guidance.detailMessage, contains('5 km'));
  });

  test('prefers marketplace radius over legacy radius', () {
    final booking = {
      'status': 'OPEN_MATCHING',
      'metadata': {
        'matchingPolicy': {
          'marketplaceRadiusMeters': 5000,
          'backupProviderRadiusMeters': 10000,
        },
      },
    };

    expect(providerMarketplaceRadiusMeters(booking), 5000);
    expect(
        providerMarketplaceRadiusTagLabel(booking), '5 km phạm vi công khai');
  });

  test('keeps direct request guidance when wallet is negative', () {
    final guidance = providerRequestGuidance(
      booking: {'status': 'OPEN_MATCHING'},
      isPreferredRequest: true,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Yêu cầu trực tiếp');
    expect(guidance.decisionLabel, 'Xác nhận ngay');
    expect(guidance.nextAction, contains('xác nhận đặt lịch ngay'));
    expect(guidance.infoMessage, contains('Chấp nhận để xác nhận ngay'));
  });

  test('explains when first-pick acceptance immediately confirms a booking',
      () {
    final response = {
      'event': 'booking.matched',
      'matchSource': 'FIRST_PICK_ACCEPTED_FIRST',
      'booking': {'status': 'PROVIDER_ON_THE_WAY'},
    };

    expect(providerAcceptanceConfirmedBooking(response), isTrue);
    expect(
      providerBookingDecisionStatusMessage(
        accepted: true,
        response: response,
      ),
      contains('Đặt lịch đã được xác nhận'),
    );
  });

  test('keeps marketplace acceptance waiting for customer selection', () {
    final response = {
      'event': 'provider.accepted',
      'booking': {'status': 'OPEN_MATCHING'},
    };

    expect(providerAcceptanceConfirmedBooking(response), isFalse);
    expect(
      providerBookingDecisionStatusMessage(
        accepted: true,
        response: response,
      ),
      contains('Đang chờ khách hàng'),
    );
  });

  test('blocks marketplace participation guidance when wallet is negative', () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'OPEN_MATCHING',
        'preferredProvider': {'displayName': 'Linh Wellness'},
      },
      isPreferredRequest: false,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Cơ hội đặt lịch');
    expect(guidance.decisionLabel, 'Cần thanh toán phí');
    expect(guidance.contextMessage, contains('phí HANDS còn thiếu'));
    expect(
      providerMarketplaceJoinButtonLabel(
        hasPreferredProvider: true,
      ),
      'Tham gia hỗ trợ đặt lịch',
    );
    expect(
      providerWalletBlockFallbackReasonClean,
      'Phí HANDS chưa được thanh toán nên bạn chưa thể xác nhận nhận lịch này.',
    );
    expect(guidance.detailMessage, providerMarketplaceJoinBlockReasonClean);
    expect(providerActionBlockCopy(guidance.detailMessage)?.title,
        'Cần thanh toán phí');
    expect(
      providerActionBlockCopy(
              'Unpaid HANDS fees must be settled before you can participate in marketplace bookings.')
          ?.detail,
      providerWalletBlockFallbackReasonClean,
    );
  });

  test('wallet gate blocks marketplace participation before final matching',
      () {
    expect(
      providerWalletBlocksMarketplaceParticipation(
        marketplaceJoinBlocked: true,
        isPreferredRequest: false,
        isMatched: false,
      ),
      isTrue,
    );
    expect(
      providerWalletBlocksMarketplaceParticipation(
        marketplaceJoinBlocked: true,
        isPreferredRequest: true,
        isMatched: false,
      ),
      isFalse,
      reason:
          'Direct first-pick accept/reject is not marketplace participation.',
    );
    expect(
      providerWalletBlocksMarketplaceParticipation(
        marketplaceJoinBlocked: true,
        isPreferredRequest: false,
        isMatched: false,
      ),
      isTrue,
      reason:
          'Explicit marketplace policy can still block participation before settlement.',
    );
    expect(
      providerWalletBlocksMarketplaceParticipation(
        marketplaceJoinBlocked: true,
        isPreferredRequest: false,
        isMatched: true,
      ),
      isFalse,
      reason: 'Already matched bookings are handled by service workflow.',
    );
    expect(
      providerMarketplaceJoinButtonLabel(
        hasPreferredProvider: true,
      ),
      'Tham gia hỗ trợ đặt lịch',
    );
  });

  test(
      'keeps marketplace booking visible but explains participation is blocked',
      () {
    final guidance = providerRequestGuidance(
      booking: {
        'status': 'OPEN_MATCHING',
        'preferredProvider': {'displayName': 'Sen ne'},
      },
      isPreferredRequest: false,
      joined: false,
      walletBlocked: true,
    );

    expect(guidance.modeLabel, 'Cơ hội đặt lịch');
    expect(guidance.nextAction, contains('Thanh toán phí HANDS còn thiếu'));
    expect(guidance.contextMessage, contains('vẫn có thể xem'));
    expect(guidance.contextMessage, contains('trước khi tham gia'));
    expect(guidance.infoMessage, contains('thanh toán phí HANDS còn thiếu'));
    expect(guidance.detailMessage, providerMarketplaceJoinBlockReasonClean);
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

    expect(guidance.modeLabel, 'Cơ hội đặt lịch công khai');
    expect(guidance.roleLabel, 'Ứng viên công khai');
    expect(guidance.decisionLabel, 'Có thể tham gia');
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

    expect(guidance.decisionLabel, 'Trò chuyện đang mở');
    expect(guidance.nextAction, contains('Tiếp tục'));
    expect(guidance.infoMessage, 'Trò chuyện đã sẵn sàng cho đặt lịch này.');
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
        'Dịch vụ đã hoàn tất. Hãy kiểm tra thu nhập và trạng thái chi trả.');
  });

  test('formats partner booking service option labels consistently', () {
    final service = {
      'name': 'Foot Massage',
      'durationMin': 90,
      'basePrice': 700000,
    };

    expect(providerServiceOptionLabel(service), 'Foot Massage / 90 phút');
    expect(
      providerServiceOptionPriceLabel(service),
      'Foot Massage / 90 phút / 700.000 VND',
    );
    expect(
      providerServiceOptionPriceLabel(service, amount: 750000),
      'Foot Massage / 90 phút / 750.000 VND',
    );
  });

  test('keeps partner booking service labels safe for missing values', () {
    expect(providerServiceOptionLabel(null), 'Dịch vụ massage');
    expect(providerServiceOptionPriceLabel(null), 'Dịch vụ massage');
    expect(providerServiceDurationLabel(null), '- phút');
  });
}
