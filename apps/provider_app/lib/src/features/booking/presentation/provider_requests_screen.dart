import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/realtime_socket.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../earnings/presentation/provider_wallet_settlement_dialog.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_cards.dart';
import 'provider_request_filter_helpers.dart';
import 'provider_request_guidance_helpers.dart';
import 'provider_request_panels.dart';
import 'provider_requests_list_section.dart';

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({
    super.key,
    this.initialBookingId,
    this.onOpenRequestCountChanged,
    this.onQueueStateChanged,
  });

  final String? initialBookingId;
  final ValueChanged<int>? onOpenRequestCountChanged;
  final VoidCallback? onQueueStateChanged;

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen>
    with WidgetsBindingObserver {
  final loginPhoneController = TextEditingController(
    text: localDemoAccessEnabled ? '+84900000002' : '',
  );
  final loginOtpController = TextEditingController(
    text: localDemoAccessEnabled ? '123456' : '',
  );
  late final RealtimeSocket _socket;
  late final ProviderBookingDetailViewTracker _detailViewTracker;
  Timer? _detailViewHeartbeatTimer;
  final List<void Function()> _realtimeDisposers = [];
  Timer? _otpCooldownTimer;
  List<dynamic> openBookings = [];
  Set<String> joinedBookingIds = {};
  bool isOnline = false;
  bool isAvailabilityEnabled = false;
  bool loading = false;
  bool otpRequested = false;
  int otpCooldownSeconds = 0;
  bool restoringSession = true;
  bool requestActionsWalletBlocked = false;
  bool savingAlertPreferences = false;
  String requestView = 'action';
  ProviderRequestFilters requestFilters = const ProviderRequestFilters();
  String? statusMessage;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.initialBookingId != null) {
      requestView = 'all';
    }
    _socket = ref.read(realtimeSocketProvider);
    final providerRepository = ref.read(providerRepositoryProvider);
    _detailViewTracker = ProviderBookingDetailViewTracker(
      record: ({
        required bookingId,
        required eventType,
        duration,
      }) async {
        await providerRepository.recordBookingDetailView(
          bookingId,
          eventType: eventType,
          duration: duration,
        );
      },
    );
    _detailViewHeartbeatTimer = Timer.periodic(
      ProviderBookingDetailViewTracker.heartbeatInterval,
      (_) => unawaited(_detailViewTracker.recordHeartbeat()),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(restoreSessionAndLoad());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    loginPhoneController.dispose();
    loginOtpController.dispose();
    _otpCooldownTimer?.cancel();
    _detailViewHeartbeatTimer?.cancel();
    unawaited(_detailViewTracker.closeAll());
    detachRealtimeListeners();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ref.read(authControllerProvider) != null) {
      unawaited(syncAvailabilityAndHeartbeat(refreshLocation: true));
    }
  }

  void attachRealtimeListeners() {
    detachRealtimeListeners();

    _realtimeDisposers.add(_socket.onEvent('booking.opened', (payload) {
      if (!mounted) {
        return;
      }
      setState(() => statusMessage = 'Bạn vừa nhận được yêu cầu đặt lịch mới.');
      unawaited(loadOpenBookings(showLoading: false));
    }));

    _realtimeDisposers.add(_socket.onEvent('booking.matched', (payload) {
      if (!mounted) {
        return;
      }
      setState(() => statusMessage =
          'Một đặt lịch đã được xác nhận. Hãy kiểm tra trạng thái hiện tại.');
      widget.onQueueStateChanged?.call();
      unawaited(loadOpenBookings(showLoading: false));
    }));

    _realtimeDisposers.add(_socket.onEvent('booking.expired', (payload) {
      if (!mounted) {
        return;
      }
      final booking =
          payload is Map<String, dynamic> ? payload : const <String, dynamic>{};
      setState(() {
        statusMessage = providerClosedBookingMessage(booking);
      });
      unawaited(loadOpenBookings(showLoading: false));
    }));
  }

  void detachRealtimeListeners() {
    for (final disposeListener in _realtimeDisposers) {
      disposeListener();
    }
    _realtimeDisposers.clear();
  }

  Future<void> restoreSessionAndLoad() async {
    try {
      final session =
          await ref.read(authControllerProvider.notifier).restoreSession();
      if (session != null) {
        ref.read(pushTokenRefreshRegistrationProvider);
        await ref.read(registerCurrentDevicePushTokenProvider).call();
        attachRealtimeListeners();
        await syncAvailabilityAndHeartbeat(refreshLocation: true);
        await loadBookingAlertPreferences();
        await loadOpenBookings(showLoading: false);
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => restoringSession = false);
      }
    }
  }

  Future<void> signInAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInDemoProvider();
      ref.read(pushTokenRefreshRegistrationProvider);
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      attachRealtimeListeners();
      await syncAvailabilityAndHeartbeat(refreshLocation: true);
      await loadBookingAlertPreferences();
      await loadOpenBookings();
      if (mounted) {
        setState(() => statusMessage ??= pushResult.message);
      }
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> requestLoginOtp() async {
    final phone = loginPhoneController.text.trim();
    if (!isValidProviderPhone(phone)) {
      setState(
        () => error = 'Nhập số điện thoại hợp lệ, gồm cả mã quốc gia.',
      );
      return;
    }
    if (otpCooldownSeconds > 0) return;
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      final result = await ref.read(authControllerProvider.notifier).requestOtp(
            phone: phone,
          );
      setState(() {
        otpRequested = true;
        statusMessage = !localDemoAccessEnabled || result.devOtp == null
            ? 'Mã OTP đã gửi đến ${result.phone}. Nhập mã SMS để tiếp tục.'
            : 'Đã yêu cầu OTP cho ${result.phone}. OTP thử nghiệm cục bộ: ${result.devOtp}.';
      });
      _startOtpCooldown();
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> signInWithOtpAndLoad() async {
    final otp = loginOtpController.text.trim();
    if (!otpRequested) {
      setState(() => error = 'Hãy yêu cầu mã OTP trước khi đăng nhập.');
      return;
    }
    if (!isValidProviderOtp(otp)) {
      setState(() => error = 'Nhập mã OTP gồm 6 chữ số.');
      return;
    }
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInWithOtp(
            phone: loginPhoneController.text.trim(),
            otp: otp,
          );
      ref.read(pushTokenRefreshRegistrationProvider);
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      attachRealtimeListeners();
      await syncAvailabilityAndHeartbeat(refreshLocation: true);
      await loadBookingAlertPreferences();
      await loadOpenBookings();
      if (mounted) {
        setState(() => statusMessage ??= pushResult.message);
      }
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  void _startOtpCooldown() {
    _otpCooldownTimer?.cancel();
    setState(() => otpCooldownSeconds = 60);
    _otpCooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || otpCooldownSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => otpCooldownSeconds = 0);
        return;
      }
      setState(() => otpCooldownSeconds -= 1);
    });
  }

  Future<void> goOnline() async {
    await ref.read(providerRepositoryProvider).goOnline();
    await syncAvailabilityAndHeartbeat(refreshLocation: false);
    if (mounted) {
      setState(() {
        statusMessage = isOnline
            ? 'Bạn đang trực tuyến và có thể nhận yêu cầu trực tiếp hoặc công khai.'
            : 'Đã bật nhận việc. Yêu cầu sẽ mở trong giờ làm việc của bạn.';
      });
    }
  }

  Future<void> goOffline() async {
    await ref.read(providerRepositoryProvider).goOffline();
    final heartbeat = ref.read(providerLocationHeartbeatProvider);
    heartbeat.stop();
    if (mounted) {
      setState(() {
        isOnline = false;
        isAvailabilityEnabled = false;
        statusMessage = 'Bạn đang ngoại tuyến và sẽ không nhận yêu cầu mới.';
      });
    }
  }

  Future<void> syncAvailabilityAndHeartbeat({
    required bool refreshLocation,
  }) async {
    final availability =
        await ref.read(providerRepositoryProvider).availability();
    final heartbeat = ref.read(providerLocationHeartbeatProvider);
    Object? locationError;
    try {
      await heartbeat.syncForAvailability(
        availability,
        runImmediately: refreshLocation,
      );
    } catch (error) {
      locationError = error;
    }

    if (!mounted) {
      return;
    }
    setState(() {
      isAvailabilityEnabled =
          providerAvailabilityWantsLocationHeartbeat(availability);
      isOnline = providerAvailabilityIsOnline(availability);
      if (locationError != null) {
        statusMessage =
            'Đã bật nhận việc nhưng không thể cập nhật vị trí hiện tại.';
      }
    });
  }

  Future<void> loadOpenBookings({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final bookings =
          await ref.read(providerRepositoryProvider).requestBookings();
      setState(() {
        openBookings = bookings;
        joinedBookingIds = bookings
            .whereType<Map<String, dynamic>>()
            .where(providerHasJoinedRequest)
            .map((booking) => booking['id'])
            .whereType<String>()
            .toSet();
      });
      widget.onOpenRequestCountChanged?.call(
        providerOpenRequestCount(bookings),
      );
      syncVisibleRequestDetailTelemetry();
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> joinBooking(Map<String, dynamic> booking) async {
    final bookingId = booking['id'] as String;
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (!await ensureWalletCanJoinMarketplace()) {
        return;
      }
      await ref.read(providerRepositoryProvider).joinBooking(bookingId);
      setState(() {
        joinedBookingIds = {...joinedBookingIds, bookingId};
        statusMessage =
            'Bạn đang hiển thị trong yêu cầu này. Đang chờ khách hàng chọn đối tác.';
      });
      await loadOpenBookings();
    } catch (exception) {
      await handleBookingActionException(exception);
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> respondToBooking(
      Map<String, dynamic> booking, bool accepted) async {
    final bookingId = booking['id'] as String;
    _PreferredProviderRejection? rejection;
    if (!accepted && _isPreferredRequest(booking)) {
      rejection = await _showPreferredProviderRejectionDialog();
      if (!mounted || rejection == null) {
        return;
      }
    }
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      Map<String, dynamic> response;
      if (accepted) {
        response =
            await ref.read(providerRepositoryProvider).acceptBooking(bookingId);
        if (providerAcceptanceConfirmedBooking(response)) {
          try {
            await ref
                .read(providerLocationHeartbeatProvider)
                .startActiveBooking(bookingId);
          } catch (_) {
            if (mounted) {
              setState(() {
                statusMessage =
                    'Đặt lịch đã xác nhận nhưng không thể bắt đầu chia sẻ vị trí. Hãy kiểm tra quyền vị trí trong mục Công việc.';
              });
            }
          }
        }
      } else {
        response = await ref.read(providerRepositoryProvider).rejectBooking(
              bookingId,
              reasonCode: rejection?.reasonCode,
              reasonDetail: rejection?.reasonDetail,
            );
        joinedBookingIds =
            joinedBookingIds.where((id) => id != bookingId).toSet();
      }
      if (statusMessage == null) {
        setState(() {
          statusMessage = providerBookingDecisionStatusMessage(
            accepted: accepted,
            response: response,
          );
        });
      }
      widget.onQueueStateChanged?.call();
      await loadOpenBookings();
    } catch (exception) {
      await handleBookingActionException(exception);
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  bool _isPreferredRequest(Map<String, dynamic> booking) {
    return providerIsPreferredRequest(
      booking,
      ref.read(authControllerProvider)?.userId,
    );
  }

  Future<_PreferredProviderRejection?>
      _showPreferredProviderRejectionDialog() async {
    final detailController = TextEditingController();
    String? reasonCode;
    try {
      return await showDialog<_PreferredProviderRejection>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('Từ chối yêu cầu trực tiếp'),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Từ chối sẽ kết thúc đặt lịch này. Khách hàng sẽ không được ghép với đối tác khác.',
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: reasonCode,
                    decoration: const InputDecoration(labelText: 'Lý do'),
                    items: _preferredProviderRejectionReasons.entries
                        .map(
                          (entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setDialogState(() => reasonCode = value),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: detailController,
                    maxLength: 1000,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Chi tiết để HANDS hỗ trợ',
                      hintText:
                          'Giải thích vì sao bạn không thể nhận yêu cầu này.',
                    ),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Giữ yêu cầu'),
              ),
              FilledButton(
                onPressed:
                    reasonCode == null || detailController.text.trim().isEmpty
                        ? null
                        : () => Navigator.of(dialogContext).pop(
                              _PreferredProviderRejection(
                                reasonCode: reasonCode!,
                                reasonDetail: detailController.text.trim(),
                              ),
                            ),
                child: const Text('Từ chối đặt lịch'),
              ),
            ],
          ),
        ),
      );
    } finally {
      detailController.dispose();
    }
  }

  Future<void> handleBookingActionException(Object exception) async {
    final walletSummary = providerApiExceptionWalletSummary(exception);
    if (walletSummary != null) {
      if (!mounted) {
        return;
      }
      setState(() {
        requestActionsWalletBlocked =
            providerWalletMarketplaceJoinBlocked(walletSummary);
        error = providerWalletBlockReason(walletSummary) ??
            providerWalletBlockFallbackReasonClean;
        statusMessage = providerWalletBlockHintClean;
      });
      await showWalletSettlementDialog(walletSummary);
      return;
    }

    if (mounted) {
      setState(() => error = providerAppErrorMessage(exception));
    }
  }

  Future<bool> ensureWalletCanJoinMarketplace() async {
    try {
      final summary =
          await ref.read(providerRepositoryProvider).earningsSummary();
      final marketplaceJoinBlocked =
          providerWalletMarketplaceJoinBlocked(summary);
      if (marketplaceJoinBlocked) {
        final blockReason = providerWalletBlockReason(summary) ??
            providerWalletBlockFallbackReasonClean;
        if (mounted) {
          setState(() {
            requestActionsWalletBlocked = true;
            error = blockReason;
            statusMessage = providerWalletBlockHintClean;
          });
          await showWalletSettlementDialog(summary);
        }
        return false;
      }
    } catch (exception) {
      if (mounted) {
        setState(() {
          statusMessage =
              'Không thể làm mới trạng thái ví trên thiết bị. Máy chủ sẽ xác minh thanh toán trước khi cho phép tham gia.';
        });
      }
    }
    return true;
  }

  Future<void> showWalletSettlementDialog(Map<String, dynamic> summary) async {
    if (!mounted) {
      return;
    }

    await showProviderWalletSettlementDialog(
      context: context,
      summary: summary,
      onRefresh: () {
        if (mounted) {
          setState(() {});
        }
      },
    );
  }

  Future<void> loadBookingAlertPreferences() async {
    final result =
        await ref.read(providerRepositoryProvider).bookingAlertPreferences();
    if (mounted) {
      setState(() => requestFilters = ProviderRequestFilters.fromJson(result));
    }
  }

  Future<void> saveBookingAlertPreferences() async {
    setState(() {
      savingAlertPreferences = true;
      error = null;
    });
    try {
      final result = await ref
          .read(providerRepositoryProvider)
          .updateBookingAlertPreferences(requestFilters.toJson());
      if (mounted) {
        setState(() {
          requestFilters = ProviderRequestFilters.fromJson(result);
          statusMessage = requestFilters.alertsEnabled
              ? 'Đã lưu điều kiện thông báo yêu cầu công khai. Yêu cầu trực tiếp vẫn được bật.'
              : 'Đã tắt thông báo theo điều kiện công khai. Yêu cầu trực tiếp vẫn được bật.';
        });
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) setState(() => savingAlertPreferences = false);
    }
  }

  List<Map<String, dynamic>> sortedBookingItems() {
    final auth = ref.read(authControllerProvider);
    return openBookings.whereType<Map<String, dynamic>>().toList()
      ..sort((left, right) {
        final leftTarget = left['id']?.toString() == widget.initialBookingId;
        final rightTarget = right['id']?.toString() == widget.initialBookingId;
        if (leftTarget != rightTarget) {
          return leftTarget ? -1 : 1;
        }

        final leftPriority = providerRequestPriority(left, auth?.userId);
        final rightPriority = providerRequestPriority(right, auth?.userId);
        if (leftPriority != rightPriority) {
          return rightPriority.compareTo(leftPriority);
        }
        return bookingTimestamp(right).compareTo(bookingTimestamp(left));
      });
  }

  List<Map<String, dynamic>> visibleBookingsForRequestView(
    List<Map<String, dynamic>> bookingItems,
  ) {
    final currentUserId = ref.read(authControllerProvider)?.userId ?? '';
    return bookingItems.where((booking) {
      if (requestView == 'chat') {
        return isProviderAppChatVisible(booking) &&
            providerBookingMatchesRequestFilters(
              booking,
              requestFilters,
              currentUserId,
            );
      }
      if (requestView == 'all') {
        return providerBookingMatchesRequestFilters(
          booking,
          requestFilters,
          currentUserId,
        );
      }
      return !isProviderAppChatVisible(booking) &&
          providerBookingMatchesRequestFilters(
            booking,
            requestFilters,
            currentUserId,
          );
    }).toList();
  }

  void syncVisibleRequestDetailTelemetry() {
    final visibleBookingIds =
        visibleBookingsForRequestView(sortedBookingItems())
            .map((booking) => booking['id']?.toString())
            .whereType<String>()
            .where((bookingId) => bookingId.isNotEmpty);
    unawaited(_detailViewTracker.syncVisibleBookingIds(visibleBookingIds));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final heartbeatSnapshot =
        ref.watch(providerLocationHeartbeatStatusProvider).valueOrNull ??
            ref.read(providerLocationHeartbeatProvider).snapshot;
    final bookingItems = sortedBookingItems();
    final visibleBookings = visibleBookingsForRequestView(bookingItems);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Yêu cầu đặt lịch',
              style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Đăng nhập để nhận yêu cầu đặt lịch.'
                : 'Xem yêu cầu trực tiếp, cơ hội công khai và công việc sẵn sàng trò chuyện.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: auth == null
                ? (localDemoAccessEnabled ? signInAndLoad : null)
                : () => loadOpenBookings(),
            icon: const Icon(Icons.login),
            label: Text(auth == null
                ? (localDemoAccessEnabled
                    ? 'Đăng nhập thử nghiệm'
                    : 'Dùng OTP điện thoại bên dưới')
                : 'Làm mới yêu cầu'),
          ),
          const SizedBox(height: 12),
          ProviderStatusPanel(
            isSignedIn: auth != null,
            isOnline: isOnline,
            isAvailabilityEnabled: isAvailabilityEnabled,
            heartbeatSnapshot: heartbeatSnapshot,
            loading: loading,
            onGoOnline: auth == null
                ? null
                : () async {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    try {
                      await goOnline();
                      await loadOpenBookings();
                    } catch (exception) {
                      setState(
                          () => error = providerAppErrorMessage(exception));
                    } finally {
                      if (mounted) {
                        setState(() => loading = false);
                      }
                    }
                  },
            onGoOffline: auth == null
                ? null
                : () async {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    try {
                      await goOffline();
                      await loadOpenBookings();
                    } catch (exception) {
                      setState(
                          () => error = providerAppErrorMessage(exception));
                    } finally {
                      if (mounted) {
                        setState(() => loading = false);
                      }
                    }
                  },
          ),
          if (loading || restoringSession) ...[
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
          const SizedBox(height: 20),
          if (auth == null)
            ProviderOtpLoginPanel(
              phoneController: loginPhoneController,
              otpController: loginOtpController,
              otpRequested: otpRequested,
              otpCooldownSeconds: otpCooldownSeconds,
              loading: loading,
              onRequestOtp: requestLoginOtp,
              onVerifyOtp: signInWithOtpAndLoad,
              onDemoLogin: signInAndLoad,
            )
          else ...[
            FutureBuilder<Map<String, dynamic>>(
              future: ref.read(providerRepositoryProvider).earningsSummary(),
              builder: (context, walletSnapshot) {
                final walletSummary =
                    walletSnapshot.data ?? const <String, dynamic>{};
                final walletBlocked =
                    providerWalletMarketplaceJoinBlocked(walletSummary);
                if (walletSnapshot.hasData &&
                    requestActionsWalletBlocked != walletBlocked) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      setState(
                          () => requestActionsWalletBlocked = walletBlocked);
                    }
                  });
                }
                return ProviderWalletGateCard(
                  summary: walletSummary,
                  error: walletSnapshot.error,
                  isLoading:
                      walletSnapshot.connectionState == ConnectionState.waiting,
                  onRefresh: () => setState(() {}),
                );
              },
            ),
            const SizedBox(height: 16),
            ProviderRequestsListSection(
              isOnline: isOnline,
              authUserId: auth.userId,
              bookingItems: bookingItems,
              visibleBookings: visibleBookings,
              requestView: requestView,
              joinedBookingIds: joinedBookingIds,
              loading: loading,
              walletBlocked: requestActionsWalletBlocked,
              filters: requestFilters,
              savingAlertPreferences: savingAlertPreferences,
              onRequestViewChanged: (value) {
                setState(() => requestView = value);
                syncVisibleRequestDetailTelemetry();
              },
              onJoin: joinBooking,
              onAccept: (booking) => respondToBooking(booking, true),
              onReject: (booking) => respondToBooking(booking, false),
              onFiltersChanged: (value) {
                setState(() => requestFilters = value);
                syncVisibleRequestDetailTelemetry();
              },
              onSaveAlertPreferences: saveBookingAlertPreferences,
            ),
          ],
        ],
      ),
    );
  }
}

const _preferredProviderRejectionReasons = <String, String>{
  'SCHEDULE_CONFLICT': 'Trùng lịch',
  'TOO_FAR': 'Khoảng cách quá xa',
  'SERVICE_UNSUPPORTED': 'Không hỗ trợ dịch vụ',
  'LOCATION_ACCESS_ISSUE': 'Không thể đến địa điểm dịch vụ',
  'SAFETY_OR_PERSONAL_REASON': 'Lý do an toàn hoặc cá nhân',
  'OTHER': 'Lý do khác',
};

class _PreferredProviderRejection {
  const _PreferredProviderRejection({
    required this.reasonCode,
    required this.reasonDetail,
  });

  final String reasonCode;
  final String reasonDetail;
}
