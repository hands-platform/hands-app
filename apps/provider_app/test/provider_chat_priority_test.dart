import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/chat/presentation/provider_chat_priority.dart';

void main() {
  test('selects the most operationally active visible chat', () {
    final selected = selectProviderPriorityChatBooking([
      {
        'id': 'matched-newer',
        'status': 'MATCHED',
        'updatedAt': '2026-07-24T03:00:00.000Z',
        'chatRoom': {'id': 'chat-matched'},
      },
      {
        'id': 'in-service-older',
        'status': 'IN_SERVICE',
        'updatedAt': '2026-07-24T01:00:00.000Z',
        'chatRoom': {'id': 'chat-live'},
      },
      {
        'id': 'completed-newest',
        'status': 'COMPLETED',
        'updatedAt': '2026-07-24T04:00:00.000Z',
        'chatRoom': {'id': 'chat-archive'},
      },
    ]);

    expect(selected?['id'], 'in-service-older');
  });

  test('uses the newest chat when active statuses have equal priority', () {
    final selected = selectProviderPriorityChatBooking([
      {
        'id': 'matched-older',
        'status': 'MATCHED',
        'updatedAt': '2026-07-24T01:00:00.000Z',
        'chatRoom': {'id': 'chat-1'},
      },
      {
        'id': 'matched-newer',
        'status': 'MATCHED',
        'updatedAt': '2026-07-24T02:00:00.000Z',
        'chatRoom': {'id': 'chat-2'},
      },
    ]);

    expect(selected?['id'], 'matched-newer');
  });

  test('returns every active chat in operational priority order', () {
    final chats = providerActiveChatBookings([
      {
        'id': 'matched',
        'status': 'MATCHED',
        'updatedAt': '2026-07-24T03:00:00.000Z',
        'chatRoom': {'id': 'chat-matched'},
      },
      {
        'id': 'missing-room',
        'status': 'IN_SERVICE',
        'updatedAt': '2026-07-24T04:00:00.000Z',
      },
      {
        'id': 'arrived',
        'status': 'ARRIVED',
        'updatedAt': '2026-07-24T02:00:00.000Z',
        'chatRoom': {'id': 'chat-arrived'},
      },
      {
        'id': 'in-service',
        'status': 'IN_SERVICE',
        'updatedAt': '2026-07-24T01:00:00.000Z',
        'chatRoom': {'id': 'chat-live'},
      },
    ]);

    expect(
      chats.map((booking) => booking['id']),
      ['in-service', 'arrived', 'matched'],
    );
  });

  test('normalizes invalid unread summary values to zero', () {
    expect(providerUnreadChatCount({'unreadCount': 4}), 4);
    expect(providerUnreadChatCount({'unreadCount': -2}), 0);
    expect(providerUnreadChatCount({'unreadCount': '4'}), 0);
    expect(providerUnreadChatCount(null), 0);
  });

  test('normalizes positive room unread counts and ignores invalid rows', () {
    expect(
      providerRoomUnreadCounts({
        'rooms': [
          {'chatRoomId': 'chat-1', 'unreadCount': 3},
          {'chatRoomId': 'chat-2', 'unreadCount': 0},
          {'chatRoomId': '', 'unreadCount': 2},
          {'chatRoomId': 'chat-3', 'unreadCount': '4'},
        ],
      }),
      {'chat-1': 3},
    );
  });
}
