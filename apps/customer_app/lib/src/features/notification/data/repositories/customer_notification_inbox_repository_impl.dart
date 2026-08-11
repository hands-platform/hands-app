import '../../domain/entities/customer_app_notification.dart';
import '../../domain/repositories/customer_notification_inbox_repository.dart';
import '../datasources/notification_remote_datasource.dart';

class CustomerNotificationInboxRepositoryImpl
    implements CustomerNotificationInboxRepository {
  const CustomerNotificationInboxRepositoryImpl(this._remoteDataSource);

  final NotificationRemoteDataSource _remoteDataSource;

  @override
  Future<CustomerNotificationInboxPage> list({
    String? cursor,
    int take = 20,
  }) async {
    final result = await _remoteDataSource.listCustomerInbox(
      cursor: cursor,
      take: take,
    );
    final rawRows = result['rows'];
    final pagination = result['pagination'];
    return CustomerNotificationInboxPage(
      rows: rawRows is List
          ? rawRows
              .whereType<Map<String, dynamic>>()
              .map(CustomerAppNotification.fromJson)
              .where((item) => item.id.isNotEmpty)
              .toList(growable: false)
          : const [],
      nextCursor: pagination is Map<String, dynamic>
          ? pagination['nextCursor']?.toString()
          : null,
      unreadCount: (result['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<void> markRead(String notificationId) {
    return _remoteDataSource.markRead(notificationId);
  }
}
