import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider_app/provider_app.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/features/booking/presentation/provider_requests_list_section.dart';
import 'package:provider_app/src/features/booking/presentation/provider_request_filter_helpers.dart';
import 'package:provider_app/src/features/chat/presentation/provider_chat_location_helpers.dart';
import 'package:provider_app/src/features/earnings/presentation/provider_earnings_screen.dart';
import 'package:provider_app/src/features/notification/data/datasources/in_app_notification_token_datasource.dart';
import 'package:provider_app/src/features/notification/presentation/providers/notification_providers.dart';

void main() {
  testWidgets('renders partner requests screen', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          pushTokenDataSourceProvider
              .overrideWithValue(InAppNotificationTokenDataSource()),
        ],
        child: const ProviderApp(),
      ),
    );

    expect(find.text('Yêu cầu đặt lịch'), findsOneWidget);
    expect(find.text('Đăng nhập thử nghiệm'), findsOneWidget);
  });

  test('partner service option labels tolerate numeric strings', () {
    final service = {
      'name': 'Foot Massage',
      'durationMin': '90',
      'bookingPrice': '700000',
      'basePrice': '500000',
    };

    expect(providerServiceOptionLabel(service), 'Foot Massage / 90 phút');
    expect(providerServiceDurationLabel(service), '90 phút');
    expect(providerServiceOptionPriceLabel(service),
        'Foot Massage / 90 phút / 700.000 VND');
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
    expect(providerWalletStatusLabel(summary), 'Cần thanh toán phí');
    expect(providerWalletSettlementSteps(summary).first,
        'Thanh toán 120.000 VND phí HANDS còn thiếu.');
  });

  test('partner earning target sort moves push earning first', () {
    final earnings = sortedProviderEarningsForTarget([
      {
        'id': 'earning-newer',
        'bookingId': 'booking-newer',
        'payoutBatchId': 'payout-newer',
      },
      {
        'id': 'earning-target',
        'bookingId': 'booking-target',
        'payoutBatchId': 'payout-target',
      },
    ], earningId: 'earning-target');

    expect(earnings.first['id'], 'earning-target');
  });

  test('partner earning target sort can match payout batch id', () {
    final earnings = sortedProviderEarningsForTarget([
      {
        'id': 'earning-newer',
        'bookingId': 'booking-newer',
        'payoutBatchId': 'payout-newer',
      },
      {
        'id': 'earning-payout-target',
        'bookingId': 'booking-target',
        'payoutBatchId': 'payout-target',
      },
    ], payoutBatchId: 'payout-target');

    expect(earnings.first['id'], 'earning-payout-target');
  });

  test('partner wallet requests require bank input when missing or rejected',
      () {
    expect(providerWalletBankInputRequired(const {}), isTrue);
    expect(
      providerWalletBankInputRequired({
        'bankAccounts': [
          {
            'status': 'REJECTED',
            'rejectionReason': 'Account holder mismatch',
          },
        ],
      }),
      isTrue,
    );
    expect(
      providerWalletBankRejectionReason({
        'status': 'REJECTED',
        'rejectionReason': 'Account holder mismatch',
      }),
      'Account holder mismatch',
    );
  });

  test('partner wallet requests wait for bank review before continuing', () {
    final snapshot = {
      'bankAccounts': [
        {'status': 'PENDING_REVIEW'},
      ],
    };

    expect(providerWalletBankInputRequired(snapshot), isFalse);
    expect(
      providerWalletBankRequestMessage('yêu cầu rút tiền', 'PENDING_REVIEW'),
      'Thông tin ngân hàng đang chờ phê duyệt trước khi tiếp tục yêu cầu rút tiền.',
    );
  });

  test('partner wallet requests can continue after bank approval', () {
    final snapshot = {
      'bankAccounts': [
        {'status': 'APPROVED'},
      ],
    };

    expect(providerWalletBankInputRequired(snapshot), isFalse);
    expect(
      providerWalletBankRequestMessage('báo cáo khoản nộp', 'APPROVED'),
      'Thông tin ngân hàng đã được phê duyệt. Có thể tiếp tục báo cáo khoản nộp qua HANDS.',
    );
  });

  testWidgets('shows marketplace-only wallet hold banner in request list',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ProviderRequestsListSection(
              isOnline: true,
              authUserId: 'provider-user-1',
              bookingItems: const [],
              visibleBookings: const [],
              requestView: 'action',
              joinedBookingIds: const {},
              loading: false,
              walletBlocked: true,
              filters: const ProviderRequestFilters(),
              savingAlertPreferences: false,
              onRequestViewChanged: (_) {},
              onJoin: (_) {},
              onAccept: (_) {},
              onReject: (_) {},
              onFiltersChanged: (_) {},
              onSaveAlertPreferences: () {},
            ),
          ),
        ),
      ),
    );

    expect(
      find.text(
        '$providerMarketplaceJoinBlockReasonClean Yêu cầu trực tiếp vẫn được xử lý riêng.',
      ),
      findsOneWidget,
    );
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
    expect(providerActionBlockCopy(walletMessage)?.title, 'Cần thanh toán phí');

    final kycMessage = providerAppErrorMessage(ApiException(403, {
      'message': 'Partner KYC must be approved before receiving paid work.',
      'error': 'Forbidden',
      'statusCode': 403,
    }));

    expect(providerActionBlockCopy(kycMessage)?.title, 'Cần phê duyệt KYC');

    final bankMessage = providerAppErrorMessage(ApiException(403, {
      'message':
          'Partner bank account must be approved before wallet withdrawal.',
    }));

    expect(providerActionBlockCopy(bankMessage)?.title,
        'Cần thông tin ngân hàng cho ví');
    expect(
      providerActionBlockCopy(bankMessage)?.detail,
      contains('yêu cầu rút hoặc nộp tiền vào ví'),
    );
  });

  test('partner chat is hidden after operations closes no-show booking', () {
    final liveBooking = {
      'status': 'IN_SERVICE',
      'chatRoom': {'id': 'room-live'},
    };
    final noShowBooking = {
      'status': 'NO_SHOW',
      'chatRoom': {'id': 'room-no-show'},
    };

    expect(isProviderAppChatVisible(liveBooking), isTrue);
    expect(isProviderAppChatVisible(noShowBooking), isFalse);
  });

  test('partner chat location reads selected booking address snapshot', () {
    final booking = {
      'id': 'booking-selected-chat-location',
      'addressSnapshot': {
        'latitude': '10.7769',
        'longitude': '106.7009',
      },
    };

    expect(providerChatCustomerLatitude(booking), 10.7769);
    expect(providerChatCustomerLongitude(booking), 106.7009);
  });

  test(
      'partner chat location prefers address snapshot over stale root coordinate',
      () {
    final booking = {
      'id': 'booking-stale-root-chat-location',
      'lat': '13.7563',
      'lng': '100.5018',
      'addressSnapshot': {
        'latitude': '10.7769',
        'longitude': '106.7009',
      },
    };

    expect(providerChatCustomerLatitude(booking), 10.7769);
    expect(providerChatCustomerLongitude(booking), 106.7009);
  });

  test('partner chat location keeps legacy root coordinate fallback', () {
    final booking = {
      'id': 'booking-legacy-chat-location',
      'lat': '10.775',
      'lng': '106.701',
    };

    expect(providerChatCustomerLatitude(booking), 10.775);
    expect(providerChatCustomerLongitude(booking), 106.701);
  });

  testWidgets('keeps participation clickable for the wallet settlement dialog',
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
            ),
          ),
        ),
      ),
    );

    expect(find.text('Không thể tham gia khi phí chưa được thanh toán'),
        findsOneWidget);
    expect(find.text(providerMarketplaceJoinBlockReasonClean), findsOneWidget);
    expect(find.text('Tham gia hỗ trợ đặt lịch'), findsOneWidget);

    await tester.ensureVisible(find.text('Tham gia hỗ trợ đặt lịch'));
    await tester.tap(find.text('Tham gia hỗ trợ đặt lịch'));
    await tester.pump();

    expect(joinTapped, isTrue);
  });

  testWidgets('allows first-pick request response when wallet is negative',
      (tester) async {
    var acceptTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: OpenBookingCard(
              booking: {
                'id': 'booking-first-pick-wallet-negative',
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
              isPreferredRequest: true,
              joined: false,
              loading: false,
              walletBlocked: true,
              onJoin: () {},
              onAccept: () => acceptTapped = true,
              onReject: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Không thể tham gia khi phí chưa được thanh toán'),
        findsNothing);
    expect(find.text('Chấp nhận yêu cầu'), findsOneWidget);

    await tester.ensureVisible(find.text('Chấp nhận yêu cầu'));
    await tester.tap(find.text('Chấp nhận yêu cầu'));
    await tester.pump();

    expect(acceptTapped, isTrue);
  });

  testWidgets('shows matched first-pick chat as active when wallet is negative',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: OpenBookingCard(
              booking: {
                'id': 'booking-first-pick-matched-wallet-negative',
                'status': 'MATCHED',
                'createdAt': '2026-06-04T00:00:00.000Z',
                'updatedAt': '2026-06-04T00:00:00.000Z',
                'preferredProvider': {'displayName': 'Linh Wellness'},
                'selectedProvider': {'displayName': 'Linh Wellness'},
                'participants': [
                  {'status': 'SELECTED'}
                ],
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
              isPreferredRequest: true,
              joined: false,
              loading: false,
              walletBlocked: true,
              onJoin: () {},
              onAccept: () {},
              onReject: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Không thể tham gia khi phí chưa được thanh toán'),
        findsNothing);
    expect(find.text('Trò chuyện đã sẵn sàng. Tiếp tục trong mục Trò chuyện.'),
        findsOneWidget);
    expect(find.text('Bắt đầu dịch vụ'), findsNothing);
  });

  testWidgets(
      'keeps an existing marketplace participation visible after wallet debt',
      (tester) async {
    var rejectTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: OpenBookingCard(
              booking: {
                'id': 'booking-marketplace-wallet-lock-joined',
                'status': 'OPEN_MATCHING',
                'createdAt': '2026-06-04T00:00:00.000Z',
                'updatedAt': '2026-06-04T00:00:00.000Z',
                'preferredProvider': {'displayName': 'Linh Wellness'},
                'participants': [
                  {'status': 'JOINED'}
                ],
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
              joined: true,
              loading: false,
              walletBlocked: true,
              onJoin: () {},
              onAccept: () {},
              onReject: () => rejectTapped = true,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Không thể tham gia khi phí chưa được thanh toán'),
        findsOneWidget);
    expect(
      find.text(
          'Bạn vẫn có thể xem đặt lịch này, nhưng phải thanh toán phí HANDS còn thiếu trước khi tham gia.'),
      findsOneWidget,
    );
    expect(find.text('Tham gia hỗ trợ đặt lịch'), findsNothing);
    expect(rejectTapped, isFalse);
  });
}
