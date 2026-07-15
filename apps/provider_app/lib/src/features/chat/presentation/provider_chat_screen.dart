import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/provider_value_helpers.dart';
import '../../../core/realtime_socket.dart';
import '../../booking/presentation/provider_request_guidance_helpers.dart';
import '../../map/presentation/provider_location_preview.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_chat_location_helpers.dart';

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
  String? chatRoomId;
  String? bookingId;
  String? statusMessage;
  String? error;
  double? customerLat;
  double? customerLng;
  double? lastSharedLat;
  double? lastSharedLng;
  DateTime? lastSharedAt;
  Map<String, dynamic>? currentBooking;
  bool loading = false;
  bool startSubmitting = false;
  bool cancellationSubmitting = false;
  bool completionSubmitting = false;

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
      setState(() => error = providerAppErrorMessage(exception));
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
        setState(() => error = providerAppErrorMessage(exception));
      }
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
    ref.read(providerRepositoryProvider).joinChat(roomId);
    final bookingContext = booking ?? await _findBookingById(bookingId);
    final loadedMessages =
        await ref.read(providerRepositoryProvider).listChatMessages(roomId);
    setState(() {
      chatRoomId = roomId;
      this.bookingId = bookingId ?? bookingContext?['id']?.toString();
      currentBooking = bookingContext;
      customerLat = providerChatCustomerLatitude(bookingContext);
      customerLng = providerChatCustomerLongitude(bookingContext);
      messages = loadedMessages;
      statusMessage = this.bookingId == null
          ? 'Chat is ready.'
          : 'Chat is ready for booking ${this.bookingId}.';
    });
    final activeBookingId = this.bookingId;
    final bookingStatus = bookingContext?['status']?.toString();
    if (activeBookingId != null &&
        {
          'MATCHED',
          'PROVIDER_ON_THE_WAY',
          'ARRIVED',
          'IN_SERVICE',
        }.contains(bookingStatus)) {
      await ref.read(providerLocationHeartbeatProvider).startActiveBooking(
            activeBookingId,
            runImmediately: false,
          );
    }
    attachChatListener();
  }

  Future<Map<String, dynamic>?> _findBookingById(String? bookingId) async {
    if (bookingId == null || bookingId.isEmpty) {
      return null;
    }

    final bookings = await ref.read(providerRepositoryProvider).listBookings();
    for (final booking in bookings) {
      final bookingMap = asMap(booking);
      if (bookingMap?['id']?.toString() == bookingId) {
        return bookingMap;
      }
    }
    return null;
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

  Future<void> requestPostMatchCancellation() async {
    final activeBookingId = bookingId;
    if (activeBookingId == null || !isPostMatchCancellationAvailable) {
      return;
    }

    final note = await _showCancellationReasonDialog();
    if (note == null || note.isEmpty) {
      return;
    }

    setState(() {
      cancellationSubmitting = true;
      error = null;
      statusMessage = null;
    });
    try {
      Map<String, dynamic>? actionLocation;
      try {
        actionLocation =
            await ref.read(providerRepositoryProvider).updateLocation(
                  bookingId: activeBookingId,
                  includeAddressText: true,
                );
      } catch (exception) {
        setState(() => error = providerAppErrorMessage(exception));
        return;
      }
      final lat = _actionLocationLat(actionLocation);
      final lng = _actionLocationLng(actionLocation);
      if (lat == null || lng == null) {
        setState(() => error =
            'Current location is required before cancelling this booking. Enable location and try again.');
        return;
      }
      ref.read(providerLocationHeartbeatProvider).recordSuccessfulUpdate(
            interval: ProviderLocationHeartbeat.activeBookingInterval,
            bookingId: activeBookingId,
          );
      final result = await ref.read(providerRepositoryProvider).cancelBooking(
            activeBookingId,
            note: note,
            lat: lat,
            lng: lng,
            addressText: _actionAddressText(actionLocation),
          );
      final cancellation = asMap(result['postMatchCancellation']);
      final autoApproved = cancellation?['autoApproved'] == true;
      final adminReviewRequired =
          cancellation?['adminReviewRequired'] == true || !autoApproved;
      final nextStatusMessage = autoApproved
          ? 'Cancellation approved automatically. This booking is now closed.'
          : adminReviewRequired
              ? 'Cancellation sent to HANDS operations for review. The chat and your note will stay available for admin review.'
              : 'Cancellation request sent.';
      setState(() {
        currentBooking = {
          ...?currentBooking,
          'id': activeBookingId,
          'status': 'CANCELLED',
        };
        statusMessage = nextStatusMessage;
      });
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      await heartbeat.start(runImmediately: false);
      heartbeat.recordSuccessfulUpdate();
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => cancellationSubmitting = false);
      }
    }
  }

  Future<void> completeService() async {
    final activeBookingId = bookingId;
    if (activeBookingId == null || !isServiceCompletionAvailable) {
      return;
    }

    setState(() {
      completionSubmitting = true;
      error = null;
      statusMessage = null;
    });
    try {
      Map<String, dynamic>? actionLocation;
      try {
        actionLocation =
            await ref.read(providerRepositoryProvider).updateLocation(
                  bookingId: activeBookingId,
                  includeAddressText: true,
                );
      } catch (exception) {
        setState(() => error = providerAppErrorMessage(exception));
        return;
      }
      final lat = _actionLocationLat(actionLocation);
      final lng = _actionLocationLng(actionLocation);
      if (lat == null || lng == null) {
        setState(() => error =
            'Current location is required before completing this booking. Enable location and try again.');
        return;
      }
      ref.read(providerLocationHeartbeatProvider).recordSuccessfulUpdate(
            interval: ProviderLocationHeartbeat.activeBookingInterval,
            bookingId: activeBookingId,
          );
      await ref.read(providerRepositoryProvider).completeBooking(
            activeBookingId,
            lat: lat,
            lng: lng,
            addressText: _actionAddressText(actionLocation),
          );
      const nextStatusMessage =
          'Service completed. HANDS operations can now review the final booking record.';
      setState(() {
        currentBooking = {
          ...?currentBooking,
          'id': activeBookingId,
          'status': 'COMPLETED',
        };
        statusMessage = nextStatusMessage;
      });
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      await heartbeat.start(runImmediately: false);
      heartbeat.recordSuccessfulUpdate();
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => completionSubmitting = false);
      }
    }
  }

  Future<void> startService() async {
    final activeBookingId = bookingId;
    if (activeBookingId == null || !isServiceStartAvailable) {
      return;
    }

    setState(() {
      startSubmitting = true;
      error = null;
      statusMessage = null;
    });
    try {
      await ref.read(providerRepositoryProvider).startBooking(activeBookingId);
      setState(() {
        currentBooking = {
          ...?currentBooking,
          'id': activeBookingId,
          'status': 'IN_SERVICE',
        };
        statusMessage =
            'Service started. Complete it here when the appointment ends.';
      });
      await ref.read(providerLocationHeartbeatProvider).startActiveBooking(
            activeBookingId,
            runImmediately: false,
          );
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => startSubmitting = false);
      }
    }
  }

  bool get isServiceStartAvailable {
    return bookingId != null &&
        currentBooking?['status']?.toString() == 'MATCHED';
  }

  bool get isPostMatchCancellationAvailable {
    final status = currentBooking?['status']?.toString();
    return bookingId != null &&
        {
          'MATCHED',
          'PROVIDER_ON_THE_WAY',
          'ARRIVED',
          'IN_SERVICE',
        }.contains(status);
  }

  bool get isServiceCompletionAvailable {
    return bookingId != null &&
        currentBooking?['status']?.toString() == 'IN_SERVICE';
  }

  Future<String?> _showCancellationReasonDialog() async {
    return showDialog<String>(
      context: context,
      builder: (_) => const _CancellationReasonDialog(),
    );
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
      ref.read(providerLocationHeartbeatProvider).recordSuccessfulUpdate(
            interval: ProviderLocationHeartbeat.activeBookingInterval,
            bookingId: activeBookingId,
          );
      setState(() {
        lastSharedLat = _actionLocationLat(location);
        lastSharedLng = _actionLocationLng(location);
        lastSharedAt = DateTime.now();
        statusMessage =
            'Your current location was shared with the customer at ${formatCoordinate(lastSharedLat)} / ${formatCoordinate(lastSharedLng)}.';
      });
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
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
            ProviderErrorCard(text: error!),
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
            if (isServiceStartAvailable) ...[
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: startSubmitting ||
                        completionSubmitting ||
                        cancellationSubmitting ||
                        loading
                    ? null
                    : startService,
                icon: startSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.play_arrow_outlined),
                label: const Text('Start service'),
              ),
            ],
            if (isServiceCompletionAvailable) ...[
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: startSubmitting ||
                        completionSubmitting ||
                        cancellationSubmitting ||
                        loading
                    ? null
                    : completeService,
                icon: completionSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Complete service'),
              ),
            ],
            if (isPostMatchCancellationAvailable) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: startSubmitting ||
                        cancellationSubmitting ||
                        completionSubmitting ||
                        loading
                    ? null
                    : requestPostMatchCancellation,
                icon: cancellationSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cancel_schedule_send_outlined),
                label: const Text('Cancel this booking'),
              ),
            ],
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

