class CustomerAppNotification {
  const CustomerAppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.data = const {},
    this.readAt,
  });

  factory CustomerAppNotification.fromJson(Map<String, dynamic> json) {
    return CustomerAppNotification(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      body: json['body']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      data: json['data'] is Map
          ? Map<String, dynamic>.from(json['data'] as Map)
          : const {},
      readAt: DateTime.tryParse(json['readAt']?.toString() ?? ''),
    );
  }

  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;
  final Map<String, dynamic> data;
  final DateTime? readAt;

  CustomerAppNotification markRead([DateTime? at]) {
    return CustomerAppNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      createdAt: createdAt,
      data: data,
      readAt: at ?? DateTime.now(),
    );
  }
}

class CustomerNotificationInboxPage {
  const CustomerNotificationInboxPage({
    required this.rows,
    required this.nextCursor,
    this.unreadCount = 0,
  });

  final List<CustomerAppNotification> rows;
  final String? nextCursor;
  final int unreadCount;
}
