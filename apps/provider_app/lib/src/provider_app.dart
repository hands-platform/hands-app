import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_state.dart';
import 'core/realtime_socket.dart';
import 'core/provider_value_helpers.dart';
import 'features/booking/presentation/provider_booking_service_helpers.dart';
import 'features/chat/presentation/provider_chat_screen.dart';
import 'features/booking/presentation/provider_jobs_helpers.dart';
import 'features/booking/presentation/provider_request_guidance_helpers.dart';
import 'features/earnings/presentation/provider_earnings_screen.dart';
import 'features/earnings/presentation/provider_wallet_gate_helpers.dart';
import 'features/earnings/presentation/provider_wallet_settlement_widgets.dart';
import 'features/provider_profile/presentation/provider_error_helpers.dart';
import 'features/provider_profile/presentation/provider_feedback_cards.dart';
import 'features/provider_profile/presentation/provider_profile_screen.dart';

export 'core/provider_value_helpers.dart';
export 'features/booking/presentation/provider_booking_service_helpers.dart';
export 'features/booking/presentation/provider_jobs_helpers.dart';
export 'features/booking/presentation/provider_request_guidance_helpers.dart';
export 'features/earnings/presentation/provider_wallet_gate_helpers.dart';
export 'features/map/presentation/provider_location_preview.dart';
export 'features/provider_profile/presentation/provider_error_helpers.dart';
export 'features/provider_profile/presentation/provider_feedback_cards.dart';
export 'features/provider_profile/presentation/provider_profile_screen.dart';
export 'features/provider_profile/presentation/provider_public_media_review_helpers.dart';

class ProviderApp extends StatelessWidget {
  const ProviderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Partner',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const ProviderShell(),
    );
  }
}

class ProviderShell extends ConsumerStatefulWidget {
  const ProviderShell({super.key});

