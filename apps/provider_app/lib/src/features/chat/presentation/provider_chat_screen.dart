import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/provider_value_helpers.dart';
import '../../../core/realtime_socket.dart';
import '../../booking/presentation/provider_request_guidance_helpers.dart';
import '../../map/presentation/provider_location_preview.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  late final RealtimeSocket _socket;
  final messageController = TextEditingController();
  List<dynamic> messages = [];
  String? chatRoomId;
  String? bookingId;
  String? statusMessage;
  String? error;
  double? customerLat;
  double? customerLng;
  double? lastSharedLat;
  double? lastSharedLng;
  DateTime? lastSharedAt;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
  }

  @override
  void dispose() {
    _socket.offEvent('chat.message.created');
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
        statusMessage = 'New customer message received.';
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
        await ref.read(authControllerProvider.notifier).signInDemoProvider();
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

  Future<void> loadLatestChat() async {
    final bookings = await ref.read(providerRepositoryProvider).listBookings();
    final bookingWithChat = bookings.map(asMap).firstWhere(
          (item) => isProviderAppChatVisible(item),
          orElse: () => null,
        );
    final latestBooking = bookings.isNotEmpty ? asMap(bookings.first) : null;
    final booking = bookingWithChat ?? latestBooking;
    final room = asMap(bookingWithChat?['chatRoom']);
    if (room == null) {
      final status = booking?['status']?.toString();
      final preferredProvider = asMap(booking?['preferredProvider']);
      final selectedProvider = asMap(booking?['selectedProvider']);
      final selectedProviderId = selectedProvider?['id']?.toString();
      final preferredProviderId = preferredProvider?['id']?.toString();
      final myProviderId = ref
          .read(authControllerProvider)
          ?.user['providerProfile']?['id']
          ?.toString();
      final isPreferredRequest =
          myProviderId != null && preferredProviderId == myProviderId;
      final isFinalProvider =
          myProviderId != null && selectedProviderId == myProviderId;
      final nextMessage = switch (status) {
        'OPEN_MATCHING' => isPreferredRequest
            ? 'You were picked first. Accept the request from Requests to move this booking forward.'
            : 'No chat yet. Join or stay visible in Requests until the guest picks you.',
        'MATCHED' => isFinalProvider
            ? 'The guest picked you. Chat should be ready now; refresh Requests if it is not visible.'
            : 'A partner was selected already, so this chat room is not yours.',
        'IN_SERVICE' =>
          'Service is already in progress. Reload chat to join the live room.',
        'COMPLETED' =>
          'Service complete. Chat is archived for admin records and no longer shown in the app.',
        'CANCELLED' ||
        'EXPIRED' ||
        'REFUNDED' =>
          'This booking is closed. Chat is archived for admin records.',
        _ => 'No selected booking chat yet.',
      };
      setState(() => statusMessage = nextMessage);
      return;
    }

    final roomId = room['id']?.toString();
    if (roomId == null || roomId.isEmpty) {
      setState(() => statusMessage = 'Chat room is not ready yet.');
      return;
    }
    ref.read(providerRepositoryProvider).joinChat(roomId);
    final loadedMessages =
        await ref.read(providerRepositoryProvider).listChatMessages(roomId);
    setState(() {
      chatRoomId = roomId;
      bookingId = booking?['id']?.toString();
      customerLat = asNum(booking?['lat'])?.toDouble();
      customerLng = asNum(booking?['lng'])?.toDouble();
      messages = loadedMessages;
      statusMessage = 'Chat is ready for booking ${booking?['id']}.';
    });
    attachChatListener();
  }

  Future<void> sendMessage() async {
    final roomId = chatRoomId;
    final text = messageController.text.trim();
    if (roomId == null || text.isEmpty) {
      return;
    }
    messageController.clear();
    ref.read(providerRepositoryProvider).sendChatMessage(roomId, text);
  }

  Future<void> shareLocation() async {
    final activeBookingId = bookingId;
    if (activeBookingId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final location = await ref
          .read(providerRepositoryProvider)
          .updateLocation(bookingId: activeBookingId);
      setState(() {
        lastSharedLat = asNum(location['lat'])?.toDouble();
        lastSharedLng = asNum(location['lng'])?.toDouble();
        lastSharedAt = DateTime.now();
        statusMessage =
            'Your current location was shared with the customer at ${formatCoordinate(lastSharedLat)} / ${formatCoordinate(lastSharedLng)}.';
      });
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
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
                ? 'Login to load your latest service chat.'
                : 'Realtime messages with the customer for matched bookings.',
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
            InfoCard(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorCard(text: error!),
          ],
          const SizedBox(height: 16),
          if (chatRoomId == null)
            const InfoCard(
                text:
                    'Chat opens after the guest confirms you. Completed or closed booking chats are archived for admin records.')
          else ...[
            Text('Room $chatRoomId',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ProviderLocationPreviewCard(
              customerLatitude: customerLat,
              customerLongitude: customerLng,
              latitude: lastSharedLat,
              longitude: lastSharedLng,
              lastSharedAt: lastSharedAt,
            ),
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              onPressed: loading ? null : shareLocation,
              icon: const Icon(Icons.my_location_outlined),
              label: const Text('Share current location'),
            ),
            const SizedBox(height: 8),
            if (messages.isEmpty)
              const InfoCard(
                  text:
                      'No messages yet. The first message will appear here as soon as either side sends one.')
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
