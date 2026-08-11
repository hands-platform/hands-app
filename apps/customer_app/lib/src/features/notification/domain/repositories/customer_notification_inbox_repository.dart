import '../entities/customer_app_notification.dart';

abstract class CustomerNotificationInboxRepository {
  Future<CustomerNotificationInboxPage> list({
    String? cursor,
    int take = 20,
  });

  Future<void> markRead(String notificationId);
}
