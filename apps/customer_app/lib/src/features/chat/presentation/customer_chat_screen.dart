import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app_state.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/realtime_socket.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';

const _bookingLifecycleEventMessages = <String, String>{
  'booking.matched': 'Your partner confirmed. Chat and service are now active.',
  'provider.arrived': 'Your partner has arrived at the service address.',
  'service.started': 'Your service has started.',
  'service.completed': 'Your service is complete.',
  'booking.expired': 'This booking is no longer active.',
  'booking.cancelled': 'This booking was cancelled.',
};

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

class _ChatScreenState extends ConsumerState<ChatScreen>
    with WidgetsBindingObserver {
  late final RealtimeSocket _socket;
  final _imagePicker = ImagePicker();
  final messageController = TextEditingController();
  List<dynamic> messages = [];
  Map<String, dynamic>? activeBooking;
  Map<String, dynamic>? latestProviderLocation;
  String? chatRoomId;
  String? statusMessage;
  String? error;
  bool loading = false;
  bool messageSubmitting = false;
  void Function()? _chatListenerDisposer;
  void Function()? _locationListenerDisposer;
  final List<void Function()> _bookingLifecycleDisposers = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
    WidgetsBinding.instance.removeObserver(this);
    final roomId = chatRoomId;
    if (roomId != null) {
      _socket.leaveChat(roomId);
    }
    final bookingId =
        activeBooking?['id']?.toString() ?? widget.initialBookingId;
    if (bookingId != null) {
      _socket.leaveBooking(bookingId);
    }
    _chatListenerDisposer?.call();
    _locationListenerDisposer?.call();
    for (final disposeListener in _bookingLifecycleDisposers) {
      disposeListener();
    }
    messageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final roomId = chatRoomId;
    if (state == AppLifecycleState.resumed &&
        roomId != null &&
        !loading) {
      unawaited(openInitialChatRoom(
        roomId,
        bookingId:
            activeBooking?['id']?.toString() ?? widget.initialBookingId,
      ));
    }
  }

  void attachChatListener() {
    _chatListenerDisposer?.call();
    _chatListenerDisposer = _socket.onEvent('chat.message.created', (payload) {
      if (!mounted || payload is! Map || payload['chatRoomId'] != chatRoomId) {
        return;
      }
      setState(() {
        messages = _appendChatMessage(messages, payload);
        statusMessage = 'New message received.';
      });
    });
  }

  void attachLocationListener(String? bookingId) {
    _locationListenerDisposer?.call();
    _locationListenerDisposer = null;
    if (bookingId == null || bookingId.isEmpty) {
      return;
    }
    ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    _locationListenerDisposer =
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

  void attachBookingLifecycleListeners(String? bookingId) {
    for (final disposeListener in _bookingLifecycleDisposers) {
      disposeListener();
    }
    _bookingLifecycleDisposers.clear();
    if (bookingId == null || bookingId.isEmpty) {
      return;
    }

    for (final entry in _bookingLifecycleEventMessages.entries) {
      _bookingLifecycleDisposers.add(_socket.onEvent(entry.key, (payload) {
        if (!mounted || !_eventBelongsToBooking(payload, bookingId)) {
          return;
        }
        unawaited(_refreshBookingLifecycle(
          bookingId,
          message: entry.value,
        ));
      }));
    }
  }

  bool _eventBelongsToBooking(dynamic payload, String bookingId) {
    if (payload is! Map) {
      return true;
    }
    final payloadBooking = asMap(payload['booking']);
    final payloadBookingId = payload['bookingId']?.toString() ??
        payload['id']?.toString() ??
        payloadBooking?['id']?.toString();
    return payloadBookingId == null || payloadBookingId == bookingId;
  }

  Future<void> _refreshBookingLifecycle(
    String bookingId, {
    required String message,
  }) async {
    try {
      final updated =
          await ref.read(customerRepositoryProvider).getBooking(bookingId);
      if (!mounted) {
        return;
      }
      final storedProviderLocation = bookingLatestProviderLocation(updated);
      setState(() {
        activeBooking = updated;
        if (storedProviderLocation != null) {
          latestProviderLocation = storedProviderLocation;
        }
        statusMessage = message;
        error = null;
      });
    } catch (exception) {
      if (mounted) {
        setState(() {
          statusMessage = message;
          error = customerErrorMessage(exception);
        });
      }
    }
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
      setState(() => error = customerErrorMessage(exception));
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
        setState(() => error = customerErrorMessage(exception));
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
      latestProviderLocation = bookingLatestProviderLocation(bookingContext);
      messages = loadedMessages;
      statusMessage = bookingId == null
          ? 'Chat is ready.'
          : 'Chat is ready for booking $bookingId.';
    });
    attachChatListener();
    attachLocationListener(bookingId);
    attachBookingLifecycleListeners(bookingId);
  }

  Future<void> sendMessage() async {
    final roomId = chatRoomId;
    final text = messageController.text.trim();
    if (roomId == null || text.isEmpty || messageSubmitting) {
      return;
    }
    setState(() {
      messageSubmitting = true;
      error = null;
    });
    try {
      final message = await ref
          .read(customerRepositoryProvider)
          .sendChatMessage(roomId, text);
      if (!mounted) {
        return;
      }
      setState(() {
        messages = _appendChatMessage(messages, message);
        statusMessage = 'Message sent.';
        messageController.clear();
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => messageSubmitting = false);
      }
    }
  }

  Future<void> pickAndSendPhoto() async {
    final roomId = chatRoomId;
    if (roomId == null || messageSubmitting) return;
    final photo = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 78,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (photo == null || !mounted) return;

    setState(() {
      messageSubmitting = true;
      error = null;
    });
    try {
      final bytes = await photo.readAsBytes();
      final message =
          await ref.read(customerRepositoryProvider).sendChatAttachment(
                roomId,
                bytes: bytes,
                contentType: _chatImageContentType(photo),
              );
      if (mounted) {
        setState(() {
          messages = _appendChatMessage(messages, message);
          statusMessage = 'Photo sent.';
        });
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerErrorMessage(exception));
      }
    } finally {
      if (mounted) setState(() => messageSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final auth = ref.watch(authControllerProvider);
    final bookingStatus = activeBooking?['status']?.toString();
    final bookingAction = bookingStatus == null
        ? null
        : waitingCustomerAction(
            status: bookingStatus,
            fallbackCount: 0,
            hasChatRoom: chatRoomId != null,
          );
    final chatIsActive = isCustomerAppChatVisible(activeBooking);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (loading) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: RefreshIndicator(
                onRefresh: auth == null ? () async {} : loadLatestChat,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    CustomerSpacing.page,
                    18,
                    CustomerSpacing.page,
                    24,
                  ),
                  children: [
                    Text(
                      auth == null
                          ? 'Sign in to open your booking chat.'
                          : chatRoomId == null
                              ? 'Your partner chat opens after matching.'
                              : 'Messages and live service location',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 14),
                    if (auth == null || chatRoomId == null)
                      FilledButton.icon(
                        onPressed:
                            loading || (auth == null && !localDemoAccessEnabled)
                                ? null
                                : signInAndLoadChat,
                        icon: const Icon(Icons.chat_bubble_outline_rounded),
                        label: Text(auth == null && !localDemoAccessEnabled
                            ? 'Sign in on Home'
                            : 'Open latest chat'),
                      ),
                    if (statusMessage != null) ...[
                      const SizedBox(height: 12),
                      InfoBanner(text: statusMessage!),
                    ],
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      ErrorPanel(text: error!),
                    ],
                    if (bookingStatus != null && bookingAction != null) ...[
                      const SizedBox(height: 16),
                      _CustomerChatBookingStatusCard(
                        status: bookingStatus,
                        title: bookingAction.title,
                        body: bookingAction.body,
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (chatRoomId == null)
                      const EmptyPanel(
                        text:
                            'Chat becomes available when a partner accepts your booking.',
                      )
                    else ...[
                      BookingSectionCard(
                        title: 'Service location',
                        child: LiveLocationDetails(
                          customerPoint: deriveBookingLatLng(activeBooking),
                          providerLocation: latestProviderLocation,
                          emptyText:
                              'The partner location appears after live sharing starts.',
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (messages.isEmpty)
                        const EmptyPanel(
                          text:
                              'No messages yet. Send the first message when you are ready.',
                        )
                      else
                        for (final message in messages)
                          if (asMap(message) != null) ...[
                            MessageTile(
                              message: asMap(message)!,
                              attachmentLoader: ref
                                  .read(customerRepositoryProvider)
                                  .getChatAttachmentUri,
                            ),
                            const SizedBox(height: 10),
                          ],
                      if (!chatIsActive) ...[
                        const SizedBox(height: 6),
                        const EmptyPanel(
                          text:
                              'This booking chat is closed and retained in HANDS records.',
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
            if (chatRoomId != null && chatIsActive)
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                decoration: BoxDecoration(
                  color: colors.surface,
                  border: Border(
                    top: BorderSide(color: colors.outline),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      onPressed: messageSubmitting ? null : pickAndSendPhoto,
                      tooltip: 'Send photo',
                      icon: const Icon(Icons.add_photo_alternate_outlined),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: TextField(
                        controller: messageController,
                        minLines: 1,
                        maxLines: 3,
                        textInputAction: TextInputAction.newline,
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    IconButton.filled(
                      onPressed: messageSubmitting ? null : sendMessage,
                      tooltip: 'Send',
                      icon: messageSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

List<dynamic> _appendChatMessage(List<dynamic> current, dynamic incoming) {
  final incomingMap = asMap(incoming);
  final incomingId = incomingMap?['id']?.toString();
  if (incomingId != null &&
      incomingId.isNotEmpty &&
      current
          .any((message) => asMap(message)?['id']?.toString() == incomingId)) {
    return current;
  }
  return [...current, incoming];
}

class _CustomerChatBookingStatusCard extends StatelessWidget {
  const _CustomerChatBookingStatusCard({
    required this.status,
    required this.title,
    required this.body,
  });

  final String status;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final closed = const {
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'REFUNDED',
      'NO_SHOW',
    }.contains(status);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: colors.surface,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _customerChatBookingStatusIcon(status),
                  color: colors.primary,
                  size: 21,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  waitingStepLabel(status),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(body, style: Theme.of(context).textTheme.bodyMedium),
          if (!closed) ...[
            const SizedBox(height: 14),
            LinearProgressIndicator(
              value: bookingProgress(status),
              minHeight: 5,
              borderRadius: BorderRadius.circular(999),
              backgroundColor: colors.surface,
            ),
          ],
        ],
      ),
    );
  }
}

IconData _customerChatBookingStatusIcon(String status) {
  return switch (status) {
    'PROVIDER_ON_THE_WAY' => Icons.directions_bike_outlined,
    'ARRIVED' => Icons.location_on_outlined,
    'IN_SERVICE' => Icons.spa_outlined,
    'COMPLETED' => Icons.check_circle_outline,
    'CANCELLED' ||
    'EXPIRED' ||
    'REFUNDED' ||
    'NO_SHOW' =>
      Icons.event_busy_outlined,
    _ => Icons.schedule_outlined,
  };
}

class MessageTile extends StatelessWidget {
  const MessageTile({
    super.key,
    required this.message,
    required this.attachmentLoader,
  });

  final Map<String, dynamic> message;
  final Future<Uri> Function(String fileId) attachmentLoader;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final sender = asMap(message['sender']);
    final roles = sender?['roles'];
    final isCustomer = roles is List<dynamic> &&
        roles.map((role) => '$role').contains('CUSTOMER');
    final senderName = sender?['fullName']?.toString().trim();
    final createdAt = DateTime.tryParse(message['createdAt']?.toString() ?? '');
    final attachments = message['attachments'] is List
        ? (message['attachments'] as List)
            .whereType<Map>()
            .map((item) => item['id']?.toString())
            .whereType<String>()
            .where((id) => id.isNotEmpty)
            .toList()
        : const <String>[];

    return Align(
      alignment: isCustomer ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 286),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: isCustomer ? colors.primary : colors.surface,
            border: isCustomer ? null : Border.all(color: colors.outline),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: Radius.circular(isCustomer ? 14 : 3),
              bottomRight: Radius.circular(isCustomer ? 3 : 14),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 9),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!isCustomer &&
                    senderName != null &&
                    senderName.isNotEmpty) ...[
                  Text(
                    senderName,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 4),
                ],
                if (attachments.isNotEmpty)
                  for (final fileId in attachments) ...[
                    FutureBuilder<Uri>(
                      future: attachmentLoader(fileId),
                      builder: (context, snapshot) {
                        if (!snapshot.hasData) {
                          return const SizedBox(
                            width: 220,
                            height: 140,
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        return ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            snapshot.data.toString(),
                            width: 220,
                            height: 180,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const SizedBox(
                              width: 220,
                              height: 100,
                              child: Center(
                                child: Icon(Icons.broken_image_outlined),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 6),
                  ],
                if ((message['body']?.toString().trim() ?? '').isNotEmpty)
                  Text(
                    message['body']?.toString() ?? '',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: isCustomer ? colors.onPrimary : colors.ink,
                        ),
                  ),
                if (createdAt != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    _chatTime(createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isCustomer
                              ? colors.onPrimary.withValues(alpha: 0.75)
                              : colors.inkMuted,
                          fontSize: 12,
                        ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _chatImageContentType(XFile photo) {
  final mimeType = photo.mimeType?.toLowerCase();
  if (mimeType == 'image/png' || mimeType == 'image/webp') return mimeType!;
  final name = photo.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

String _chatTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}