double? _actionLocationLat(Map<String, dynamic>? location) {
  return asNum(location?['lat'] ?? location?['latitude'])?.toDouble();
}

double? _actionLocationLng(Map<String, dynamic>? location) {
  return asNum(location?['lng'] ?? location?['longitude'])?.toDouble();
}

String? _actionAddressText(Map<String, dynamic>? location) {
  final addressText = location?['addressText']?.toString().trim();
  if (addressText == null || addressText.isEmpty) {
    return null;
  }
  return addressText;
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

class _CancellationReasonDialog extends StatefulWidget {
  const _CancellationReasonDialog();

  @override
  State<_CancellationReasonDialog> createState() =>
      _CancellationReasonDialogState();
}

class _CancellationReasonDialogState extends State<_CancellationReasonDialog> {
  final controller = TextEditingController();
  String? validationMessage;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancel this booking?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Add a clear reason. HANDS operations may review this chat before restoring any affected commission.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: 'Cancellation reason',
              errorText: validationMessage,
            ),
            minLines: 2,
            maxLines: 4,
            maxLength: 1000,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Keep booking'),
        ),
        FilledButton(
          onPressed: () {
            final note = controller.text.trim();
            if (note.isEmpty) {
              setState(() {
                validationMessage = 'Write the reason before cancelling.';
              });
              return;
            }
            Navigator.of(context).pop(note);
          },
          child: const Text('Send cancellation'),
        ),
      ],
    );
  }
}
