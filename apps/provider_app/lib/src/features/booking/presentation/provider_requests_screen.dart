import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/realtime_socket.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../earnings/presentation/provider_wallet_settlement_dialog.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_cards.dart';
import 'provider_request_guidance_helpers.dart';
import 'provider_request_panels.dart';

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> {
  final loginPhoneController = TextEditingController(text: '+84900000002');
  final loginOtpController = TextEditingController(text: '123456');
  late final RealtimeSocket _socket;
  List<dynamic> openBookings = [];
  Set<String> joinedBookingIds = {};
  bool isOnline = false;
  bool loading = false;
  bool otpRequested = false;
  bool restoringSession = true;
  bool requestActionsWalletBlocked = false;
  String requestView = 'action';
  String? statusMessage;
  String? error;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(restoreSessionAndLoad());
    });
  }

  @override
  void dispose() {
    loginPhoneController.dispose();
    loginOtpController.dispose();
    detachRealtimeListeners();
    super.dispose();
  }

  void attachRealtimeListeners() {
    detachRealtimeListeners();

    _socket.onEvent('booking.opened', (payload) {
      if (!mounted) {
        return;
      }
      setState(
          () => statusMessage = 'A new direct booking request just arrived.');
      unawaited(loadOpenBookings(showLoading: false));
    });

    _socket.onEvent('booking.matched', (payload) {
      if (!mounted) {
        return;
      }
      setState(() => statusMessage =
          'A booking was confirmed. Review the selected partner state.');
      unawaited(loadOpenBookings(showLoading: false));
    });

    _socket.onEvent('booking.expired', (payload) {
      if (!mounted) {
        return;
      }
      final booking =
          payload is Map<String, dynamic> ? payload : const <String, dynamic>{};
      final isCancelled = booking['status'] == 'CANCELLED';
      setState(() {
        statusMessage = isCancelled
            ? 'The customer cancelled a request. It was removed from your active queue.'
            : 'A booking request expired before a partner was confirmed.';
      });
      unawaited(loadOpenBookings(showLoading: false));
    });
  }

  void detachRealtimeListeners() {
    for (final event in [
      'booking.opened',
      'booking.matched',
      'booking.expired'
    ]) {
      _socket.offEvent(event);
    }
  }

  Future<void> restoreSessionAndLoad() async {
    try {
      final session =
          await ref.read(authControllerProvider.notifier).restoreSession();
      if (session != null) {
        attachRealtimeListeners();
        await goOnline();
        await startLocationHeartbeatAfterOnline();
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
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      attachRealtimeListeners();
      await goOnline();
      await startLocationHeartbeatAfterOnline();
      await loadOpenBookings();
      if (mounted) {
        setState(() => statusMessage = pushResult.message);
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
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      final result = await ref.read(authControllerProvider.notifier).requestOtp(
            phone: loginPhoneController.text.trim(),
          );
      setState(() {
        otpRequested = true;
        statusMessage = result.devOtp == null
            ? 'OTP sent to ${result.phone}. Enter the SMS code to continue.'
            : 'OTP requested for ${result.phone}. Local dev OTP: ${result.devOtp}.';
      });
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> signInWithOtpAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInWithOtp(
            phone: loginPhoneController.text.trim(),
            otp: loginOtpController.text.trim(),
          );
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      attachRealtimeListeners();
      await goOnline();
      await startLocationHeartbeatAfterOnline();
      await loadOpenBookings();
      if (mounted) {
        setState(() => statusMessage = pushResult.message);
      }
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> goOnline() async {
    await ref.read(providerRepositoryProvider).goOnline();
    setState(() {
      isOnline = true;
      statusMessage = 'You are online and visible for direct booking requests.';
    });
  }

  Future<void> startLocationHeartbeatAfterOnline() async {
    final heartbeat = ref.read(providerLocationHeartbeatProvider);
    await heartbeat.start(runImmediately: false);
    heartbeat.recordSuccessfulUpdate();
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
      setState(() => openBookings = bookings);
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
            'You joined this request. Waiting for the customer to choose a partner.';
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
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (accepted) {
        await ref.read(providerRepositoryProvider).acceptBooking(bookingId);
      } else {
        await ref.read(providerRepositoryProvider).rejectBooking(bookingId);
        joinedBookingIds =
            joinedBookingIds.where((id) => id != bookingId).toSet();
      }
      setState(() => statusMessage = accepted
          ? 'You accepted the booking request.'
          : 'You declined the booking request.');
      await loadOpenBookings();
    } catch (exception) {
      await handleBookingActionException(exception);
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
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
              'Wallet status could not be refreshed locally. The server will verify settlement before marketplace participation.';
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

  Future<void> startService(Map<String, dynamic> booking) async {
    final bookingId = booking['id'] as String;
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      await ref.read(providerRepositoryProvider).startBooking(bookingId);
      setState(
          () => statusMessage = 'Service started. The chat room is now live.');
      await loadOpenBookings();
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
    final heartbeatSnapshot =
        ref.watch(providerLocationHeartbeatStatusProvider).valueOrNull ??
            ref.read(providerLocationHeartbeatProvider).snapshot;
    final bookingItems = openBookings.whereType<Map<String, dynamic>>().toList()
      ..sort((left, right) {
        final leftPriority = providerRequestPriority(left, auth?.userId);
        final rightPriority = providerRequestPriority(right, auth?.userId);
        if (leftPriority != rightPriority) {
          return rightPriority.compareTo(leftPriority);
        }
        return bookingTimestamp(right).compareTo(bookingTimestamp(left));
      });
    final visibleBookings = bookingItems.where((booking) {
      if (requestView == 'chat') {
        return isProviderAppChatVisible(booking);
      }
      if (requestView == 'all') {
        return true;
      }
      return !isProviderAppChatVisible(booking);
    }).toList();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Direct booking requests',
              style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Login to receive direct booking requests.'
                : 'Accept or reject bookings sent directly to you.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: auth == null ? signInAndLoad : () => loadOpenBookings(),
            icon: const Icon(Icons.login),
            label:
                Text(auth == null ? 'Demo partner login' : 'Refresh requests'),
          ),
          const SizedBox(height: 12),
          ProviderStatusPanel(
            isSignedIn: auth != null,
            isOnline: isOnline,
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
                      await startLocationHeartbeatAfterOnline();
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
            RequestFlowBar(
              activeStep: !isOnline
                  ? 0
                  : (bookingItems.any(isProviderAppChatVisible)
                      ? 3
                      : (bookingItems.any((item) => item['status'] == 'MATCHED')
                          ? 2
                          : 1)),
            ),
            const SizedBox(height: 16),
            RequestQueueSummary(
              totalRequests: bookingItems.length,
              preferredRequests: bookingItems.where((booking) {
                final preferredProvider = booking['preferredProvider'];
                return preferredProvider is Map<String, dynamic> &&
                    preferredProvider['userId'] == auth.userId;
              }).length,
              backupRequests: bookingItems.where((booking) {
                final preferredProvider = booking['preferredProvider'];
                return preferredProvider is Map<String, dynamic> &&
                    preferredProvider['userId'] != auth.userId;
              }).length,
              chatReady: bookingItems.where(isProviderAppChatVisible).length,
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Action needed'),
                  selected: requestView == 'action',
                  onSelected: (_) => setState(() => requestView = 'action'),
                ),
                ChoiceChip(
                  label: const Text('Chat ready'),
                  selected: requestView == 'chat',
                  onSelected: (_) => setState(() => requestView = 'chat'),
                ),
                ChoiceChip(
                  label: const Text('All requests'),
                  selected: requestView == 'all',
                  onSelected: (_) => setState(() => requestView = 'all'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            InfoCard(
              text:
                  'Showing ${visibleBookings.length} of ${bookingItems.length} request(s) - ${requestView == 'action' ? 'Requests that still need action' : requestView == 'chat' ? 'Requests with chat already unlocked' : 'All loaded requests'}',
            ),
            const SizedBox(height: 16),
            if (bookingItems.isEmpty)
              const InfoCard(
                  text:
                      'No direct requests yet. Once a customer books your profile, it will appear here.')
            else if (visibleBookings.isEmpty)
              const InfoCard(
                  text:
                      'No requests match this filter right now. Switch filters to review older items.')
            else
              for (final booking in visibleBookings)
                Builder(
                  builder: (context) {
                    final preferredProvider = booking['preferredProvider'];
                    final isPreferredRequest =
                        preferredProvider is Map<String, dynamic> &&
                            preferredProvider['userId'] == auth.userId;
                    return OpenBookingCard(
                      booking: booking,
                      isPreferredRequest: isPreferredRequest,
                      joined: joinedBookingIds.contains(booking['id']),
                      loading: loading,
                      walletBlocked: requestActionsWalletBlocked,
                      onJoin: () => joinBooking(booking),
                      onAccept: () => respondToBooking(booking, true),
                      onReject: () => respondToBooking(booking, false),
                      onStart: () => startService(booking),
                    );
                  },
                ),
          ],
        ],
      ),
    );
  }
}
