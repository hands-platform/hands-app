import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/realtime_socket.dart';

void main() {
  test('keeps only active booking and chat rooms for reconnect', () {
    final socket = RealtimeSocket(baseUrl: 'http://socket.test');

    socket.joinBooking('booking-1');
    socket.joinBooking('booking-2');
    socket.leaveBooking('booking-1');
    socket.joinChat('chat-1');
    socket.leaveChat('chat-1');

    expect(socket.joinedBookingRooms, {'booking-2'});
    expect(socket.joinedChatRooms, isEmpty);
    socket.dispose();
  });

  test('removes only the listener owned by its disposer', () {
    final socket = RealtimeSocket(baseUrl: 'http://socket.test');

    final disposeFirst = socket.onEvent('booking.expired', (_) {});
    final disposeSecond = socket.onEvent('booking.expired', (_) {});

    expect(socket.listenerCount('booking.expired'), 2);
    disposeFirst();
    expect(socket.listenerCount('booking.expired'), 1);
    disposeSecond();
    expect(socket.listenerCount('booking.expired'), 0);
    socket.dispose();
  });
}
