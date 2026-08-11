import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_bookings_screen.dart';
import '../../chat/presentation/customer_chat_screen.dart';
import '../../discovery/presentation/customer_providers_screen.dart';
import '../../profile/presentation/customer_profile_screen.dart';
import '../../referral/presentation/customer_referral_screen.dart';
import '../domain/entities/customer_app_notification.dart';
import 'providers/notification_providers.dart';

class CustomerNotificationScreen extends ConsumerStatefulWidget {
  const CustomerNotificationScreen({super.key});

  @override
  ConsumerState<CustomerNotificationScreen> createState() =>
      _CustomerNotificationScreenState();
}

class _CustomerNotificationScreenState
    extends ConsumerState<CustomerNotificationScreen> {
  final List<CustomerAppNotification> _rows = [];
  String? _nextCursor;
  int _unreadCount = 0;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _load(reset: true));
  }

  Future<void> _load({required bool reset}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(customerNotificationInboxRepositoryProvider)
          .list(cursor: reset ? null : _nextCursor);
      if (!mounted) return;
      setState(() {
        if (reset) _rows.clear();
        _rows.addAll(page.rows);
        _nextCursor = page.nextCursor;
        _unreadCount = page.unreadCount;
      });
    } catch (exception) {
      if (mounted) setState(() => _error = customerErrorMessage(exception));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(CustomerAppNotification notification) async {
    final index = _rows.indexWhere((row) => row.id == notification.id);
    if (notification.readAt == null) {
      try {
        await ref
            .read(customerNotificationInboxRepositoryProvider)
            .markRead(notification.id);
        if (mounted && index >= 0) {
          setState(() {
            _rows[index] = notification.markRead();
            if (_unreadCount > 0) _unreadCount -= 1;
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() => _error = 'markReadError');
        }
      }
    }
    if (!mounted) return;

    if (notification.type == 'customer.referral.reward_credited') {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => const CustomerReferralScreen()),
      );
      return;
    }
    if (notification.type == 'customer.wallet.manual_adjustment') {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => const ProfileScreen(openWalletOnLoad: true),
        ),
      );
      return;
    }
    final chatRoomId = notification.data['chatRoomId']?.toString();
    final bookingId = notification.data['bookingId']?.toString();
    if (chatRoomId != null && chatRoomId.isNotEmpty) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            initialChatRoomId: chatRoomId,
            initialBookingId: bookingId,
          ),
        ),
      );
      return;
    }
    if (bookingId != null && bookingId.isNotEmpty) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => BookingsScreen(
            initialBookingId: bookingId,
            initialPaymentId: notification.data['paymentId']?.toString(),
          ),
        ),
      );
      return;
    }

    final destination = notification.data['destination']?.toString() ??
        notification.data['appDestination']?.toString();
    final Widget? destinationScreen = switch (destination) {
      'booking' => const BookingsScreen(),
      'chat' => const ChatScreen(),
      'providerProfile' => const ProvidersScreen(),
      'profile' => const ProfileScreen(),
      _ => null,
    };
    if (destinationScreen != null) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => destinationScreen),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final title = _notificationText(locale, 'title');
    return HandsScaffold(
      appBar: HandsTopBar(
        title: _unreadCount == 0 ? title : '$title ($_unreadCount)',
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(CustomerSpacing.page),
                child: ErrorPanel(
                  text: _notificationText(locale, _error!),
                ),
              )
            else if (!_loading && _rows.isEmpty)
              Padding(
                padding: const EdgeInsets.all(CustomerSpacing.page),
                child: EmptyPanel(text: _notificationText(locale, 'empty')),
              )
            else
              for (final row in _rows)
                _NotificationRow(
                  notification: row,
                  onTap: () => _open(row),
                ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_nextCursor != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: OutlinedButton(
                  onPressed: () => _load(reset: false),
                  child: Text(_notificationText(locale, 'loadMore')),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.notification,
    required this.onTap,
  });

  final CustomerAppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final locale = Localizations.localeOf(context);
    final unread = notification.readAt == null;
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: unread ? colors.primarySoft : colors.canvas,
          border: Border(bottom: BorderSide(color: colors.outline)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.primarySoft,
                border: Border.all(color: colors.outline),
              ),
              child: Icon(
                _notificationIcon(notification.type),
                size: 22,
                color: colors.primary,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _notificationTitle(locale, notification),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight:
                              unread ? FontWeight.w800 : FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _notificationBody(locale, notification),
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: colors.inkMuted,
                          height: 1.45,
                        ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _notificationTime(locale, notification.createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

IconData _notificationIcon(String type) {
  if (type == 'customer.referral.reward_credited') {
    return Icons.card_giftcard_outlined;
  }
  if (type == 'customer.wallet.manual_adjustment') {
    return Icons.account_balance_wallet_outlined;
  }
  return Icons.campaign_outlined;
}

String _notificationTitle(
  Locale locale,
  CustomerAppNotification notification,
) {
  if (notification.type == 'customer.referral.reward_credited') {
    return _notificationText(locale, 'referralTitle');
  }
  if (notification.type == 'customer.wallet.manual_adjustment') {
    final direction = notification.data['direction'];
    if (direction != 'CREDIT' && direction != 'DEBIT') {
      return notification.title;
    }
    return _notificationText(
      locale,
      direction == 'DEBIT' ? 'walletDebitTitle' : 'walletCreditTitle',
    );
  }
  return notification.title;
}

String _notificationBody(
  Locale locale,
  CustomerAppNotification notification,
) {
  final amount = notification.data['amount'];
  final currency = notification.data['currency']?.toString().trim();
  if (amount == null || currency == null || currency.isEmpty) {
    return notification.body;
  }
  final values = {
    'amount': formatCurrency(amount),
    'currency': currency,
  };
  if (notification.type == 'customer.referral.reward_credited') {
    return _notificationTextWith(locale, 'referralBody', values);
  }
  if (notification.type == 'customer.wallet.manual_adjustment') {
    return _notificationTextWith(
      locale,
      notification.data['direction'] == 'DEBIT'
          ? 'walletDebitBody'
          : 'walletCreditBody',
      values,
    );
  }
  return notification.body;
}

String _notificationTime(Locale locale, DateTime createdAt) {
  final local = createdAt.toLocal();
  final difference = DateTime.now().difference(local);
  if (!difference.isNegative && difference.inMinutes < 1) {
    return _notificationText(locale, 'justNow');
  }
  if (!difference.isNegative && difference.inHours < 1) {
    return _notificationTextWith(
      locale,
      'minutesAgo',
      {'value': difference.inMinutes},
    );
  }
  if (!difference.isNegative && difference.inDays < 1) {
    return _notificationTextWith(
      locale,
      'hoursAgo',
      {'value': difference.inHours},
    );
  }
  if (!difference.isNegative && difference.inDays < 7) {
    return _notificationTextWith(
      locale,
      'daysAgo',
      {'value': difference.inDays},
    );
  }
  return '${_two(local.day)}/${_two(local.month)}/${local.year}';
}

String _two(int value) => value.toString().padLeft(2, '0');

String _notificationText(Locale locale, String key) {
  final language = _notificationCopy.containsKey(locale.languageCode)
      ? locale.languageCode
      : 'vi';
  return _notificationCopy[language]?[key] ??
      _notificationCopy['vi']![key] ??
      key;
}

String _notificationTextWith(
  Locale locale,
  String key,
  Map<String, Object?> values,
) {
  var text = _notificationText(locale, key);
  for (final entry in values.entries) {
    text = text.replaceAll('{${entry.key}}', '${entry.value ?? ''}');
  }
  return text;
}

const _notificationCopy = <String, Map<String, String>>{
  'vi': {
    'title': 'Thông báo',
    'loadError': 'Không thể tải thông báo. Kéo xuống để thử lại.',
    'markReadError': 'Không thể đánh dấu thông báo là đã đọc.',
    'empty': 'Chưa có thông báo.',
    'loadMore': 'Xem thêm',
    'referralTitle': 'Đã nhận thưởng giới thiệu',
    'referralBody': '{amount} {currency} đã được cộng vào ví HANDS của bạn.',
    'walletCreditTitle': 'Đã cộng tiền vào ví',
    'walletDebitTitle': 'Đã trừ tiền khỏi ví',
    'walletCreditBody':
        '{amount} {currency} đã được cộng vào ví HANDS của bạn.',
    'walletDebitBody': '{amount} {currency} đã được trừ khỏi ví HANDS của bạn.',
    'justNow': 'Vừa xong',
    'minutesAgo': '{value} phút trước',
    'hoursAgo': '{value} giờ trước',
    'daysAgo': '{value} ngày trước',
  },
  'en': {
    'title': 'Notifications',
    'loadError': 'Notifications could not be loaded. Pull down to retry.',
    'markReadError': 'This notification could not be marked as read.',
    'empty': 'No notifications yet.',
    'loadMore': 'Load more',
    'referralTitle': 'Referral reward added',
    'referralBody': '{amount} {currency} was added to your HANDS wallet.',
    'walletCreditTitle': 'Wallet credited',
    'walletDebitTitle': 'Wallet debited',
    'walletCreditBody': '{amount} {currency} was added to your HANDS wallet.',
    'walletDebitBody':
        '{amount} {currency} was deducted from your HANDS wallet.',
    'justNow': 'Just now',
    'minutesAgo': '{value} min ago',
    'hoursAgo': '{value} hr ago',
    'daysAgo': '{value} day(s) ago',
  },
  'ko': {
    'title': '알림',
    'loadError': '알림을 불러오지 못했습니다. 아래로 당겨 다시 시도해 주세요.',
    'markReadError': '알림을 읽음 처리하지 못했습니다.',
    'empty': '아직 알림이 없습니다.',
    'loadMore': '더 보기',
    'referralTitle': '추천 보상이 적립되었습니다',
    'referralBody': '{amount} {currency}가 HANDS 월렛에 적립되었습니다.',
    'walletCreditTitle': '월렛 입금',
    'walletDebitTitle': '월렛 출금',
    'walletCreditBody': '{amount} {currency}가 HANDS 월렛에 입금되었습니다.',
    'walletDebitBody': '{amount} {currency}가 HANDS 월렛에서 출금되었습니다.',
    'justNow': '방금 전',
    'minutesAgo': '{value}분 전',
    'hoursAgo': '{value}시간 전',
    'daysAgo': '{value}일 전',
  },
  'ja': {
    'title': '通知',
    'loadError': '通知を読み込めませんでした。下に引いて再試行してください。',
    'markReadError': '通知を既読にできませんでした。',
    'empty': '通知はまだありません。',
    'loadMore': 'さらに表示',
    'referralTitle': '紹介特典が追加されました',
    'referralBody': '{amount} {currency}がHANDSウォレットに追加されました。',
    'walletCreditTitle': 'ウォレット入金',
    'walletDebitTitle': 'ウォレット出金',
    'walletCreditBody': '{amount} {currency}がHANDSウォレットに追加されました。',
    'walletDebitBody': '{amount} {currency}がHANDSウォレットから差し引かれました。',
    'justNow': 'たった今',
    'minutesAgo': '{value}分前',
    'hoursAgo': '{value}時間前',
    'daysAgo': '{value}日前',
  },
  'zh': {
    'title': '通知',
    'loadError': '无法加载通知。下拉重试。',
    'markReadError': '无法将通知标记为已读。',
    'empty': '暂无通知。',
    'loadMore': '查看更多',
    'referralTitle': '推荐奖励已到账',
    'referralBody': '{amount} {currency} 已存入您的 HANDS 钱包。',
    'walletCreditTitle': '钱包入账',
    'walletDebitTitle': '钱包扣款',
    'walletCreditBody': '{amount} {currency} 已存入您的 HANDS 钱包。',
    'walletDebitBody': '{amount} {currency} 已从您的 HANDS 钱包扣除。',
    'justNow': '刚刚',
    'minutesAgo': '{value}分钟前',
    'hoursAgo': '{value}小时前',
    'daysAgo': '{value}天前',
  },
};
