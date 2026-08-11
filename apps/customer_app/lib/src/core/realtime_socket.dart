import 'package:socket_io_client/socket_io_client.dart' as io;

class RealtimeSocket {
  RealtimeSocket({required this.baseUrl});

  final String baseUrl;
  io.Socket? _socket;
  final Set<String> _bookingRooms = {};
  final Set<String> _chatRooms = {};
  final Map<String, Set<void Function(dynamic payload)>> _handlers = {};
  final Map<String, void Function(dynamic payload)> _dispatchers = {};

  bool get connected => _socket?.connected ?? false;
  Set<String> get joinedBookingRooms => Set.unmodifiable(_bookingRooms);
  Set<String> get joinedChatRooms => Set.unmodifiable(_chatRooms);

  void connect(String accessToken) {
    _socket?.dispose();
    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': accessToken})
          .disableAutoConnect()
          .build(),
    );
    _socket!.onConnect((_) => _rejoinRooms());
    for (final entry in _dispatchers.entries) {
      _socket!.on(entry.key, entry.value);
    }
    _socket!.connect();
  }

  void joinBooking(String bookingId) {
    _bookingRooms.add(bookingId);
    if (connected) {
      _socket!.emit('booking.join_room', {'bookingId': bookingId});
    }
  }

  void leaveBooking(String bookingId) {
    _bookingRooms.remove(bookingId);
  }

  void joinChat(String chatRoomId) {
    _chatRooms.add(chatRoomId);
    if (connected) {
      _socket!.emit('chat.join_room', {'chatRoomId': chatRoomId});
    }
  }

  void leaveChat(String chatRoomId) {
    _chatRooms.remove(chatRoomId);
  }

  void sendChatMessage(String chatRoomId, String text) {
    _socket
        ?.emit('chat.message.create', {'chatRoomId': chatRoomId, 'text': text});
  }

  void Function() onEvent(
      String event, void Function(dynamic payload) handler) {
    final handlers = _handlers.putIfAbsent(event, () => {});
    handlers.add(handler);
    if (!_dispatchers.containsKey(event)) {
      void dispatcher(dynamic payload) {
        for (final listener
            in List<void Function(dynamic)>.of(_handlers[event] ?? const {})) {
          listener(payload);
        }
      }

      _dispatchers[event] = dispatcher;
      _socket?.on(event, dispatcher);
    }
    return () => _removeEventHandler(event, handler);
  }

  void offEvent(String event) {
    _handlers.remove(event);
    final dispatcher = _dispatchers.remove(event);
    if (dispatcher != null) {
      _socket?.off(event, dispatcher);
    }
  }

  int listenerCount(String event) => _handlers[event]?.length ?? 0;

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _bookingRooms.clear();
    _chatRooms.clear();
    _handlers.clear();
    _dispatchers.clear();
  }

  void _rejoinRooms() {
    for (final bookingId in _bookingRooms) {
      _socket?.emit('booking.join_room', {'bookingId': bookingId});
    }
    for (final chatRoomId in _chatRooms) {
      _socket?.emit('chat.join_room', {'chatRoomId': chatRoomId});
    }
  }

  void _removeEventHandler(
      String event, void Function(dynamic payload) handler) {
    final handlers = _handlers[event];
    handlers?.remove(handler);
    if (handlers != null && handlers.isEmpty) {
      offEvent(event);
    }
  }
}