  @override
  ConsumerState<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends ConsumerState<ProviderShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = const [
      RequestsScreen(),
      PartnerJobsScreen(),
      EarningsScreen(),
      ChatScreen(),
      ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.radar_outlined), label: 'Requests'),
          NavigationDestination(
              icon: Icon(Icons.work_history_outlined), label: 'Jobs'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined), label: 'Earnings'),
          NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(
              icon: Icon(Icons.verified_user_outlined), label: 'Profile'),
        ],
      ),
    );
  }
}

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

    final settlementView = ProviderWalletSettlementView.fromSummary(summary);

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        return AlertDialog(
          icon: const Icon(Icons.lock_outline),
          title: const Text('Settlement required'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  settlementView.reasonLabel,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Text(
                  'You cannot participate in this marketplace booking until unpaid HANDS fees are settled.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                Text(
                  'Amount to settle: ${settlementView.amountLabel}',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(settlementView.instruction),
                if (settlementView.reference != null) ...[
                  const SizedBox(height: 12),
                  WalletSettlementReferenceCard(
                    reference: settlementView.reference!,
                    amountLabel: settlementView.amountLabel,
                  ),
                ],
                const SizedBox(height: 12),
                WalletSettlementChecklist(items: settlementView.steps),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
            FilledButton.icon(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                setState(() {});
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh wallet'),
            ),
          ],
        );
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

class ProviderOtpLoginPanel extends StatelessWidget {
  const ProviderOtpLoginPanel({
    super.key,
    required this.phoneController,
    required this.otpController,
    required this.otpRequested,
    required this.loading,
    required this.onRequestOtp,
    required this.onVerifyOtp,
    required this.onDemoLogin,
  });

  final TextEditingController phoneController;
  final TextEditingController otpController;
  final bool otpRequested;
  final bool loading;
  final VoidCallback onRequestOtp;
  final VoidCallback onVerifyOtp;
  final VoidCallback onDemoLogin;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Partner login',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Use phone OTP for the production partner account, or local demo login while testing direct booking requests.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Phone number',
                hintText: '+84900000002',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'OTP code',
                hintText: '123456',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: loading ? null : onRequestOtp,
                    icon: const Icon(Icons.sms_outlined),
                    label: Text(otpRequested ? 'Resend OTP' : 'Request OTP'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: loading ? null : onVerifyOtp,
                    icon: const Icon(Icons.login),
                    label: const Text('Verify'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: loading ? null : onDemoLogin,
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('Use local demo login'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ProviderStatusPanel extends StatelessWidget {
  const ProviderStatusPanel({
    super.key,
    required this.isSignedIn,
    required this.isOnline,
    required this.heartbeatSnapshot,
    required this.loading,
    required this.onGoOnline,
  });

  final bool isSignedIn;
  final bool isOnline;
  final ProviderLocationHeartbeatSnapshot heartbeatSnapshot;
  final bool loading;
  final VoidCallback? onGoOnline;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: isOnline
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Icon(
                  isOnline ? Icons.radar_outlined : Icons.power_settings_new),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(isOnline ? 'Online available' : 'Offline',
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    isOnline
                        ? providerLocationHeartbeatLabel(heartbeatSnapshot)
                        : 'Go online to receive direct booking requests.',
                  ),
                  if (isOnline && heartbeatSnapshot.lastError != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Last saved location remains visible to customers.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.error,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            FilledButton.tonal(
              onPressed: !isSignedIn || loading || isOnline ? null : onGoOnline,
              child: const Text('Go online'),
            ),
          ],
        ),
      ),
    );
  }
}

class PartnerJobsScreen extends ConsumerStatefulWidget {
  const PartnerJobsScreen({super.key});

  @override
  ConsumerState<PartnerJobsScreen> createState() => _PartnerJobsScreenState();
}

class _PartnerJobsScreenState extends ConsumerState<PartnerJobsScreen> {
  List<dynamic> bookings = [];
  bool loading = false;
  String? error;
  String? statusMessage;

  Future<void> signInAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (ref.read(authControllerProvider) == null) {
        await ref.read(authControllerProvider.notifier).signInDemoProvider();
      }
      await loadJobs(showLoading: false);
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadJobs({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final loaded = await ref.read(providerRepositoryProvider).listBookings();
      if (!mounted) {
        return;
      }
      setState(() {
        bookings = loaded;
        statusMessage = 'Jobs refreshed with ${loaded.length} booking(s).';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final items = bookings.whereType<Map<String, dynamic>>().toList()
      ..sort((left, right) =>
          bookingTimestamp(right).compareTo(bookingTimestamp(left)));
    final activeCount = items.where(isProviderActiveBooking).length;
    final completedCount =
        items.where((booking) => booking['status'] == 'COMPLETED').length;
    final closedCount = items.where(isProviderClosedBooking).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Jobs', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Today, active service states, and closed booking records.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed:
                loading ? null : (auth == null ? signInAndLoad : loadJobs),
            icon: const Icon(Icons.work_history_outlined),
            label: Text(auth == null ? 'Demo partner login' : 'Refresh jobs'),
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
          PartnerJobsSummary(
              active: activeCount,
              completed: completedCount,
              closed: closedCount),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(text: 'Login first to load your partner job queue.')
          else if (items.isEmpty)
            const InfoCard(
                text: 'No assigned, joined, or completed bookings yet.')
          else
            for (final booking in items) PartnerJobsCard(booking: booking),
        ],
      ),
    );
  }
}

class PartnerJobsSummary extends StatelessWidget {
  const PartnerJobsSummary({
    super.key,
    required this.active,
    required this.completed,
    required this.closed,
  });

  final int active;
  final int completed;
  final int closed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Active',
              value: '$active live',
              tone: const Color(0xFFEAF2FF)),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Done',
              value: '$completed complete',
              tone: const Color(0xFFEAF5E3)),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Closed',
              value: '$closed closed',
              tone: const Color(0xFFF8ECD4)),
        ),
      ],
    );
  }
}

