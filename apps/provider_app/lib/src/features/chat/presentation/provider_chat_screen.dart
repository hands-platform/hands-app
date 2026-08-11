import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app_state.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/provider_value_helpers.dart';
import '../../../core/realtime_socket.dart';
import '../../booking/presentation/provider_booking_service_helpers.dart';
import '../../booking/presentation/provider_jobs_helpers.dart';
import '../../map/presentation/provider_location_preview.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_chat_location_helpers.dart';
import 'provider_chat_priority.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    this.initialChatRoomId,
    this.initialBookingId,
    this.onUnreadCountChanged,
    this.onQueueStateChanged,
    this.onOpenJobs,
  });

  final String? initialChatRoomId;
  final String? initialBookingId;
  final ValueChanged<int>? onUnreadCountChanged;
  final VoidCallback? onQueueStateChanged;
  final VoidCallback? onOpenJobs;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen>
    with WidgetsBindingObserver {
  late final RealtimeSocket _socket;
  final _imagePicker = ImagePicker();
  StreamSubscription<void>? _socketConnectionSubscription;
  final messageController = TextEditingController();
  List<dynamic> messages = [];
  List<Map<String, dynamic>> activeChatBookings = [];
  Map<String, int> roomUnreadCounts = {};
  int unreadChatCount = 0;
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
  bool cancellationSubmitting = false;
  bool completionSubmitting = false;
  bool messageSubmitting = false;
  bool staleInitialChatTarget = false;
  bool _chatSyncInFlight = false;
  bool _chatSyncRequested = false;
  void Function()? _chatListenerDisposer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _socket = ref.read(realtimeSocketProvider);
    _socketConnectionSubscription = _socket.connectionEvents.listen((_) {
      unawaited(_synchronizeActiveChats());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final initialRoomId = widget.initialChatRoomId;
      if (initialRoomId != null && initialRoomId.isNotEmpty) {
        unawaited(openInitialChatRoom(
          initialRoomId,
          bookingId: widget.initialBookingId,
        ));
      } else if (ref.read(authControllerProvider) != null) {
        unawaited(signInAndLoadChat());
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_socketConnectionSubscription?.cancel());
    final roomId = chatRoomId;
    if (roomId != null) {
      _socket.leaveChat(roomId);
    }
    _chatListenerDisposer?.call();
    messageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ref.read(authControllerProvider) != null) {
      unawaited(_synchronizeActiveChats());
    }
  }

  void attachChatListener() {
    _chatListenerDisposer?.call();
    _chatListenerDisposer = _socket.onEvent('chat.message.created', (payload) {
      if (!mounted || payload is! Map) {
        return;
      }
      final incomingRoomId = payload['chatRoomId']?.toString();
      if (incomingRoomId == null || incomingRoomId.isEmpty) {
        return;
      }
      if (incomingRoomId != chatRoomId) {
        setState(() {
          roomUnreadCounts = {
            ...roomUnreadCounts,
            incomingRoomId: (roomUnreadCounts[incomingRoomId] ?? 0) + 1,
          };
          unreadChatCount += 1;
        });
        widget.onUnreadCountChanged?.call(unreadChatCount);
        return;
      }
      setState(() {
        messages = _appendChatMessage(messages, payload);
        statusMessage = 'Bạn vừa nhận được tin nhắn mới từ khách hàng.';
      });
      unawaited(_markChatRoomRead());
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
        setState(() => statusMessage = 'Đăng nhập để tải cuộc trò chuyện này.');
        return;
      }

      final bookings = await _loadActiveChatState();
      final chatBookings = providerActiveChatBookings(bookings);
      Map<String, dynamic>? roomBooking;
      for (final candidate in chatBookings) {
        final candidateRoomId = asMap(candidate['chatRoom'])?['id']?.toString();
        if (candidateRoomId == roomId) {
          roomBooking = candidate;
          break;
        }
      }
      final roomBookingId = roomBooking?['id']?.toString();
      final targetMismatch = roomBooking != null &&
          bookingId != null &&
          roomBookingId != bookingId;
      final booking = targetMismatch ? null : roomBooking;
      if (booking == null) {
        if (!targetMismatch) {
          await _markChatRoomRead(roomIdOverride: roomId);
        }
        if (!mounted) {
          return;
        }
        setState(() {
          chatRoomId = null;
          this.bookingId = bookingId;
          currentBooking = null;
          customerLat = null;
          customerLng = null;
          messages = [];
          staleInitialChatTarget = true;
          statusMessage = targetMismatch
              ? 'Thông báo này không khớp với đặt lịch đang hoạt động. Không mở cuộc trò chuyện.'
              : 'Cuộc trò chuyện của đặt lịch này không còn hoạt động. Dịch vụ có thể đã hoàn tất, bị hủy hoặc không còn được giao cho bạn.';
        });
        return;
      }
      await loadChatRoom(roomId, bookingId: bookingId, booking: booking);
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
    final bookings = await _loadActiveChatState();
    final chatBookings = providerActiveChatBookings(bookings);
    final bookingWithChat = chatBookings.isEmpty ? null : chatBookings.first;
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
            ? 'Bạn được chọn đầu tiên. Hãy chấp nhận trong mục Yêu cầu để xác nhận đặt lịch.'
            : 'Chưa có trò chuyện. Hãy tham gia hoặc tiếp tục hiển thị trong mục Yêu cầu đến khi khách hàng chọn bạn.',
        'MATCHED' => isFinalProvider
            ? 'Khách hàng đã chọn bạn. Trò chuyện đã sẵn sàng; hãy làm mới mục Yêu cầu nếu chưa thấy.'
            : 'Khách hàng đã chọn đối tác khác nên phòng trò chuyện này không thuộc về bạn.',
        'IN_SERVICE' =>
          'Dịch vụ đang diễn ra. Hãy tải lại để vào phòng trò chuyện.',
        'COMPLETED' =>
          'Dịch vụ đã hoàn tất. Trò chuyện được lưu cho quản trị viên và không còn hiển thị trong ứng dụng.',
        'CANCELLED' ||
        'EXPIRED' ||
        'REFUNDED' =>
          'Đặt lịch đã đóng. Trò chuyện được lưu cho quản trị viên.',
        _ => 'Chưa có cuộc trò chuyện đặt lịch được chọn.',
      };
      setState(() => statusMessage = nextMessage);
      return;
    }

    final roomId = room['id']?.toString();
    if (roomId == null || roomId.isEmpty) {
      setState(() => statusMessage = 'Phòng trò chuyện chưa sẵn sàng.');
      return;
    }
    await loadChatRoom(
      roomId,
      bookingId: booking?['id']?.toString(),
      booking: booking,
    );
  }

  Future<List<dynamic>> _loadActiveChatState() async {
    final bookings = await ref.read(providerRepositoryProvider).listBookings();
    Object? notificationSummary;
    try {
      notificationSummary =
          await ref.read(providerRepositoryProvider).chatNotificationSummary();
    } catch (_) {
      // Booking chat remains usable when the background badge endpoint is
      // temporarily unavailable.
    }
    final chatBookings = providerActiveChatBookings(bookings);
    for (final booking in chatBookings) {
      final roomId = asMap(booking['chatRoom'])?['id']?.toString();
      if (roomId != null && roomId.isNotEmpty) {
        ref.read(providerRepositoryProvider).joinChat(roomId);
      }
    }
    if (mounted) {
      setState(() {
        activeChatBookings = chatBookings;
        if (notificationSummary != null) {
          unreadChatCount = providerUnreadChatCount(notificationSummary);
          roomUnreadCounts = providerRoomUnreadCounts(notificationSummary);
        }
      });
      if (notificationSummary != null) {
        widget.onUnreadCountChanged
            ?.call(providerUnreadChatCount(notificationSummary));
      }
    }
    return bookings;
  }

  Future<void> _synchronizeActiveChats() async {
    if (!mounted || ref.read(authControllerProvider) == null) {
      return;
    }
    if (_chatSyncInFlight) {
      _chatSyncRequested = true;
      return;
    }

    _chatSyncInFlight = true;
    try {
      final bookings = await _loadActiveChatState();
      final chatBookings = providerActiveChatBookings(bookings);
      if (!mounted) {
        return;
      }

      final openRoomId = chatRoomId;
      Map<String, dynamic>? openBooking;
      if (openRoomId != null) {
        for (final booking in chatBookings) {
          if (asMap(booking['chatRoom'])?['id']?.toString() == openRoomId) {
            openBooking = booking;
            break;
          }
        }
      }

      if (openBooking != null && openRoomId != null) {
        final loadedMessages = await ref
            .read(providerRepositoryProvider)
            .listChatMessages(openRoomId);
        if (!mounted) {
          return;
        }
        setState(() {
          currentBooking = openBooking;
          bookingId = openBooking?['id']?.toString();
          customerLat = providerChatCustomerLatitude(openBooking);
          customerLng = providerChatCustomerLongitude(openBooking);
          messages = loadedMessages;
        });
        attachChatListener();
        await _markChatRoomRead();
        return;
      }

      if (chatBookings.isNotEmpty) {
        final nextBooking = chatBookings.first;
        final nextRoomId = asMap(nextBooking['chatRoom'])?['id']?.toString();
        if (nextRoomId != null && nextRoomId.isNotEmpty) {
          await loadChatRoom(
            nextRoomId,
            bookingId: nextBooking['id']?.toString(),
            booking: nextBooking,
          );
        }
        return;
      }

      setState(() {
        chatRoomId = null;
        bookingId = null;
        currentBooking = null;
        customerLat = null;
        customerLng = null;
        messages = [];
        statusMessage =
            'Hiện không có cuộc trò chuyện đặt lịch đang hoạt động.';
      });
    } catch (_) {
      // Keep the last usable chat state. The next resume, reconnect, or manual
      // refresh retries the persisted API snapshot.
    } finally {
      _chatSyncInFlight = false;
      if (_chatSyncRequested && mounted) {
        _chatSyncRequested = false;
        unawaited(_synchronizeActiveChats());
      }
    }
  }

  Future<void> openBookingChat(Map<String, dynamic> booking) async {
    final roomId = asMap(booking['chatRoom'])?['id']?.toString();
    if (roomId == null || roomId.isEmpty || loading) {
      return;
    }

    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      await loadChatRoom(
        roomId,
        bookingId: booking['id']?.toString(),
        booking: booking,
      );
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

  Future<void> loadChatRoom(
    String roomId, {
    String? bookingId,
    Map<String, dynamic>? booking,
  }) async {
    final previousRoomId = chatRoomId;
    if (previousRoomId != null && previousRoomId != roomId) {
      _socket.leaveChat(previousRoomId);
    }
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
      staleInitialChatTarget = false;
      statusMessage = this.bookingId == null
          ? 'Trò chuyện đã sẵn sàng.'
          : 'Trò chuyện đã sẵn sàng cho đặt lịch ${this.bookingId}.';
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
    await _markChatRoomRead();
  }

  Future<void> _markChatRoomRead({String? roomIdOverride}) async {
    final roomId = roomIdOverride ?? chatRoomId;
    if (roomId == null || roomId.isEmpty) {
      return;
    }
    try {
      final summary = await ref
          .read(providerRepositoryProvider)
          .markChatNotificationsRead(roomId);
      if (mounted) {
        setState(() {
          unreadChatCount = providerUnreadChatCount(summary);
          roomUnreadCounts = providerRoomUnreadCounts(summary);
        });
      }
      widget.onUnreadCountChanged?.call(providerUnreadChatCount(summary));
    } catch (_) {
      // Reading chat must remain available when notification state refresh
      // fails; the shell retries the persisted unread count on navigation.
    }
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

  Future<void> _closeCurrentChatAndOpenNext({
    required String closedBookingId,
    required String confirmationMessage,
  }) async {
    final closedRoomId = chatRoomId;
    if (closedRoomId != null) {
      _socket.leaveChat(closedRoomId);
    }
    final remainingBookings = providerActiveChatBookings(
      activeChatBookings.where(
        (booking) => booking['id']?.toString() != closedBookingId,
      ),
    );
    if (!mounted) {
      return;
    }

    setState(() {
      activeChatBookings = remainingBookings;
      chatRoomId = null;
      bookingId = null;
      currentBooking = null;
      customerLat = null;
      customerLng = null;
      lastSharedLat = null;
      lastSharedLng = null;
      lastSharedAt = null;
      messages = [];
      statusMessage = confirmationMessage;
    });

    if (remainingBookings.isEmpty) {
      return;
    }

    final nextBooking = remainingBookings.first;
    final nextRoomId = asMap(nextBooking['chatRoom'])?['id']?.toString();
    if (nextRoomId == null || nextRoomId.isEmpty) {
      return;
    }

    try {
      await loadChatRoom(
        nextRoomId,
        bookingId: nextBooking['id']?.toString(),
        booking: nextBooking,
      );
      if (mounted) {
        setState(() {
          statusMessage =
              '$confirmationMessage Đã mở cuộc trò chuyện tiếp theo.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          statusMessage =
              '$confirmationMessage Chọn một cuộc trò chuyện đang hoạt động để tiếp tục.';
        });
      }
    }
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
          .read(providerRepositoryProvider)
          .sendChatMessage(roomId, text);
      if (!mounted) {
        return;
      }
      setState(() {
        messages = _appendChatMessage(messages, message);
        statusMessage = 'Đã gửi tin nhắn.';
        messageController.clear();
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => messageSubmitting = false);
      }
    }
  }

  Future<void> pickAndSendPhoto() async {
    final roomId = chatRoomId;
    if (roomId == null || messageSubmitting) {
      return;
    }
    final photo = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 78,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (photo == null || !mounted) {
      return;
    }

    setState(() {
      messageSubmitting = true;
      error = null;
    });
    try {
      final message =
          await ref.read(providerRepositoryProvider).sendChatAttachment(
                roomId,
                bytes: await photo.readAsBytes(),
                contentType: _chatImageContentType(photo),
              );
      if (mounted) {
        setState(() {
          messages = _appendChatMessage(messages, message);
          statusMessage = 'Đã gửi ảnh.';
        });
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => messageSubmitting = false);
      }
    }
  }

  Future<void> requestPostMatchCancellation() async {
    final activeBookingId = bookingId;
    if (activeBookingId == null || !isPostMatchCancellationAvailable) {
      return;
    }

    final cancellationRequest = await _showCancellationReasonDialog();
    if (cancellationRequest == null) {
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
            'Cần vị trí hiện tại trước khi hủy đặt lịch. Hãy bật vị trí và thử lại.');
        return;
      }
      ref.read(providerLocationHeartbeatProvider).recordSuccessfulUpdate(
            interval: ProviderLocationHeartbeat.activeBookingInterval,
            bookingId: activeBookingId,
          );
      final result = await ref.read(providerRepositoryProvider).cancelBooking(
            activeBookingId,
            reasonCode: cancellationRequest.reasonCode,
            note: cancellationRequest.detail,
            lat: lat,
            lng: lng,
            addressText: _actionAddressText(actionLocation),
          );
      final cancellation = asMap(result['postMatchCancellation']);
      final autoApproved = cancellation?['autoApproved'] == true;
      final adminReviewRequired =
          cancellation?['adminReviewRequired'] == true || !autoApproved;
      final nextStatusMessage = autoApproved
          ? 'Yêu cầu hủy đã được tự động chấp thuận. Đặt lịch đã đóng.'
          : adminReviewRequired
              ? 'Yêu cầu hủy đã được gửi cho HANDS xem xét. Trò chuyện và ghi chú của bạn được lưu để quản trị viên kiểm tra.'
              : 'Đã gửi yêu cầu hủy.';
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      await heartbeat.start(runImmediately: false);
      heartbeat.recordSuccessfulUpdate();
      widget.onQueueStateChanged?.call();
      await _closeCurrentChatAndOpenNext(
        closedBookingId: activeBookingId,
        confirmationMessage: nextStatusMessage,
      );
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
            'Cần vị trí hiện tại trước khi hoàn tất đặt lịch. Hãy bật vị trí và thử lại.');
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
          'Dịch vụ đã hoàn tất. HANDS có thể kiểm tra bản ghi đặt lịch cuối cùng.';
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      await heartbeat.start(runImmediately: false);
      heartbeat.recordSuccessfulUpdate();
      widget.onQueueStateChanged?.call();
      await _closeCurrentChatAndOpenNext(
        closedBookingId: activeBookingId,
        confirmationMessage: nextStatusMessage,
      );
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => completionSubmitting = false);
      }
    }
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
        isProviderActiveBooking(currentBooking ?? const {});
  }

  Future<_ProviderCancellationRequest?> _showCancellationReasonDialog() async {
    return showDialog<_ProviderCancellationRequest>(
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
            'Vị trí hiện tại đã được chia sẻ với khách hàng tại ${formatCoordinate(lastSharedLat)} / ${formatCoordinate(lastSharedLng)}.';
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
          Text('Trò chuyện', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Đăng nhập để tải cuộc trò chuyện dịch vụ gần nhất.'
                : 'Trao đổi trực tiếp với khách hàng sau khi ghép đôi.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: loading || (auth == null && !localDemoAccessEnabled)
                ? null
                : signInAndLoadChat,
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text(
              auth == null && !localDemoAccessEnabled
                  ? 'Đăng nhập trong mục Yêu cầu'
                  : chatRoomId == null
                      ? 'Mở trò chuyện đang hoạt động'
                      : 'Làm mới trò chuyện',
            ),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (activeChatBookings.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Trò chuyện đặt lịch đang hoạt động',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Text(
                  '${activeChatBookings.length}',
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Trò chuyện dịch vụ được sắp xếp theo công việc hoạt động gần nhất.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 148,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: activeChatBookings.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final booking = activeChatBookings[index];
                  final roomId =
                      asMap(booking['chatRoom'])?['id']?.toString() ?? '';
                  return ProviderActiveChatCard(
                    key: ValueKey(
                      'provider-chat-booking-${booking['id']}',
                    ),
                    booking: booking,
                    unreadCount: roomUnreadCounts[roomId] ?? 0,
                    selected: roomId.isNotEmpty && roomId == chatRoomId,
                    onTap: loading ? null : () => openBookingChat(booking),
                  );
                },
              ),
            ),
          ],
          if (statusMessage != null) ...[
            const SizedBox(height: 12),
            InfoCard(text: statusMessage!),
          ],
          if (staleInitialChatTarget && widget.onOpenJobs != null) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: widget.onOpenJobs,
              icon: const Icon(Icons.work_history_outlined),
              label: const Text('Mở Công việc'),
            ),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ProviderErrorCard(text: error!),
          ],
          const SizedBox(height: 16),
          if (chatRoomId == null)
            const InfoCard(
                text:
                    'Trò chuyện mở sau khi khách hàng xác nhận bạn. Các cuộc trò chuyện đã hoàn tất hoặc đóng sẽ được lưu cho quản trị viên.')
          else ...[
            Text('Phòng $chatRoomId',
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
              label: const Text('Chia sẻ vị trí hiện tại'),
            ),
            if (isServiceCompletionAvailable) ...[
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed:
                    completionSubmitting || cancellationSubmitting || loading
                        ? null
                        : completeService,
                icon: completionSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Hoàn tất dịch vụ'),
              ),
            ],
            if (isPostMatchCancellationAvailable) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed:
                    cancellationSubmitting || completionSubmitting || loading
                        ? null
                        : requestPostMatchCancellation,
                icon: cancellationSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cancel_schedule_send_outlined),
                label: const Text('Hủy đặt lịch này'),
              ),
            ],
            const SizedBox(height: 8),
            if (messages.isEmpty)
              const InfoCard(
                  text:
                      'Chưa có tin nhắn. Tin nhắn đầu tiên sẽ xuất hiện khi một bên gửi.')
            else
              for (final message in messages)
                if (asMap(message) != null)
                  MessageTile(
                    message: asMap(message)!,
                    attachmentLoader: ref
                        .read(providerRepositoryProvider)
                        .getChatAttachmentUri,
                  ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: messageSubmitting ? null : pickAndSendPhoto,
                  tooltip: 'Gửi ảnh',
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: TextField(
                    controller: messageController,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      labelText: 'Tin nhắn',
                    ),
                    minLines: 1,
                    maxLines: 3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: messageSubmitting ? null : sendMessage,
              icon: messageSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
              label: const Text('Gửi'),
            ),
          ],
        ],
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
  const MessageTile({
    super.key,
    required this.message,
    required this.attachmentLoader,
  });

  final Map<String, dynamic> message;
  final Future<Uri> Function(String fileId) attachmentLoader;

  @override
  Widget build(BuildContext context) {
    final sender = asMap(message['sender']);
    final attachments = message['attachments'] is List
        ? (message['attachments'] as List)
            .whereType<Map>()
            .map((item) => item['id']?.toString())
            .whereType<String>()
            .where((id) => id.isNotEmpty)
            .toList()
        : const <String>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              sender?['fullName']?.toString() ?? 'Người gửi',
              style: Theme.of(context).textTheme.labelMedium,
            ),
            if (attachments.isNotEmpty)
              for (final fileId in attachments) ...[
                const SizedBox(height: 8),
                FutureBuilder<Uri>(
                  future: attachmentLoader(fileId),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const SizedBox(
                        height: 140,
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(
                        snapshot.data.toString(),
                        width: double.infinity,
                        height: 180,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox(
                          height: 100,
                          child: Center(
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            if ((message['body']?.toString().trim() ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(message['body']?.toString() ?? ''),
            ],
          ],
        ),
      ),
    );
  }
}

String _chatImageContentType(XFile photo) {
  final mimeType = photo.mimeType?.toLowerCase();
  if (mimeType == 'image/png' || mimeType == 'image/webp') {
    return mimeType!;
  }
  final name = photo.name.toLowerCase();
  if (name.endsWith('.png')) {
    return 'image/png';
  }
  if (name.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

class ProviderActiveChatCard extends StatelessWidget {
  const ProviderActiveChatCard({
    super.key,
    required this.booking,
    required this.unreadCount,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> booking;
  final int unreadCount;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final service = providerBookingService(booking);
    final bookingId = booking['id']?.toString() ?? '';
    final shortBookingId = bookingId.length > 8
        ? bookingId.substring(bookingId.length - 8)
        : bookingId;

    return SizedBox(
      width: 252,
      child: Card(
        margin: EdgeInsets.zero,
        elevation: selected ? 2 : 0,
        color: selected ? colorScheme.primaryContainer : null,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: selected ? colorScheme.primary : colorScheme.outlineVariant,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Badge.count(
                      count: unreadCount,
                      isLabelVisible: unreadCount > 0,
                      child: Icon(
                        selected
                            ? Icons.chat_bubble
                            : Icons.chat_bubble_outline,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        providerChatStatusLabel(booking),
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    ),
                    if (selected)
                      Icon(
                        Icons.check_circle,
                        size: 18,
                        color: colorScheme.primary,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  providerServiceOptionLabel(service),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  formatRequestOpenedMoment(booking['scheduledStartAt']),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const Spacer(),
                Text(
                  unreadCount > 0
                      ? '$unreadCount tin nhắn mới'
                      : 'Đặt lịch $shortBookingId',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: unreadCount > 0
                            ? colorScheme.primary
                            : colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
        ),
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
  String? reasonCode;
  String? validationMessage;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Hủy đặt lịch này?'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chọn lý do và ghi rõ chi tiết để HANDS xem xét.',
            ),
            const SizedBox(height: 12),
            RadioGroup<String>(
              groupValue: reasonCode,
              onChanged: (value) {
                setState(() {
                  reasonCode = value;
                  validationMessage = null;
                });
              },
              child: Column(
                children: _providerCancellationReasons
                    .map(
                      (reason) => RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: Text(reason.label),
                        subtitle: Text(reason.description),
                        value: reason.code,
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                labelText: 'Lý do chi tiết',
                hintText:
                    'Sự việc xảy ra, nội dung khách hàng trao đổi và cách bạn đã xử lý',
                errorText: validationMessage,
              ),
              minLines: 3,
              maxLines: 5,
              maxLength: 1000,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Tiếp tục đặt lịch'),
        ),
        FilledButton(
          onPressed: () {
            final selectedReasonCode = reasonCode;
            final detail = controller.text.trim();
            if (selectedReasonCode == null) {
              setState(() {
                validationMessage = 'Chọn một lý do hủy.';
              });
              return;
            }
            if (detail.isEmpty) {
              setState(() {
                validationMessage = 'Nhập chi tiết trước khi hủy.';
              });
              return;
            }
            Navigator.of(context).pop(
              _ProviderCancellationRequest(
                reasonCode: selectedReasonCode,
                detail: detail,
              ),
            );
          },
          child: const Text('Gửi yêu cầu hủy'),
        ),
      ],
    );
  }
}

class _ProviderCancellationRequest {
  const _ProviderCancellationRequest({
    required this.reasonCode,
    required this.detail,
  });

  final String reasonCode;
  final String detail;
}

class _ProviderCancellationReason {
  const _ProviderCancellationReason({
    required this.code,
    required this.label,
    required this.description,
  });

  final String code;
  final String label;
  final String description;
}

const _providerCancellationReasons = <_ProviderCancellationReason>[
  _ProviderCancellationReason(
    code: 'CUSTOMER_REQUESTED',
    label: 'Khách hàng yêu cầu hủy',
    description:
        'Khách hàng yêu cầu hủy trong trò chuyện hoặc sau khi bạn đến.',
  ),
  _ProviderCancellationReason(
    code: 'CUSTOMER_NOT_FOUND',
    label: 'Không gặp được khách hàng',
    description: 'Bạn đã đến nhưng không thể tìm hoặc liên hệ với khách hàng.',
  ),
  _ProviderCancellationReason(
    code: 'SAFETY_CONCERN',
    label: 'Lo ngại về an toàn',
    description: 'Địa điểm hoặc tình huống không an toàn.',
  ),
  _ProviderCancellationReason(
    code: 'SERVICE_CANNOT_BE_PROVIDED',
    label: 'Không thể cung cấp dịch vụ',
    description:
        'Bạn không thể cung cấp dịch vụ đã đặt một cách an toàn hoặc đúng yêu cầu.',
  ),
  _ProviderCancellationReason(
    code: 'OTHER',
    label: 'Lý do khác',
    description: 'Chỉ chọn khi không có lý do nào ở trên phù hợp.',
  ),
];
