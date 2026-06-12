import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/realtime_socket.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    this.initialChatRoomId,
    this.initialBookingId,
  });

  final String? initialChatRoomId;
  final String? initialBookingId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  late final RealtimeSocket _socket;
  final messageController = TextEditingController();
  List<dynamic> messages = [];
  Map<String, dynamic>? activeBooking;
  Map<String, dynamic>? latestProviderLocation;
  String? chatRoomId;
  String? statusMessage;
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final initialRoomId = widget.initialChatRoomId;
      if (initialRoomId != null && initialRoomId.isNotEmpty) {
        unawaited(openInitialChatRoom(
          initialRoomId,
          bookingId: widget.initialBookingId,
        ));
      }
    });
  }

  @override
  void dispose() {
    _socket.offEvent('chat.message.created');
    _socket.offEvent('provider.location.updated');
    messageController.dispose();
    super.dispose();
  }

  void attachChatListener() {
    _socket.offEvent('chat.message.created');
    _socket.onEvent('chat.message.created', (payload) {
      if (!mounted || payload is! Map || payload['chatRoomId'] != chatRoomId) {
        return;
      }
      setState(() {
        messages = [...messages, payload];
        statusMessage = 'New message received.';
      });
    });
  }

  void attachLocationListener(String? bookingId) {
    _socket.offEvent('provider.location.updated');
    if (bookingId == null || bookingId.isEmpty) {
      return;
    }
    ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    _socket.onEvent('provider.location.updated', (payload) {
      if (!mounted ||
          payload is! Map ||
          payload['bookingId']?.toString() != bookingId) {
        return;
      }
      setState(() {
        latestProviderLocation =
            Map<String, dynamic>.from(payload.cast<String, dynamic>());
        statusMessage = 'Partner location updated.';
      });
    });
  }

  Future<void> signInAndLoadChat() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (ref.read(authControllerProvider) == null) {
        await ref.read(authControllerProvider.notifier).signInDemoCustomer();
      }
      await loadLatestChat();
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> openInitialChatRoom(
    String roomId, {
    String? bookingId,
  }) async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      final authController = ref.read(authControllerProvider.notifier);
      final session = ref.read(authControllerProvider) ??
          await authController.restoreSession();
      if (!mounted) {
        return;
      }
      if (session == null) {
        setState(() => statusMessage = 'Login to load this chat.');
        return;
      }

      await loadChatRoom(roomId, bookingId: bookingId);
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadLatestChat() async {
    final bookings = await ref.read(customerRepositoryProvider).listBookings();
    final bookingWithChat = bookings.map(asMap).firstWhere(
          (item) => isCustomerAppChatVisible(item),
          orElse: () => null,
        );
    final latestBooking = bookings.isNotEmpty ? asMap(bookings.first) : null;
    final booking = bookingWithChat ?? latestBooking;
    final room = asMap(bookingWithChat?['chatRoom']);
    if (room == null) {
      final status = booking?['status']?.toString();
      final providerName = providerDisplayName(booking);
      final nextMessage = switch (status) {
        'OPEN_MATCHING' =>
          '$providerName has not been locked in yet. Stay on the waiting screen until a partner is selected.',
        'MATCHED' =>
          '$providerName is confirmed. Chat should be ready now; refresh bookings if it is not visible.',
        'PROVIDER_ON_THE_WAY' =>
          '$providerName is on the way. Chat should already be ready for location details.',
        'IN_SERVICE' =>
          'The service is already in progress. Reload chat to join the live room.',
        'COMPLETED' =>
          'Service is complete. Chat is archived for admin records and no longer shown in the app.',
        'CANCELLED' ||
        'EXPIRED' ||
        'REFUNDED' =>
          'This booking is closed. Chat is archived for admin records.',
        _ => 'No matched booking chat yet. Wait until a partner is selected.',
      };
      setState(() => statusMessage = nextMessage);
      return;
    }

    final roomId = room['id']?.toString();
    if (roomId == null || roomId.isEmpty) {
      setState(() => statusMessage = 'Chat room is not ready yet.');
      return;
    }
    await loadChatRoom(
      roomId,
      bookingId: booking?['id']?.toString(),
      booking: booking,
    );
  }

  Future<void> loadChatRoom(
    String roomId, {
    String? bookingId,
    Map<String, dynamic>? booking,
  }) async {
    ref.read(customerRepositoryProvider).joinChat(roomId);
    final bookingContext = booking ??
        (bookingId == null
            ? null
            : await ref.read(customerRepositoryProvider).getBooking(bookingId));
    final loadedMessages =
        await ref.read(customerRepositoryProvider).listChatMessages(roomId);
    setState(() {
      chatRoomId = roomId;
      activeBooking = bookingContext;
      latestProviderLocation = null;
      messages = loadedMessages;
      statusMessage = bookingId == null
          ? 'Chat is ready.'
          : 'Chat is ready for booking $bookingId.';
    });
    attachChatListener();
    attachLocationListener(bookingId);
  }

  Future<void> sendMessage() async {
    final roomId = chatRoomId;
    final text = messageController.text.trim();
    if (roomId == null || text.isEmpty) {
      return;
    }
    messageController.clear();
    ref.read(customerRepositoryProvider).sendChatMessage(roomId, text);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Chat', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Login to load the latest booking chat.'
                : 'Realtime messages with your assigned partner.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: loading ? null : signInAndLoadChat,
            icon: const Icon(Icons.chat_bubble_outline),
            label:
                Text(chatRoomId == null ? 'Open latest chat' : 'Refresh chat'),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (statusMessage != null) ...[
            const SizedBox(height: 12),
            EmptyPanel(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          const SizedBox(height: 16),
          if (chatRoomId == null)
            const EmptyPanel(
                text:
                    'Chat opens after a partner is selected. Completed or closed booking chats are archived for admin records.')
          else ...[
            Text('Room $chatRoomId',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            BookingSectionCard(
              title: 'Live service location',
              child: LiveLocationDetails(
                customerPoint: deriveBookingLatLng(activeBooking),
                providerLocation: latestProviderLocation,
                emptyText:
                    'Partner location appears here after the partner shares their current pin.',
              ),
            ),
            const SizedBox(height: 12),
            if (messages.isEmpty)
              const EmptyPanel(
                  text:
                      'No messages yet. Send the first message when you are ready.')
            else
              for (final message in messages)
                if (asMap(message) != null)
                  MessageTile(message: asMap(message)!),
            const SizedBox(height: 12),
            TextField(
              controller: messageController,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Message',
              ),
              minLines: 1,
              maxLines: 3,
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: sendMessage,
              icon: const Icon(Icons.send_outlined),
              label: const Text('Send'),
            ),
          ],
        ],
      ),
    );
  }
}

class MessageTile extends StatelessWidget {
  const MessageTile({super.key, required this.message});

  final Map<String, dynamic> message;

  @override
  Widget build(BuildContext context) {
    final sender = asMap(message['sender']);
    return Card(
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.person_outline)),
        title: Text(message['body']?.toString() ?? ''),
        subtitle: Text(sender?['fullName']?.toString() ?? 'Sender'),
      ),
    );
  }
}