class PartnerJobsCard extends StatelessWidget {
  const PartnerJobsCard({super.key, required this.booking});

  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final service = providerBookingService(booking);
    final address = asMap(booking['address']);
    final payment = asMap(booking['payment']);
    final selectedProvider = asMap(booking['selectedProvider']);
    final isAssigned = selectedProvider != null;
    final amount = payment?['amount'] ?? service?['basePrice'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.event_available_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    providerServiceOptionLabel(service),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                ProviderRequestTag(
                    label: booking['status']?.toString() ?? 'UNKNOWN',
                    highlighted: isAssigned),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderRequestTag(
                    label:
                        'Opened ${formatRequestOpenedMoment(booking['createdAt'] ?? booking['scheduledStartAt'])}'),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(label: '${formatCurrency(amount)} VND'),
                ProviderRequestTag(
                    label: payment?['status']?.toString() ?? 'NO_PAYMENT'),
              ],
            ),
            const SizedBox(height: 10),
            Text(address?['line1']?.toString() ?? 'Guest address pending'),
            const SizedBox(height: 6),
            Text(
              partnerJobNextAction(booking),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}

class RequestFlowBar extends StatelessWidget {
  const RequestFlowBar({super.key, required this.activeStep});

  final int activeStep;

  @override
  Widget build(BuildContext context) {
    final steps = ['Online', 'Request', 'Accept', 'Chat'];
    return Row(
      children: [
        for (var index = 0; index < steps.length; index++)
          Expanded(
            child: Padding(
              padding:
                  EdgeInsets.only(right: index == steps.length - 1 ? 0 : 6),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: index <= activeStep
                      ? Theme.of(context).colorScheme.primaryContainer
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(steps[index], textAlign: TextAlign.center),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class RequestQueueSummary extends StatelessWidget {
  const RequestQueueSummary({
    super.key,
    required this.totalRequests,
    required this.preferredRequests,
    required this.backupRequests,
    required this.chatReady,
  });

  final int totalRequests;
  final int preferredRequests;
  final int backupRequests;
  final int chatReady;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: RequestSummaryCard(
                label: 'Queue',
                value: '$totalRequests active',
                tone: const Color(0xFFEAF2FF),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Direct',
                value: '$preferredRequests first-pick',
                tone: const Color(0xFFEAF5E3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: RequestSummaryCard(
                label: 'Marketplace',
                value: '$backupRequests standby',
                tone: const Color(0xFFFBF0DE),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Chat',
                value: '$chatReady ready',
                tone: const Color(0xFFF2EAFE),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class ProviderWalletGateCard extends StatelessWidget {
  const ProviderWalletGateCard({
    super.key,
    required this.summary,
    required this.isLoading,
    required this.onRefresh,
    this.error,
  });

  final Map<String, dynamic> summary;
  final bool isLoading;
  final VoidCallback onRefresh;
  final Object? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final settlementView = ProviderWalletSettlementView.fromSummary(summary);

    if (isLoading) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Checking wallet settlement before marketplace participation.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      color: settlementView.blocked
          ? colorScheme.errorContainer
          : colorScheme.primaryContainer.withValues(alpha: 0.55),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  settlementView.blocked
                      ? Icons.lock_outline
                      : Icons.account_balance_wallet_outlined,
                  color: settlementView.blocked
                      ? colorScheme.onErrorContainer
                      : colorScheme.onPrimaryContainer,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    settlementView.blocked
                        ? 'Wallet settlement required'
                        : 'Wallet clear',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  settlementView.balanceLabel,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              settlementView.statusLabel,
              style: theme.textTheme.labelLarge?.copyWith(
                color: settlementView.blocked
                    ? colorScheme.onErrorContainer
                    : colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              settlementView.blocked
                  ? settlementView.reasonLabel
                  : 'You can join marketplace and direct booking requests.',
            ),
            if (settlementView.blocked) ...[
              const SizedBox(height: 8),
              Text(
                'Amount to settle: ${settlementView.amountLabel}',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(settlementView.instruction),
              if (settlementView.reference != null) ...[
                const SizedBox(height: 10),
                WalletSettlementReferenceCard(
                  reference: settlementView.reference!,
                  amountLabel: settlementView.amountLabel,
                ),
              ],
              const SizedBox(height: 10),
              WalletSettlementChecklist(items: settlementView.steps),
              const SizedBox(height: 10),
              FilledButton.tonalIcon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh wallet status'),
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                'Wallet status could not be refreshed. Booking actions will still show the server decision.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class RequestSummaryCard extends StatelessWidget {
  const RequestSummaryCard({
    super.key,
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tone,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: Colors.black54, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class InlineRequestFact extends StatelessWidget {
  const InlineRequestFact({
    super.key,
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.black54,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class OpenBookingCard extends StatelessWidget {
  const OpenBookingCard({
    super.key,
    required this.booking,
    required this.isPreferredRequest,
    required this.joined,
    required this.loading,
    required this.walletBlocked,
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
    required this.onStart,
  });

  final Map<String, dynamic> booking;
  final bool isPreferredRequest;
  final bool joined;
  final bool loading;
  final bool walletBlocked;
  final VoidCallback onJoin;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final services = booking['services'] is List<dynamic>
        ? booking['services'] as List<dynamic>
        : [];
    final firstService = services.isNotEmpty
        ? services.first as Map<String, dynamic>
        : <String, dynamic>{};
    final service = firstService['service'] as Map<String, dynamic>?;
    final participants = booking['participants'] is List<dynamic>
        ? booking['participants'] as List<dynamic>
        : [];
    final preferredProvider =
        booking['preferredProvider'] as Map<String, dynamic>?;
    final payment = asMap(booking['payment']);
    final hasPreferredProvider = preferredProvider != null;
    final hasChat = isProviderAppChatVisible(booking);
    final isMatched = booking['status'] == 'MATCHED';
    final walletBlocksMarketplaceJoin = providerWalletBlocksMarketplaceJoin(
      walletBlocked: walletBlocked,
      isPreferredRequest: isPreferredRequest,
      isMatched: isMatched,
      joined: joined,
    );
    final isCashBooking = providerBookingIsCash(booking);
    final customerAmount = payment?['amount'] ?? service?['basePrice'];
    final customerAddress = booking['address'] as Map<String, dynamic>?;
    final customerName = customerAddress?['name']?.toString() ?? 'Guest';
    final customerPhone = customerAddress?['phone']?.toString();
    final bookingId = booking['id']?.toString() ?? '';
    final shortBookingId =
        bookingId.length <= 8 ? bookingId : bookingId.substring(0, 8);
    final updatedLabel =
        formatRelativeMoment(booking['updatedAt'] ?? booking['createdAt']);
    final openedLabel = formatRequestOpenedMoment(
        booking['createdAt'] ?? booking['scheduledStartAt']);
    final guidance = providerRequestGuidance(
      booking: booking,
      isPreferredRequest: isPreferredRequest,
      joined: joined,
      walletBlocked: walletBlocked,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.spa_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(providerServiceOptionLabel(service),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(
                        '$customerName${customerPhone == null ? '' : ' - $customerPhone'}',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.black54),
                      ),
                      Text(
                          '${booking['status']} - ${participants.length} partner(s) joined'),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isPreferredRequest
                        ? const Color(0xFFE7F2DE)
                        : (hasPreferredProvider
                            ? const Color(0xFFF8ECD4)
                            : const Color(0xFFE5ECFB)),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    isPreferredRequest
                        ? 'Preferred'
                        : (hasPreferredProvider ? 'Marketplace' : 'Open'),
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderRequestTag(label: guidance.modeLabel),
                ProviderRequestTag(
                    label: 'Booking $shortBookingId', highlighted: true),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(
                    label: '${formatCurrency(customerAmount)} VND'),
                ProviderRequestTag(
                    label: providerMatchingWindowTagLabel(booking)),
                ProviderRequestTag(
                    label: providerBackupRadiusTagLabel(booking)),
                ProviderRequestTag(
                  label: payment?['method']?.toString() ??
                      (isCashBooking ? 'CASH' : 'PAYMENT'),
                  highlighted: isCashBooking,
                ),
                if (updatedLabel != 'Updated just now')
                  ProviderRequestTag(label: updatedLabel),
              ],
            ),
            const SizedBox(height: 10),
            Text('Opened: $openedLabel'),
            if (customerAddress != null) ...[
              const SizedBox(height: 4),
              Text(
                'Guest address: ${customerAddress['line1'] ?? 'Address pending'}',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: Colors.black54),
              ),
            ],
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE4EAF2)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Guest',
                      value: customerName,
                    ),
                  ),
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Phone',
                      value: customerPhone ?? 'Pending',
                    ),
                  ),
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Priority',
                      value: guidance.priorityLabel,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: RequestSummaryCard(
                    label: 'Role',
                    value: guidance.roleLabel,
                    tone: isPreferredRequest
                        ? const Color(0xFFEAF5E3)
                        : (hasPreferredProvider
                            ? const Color(0xFFFBF0DE)
                            : const Color(0xFFEAF2FF)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: RequestSummaryCard(
                    label: 'Decision',
                    value: guidance.decisionLabel,
                    tone: isMatched
                        ? const Color(0xFFF2EAFE)
                        : const Color(0xFFF7F8FA),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F8FA),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Next action',
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    guidance.nextAction,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(guidance.contextMessage),
            if (walletBlocksMarketplaceJoin) ...[
              const SizedBox(height: 12),
              const MarketplaceJoinLockCard(),
            ] else ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isPreferredRequest
                      ? const Color(0xFFF1F8EC)
                      : const Color(0xFFF8F6EC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isPreferredRequest
                        ? const Color(0xFFD6E9C8)
                        : const Color(0xFFE7D9B7),
                  ),
                ),
                child: Text(guidance.detailMessage,
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
              const SizedBox(height: 12),
              InfoCard(text: guidance.infoMessage),
              if (isCashBooking &&
                  ((isPreferredRequest && !isMatched) ||
                      (!isPreferredRequest && !joined))) ...[
                const SizedBox(height: 12),
                InfoCard(text: providerCashBookingSettlementHint(booking)),
              ],
            ],
            const SizedBox(height: 12),
            if (isPreferredRequest && !isMatched)
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: loading ? null : onReject,
                      icon: const Icon(Icons.close),
                      label: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: loading ? null : onAccept,
                      icon: const Icon(Icons.check),
                      label: const Text('Accept request'),
                    ),
                  ),
                ],
              )
            else if (isPreferredRequest && isMatched && !hasChat)
              FilledButton.icon(
                onPressed: loading ? null : onStart,
                icon: const Icon(Icons.play_arrow_outlined),
                label: const Text('Start service chat'),
              )
            else if (isPreferredRequest && hasChat)
              const InfoCard(text: 'Chat is ready. Continue from the Chat tab.')
            else if (!joined)
              FilledButton.icon(
                onPressed:
                    loading || walletBlocksMarketplaceJoin ? null : onJoin,
                icon: Icon(walletBlocksMarketplaceJoin
                    ? Icons.lock_outline
                    : Icons.add_circle_outline),
                label: Text(providerMarketplaceJoinButtonLabel(
                  walletBlocksMarketplaceJoin: walletBlocksMarketplaceJoin,
                  hasPreferredProvider: hasPreferredProvider,
                )),
              )
            else ...[
              const InfoCard(
                  text:
                      'You are visible to the customer now. Wait for the final selection.'),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: loading ? null : onReject,
                icon: const Icon(Icons.close),
                label: const Text('Withdraw from shortlist'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class MarketplaceJoinLockCard extends StatelessWidget {
  const MarketplaceJoinLockCard({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.error.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, color: colorScheme.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Marketplace visible, join locked',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: colorScheme.onErrorContainer,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(providerWalletBlockFallbackReasonClean),
                const SizedBox(height: 8),
                Text(
                  providerWalletBlockHintClean,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onErrorContainer,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderRequestTag extends StatelessWidget {
  const ProviderRequestTag({
    super.key,
    required this.label,
    this.highlighted = false,
  });

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFE8F2DF) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: highlighted
              ? const Color(0xFFBFD6AA)
              : Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .labelLarge
            ?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class ProviderMvpScreen extends StatelessWidget {
  const ProviderMvpScreen(
      {super.key, required this.title, this.subtitle, required this.items});

  final String title;
  final String? subtitle;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(subtitle!, style: Theme.of(context).textTheme.bodyLarge),
          ],
          const SizedBox(height: 16),
          for (final item in items)
            Card(
              child: ListTile(
                title: Text(item),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
        ],
      ),
    );
  }
}
