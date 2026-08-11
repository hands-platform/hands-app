import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:flutter_test/flutter_test.dart';

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

    final disposeFirst = socket.onEvent('booking.matched', (_) {});
    final disposeSecond = socket.onEvent('booking.matched', (_) {});

    expect(socket.listenerCount('booking.matched'), 2);
    disposeFirst();
    expect(socket.listenerCount('booking.matched'), 1);
    disposeSecond();
    expect(socket.listenerCount('booking.matched'), 0);
    socket.dispose();
  });
}
