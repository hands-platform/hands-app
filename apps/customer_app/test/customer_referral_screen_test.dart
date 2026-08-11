import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/customer_design_system.dart';
import 'package:customer_app/src/features/referral/data/customer_referral_repository.dart';
import 'package:customer_app/src/features/referral/presentation/customer_referral_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('moves from the referral introduction to the live dashboard once',
      (tester) async {
    final repository = _FakeReferralRepository();
    final platformCalls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      platformCalls.add(call);
      return null;
    });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );
    await _pumpReferralScreen(tester, repository);
    await tester.pumpAndSettle();

    expect(find.text('Share HANDS and get rewarded'), findsOneWidget);
    expect(find.text('Start earning rewards'), findsOneWidget);

    await tester.ensureVisible(find.text('Start earning rewards'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start earning rewards'));
    await tester.pumpAndSettle();

    expect(repository.issueCalls, 1);
    expect(find.text('My referral link'), findsOneWidget);
    expect(find.text('Invited friends'), findsOneWidget);
    expect(repository.inviteCalls, 1);
    expect(repository.rewardCalls, 1);

    await tester.ensureVisible(find.byTooltip('Copy referral link'));
    await tester.tap(find.byTooltip('Copy referral link'));
    await tester.pump();
    expect(find.text('Referral link copied.'), findsWidgets);
    expect(
      platformCalls,
      contains(
        isA<MethodCall>()
            .having((call) => call.method, 'method', 'Clipboard.setData')
            .having(
          (call) => call.arguments,
          'arguments',
          {'text': 'https://hands.vn/r/customer/HCUSTOMER'},
        ),
      ),
    );

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('No friends have joined through your link yet.'),
        findsOneWidget);
  });

  testWidgets('shows policy help, safe lists, and server cashout actions',
      (tester) async {
    final repository = _FakeReferralRepository(
      hasCode: true,
      includeRows: true,
    );
    await _pumpReferralScreen(tester, repository);
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Referral help'));
    await tester.pumpAndSettle();
    expect(find.text('Share HANDS and get rewarded'), findsOneWidget);
    expect(find.text('Earn 10% of the policy reward base.'), findsOneWidget);
    Navigator.of(tester.element(find.byType(DraggableScrollableSheet))).pop();
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('N*** A*'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Reward condition met'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Request cashout'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Booking HANDS-12345678'), findsOneWidget);
    expect(find.text('Your wallet balance cannot cover this cashout.'),
        findsOneWidget);

    final cashoutButton = find.widgetWithText(FilledButton, 'Request cashout');
    await Scrollable.ensureVisible(
      tester.element(cashoutButton),
      alignment: 0.5,
    );
    await tester.pumpAndSettle();
    await tester.tap(cashoutButton);
    await tester.pumpAndSettle();
    expect(repository.cashoutCalls, 1);
    expect(find.text('Cashout request submitted.'), findsWidgets);
  });

  testWidgets('retries a failed referral summary without creating a code',
      (tester) async {
    final repository = _FakeReferralRepository(failSummaryOnce: true);
    await _pumpReferralScreen(tester, repository);
    await tester.pumpAndSettle();

    expect(find.text('Referral details could not be loaded.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(repository.summaryCalls, 2);
    expect(repository.issueCalls, 0);
    expect(find.text('Share HANDS and get rewarded'), findsOneWidget);
  });
}

Future<void> _pumpReferralScreen(
  WidgetTester tester,
  CustomerReferralRepository repository,
) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        customerReferralRepositoryProvider.overrideWithValue(repository),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        theme: buildCustomerTheme(),
        home: const CustomerReferralScreen(),
      ),
    ),
  );
}

class _FakeReferralRepository extends CustomerReferralRepository {
  _FakeReferralRepository({
    this.hasCode = false,
    this.includeRows = false,
    this.failSummaryOnce = false,
  }) : super(ApiClient(baseUrl: 'http://test.local'));

  bool hasCode;
  final bool includeRows;
  final bool failSummaryOnce;
  int issueCalls = 0;
  int inviteCalls = 0;
  int rewardCalls = 0;
  int cashoutCalls = 0;
  int summaryCalls = 0;

  Map<String, dynamic> get _policy => {
        'enabled': true,
        'rewardMode': 'COMMISSION_PERCENT',
        'commissionPercentBps': 1000,
        'fixedRewardAmount': null,
        'holdPeriodDays': 7,
        'currency': 'VND',
      };

  @override
  Future<Map<String, dynamic>> summary() async {
    summaryCalls += 1;
    if (failSummaryOnce && summaryCalls == 1) throw Exception('offline');
    return {
      'policy': _policy,
      'referralCode': hasCode
          ? {
              'code': 'HCUSTOMER',
              'sharePath': '/r/customer/HCUSTOMER',
            }
          : null,
      'totals': {
        'invitedFriendCount': includeRows ? 1 : 0,
        'totalRewardAmount': includeRows ? 75000 : 0,
        'processingAmount': includeRows ? 75000 : 0,
        'paidOutAmount': 0,
        'currency': 'VND',
      },
    };
  }

  @override
  Future<Map<String, dynamic>> issueCode() async {
    issueCalls += 1;
    hasCode = true;
    return {
      'code': 'HCUSTOMER',
      'sharePath': '/r/customer/HCUSTOMER',
    };
  }

  @override
  Future<Map<String, dynamic>> invites({String? cursor, int limit = 20}) async {
    inviteCalls += 1;
    return {
      'rows': includeRows
          ? [
              {
                'id': 'invite-1',
                'displayName': 'N*** A*',
                'status': 'QUALIFIED',
                'attributedAt': '2026-08-01T08:00:00.000Z',
                'rewardConditionMet': true,
              },
            ]
          : <dynamic>[],
      'pagination': {'nextCursor': null},
    };
  }

  @override
  Future<Map<String, dynamic>> rewards({String? cursor, int limit = 20}) async {
    rewardCalls += 1;
    return {
      'rows': includeRows
          ? [
              {
                'id': 'reward-1',
                'amount': 50000,
                'currency': 'VND',
                'status': cashoutCalls == 0 ? 'CREDITED' : 'CASHOUT_REQUESTED',
                'createdAt': '2026-08-02T08:00:00.000Z',
                'availableAt': '2026-08-02T08:00:00.000Z',
                'bookingReference': 'HANDS-12345678',
                'canRequestCashout': cashoutCalls == 0,
                'cashoutUnavailableReason':
                    cashoutCalls == 0 ? null : 'PROCESSING',
              },
              {
                'id': 'reward-2',
                'amount': 25000,
                'currency': 'VND',
                'status': 'CREDITED',
                'createdAt': '2026-08-01T08:00:00.000Z',
                'availableAt': '2026-08-01T08:00:00.000Z',
                'bookingReference': 'HANDS-87654321',
                'canRequestCashout': false,
                'cashoutUnavailableReason': 'WALLET_BALANCE',
              },
            ]
          : <dynamic>[],
      'pagination': {'nextCursor': null},
    };
  }

  @override
  Future<Map<String, dynamic>> requestCashout(String rewardId) async {
    cashoutCalls += 1;
    return {'id': rewardId, 'status': 'CASHOUT_REQUESTED'};
  }
}
