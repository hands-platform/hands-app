import 'package:customer_app/src/features/notification/domain/entities/customer_app_notification.dart';
import 'package:customer_app/src/features/notification/domain/repositories/customer_notification_inbox_repository.dart';
import 'package:customer_app/src/features/notification/presentation/customer_notification_screen.dart';
import 'package:customer_app/src/features/notification/presentation/providers/notification_providers.dart';
import 'package:customer_app/src/features/profile/presentation/customer_profile_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows referral, manual wallet, and Admin messages in one inbox',
      (tester) async {
    final repository = _FakeCustomerNotificationInboxRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerNotificationInboxRepositoryProvider
              .overrideWithValue(repository),
        ],
        child: const MaterialApp(home: CustomerNotificationScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Referral reward added'), findsOneWidget);
    expect(find.text('Wallet debited'), findsOneWidget);
    expect(find.text('Service update'), findsOneWidget);
    expect(find.byIcon(Icons.card_giftcard_outlined), findsOneWidget);
    expect(find.byIcon(Icons.account_balance_wallet_outlined), findsOneWidget);
    expect(find.byIcon(Icons.campaign_outlined), findsOneWidget);
    expect(repository.calls, 1);
  });

  testWidgets('localizes structured notifications but preserves Admin copy',
      (tester) async {
    final repository = _FakeCustomerNotificationInboxRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerNotificationInboxRepositoryProvider
              .overrideWithValue(repository),
        ],
        child: const MaterialApp(
          locale: Locale('vi'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: [Locale('vi'), Locale('en')],
          home: CustomerNotificationScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Thông báo'), findsOneWidget);
    expect(find.text('Đã nhận thưởng giới thiệu'), findsOneWidget);
    expect(
      find.text('100.000 VND đã được cộng vào ví HANDS của bạn.'),
      findsOneWidget,
    );
    expect(find.text('Đã trừ tiền khỏi ví'), findsOneWidget);
    expect(
      find.text('50.000 VND đã được trừ khỏi ví HANDS của bạn.'),
      findsOneWidget,
    );
    expect(find.text('Service update'), findsOneWidget);
  });

  testWidgets('opens wallet activity from a manual adjustment notification',
      (tester) async {
    final repository = _FakeCustomerNotificationInboxRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerNotificationInboxRepositoryProvider
              .overrideWithValue(repository),
        ],
        child: const MaterialApp(home: CustomerNotificationScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Wallet debited'));
    await tester.pumpAndSettle();

    final profile = tester.widget<ProfileScreen>(find.byType(ProfileScreen));
    expect(profile.openWalletOnLoad, isTrue);
    expect(repository.markedRead, contains('wallet-1'));
  });

  testWidgets('opens an allowlisted Admin push destination', (tester) async {
    final repository = _FakeCustomerNotificationInboxRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerNotificationInboxRepositoryProvider
              .overrideWithValue(repository),
        ],
        child: const MaterialApp(home: CustomerNotificationScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Service update'));
    await tester.pumpAndSettle();

    final profile = tester.widget<ProfileScreen>(find.byType(ProfileScreen));
    expect(profile.openWalletOnLoad, isFalse);
    expect(repository.markedRead, contains('push-1'));
  });
}

class _FakeCustomerNotificationInboxRepository
    implements CustomerNotificationInboxRepository {
  int calls = 0;
  final List<String> markedRead = [];

  @override
  Future<CustomerNotificationInboxPage> list(
      {String? cursor, int take = 20}) async {
    calls += 1;
    return CustomerNotificationInboxPage(
      nextCursor: null,
      rows: [
        CustomerAppNotification(
          id: 'referral-1',
          type: 'customer.referral.reward_credited',
          title: 'Referral reward added',
          body: '100,000 VND referral reward was added to your HANDS wallet.',
          createdAt: DateTime.utc(2026, 7, 17, 8),
          data: const {'amount': 100000, 'currency': 'VND'},
        ),
        CustomerAppNotification(
          id: 'wallet-1',
          type: 'customer.wallet.manual_adjustment',
          title: 'Wallet debited',
          body: '50,000 VND was deducted from your HANDS wallet.',
          createdAt: DateTime.utc(2026, 7, 16, 8),
          data: const {
            'amount': 50000,
            'currency': 'VND',
            'direction': 'DEBIT',
          },
        ),
        CustomerAppNotification(
          id: 'push-1',
          type: 'admin.push.broadcast',
          title: 'Service update',
          body: 'A Partner is ready for your next booking.',
          createdAt: DateTime.utc(2026, 7, 15, 8),
          data: const {'destination': 'profile'},
        ),
      ],
    );
  }

  @override
  Future<void> markRead(String notificationId) async {
    markedRead.add(notificationId);
  }
}
