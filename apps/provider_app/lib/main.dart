import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'src/app_state.dart';
import 'src/core/app_config.dart';
import 'src/core/api_client.dart';
import 'src/core/realtime_socket.dart';
import 'src/features/provider_onboarding/presentation/provider_onboarding_status.dart';
import 'src/features/provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import 'src/features/provider_onboarding/presentation/widgets/provider_onboarding_forms.dart';
import 'src/features/provider_services/presentation/widgets/provider_service_pricing_card.dart';

void main() {
  runApp(const ProviderScope(child: ProviderApp()));
}

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
      ProviderScheduleScreen(),
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
      if (!await ensureWalletCanAcceptRequest()) {
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
      setState(() => error = providerAppErrorMessage(exception));
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
        if (!await ensureWalletCanAcceptRequest()) {
          return;
        }
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
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<bool> ensureWalletCanAcceptRequest() async {
    try {
      final summary =
          await ref.read(providerRepositoryProvider).earningsSummary();
      final blockReason = providerWalletBlockReason(summary);
      if (blockReason != null) {
        if (mounted) {
          setState(() {
            error = blockReason;
            statusMessage = providerWalletBlockHintKo;
          });
        }
        return false;
      }
    } catch (exception) {
      if (mounted) {
        setState(() {
          statusMessage =
              'Wallet status could not be refreshed locally. The server will verify settlement before accepting.';
        });
      }
    }
    return true;
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
                    providerWalletBlockReason(walletSummary) != null;
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

class ProviderScheduleScreen extends ConsumerStatefulWidget {
  const ProviderScheduleScreen({super.key});

  @override
  ConsumerState<ProviderScheduleScreen> createState() =>
      _ProviderScheduleScreenState();
}

class _ProviderScheduleScreenState
    extends ConsumerState<ProviderScheduleScreen> {
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
      await loadSchedule(showLoading: false);
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadSchedule({bool showLoading = true}) async {
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
                loading ? null : (auth == null ? signInAndLoad : loadSchedule),
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
          ProviderScheduleSummary(
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
            for (final booking in items) ProviderScheduleCard(booking: booking),
        ],
      ),
    );
  }
}

class ProviderScheduleSummary extends StatelessWidget {
  const ProviderScheduleSummary({
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

class ProviderScheduleCard extends StatelessWidget {
  const ProviderScheduleCard({super.key, required this.booking});

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
                        'Requested ${formatScheduleMoment(booking['scheduledStartAt'])}'),
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
              providerScheduleNextAction(booking),
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

Map<String, dynamic>? providerBookingService(Map<String, dynamic> booking) {
  final services = asList(booking['services']);
  if (services.isEmpty) {
    return null;
  }
  final service = asMap(asMap(services.first)?['service']);
  return service;
}

bool isProviderActiveBooking(Map<String, dynamic> booking) {
  return const {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE'
  }.contains(booking['status']);
}

bool isProviderClosedBooking(Map<String, dynamic> booking) {
  return const {'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'}
      .contains(booking['status']);
}

bool isProviderAppChatVisible(Map<String, dynamic>? booking) {
  if (booking == null) {
    return false;
  }
  return asMap(booking['chatRoom']) != null &&
      !isProviderClosedBooking(booking);
}

String providerScheduleNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' => 'Waiting for the guest to confirm a partner.',
    'MATCHED' => 'Prepare to start the service and unlock chat.',
    'PROVIDER_ON_THE_WAY' => 'Keep location sharing active until arrival.',
    'ARRIVED' => 'Mark the service started when the guest is ready.',
    'IN_SERVICE' => 'Complete the service after work is finished.',
    'COMPLETED' => 'Service complete. Check earnings and payout status.',
    'CANCELLED' => 'Customer cancelled. No service action is needed.',
    'REFUNDED' => 'Refunded booking. Review any admin notes if needed.',
    _ => 'Monitor this booking from Requests if action is required.',
  };
}

int providerRequestPriority(
    Map<String, dynamic> booking, String? currentUserId) {
  final preferredProvider = booking['preferredProvider'];
  final isPreferredRequest = preferredProvider is Map<String, dynamic> &&
      preferredProvider['userId'] == currentUserId;
  if (isProviderAppChatVisible(booking)) {
    return 1;
  }
  if (booking['status'] == 'MATCHED' && isPreferredRequest) {
    return 5;
  }
  if (booking['status'] == 'OPEN_MATCHING' && isPreferredRequest) {
    return 4;
  }
  if (booking['status'] == 'OPEN_MATCHING') {
    return 3;
  }
  if (booking['status'] == 'MATCHED') {
    return 2;
  }
  return 0;
}

int bookingTimestamp(Map<String, dynamic> booking) {
  final value = booking['updatedAt'] ??
      booking['createdAt'] ??
      booking['scheduledStartAt'];
  if (value is String) {
    return DateTime.tryParse(value)?.millisecondsSinceEpoch ?? 0;
  }
  return 0;
}

String formatRelativeMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Updated just now';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Updated just now';
  }
  final diff = DateTime.now().difference(parsed);
  if (diff.inMinutes < 1) {
    return 'Updated just now';
  }
  if (diff.inHours < 1) {
    return 'Updated ${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return 'Updated ${diff.inHours}h ago';
  }
  return 'Updated ${diff.inDays}d ago';
}

String providerLocationHeartbeatLabel(
    ProviderLocationHeartbeatSnapshot snapshot) {
  if (snapshot.lastError != null) {
    final retryLabel = formatNextLocationRefresh(snapshot.nextUpdateAt);
    return 'Location refresh failed. $retryLabel';
  }
  final lastSuccess = snapshot.lastSuccessAt;
  if (lastSuccess == null) {
    return snapshot.active
        ? 'Sharing location now. Auto-refresh runs every 10 minutes.'
        : 'Your last known location is saved when you go online.';
  }
  return '${formatRelativeMoment(lastSuccess.toIso8601String())}. ${formatNextLocationRefresh(snapshot.nextUpdateAt)}';
}

String formatNextLocationRefresh(DateTime? value) {
  if (value == null) {
    return 'Next refresh starts after going online.';
  }
  final diff = value.difference(DateTime.now());
  if (diff.inSeconds <= 0) {
    return 'Next refresh is due now.';
  }
  if (diff.inMinutes < 1) {
    return 'Next refresh in under 1m.';
  }
  return 'Next refresh in ${diff.inMinutes}m.';
}

String formatScheduleMoment(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'Soon';
  }
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) {
    return 'Soon';
  }
  final hour = parsed.hour.toString().padLeft(2, '0');
  final minute = parsed.minute.toString().padLeft(2, '0');
  return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')} $hour:$minute';
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
    final currency = summary['currency']?.toString() ?? 'VND';
    final walletBalance = providerWalletBalance(summary);
    final walletDebtAmount = asNum(summary['walletDebtAmount']) ??
        (walletBalance < 0 ? walletBalance.abs() : 0);
    final reason = providerWalletBlockReason(summary);
    final settlementInstruction = providerWalletSettlementInstruction(summary);
    final settlementSteps = providerWalletSettlementSteps(summary);
    final settlementReference = providerWalletSettlementReference(summary);
    final walletBlocked = reason != null;

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
                  'Checking wallet settlement before accepting requests.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      color: walletBlocked
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
                  walletBlocked
                      ? Icons.lock_outline
                      : Icons.account_balance_wallet_outlined,
                  color: walletBlocked
                      ? colorScheme.onErrorContainer
                      : colorScheme.onPrimaryContainer,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    walletBlocked
                        ? 'Wallet settlement required'
                        : 'Wallet clear',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  '${formatCurrency(walletBalance)} $currency',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              providerWalletStatusLabel(summary),
              style: theme.textTheme.labelLarge?.copyWith(
                color: walletBlocked
                    ? colorScheme.onErrorContainer
                    : colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              walletBlocked ? reason : 'You can accept new booking requests.',
            ),
            if (walletBlocked) ...[
              const SizedBox(height: 8),
              Text(
                'Amount to settle: ${formatCurrency(walletDebtAmount)} $currency',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(settlementInstruction),
              if (settlementReference != null) ...[
                const SizedBox(height: 10),
                _WalletSettlementReferenceCard(
                  reference: settlementReference,
                  amountLabel: '${formatCurrency(walletDebtAmount)} $currency',
                ),
              ],
              const SizedBox(height: 10),
              _WalletSettlementChecklist(items: settlementSteps),
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

class _WalletSettlementChecklist extends StatelessWidget {
  const _WalletSettlementChecklist({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle_outline, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(item, style: theme.textTheme.bodySmall)),
              ],
            ),
          ),
      ],
    );
  }
}

class _WalletSettlementReferenceCard extends StatelessWidget {
  const _WalletSettlementReferenceCard({
    required this.reference,
    required this.amountLabel,
  });

  final String reference;
  final String amountLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.72),
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Settlement reference',
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          SelectableText(
            reference,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Deposit or offset amount: $amountLabel',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: reference));
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Settlement reference copied.'),
                  ),
                );
              },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('Copy reference'),
            ),
          ),
        ],
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
    final scheduledLabel = formatScheduleMoment(booking['scheduledStartAt']);
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
            Text('Requested: $scheduledLabel'),
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
            if (walletBlocked && isPreferredRequest && !isMatched) ...[
              const SizedBox(height: 12),
              const ProviderErrorCard(
                  text: providerWalletBlockFallbackReasonClean),
              const SizedBox(height: 8),
              const InfoCard(text: providerWalletBlockHintClean),
            ] else if (isCashBooking &&
                ((isPreferredRequest && !isMatched) ||
                    (!isPreferredRequest && !joined))) ...[
              const SizedBox(height: 12),
              InfoCard(text: providerCashBookingSettlementHint(booking)),
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
                      onPressed: loading || walletBlocked ? null : onAccept,
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
                onPressed: loading ? null : onJoin,
                icon: const Icon(Icons.add_circle_outline),
                label: Text(hasPreferredProvider
                    ? 'Offer marketplace support'
                    : 'Join open matching'),
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

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Earnings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Login to view completed service earnings.'
                : 'Track gross revenue, platform fees, tax withholding, and net payout.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(
                text: 'Demo partner login is available on the Requests tab.')
          else
            FutureBuilder<List<dynamic>>(
              future: ref.read(providerRepositoryProvider).earnings(),
              builder: (context, earningsSnapshot) {
                return FutureBuilder<Map<String, dynamic>>(
                  future:
                      ref.read(providerRepositoryProvider).earningsSummary(),
                  builder: (context, summarySnapshot) {
                    if (earningsSnapshot.connectionState ==
                            ConnectionState.waiting ||
                        summarySnapshot.connectionState ==
                            ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final summary = summarySnapshot.data ?? <String, dynamic>{};
                    final earnings = earningsSnapshot.data ?? [];
                    final currency = summary['currency'] ?? 'VND';
                    final walletBalance = asNum(summary['walletBalance']) ??
                        ((asNum(summary['pendingNetAmount']) ?? 0) +
                            (asNum(summary['availableNetAmount']) ?? 0));
                    final walletBlocked = summary['walletBlocked'] == true;
                    final walletBlockReason =
                        summary['walletBlockReason']?.toString();
                    final walletDebtAmount =
                        asNum(summary['walletDebtAmount']) ??
                            (walletBalance < 0 ? walletBalance.abs() : 0);
                    final walletSettlementInstruction =
                        providerWalletSettlementInstruction(summary);
                    final walletStatusLabel =
                        providerWalletStatusLabel(summary);
                    final walletSettlementSteps =
                        providerWalletSettlementSteps(summary);
                    final walletSettlementReference =
                        providerWalletSettlementReference(summary);

                    return FutureBuilder<List<dynamic>>(
                      future:
                          ref.read(providerRepositoryProvider).payoutBatches(),
                      builder: (context, payoutSnapshot) {
                        final batches = payoutSnapshot.data ?? [];
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Card(
                              color: walletBlocked
                                  ? Theme.of(context).colorScheme.errorContainer
                                  : Theme.of(context)
                                      .colorScheme
                                      .primaryContainer,
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Wallet balance',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${formatCurrency(walletBalance)} $currency',
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      walletStatusLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      walletBlocked
                                          ? (walletBlockReason ??
                                              'Unsettled cash service fees must be paid before accepting new bookings.')
                                          : 'You can accept new booking requests.',
                                    ),
                                    if (walletBlocked) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                        'Amount to settle: ${formatCurrency(walletDebtAmount)} $currency',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(walletSettlementInstruction),
                                      if (walletSettlementReference !=
                                          null) ...[
                                        const SizedBox(height: 10),
                                        _WalletSettlementReferenceCard(
                                          reference: walletSettlementReference,
                                          amountLabel:
                                              '${formatCurrency(walletDebtAmount)} $currency',
                                        ),
                                      ],
                                      const SizedBox(height: 10),
                                      _WalletSettlementChecklist(
                                        items: walletSettlementSteps,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Net payout',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${summary['netAmount'] ?? 0} $currency',
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                        'Tax withholding ${summary['taxAmount'] ?? 0} $currency'),
                                    Text(
                                        'Platform fee ${summary['platformFee'] ?? 0} $currency'),
                                    Text('Payout batches ${batches.length}'),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (earnings.isEmpty)
                              const InfoCard(
                                  text: 'Completed jobs will appear here.')
                            else
                              for (final earning in earnings)
                                Card(
                                  child: ListTile(
                                    title: Text(
                                        '${earning['netAmount']} ${earning['currency'] ?? currency}'),
                                    subtitle: Text(
                                        'Booking ${earning['bookingId']} - ${earning['status']}'),
                                    trailing: Text(
                                        '${earning['platformFee'] ?? 0} fee'),
                                  ),
                                ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}

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
            ? 'The guest picked you. Start the service from Requests to unlock chat.'
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
                : 'Realtime messages with the customer during service.',
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
                    'Chat opens after the guest confirms you and the service start step begins.')
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

class ProviderLocationPreviewCard extends StatelessWidget {
  const ProviderLocationPreviewCard({
    super.key,
    required this.customerLatitude,
    required this.customerLongitude,
    required this.latitude,
    required this.longitude,
    required this.lastSharedAt,
  });

  final double? customerLatitude;
  final double? customerLongitude;
  final double? latitude;
  final double? longitude;
  final DateTime? lastSharedAt;

  @override
  Widget build(BuildContext context) {
    final hasLocation = latitude != null && longitude != null;
    final statusColor = hasLocation ? const Color(0xFF5E8E4A) : Colors.black54;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Shared location preview',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                height: 180,
                child: ProviderMapSurface(
                  customerLatitude: customerLatitude,
                  customerLongitude: customerLongitude,
                  providerLatitude: latitude,
                  providerLongitude: longitude,
                  fallbackShowProviderPin: hasLocation,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderStatusChip(
                  label: hasLocation
                      ? 'Shared ${formatProviderSharedAt(lastSharedAt)}'
                      : 'Not shared yet',
                  color: statusColor,
                ),
                if (hasLocation)
                  ProviderStatusChip(
                    label:
                        'Lat ${formatCoordinate(latitude)} / Lng ${formatCoordinate(longitude)}',
                    color: Colors.black87,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              buildProviderLocationSummary(
                customerLatitude: customerLatitude,
                customerLongitude: customerLongitude,
                providerLatitude: latitude,
                providerLongitude: longitude,
                lastSharedAt: lastSharedAt,
              ),
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

class ProviderStatusChip extends StatelessWidget {
  const ProviderStatusChip({
    super.key,
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class ProviderMapSurface extends StatefulWidget {
  const ProviderMapSurface({
    super.key,
    required this.customerLatitude,
    required this.customerLongitude,
    required this.providerLatitude,
    required this.providerLongitude,
    required this.fallbackShowProviderPin,
  });

  final double? customerLatitude;
  final double? customerLongitude;
  final double? providerLatitude;
  final double? providerLongitude;
  final bool fallbackShowProviderPin;

  @override
  State<ProviderMapSurface> createState() => _ProviderMapSurfaceState();
}

class _ProviderMapSurfaceState extends State<ProviderMapSurface> {
  MapLibreMapController? controller;
  bool styleLoaded = false;

  @override
  void didUpdateWidget(covariant ProviderMapSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (styleLoaded) {
      unawaited(syncMarkers());
    }
  }

  LatLng? get customerPoint =>
      widget.customerLatitude == null || widget.customerLongitude == null
          ? null
          : LatLng(widget.customerLatitude!, widget.customerLongitude!);

  LatLng? get providerPoint =>
      widget.providerLatitude == null || widget.providerLongitude == null
          ? null
          : LatLng(widget.providerLatitude!, widget.providerLongitude!);

  Future<void> syncMarkers() async {
    final map = controller;
    final customer = customerPoint;
    if (map == null || !styleLoaded || customer == null) {
      return;
    }
    await map.clearCircles();
    await map.clearSymbols();
    await map.addCircle(CircleOptions(
      geometry: customer,
      circleColor: '#5E8E4A',
      circleRadius: 8,
      circleStrokeColor: '#FFFFFF',
      circleStrokeWidth: 2,
    ));
    await map.addSymbol(SymbolOptions(
      geometry: customer,
      textField: 'Customer',
      textSize: 13,
      textColor: '#111827',
      textHaloColor: '#FFFFFF',
      textHaloWidth: 1.5,
      textOffset: const Offset(0, -1.2),
    ));

    final provider = providerPoint;
    if (provider != null) {
      await map.addCircle(CircleOptions(
        geometry: provider,
        circleColor: '#E84B4B',
        circleRadius: 8,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 2,
      ));
      await map.addSymbol(SymbolOptions(
        geometry: provider,
        textField: 'You',
        textSize: 13,
        textColor: '#111827',
        textHaloColor: '#FFFFFF',
        textHaloWidth: 1.5,
        textOffset: const Offset(0, -1.2),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final customer = customerPoint;
    final provider = providerPoint;
    if (AppConfig.mapTilerEnabled && customer != null) {
      return MapLibreMap(
        styleString: AppConfig.mapTilerStyleUrl,
        initialCameraPosition: CameraPosition(
          target: provider ?? customer,
          zoom: provider == null ? 13.8 : 12.8,
        ),
        onMapCreated: (value) => controller = value,
        onStyleLoadedCallback: () {
          styleLoaded = true;
          unawaited(syncMarkers());
        },
        compassEnabled: false,
        logoEnabled: false,
        myLocationEnabled: false,
        rotateGesturesEnabled: false,
        tiltGesturesEnabled: false,
      );
    }

    return _ProviderMapPlaceholder(
        showProviderPin: widget.fallbackShowProviderPin);
  }
}

class _ProviderMapPlaceholder extends StatelessWidget {
  const _ProviderMapPlaceholder({
    required this.showProviderPin,
  });

  final bool showProviderPin;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFD8F1DF),
            Color(0xFFF0E7D7),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: ProviderMapPainter())),
          Align(
            alignment: const Alignment(-0.25, -0.08),
            child: _MapPinChip(
              label: 'Customer',
              color: const Color(0xFF5E8E4A),
            ),
          ),
          if (showProviderPin)
            Align(
              alignment: const Alignment(0.36, -0.34),
              child: _MapPinChip(
                label: 'You',
                color: const Color(0xFFE84B4B),
              ),
            ),
          Align(
            alignment: const Alignment(-0.22, -0.04),
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: const Color(0xFF5E8E4A).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapPinChip extends StatelessWidget {
  const _MapPinChip({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
          ),
          child:
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 6),
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}

class ProviderMapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = const Color(0xFFB8B8B8)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;
    final thinPaint = Paint()
      ..color = const Color(0xFFD6D6D6)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final mainRoad = Path()
      ..moveTo(size.width * 0.12, size.height * 0.68)
      ..quadraticBezierTo(size.width * 0.34, size.height * 0.56,
          size.width * 0.48, size.height * 0.38)
      ..quadraticBezierTo(size.width * 0.7, size.height * 0.18,
          size.width * 0.9, size.height * 0.22);
    canvas.drawPath(mainRoad, roadPaint);

    final branch = Path()
      ..moveTo(size.width * 0.44, size.height * 0.56)
      ..quadraticBezierTo(size.width * 0.34, size.height * 0.42,
          size.width * 0.24, size.height * 0.24);
    canvas.drawPath(branch, thinPaint);

    final branchTwo = Path()
      ..moveTo(size.width * 0.56, size.height * 0.44)
      ..quadraticBezierTo(size.width * 0.66, size.height * 0.58,
          size.width * 0.8, size.height * 0.74);
    canvas.drawPath(branchTwo, thinPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

String formatCoordinate(double? value) {
  if (value == null) {
    return '-';
  }
  return value.toStringAsFixed(4);
}

String buildProviderLocationSummary({
  required double? customerLatitude,
  required double? customerLongitude,
  required double? providerLatitude,
  required double? providerLongitude,
  required DateTime? lastSharedAt,
}) {
  if (providerLatitude == null || providerLongitude == null) {
    return 'Share your current pin once so the customer can see your last known location.';
  }

  final distance = approximateDistanceMeters(
    customerLatitude,
    customerLongitude,
    providerLatitude,
    providerLongitude,
  );
  final distanceText = distance == null
      ? ''
      : '\nApprox. distance to guest: ${formatDistance(distance)}';
  return 'Customers see this saved pin, not continuous tracking. Last shared ${formatProviderSharedAt(lastSharedAt)}.$distanceText';
}

String formatProviderSharedAt(DateTime? value) {
  if (value == null) {
    return 'just now';
  }
  final diff = DateTime.now().difference(value);
  if (diff.inMinutes < 1) {
    return 'just now';
  }
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}

String formatDistance(double meters) {
  if (meters >= 1000) {
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }
  return '${meters.round()} m';
}

double? approximateDistanceMeters(
  double? startLat,
  double? startLng,
  double? endLat,
  double? endLng,
) {
  if (startLat == null ||
      startLng == null ||
      endLat == null ||
      endLng == null) {
    return null;
  }
  const earthRadiusMeters = 6371000.0;
  final lat1 = _degreesToRadians(startLat);
  final lat2 = _degreesToRadians(endLat);
  final deltaLat = _degreesToRadians(endLat - startLat);
  final deltaLng = _degreesToRadians(endLng - startLng);
  final haversine = math.sin(deltaLat / 2) * math.sin(deltaLat / 2) +
      math.cos(lat1) *
          math.cos(lat2) *
          math.sin(deltaLng / 2) *
          math.sin(deltaLng / 2);
  return earthRadiusMeters *
      2 *
      math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine));
}

double _degreesToRadians(double degrees) => degrees * math.pi / 180;

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late Future<Map<String, dynamic>> _verificationFuture;
  late Future<Map<String, dynamic>> _onboardingFuture;
  late Future<Map<String, dynamic>> _profileFuture;
  final List<String> _uploadedFileIds = [];
  final Map<String, String> _uploadedOnboardingDocumentIds = {};
  bool _isUploadingProfileImage = false;
  bool _isUploadingGalleryImage = false;
  bool _isUploading = false;
  bool _isSubmitting = false;
  bool _isSavingOnboarding = false;

  @override
  void initState() {
    super.initState();
    _verificationFuture = ref.read(providerRepositoryProvider).verification();
    _onboardingFuture =
        ref.read(providerRepositoryProvider).onboardingSnapshot();
    _profileFuture = ref.read(providerRepositoryProvider).providerMe();
  }

  void _refreshVerification() {
    setState(() {
      _verificationFuture = ref.read(providerRepositoryProvider).verification();
    });
  }

  void _refreshOnboarding() {
    setState(() {
      _onboardingFuture =
          ref.read(providerRepositoryProvider).onboardingSnapshot();
    });
  }

  void _refreshProfile() {
    setState(() {
      _profileFuture = ref.read(providerRepositoryProvider).providerMe();
    });
  }

  Future<void> _runOnboardingAction(
      String successMessage, Future<void> Function() action) async {
    setState(() {
      _isSavingOnboarding = true;
    });
    try {
      await action();
      _refreshOnboarding();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(successMessage)),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Onboarding update failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSavingOnboarding = false;
        });
      }
    }
  }

  Future<void> _editBasicProfile(Map<String, dynamic> snapshot) async {
    final input = await showProviderBasicProfileSheet(
      context,
      initial: asMap(snapshot['basicProfile']) ?? <String, dynamic>{},
    );
    if (input == null) return;
    return _runOnboardingAction('Basic profile saved', () async {
      await ref
          .read(providerRepositoryProvider)
          .updateOnboardingBasicProfile(input.toJson());
    });
  }

  Future<void> _submitKycFromForm(Map<String, dynamic> snapshot) async {
    final existingDocumentTypes = asList(snapshot['documents'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(isProviderSubmittedDocumentUsableForKyc)
        .map((document) => document['type']?.toString())
        .whereType<String>()
        .toSet();
    final readyDocumentTypes = {
      ...existingDocumentTypes,
      ..._uploadedOnboardingDocumentIds.keys,
    };
    final requiredTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
    final missingTypes = requiredTypes
        .where((type) => !readyDocumentTypes.contains(type))
        .toList();
    if (missingTypes.isNotEmpty) {
      final rejectedSummaries = providerRejectedKycDocumentSummaries(
        submittedDocuments: asList(snapshot['documents']),
        uploadedDocumentIds: _uploadedOnboardingDocumentIds,
        requiredTypes: requiredTypes,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            rejectedSummaries.isNotEmpty
                ? 'Replace rejected KYC photo(s): ${rejectedSummaries.join('; ')}'
                : 'Upload required KYC photos first: ${missingTypes.map(providerDocumentTypeLabel).join(', ')}',
          ),
        ),
      );
      return;
    }

    final input = await showProviderKycSheet(context);
    if (input == null) return;
    final documents = _uploadedOnboardingDocumentIds.entries
        .map((entry) => {'type': entry.key, 'fileId': entry.value})
        .toList();
    return _runOnboardingAction('KYC request submitted for admin review',
        () async {
      await ref.read(providerRepositoryProvider).submitOnboardingKyc(
            cccdNumber: input.cccdNumber,
            documents: documents,
          );
      _uploadedOnboardingDocumentIds.clear();
      _refreshVerification();
    });
  }

  Future<void> _addBankAccountFromForm(Map<String, dynamic> snapshot) async {
    final bankAccounts = asList(snapshot['bankAccounts']);
    final initialBankAccount = bankAccounts.isEmpty
        ? <String, dynamic>{}
        : asMap(bankAccounts.first) ?? <String, dynamic>{};
    final input = await showProviderBankAccountSheet(
      context,
      initial: initialBankAccount,
      status: initialBankAccount['status']?.toString(),
      rejectionReason: reviewReason(initialBankAccount),
    );
    if (input == null) return;
    return _runOnboardingAction('Bank account submitted for review', () async {
      await ref.read(providerRepositoryProvider).createOnboardingBankAccount(
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            accountHolderName: input.accountHolderName,
            qrBankingInfo: input.qrBankingInfo,
          );
    });
  }

  Future<void> _addTaxProfileFromForm(Map<String, dynamic> snapshot) async {
    final taxProfile = asMap(snapshot['taxProfile']) ?? <String, dynamic>{};
    final input = await showProviderTaxProfileSheet(
      context,
      initial: taxProfile,
      basicProfile: asMap(snapshot['basicProfile']) ?? <String, dynamic>{},
      status: taxProfile['status']?.toString(),
      rejectionReason: reviewReason(taxProfile),
    );
    if (input == null) return;
    return _runOnboardingAction('Tax profile submitted for review', () async {
      await ref.read(providerRepositoryProvider).upsertOnboardingTaxProfile(
            taxCode: input.taxCode,
            legalName: input.legalName,
            registeredAddress: input.registeredAddress,
          );
    });
  }

  Future<void> _acceptAgreementsFromForm(Map<String, dynamic> snapshot) async {
    final input = await showProviderAgreementsSheet(
      context,
      accepted: asList(snapshot['agreements']),
      requiredTypes: requiredPayoutAgreementTypesFromSnapshot(snapshot),
      version: providerAgreementVersionFromSnapshot(snapshot),
    );
    if (input == null) return;
    return _runOnboardingAction('Required agreements accepted', () async {
      for (final type in input.types) {
        await ref.read(providerRepositoryProvider).acceptOnboardingAgreement(
              type: type,
              version: input.version,
              deviceId: input.deviceId.isEmpty ? null : input.deviceId,
            );
      }
    });
  }

  Future<void> _pickAndUploadVerificationFile(String documentType) async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2400,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploading = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      final completedFile = await ref
          .read(providerRepositoryProvider)
          .uploadVerificationFile(bytes: bytes, contentType: contentType);
      final fileId = completedFile['id']?.toString();
      if (fileId != null && fileId.isNotEmpty) {
        _uploadedFileIds.add(fileId);
        _uploadedOnboardingDocumentIds[documentType] = fileId;
      }
      _refreshVerification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${providerDocumentTypeLabel(documentType)} uploaded: ${image.name}',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadProfileImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploadingProfileImage = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      await ref
          .read(providerRepositoryProvider)
          .uploadProfileImage(bytes: bytes, contentType: contentType);
      if (mounted) {
        _refreshProfile();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  'Profile image uploaded for admin review: ${image.name}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Profile image upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingProfileImage = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadGalleryImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1800,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploadingGalleryImage = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      await ref
          .read(providerRepositoryProvider)
          .uploadGalleryImage(bytes: bytes, contentType: contentType);
      if (mounted) {
        _refreshProfile();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Work photo uploaded for admin review: ${image.name}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Work photo upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingGalleryImage = false;
        });
      }
    }
  }

  Future<void> _submitVerification(List<dynamic> existingFiles) async {
    final uploadedExistingIds = existingFiles
        .whereType<Map>()
        .where((file) => file['uploadStatus']?.toString() == 'UPLOADED')
        .map((file) => file['id']?.toString())
        .whereType<String>()
        .toList();
    final fileIds = <String>{...uploadedExistingIds, ..._uploadedFileIds}
        .where((id) => id.isNotEmpty)
        .toList();

    if (fileIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Upload at least one verification file first.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });
    try {
      await ref
          .read(providerRepositoryProvider)
          .submitVerification(fileIds: fileIds);
      _uploadedFileIds.clear();
      _refreshVerification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification submitted')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submit failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
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
          Text('Profile', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Not signed in'
                : 'Signed in as ${auth.user['phone']}',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth != null) ...[
            FutureBuilder<Map<String, dynamic>>(
              future: _onboardingFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                return _ProviderOnboardingCard(
                  snapshot: snapshot.data ?? <String, dynamic>{},
                  error: snapshot.error,
                  isSaving: _isSavingOnboarding,
                  onRefresh: _refreshOnboarding,
                  onFillBasicProfile: () =>
                      _editBasicProfile(snapshot.data ?? <String, dynamic>{}),
                  onSubmitKyc: () =>
                      _submitKycFromForm(snapshot.data ?? <String, dynamic>{}),
                  onAddBankAccount: () => _addBankAccountFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                  onAddTaxProfile: () => _addTaxProfileFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                  onAcceptAgreements: () => _acceptAgreementsFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                );
              },
            ),
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              onPressed:
                  _isUploadingProfileImage ? null : _pickAndUploadProfileImage,
              icon: const Icon(Icons.image_outlined),
              label: Text(_isUploadingProfileImage
                  ? 'Uploading profile image...'
                  : 'Upload public profile image'),
            ),
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              onPressed:
                  _isUploadingGalleryImage ? null : _pickAndUploadGalleryImage,
              icon: const Icon(Icons.photo_library_outlined),
              label: Text(_isUploadingGalleryImage
                  ? 'Uploading work photo...'
                  : 'Upload public work photo'),
            ),
            const SizedBox(height: 12),
            FutureBuilder<Map<String, dynamic>>(
              future: _profileFuture,
              builder: (context, snapshot) {
                return _ProviderPublicMediaReviewCard(
                  profile: snapshot.data ?? <String, dynamic>{},
                  error: snapshot.error,
                  isLoading:
                      snapshot.connectionState == ConnectionState.waiting,
                  onRefresh: _refreshProfile,
                );
              },
            ),
            const SizedBox(height: 12),
            const ProviderServicePricingCard(),
            const SizedBox(height: 12),
          ],
          if (auth == null)
            const InfoCard(text: 'Login first to manage verification.')
          else
            FutureBuilder<Map<String, dynamic>>(
              future: _verificationFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final verification = snapshot.data ?? <String, dynamic>{};
                final files = verification['files'] is List<dynamic>
                    ? verification['files'] as List<dynamic>
                    : [];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: ListTile(
                        title: Text(
                            'Verification ${verification['status'] ?? 'DRAFT'}'),
                        subtitle: Text(
                          verification['rejectionReason'] == null
                              ? '${files.length} file(s) attached'
                              : '${verification['rejectionReason']}',
                        ),
                        trailing: const Icon(Icons.verified_user_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (snapshot.hasError) ...[
                      ErrorCard(
                          text: 'Verification load failed: ${snapshot.error}'),
                      const SizedBox(height: 12),
                    ],
                    FutureBuilder<Map<String, dynamic>>(
                      future: _onboardingFuture,
                      builder: (context, onboardingSnapshot) {
                        final onboarding =
                            onboardingSnapshot.data ?? <String, dynamic>{};
                        return ProviderDocumentUploadSlots(
                          uploadedDocumentIds: _uploadedOnboardingDocumentIds,
                          submittedDocuments: asList(onboarding['documents']),
                          isUploading: _isUploading,
                          onUpload: _pickAndUploadVerificationFile,
                        );
                      },
                    ),
                    if (_uploadedOnboardingDocumentIds.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      InfoCard(
                        text:
                            'Ready for KYC: ${_uploadedOnboardingDocumentIds.keys.map(providerDocumentTypeLabel).join(', ')}',
                      ),
                    ],
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: _isSubmitting || _isUploading
                          ? null
                          : () => _submitVerification(files),
                      icon: const Icon(Icons.send_outlined),
                      label: Text(_isSubmitting
                          ? 'Submitting...'
                          : 'Submit uploaded files for review'),
                    ),
                    const SizedBox(height: 12),
                    if (files.isEmpty)
                      const InfoCard(
                        text:
                            'Upload one private verification photo, then submit it for admin review.',
                      )
                    else
                      ...files.map((file) {
                        final item = asMap(file) ?? <String, dynamic>{};
                        final key =
                            item['key']?.toString() ?? 'verification file';
                        final status =
                            item['uploadStatus']?.toString() ?? 'PENDING';
                        final size = asNum(item['sizeBytes'])?.toInt();
                        final uploadedAt = item['uploadedAt']?.toString();
                        return Card(
                          child: ListTile(
                            leading: Icon(status == 'UPLOADED'
                                ? Icons.check_circle_outline
                                : Icons.pending_outlined),
                            title: Text(key),
                            subtitle: Text([
                              status,
                              if (size != null) '${(size / 1024).ceil()} KB',
                              if (uploadedAt != null) uploadedAt,
                            ].join(' / ')),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    for (final item in ['Massage menu', 'Online toggle'])
                      Card(
                        child: ListTile(
                          title: Text(item),
                          trailing: const Icon(Icons.chevron_right),
                        ),
                      ),
                  ],
                );
              },
            ),
          if (auth != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(providerRepositoryProvider).goOffline();
                ref.read(providerLocationHeartbeatProvider).stop();
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Signed out and partner is offline.')),
                  );
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProviderPublicMediaReviewCard extends StatelessWidget {
  const _ProviderPublicMediaReviewCard({
    required this.profile,
    required this.error,
    required this.isLoading,
    required this.onRefresh,
  });

  final Map<String, dynamic> profile;
  final Object? error;
  final bool isLoading;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final media = asList(profile['fileAssets'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(providerPublicMediaIsReviewable)
        .toList();
    final pendingCount = media
        .where(
            (item) => providerPublicMediaReviewStatus(item) == 'PENDING_REVIEW')
        .length;
    final approvedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'APPROVED')
        .length;
    final rejectedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'REJECTED')
        .length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.collections_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Public media review',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (isLoading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Customers only see profile photos and work photos after admin approval.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _PublicMediaReviewChip(
                  label: 'Waiting',
                  value: pendingCount,
                  color: Colors.orange.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Approved',
                  value: approvedCount,
                  color: Colors.green.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Needs changes',
                  value: rejectedCount,
                  color: Colors.red.shade700,
                ),
              ],
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                'Media review status could not be loaded: $error',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 12),
            if (media.isEmpty)
              const InfoCard(
                text:
                    'Upload a public profile image or work photo to start admin review.',
              )
            else
              ...media.take(6).map((item) => _PublicMediaReviewRow(item: item)),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_outlined),
              label: const Text('Refresh media status'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicMediaReviewChip extends StatelessWidget {
  const _PublicMediaReviewChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: CircleAvatar(
        backgroundColor: color,
        child: Text(
          value.toString(),
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ),
      label: Text(label),
    );
  }
}

class _PublicMediaReviewRow extends StatelessWidget {
  const _PublicMediaReviewRow({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final status = providerPublicMediaReviewStatus(item);
    final statusColor = providerPublicMediaReviewColor(status);
    final reason = reviewReason(item);
    final uploadedAt = item['uploadedAt']?.toString() ??
        item['createdAt']?.toString() ??
        'upload time pending';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(providerPublicMediaReviewIcon(status), color: statusColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerPublicMediaPurposeLabel(item['purpose']?.toString()),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  providerPublicMediaReviewLabel(status),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Reason: $reason'),
                ],
                const SizedBox(height: 4),
                Text(
                  uploadedAt,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProviderOnboardingCard extends StatelessWidget {
  const _ProviderOnboardingCard({
    required this.snapshot,
    required this.error,
    required this.isSaving,
    required this.onRefresh,
    required this.onFillBasicProfile,
    required this.onSubmitKyc,
    required this.onAddBankAccount,
    required this.onAddTaxProfile,
    required this.onAcceptAgreements,
  });

  final Map<String, dynamic> snapshot;
  final Object? error;
  final bool isSaving;
  final VoidCallback onRefresh;
  final Future<void> Function() onFillBasicProfile;
  final Future<void> Function() onSubmitKyc;
  final Future<void> Function() onAddBankAccount;
  final Future<void> Function() onAddTaxProfile;
  final Future<void> Function() onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final level = snapshot['level']?.toString() ?? 'LEVEL_1_SIGNUP';
    final recommended =
        snapshot['recommendedLevel']?.toString() ?? 'LEVEL_1_SIGNUP';
    final nextActions = asList(snapshot['nextRequiredActions'])
        .map((action) => action.toString())
        .toList();
    final bankAccounts = asList(snapshot['bankAccounts']);
    final documents = asList(snapshot['documents']);
    final recentLogs = asList(snapshot['recentVerificationLogs'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .toList();
    final requiredKycTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
    final payoutGate = asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
    final payoutMissing = asMap(payoutGate['missing']) ?? <String, dynamic>{};
    final canWithdraw = payoutGate['canWithdraw'] == true;
    final completedBookingCount =
        asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
    final kyc = asMap(snapshot['kyc']);
    final verification = asMap(snapshot['verification']);
    final taxProfile = asMap(snapshot['taxProfile']);
    final basicProfile = asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
    final hasBasicProfile = !nextActions.contains('BASIC_PROFILE');
    final kycStatus =
        kyc?['status']?.toString() ?? verification?['status']?.toString();
    final bankStatus = bankAccounts.isEmpty
        ? null
        : asMap(bankAccounts.first)?['status']?.toString();
    final taxStatus = taxProfile?['status']?.toString();
    final addressText = basicProfile['residentialAddress']?.toString();
    final primaryBank = bankAccounts.isEmpty ? null : asMap(bankAccounts.first);
    final kycRejectionReason = reviewReason(kyc) ?? reviewReason(verification);
    final bankRejectionReason = reviewReason(primaryBank);
    final taxRejectionReason = reviewReason(taxProfile);
    final rejectedDocuments = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where((document) => document['status']?.toString() == 'REJECTED')
        .toList();
    final rejectedRequiredSummaries = providerRejectedKycDocumentSummaries(
      submittedDocuments: documents,
      uploadedDocumentIds: const {},
      requiredTypes: requiredKycTypes,
    );
    final submittedKycRequiredCount = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(isProviderSubmittedDocumentUsableForKyc)
        .map((document) => document['type']?.toString())
        .where((type) => requiredKycTypes.contains(type))
        .toSet()
        .length;
    final kycDocumentsReady =
        submittedKycRequiredCount >= requiredKycTypes.length;
    final missingAgreementCount = (asList(payoutMissing['agreements'])).length;
    final payoutPrerequisiteReady = completedBookingCount > 0 &&
        taxStatus == 'APPROVED' &&
        (addressText?.trim().isNotEmpty ?? false) &&
        missingAgreementCount == 0;
    final payoutGateItems = providerPayoutGateItemsFromSnapshot(snapshot);
    final kycDecisionItems = providerKycDecisionChecklistFromSnapshot(snapshot);
    final levelMilestones = providerLevelMilestonesFromSnapshot(snapshot);
    final priority = providerOnboardingPriorityFromSnapshot(snapshot);
    final firstRevenuePayoutSetupActive =
        providerFirstRevenuePayoutSetupActiveFromSnapshot(snapshot);
    final priorityAction = switch (priority.actionKey) {
      'BASIC_PROFILE' => onFillBasicProfile,
      'RESIDENTIAL_ADDRESS' => onFillBasicProfile,
      'KYC_REVIEW' => onSubmitKyc,
      'BANK_ACCOUNT_REVIEW' => onAddBankAccount,
      'TAX_PROFILE_REVIEW' => onAddTaxProfile,
      'AGREEMENTS' => onAcceptAgreements,
      _ => null,
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Partner onboarding',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: isSaving ? null : onRefresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh onboarding',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _OnboardingPill(label: 'Current', value: _compactLevel(level)),
                _OnboardingPill(
                    label: 'Recommended', value: _compactLevel(recommended)),
                _OnboardingPill(
                    label: 'Completed',
                    value: '$completedBookingCount service(s)'),
                _OnboardingPill(
                    label: 'Payout',
                    value: canWithdraw ? 'Ready' : 'Locked',
                    isPositive: canWithdraw),
              ],
            ),
            const SizedBox(height: 12),
            _ProviderLevelRoadmap(milestones: levelMilestones),
            const SizedBox(height: 12),
            if (error != null) ...[
              ErrorCard(text: 'Onboarding load failed: $error'),
              const SizedBox(height: 12),
            ],
            _OnboardingPriorityPanel(
              priority: priority,
              onPressed: isSaving || priorityAction == null
                  ? null
                  : () {
                      priorityAction();
                    },
            ),
            const SizedBox(height: 12),
            if (firstRevenuePayoutSetupActive) ...[
              _FirstRevenuePayoutSetupPanel(
                completedBookingCount: completedBookingCount,
                taxStatus: taxStatus,
                addressReady: addressText?.trim().isNotEmpty ?? false,
                missingAgreementCount: missingAgreementCount,
                onAddTaxProfile: isSaving
                    ? null
                    : () {
                        onAddTaxProfile();
                      },
                onUpdateAddress: isSaving
                    ? null
                    : () {
                        onFillBasicProfile();
                      },
                onAcceptAgreements: isSaving
                    ? null
                    : () {
                        onAcceptAgreements();
                      },
              ),
              const SizedBox(height: 12),
            ],
            if (documents.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: documents.map((document) {
                    final item = asMap(document) ?? <String, dynamic>{};
                    final type = item['type']?.toString() ?? 'DOCUMENT';
                    final status = item['status']?.toString() ?? 'PENDING';
                    final rejected = status == 'REJECTED';
                    return Chip(
                      backgroundColor: rejected
                          ? Theme.of(context).colorScheme.errorContainer
                          : null,
                      label: Text(
                        '${providerDocumentTypeLabel(type)}: $status',
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (kycRejectionReason != null) ...[
              _ReviewAlert(
                title: 'KYC needs updates',
                detail: kycRejectionReason,
              ),
              const SizedBox(height: 8),
            ],
            if (rejectedDocuments.isNotEmpty) ...[
              _ReviewAlert(
                title: 'Rejected document(s)',
                detail: rejectedRequiredSummaries.isNotEmpty
                    ? '${rejectedRequiredSummaries.join('\n')}\n\nOpen the KYC checklist and replace each rejected required photo.'
                    : rejectedDocuments.map((document) {
                        final type = providerDocumentTypeLabel(
                            document['type'].toString());
                        final reason =
                            reviewReason(document) ?? 'Upload a clearer image.';
                        return '$type: $reason';
                      }).join('\n'),
              ),
              const SizedBox(height: 8),
            ],
            if (bankRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Bank account needs updates',
                detail:
                    '$bankRejectionReason\n\nOpen Bank account and submit corrected details.',
              ),
              const SizedBox(height: 8),
            ],
            if (taxRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Tax profile needs updates',
                detail:
                    '$taxRejectionReason\n\nOpen Tax profile and submit corrected MST, legal name, and registered address.',
              ),
              const SizedBox(height: 8),
            ],
            _OnboardingStepCard(
              step: '1',
              title: 'Basic profile',
              detail: addressText == null || addressText.isEmpty
                  ? 'Add legal name, public name, birthday, and service area. Tax address can wait until first earning.'
                  : addressText,
              status: hasBasicProfile ? 'Complete' : 'Required',
              complete: hasBasicProfile,
              icon: Icons.badge_outlined,
              actionLabel: hasBasicProfile ? 'Edit profile' : 'Start profile',
              onPressed: isSaving ? null : onFillBasicProfile,
            ),
            _OnboardingStepCard(
              step: '2',
              title: 'KYC verification',
              detail: rejectedRequiredSummaries.isNotEmpty
                  ? 'Replace ${rejectedRequiredSummaries.length} rejected required photo(s), then resubmit KYC.'
                  : '$submittedKycRequiredCount of ${requiredKycTypes.length} required photos ready. Status: ${kycStatus ?? 'Not submitted'}.',
              status: kycStatus == 'APPROVED'
                  ? 'Approved'
                  : kycDocumentsReady
                      ? 'Ready to submit'
                      : 'Upload documents first',
              complete: kycStatus == 'APPROVED',
              icon: Icons.verified_user_outlined,
              actionLabel: kycStatus == 'REJECTED'
                  ? 'Resubmit KYC'
                  : kycDocumentsReady
                      ? 'Submit KYC'
                      : 'Open KYC checklist',
              onPressed: isSaving ? null : onSubmitKyc,
            ),
            _KycDecisionChecklist(
              items: kycDecisionItems,
              reviewStatus: kycStatus ?? 'Not submitted',
            ),
            _OnboardingStepCard(
              step: '3',
              title: 'Bank account',
              detail: providerBankAccountStepDetail(
                status: bankStatus,
                rejectionReason: bankRejectionReason,
              ),
              status: bankStatus == 'APPROVED' ? 'Approved' : 'Required',
              complete: bankStatus == 'APPROVED',
              icon: Icons.account_balance_outlined,
              actionLabel: bankStatus == 'REJECTED'
                  ? 'Resubmit bank'
                  : bankStatus == null
                      ? 'Add bank account'
                      : 'Update bank account',
              onPressed: isSaving ? null : onAddBankAccount,
            ),
            _OnboardingStepCard(
              step: '4',
              title: 'Payout unlock',
              detail: providerTaxProfileStepDetail(
                completedBookingCount: completedBookingCount,
                status: taxStatus,
                rejectionReason: taxRejectionReason,
                missingAgreementCount: missingAgreementCount,
              ),
              status: canWithdraw
                  ? 'Withdrawals enabled'
                  : payoutPrerequisiteReady
                      ? 'Ready for admin refresh'
                      : 'Locked',
              complete: canWithdraw,
              icon: Icons.payments_outlined,
              actionLabel: completedBookingCount == 0
                  ? 'After first earning'
                  : taxStatus == 'REJECTED'
                      ? 'Resubmit tax'
                      : taxStatus == 'APPROVED'
                          ? 'Review terms'
                          : 'Add tax profile',
              onPressed: isSaving
                  ? null
                  : completedBookingCount == 0
                      ? null
                      : taxStatus == 'APPROVED'
                          ? onAcceptAgreements
                          : onAddTaxProfile,
            ),
            _PayoutGateChecklist(
              items: payoutGateItems,
              agreementVersion: providerAgreementVersionFromSnapshot(snapshot),
            ),
            _OnboardingStepCard(
              step: '5',
              title: 'Profile review',
              detail:
                  'Admin can complete an optional profile review after identity, experience, and profile evidence are reviewed.',
              status: recommended == 'LEVEL_4_TRUSTED' ? 'Complete' : 'Later',
              complete: recommended == 'LEVEL_4_TRUSTED',
              icon: Icons.workspace_premium_outlined,
            ),
            if (recentLogs.isNotEmpty) ...[
              const SizedBox(height: 6),
              _OnboardingHistoryList(logs: recentLogs),
            ],
            if (isSaving) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}

class _FirstRevenuePayoutSetupPanel extends StatelessWidget {
  const _FirstRevenuePayoutSetupPanel({
    required this.completedBookingCount,
    required this.taxStatus,
    required this.addressReady,
    required this.missingAgreementCount,
    required this.onAddTaxProfile,
    required this.onUpdateAddress,
    required this.onAcceptAgreements,
  });

  final int completedBookingCount;
  final String? taxStatus;
  final bool addressReady;
  final int missingAgreementCount;
  final VoidCallback? onAddTaxProfile;
  final VoidCallback? onUpdateAddress;
  final VoidCallback? onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final taxReady = taxStatus == 'APPROVED';
    final agreementsReady = missingAgreementCount == 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.tertiaryContainer.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colorScheme.tertiary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.account_balance_wallet_outlined,
                  color: colorScheme.tertiary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'First earning recorded',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$completedBookingCount completed service(s). Finish tax, address, and payout agreements before withdrawal. You can still receive bookings unless the HANDS wallet is negative.',
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _PayoutSetupStatusRow(
            label: 'Tax profile',
            value: taxReady ? 'Approved' : taxStatus ?? 'Missing',
            complete: taxReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Residential address',
            value: addressReady ? 'Saved' : 'Missing',
            complete: addressReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Payout agreements',
            value: agreementsReady ? 'Accepted' : '$missingAgreementCount left',
            complete: agreementsReady,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!taxReady)
                FilledButton.tonalIcon(
                  onPressed: onAddTaxProfile,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: Text(
                    taxStatus == 'REJECTED' ? 'Resubmit tax' : 'Add tax',
                  ),
                ),
              if (!addressReady)
                FilledButton.tonalIcon(
                  onPressed: onUpdateAddress,
                  icon: const Icon(Icons.home_outlined),
                  label: const Text('Update address'),
                ),
              if (!agreementsReady)
                FilledButton.tonalIcon(
                  onPressed: onAcceptAgreements,
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Accept agreements'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayoutSetupStatusRow extends StatelessWidget {
  const _PayoutSetupStatusRow({
    required this.label,
    required this.value,
    required this.complete,
  });

  final String label;
  final String value;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            complete ? Icons.check_circle_outline : Icons.radio_button_checked,
            color: complete ? colorScheme.primary : colorScheme.tertiary,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _ProviderLevelRoadmap extends StatelessWidget {
  const _ProviderLevelRoadmap({required this.milestones});

  final List<ProviderOnboardingLevelMilestone> milestones;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completedCount =
        milestones.where((milestone) => milestone.complete).length;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.stairs_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Partner level roadmap',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completedCount/${milestones.length}')),
            ],
          ),
          const SizedBox(height: 10),
          for (final milestone in milestones) ...[
            _ProviderLevelRoadmapRow(milestone: milestone),
            if (milestone != milestones.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ProviderLevelRoadmapRow extends StatelessWidget {
  const _ProviderLevelRoadmapRow({required this.milestone});

  final ProviderOnboardingLevelMilestone milestone;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final icon = milestone.complete
        ? Icons.check_circle_outline
        : milestone.current
            ? Icons.radio_button_checked
            : Icons.radio_button_unchecked;
    final iconColor = milestone.complete || milestone.current
        ? colorScheme.primary
        : colorScheme.onSurfaceVariant;
    final background = milestone.current
        ? colorScheme.primaryContainer.withValues(alpha: 0.35)
        : Colors.transparent;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  milestone.title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  milestone.detail,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          if (milestone.current) ...[
            const SizedBox(width: 8),
            const Chip(label: Text('Current')),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklist extends StatelessWidget {
  const _PayoutGateChecklist({
    required this.items,
    required this.agreementVersion,
  });

  final List<ProviderOnboardingGateItem> items;
  final String agreementVersion;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.fact_check_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Payout gate checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Agreement version: $agreementVersion',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _PayoutGateChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklistRow extends StatelessWidget {
  const _PayoutGateChecklistRow({required this.item});

  final ProviderOnboardingGateItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final iconColor = item.complete ? colorScheme.primary : colorScheme.error;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.lock_outline,
          color: iconColor,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _KycDecisionChecklist extends StatelessWidget {
  const _KycDecisionChecklist({
    required this.items,
    required this.reviewStatus,
  });

  final List<ProviderKycDecisionItem> items;
  final String reviewStatus;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.assignment_ind_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'KYC review checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'HANDS operations checks these items before Level 2 work access. Review status: $reviewStatus.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _KycDecisionChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _KycDecisionChecklistRow extends StatelessWidget {
  const _KycDecisionChecklistRow({required this.item});

  final ProviderKycDecisionItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.error_outline,
          color: item.complete ? colorScheme.primary : colorScheme.error,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OnboardingHistoryList extends StatelessWidget {
  const _OnboardingHistoryList({required this.logs});

  final List<Map<String, dynamic>> logs;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.history_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Recent review activity',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final log in logs.take(5)) ...[
            _OnboardingHistoryRow(log: log),
            if (log != logs.take(5).last)
              Divider(color: colorScheme.outlineVariant),
          ],
        ],
      ),
    );
  }
}

class _OnboardingPriorityPanel extends StatelessWidget {
  const _OnboardingPriorityPanel({
    required this.priority,
    required this.onPressed,
  });

  final ProviderOnboardingPriority priority;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final colors = switch (priority.tone) {
      'success' => (
          background: colorScheme.primaryContainer,
          foreground: colorScheme.onPrimaryContainer,
          icon: Icons.check_circle_outline,
        ),
      'warning' => (
          background: colorScheme.tertiaryContainer,
          foreground: colorScheme.onTertiaryContainer,
          icon: Icons.priority_high_outlined,
        ),
      _ => (
          background: colorScheme.secondaryContainer,
          foreground: colorScheme.onSecondaryContainer,
          icon: Icons.flag_outlined,
        ),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(colors.icon, color: colors.foreground),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      priority.title,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(color: colors.foreground),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      priority.detail,
                      style: TextStyle(color: colors.foreground),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (priority.buttonLabel != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.arrow_forward),
              label: Text(priority.buttonLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _OnboardingHistoryRow extends StatelessWidget {
  const _OnboardingHistoryRow({required this.log});

  final Map<String, dynamic> log;

  @override
  Widget build(BuildContext context) {
    final action = log['action']?.toString() ?? 'event';
    final fromStatus = log['fromStatus']?.toString();
    final toStatus = log['toStatus']?.toString();
    final actor = asMap(log['actor']);
    final actorName = actor?['fullName']?.toString().trim().isNotEmpty == true
        ? actor!['fullName'].toString()
        : actor?['phone']?.toString();
    final statusText = fromStatus == null && toStatus == null
        ? 'Recorded'
        : '${fromStatus ?? 'New'} -> ${toStatus ?? 'Updated'}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3),
            child: Icon(Icons.circle, size: 10),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerLogActionLabel(action),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(statusText),
                Text(
                  [
                    formatRelativeMoment(log['createdAt']),
                    if (actorName != null) 'by $actorName',
                  ].join(' / '),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingPill extends StatelessWidget {
  const _OnboardingPill({
    required this.label,
    required this.value,
    this.isPositive,
  });

  final String label;
  final String value;
  final bool? isPositive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = isPositive == null
        ? colorScheme.secondaryContainer
        : isPositive!
            ? colorScheme.primaryContainer
            : colorScheme.errorContainer;
    return Chip(
      backgroundColor: color,
      label: Text('$label: $value'),
    );
  }
}

class _ReviewAlert extends StatelessWidget {
  const _ReviewAlert({
    required this.title,
    required this.detail,
  });

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.error),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.report_problem_outlined, color: colorScheme.error),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(detail),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingStepCard extends StatelessWidget {
  const _OnboardingStepCard({
    required this.step,
    required this.title,
    required this.detail,
    required this.status,
    required this.complete,
    required this.icon,
    this.actionLabel,
    this.onPressed,
  });

  final String step;
  final String title;
  final String detail;
  final String status;
  final bool complete;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background = complete
        ? colorScheme.primaryContainer
        : colorScheme.surfaceContainerHighest;
    final foreground = complete
        ? colorScheme.onPrimaryContainer
        : colorScheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: complete ? colorScheme.primary : colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: complete
                    ? colorScheme.primary
                    : colorScheme.surfaceContainerHighest,
                foregroundColor:
                    complete ? colorScheme.onPrimary : colorScheme.primary,
                child: complete
                    ? const Icon(Icons.check, size: 20)
                    : Text(step,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(detail, style: TextStyle(color: foreground)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: foreground),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Chip(
                label: Text(status),
                backgroundColor:
                    complete ? colorScheme.primary : colorScheme.surface,
              ),
              if (actionLabel != null)
                FilledButton.tonal(
                  onPressed: onPressed,
                  child: Text(actionLabel!),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

String _compactLevel(String value) {
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' signup')
      .replaceAll('_ACTIVE', ' active')
      .replaceAll('_PAYOUT_ENABLED', ' payout')
      .replaceAll('_TRUSTED', ' reviewed');
}

String guessImageContentTypeFromName(String name) {
  final lowerName = name.toLowerCase();
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
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

const providerWalletBlockFallbackReason = '수수료 정산이 완료되지 않아 예약을 받을 수 없습니다.';

const providerWalletBlockHint =
    '현금 결제로 발생한 HANDS 수수료를 정산하면 다시 예약을 받을 수 있습니다. Earnings 탭에서 마이너스 월렛을 확인하세요.';

const providerWalletBlockFallbackReasonKo = '수수료 정산이 완료되지 않아 예약을 받을 수 없습니다.';

const providerWalletBlockHintKo =
    '현금 결제로 발생한 HANDS 수수료를 정산하면 다시 예약을 받을 수 있습니다. Earnings 탭에서 마이너스 월렛을 확인하세요.';

const providerWalletBlockFallbackReasonReadable =
    '수수료 정산이 완료되지 않아 예약을 받을 수 없습니다.';

const providerWalletBlockHintReadable =
    'Cash bookings are paid directly to you. If HANDS fees, tax withholding, or platform costs create a negative wallet, deposit the settlement amount or wait for admin offset before accepting more bookings.';

const providerWalletBlockFallbackReasonClean =
    'HANDS fee settlement is incomplete, so final booking acceptance is locked.';

const providerWalletBlockHintClean =
    'Cash jobs are paid directly to you. You can still appear in marketplace opportunities, but final acceptance requires settling unpaid HANDS fees or an admin offset.';

num providerWalletBalance(Map<String, dynamic> summary) {
  return asNum(summary['walletBalance']) ??
      ((asNum(summary['pendingNetAmount']) ?? 0) +
          (asNum(summary['availableNetAmount']) ?? 0));
}

String? providerWalletBlockReason(Map<String, dynamic> summary) {
  final walletBalance = providerWalletBalance(summary);
  final walletBlocked = summary['walletBlocked'] == true || walletBalance < 0;
  if (!walletBlocked) {
    return null;
  }

  final reason = summary['walletBlockReason']?.toString().trim();
  if (reason != null && reason.isNotEmpty) {
    return reason;
  }

  return providerWalletBlockFallbackReasonClean;
}

String providerWalletSettlementInstruction(Map<String, dynamic> summary) {
  final instruction = summary['walletSettlementInstruction']?.toString().trim();
  if (instruction != null && instruction.isNotEmpty) {
    return instruction;
  }
  return providerWalletBlockHintClean;
}

String? providerWalletSettlementReference(Map<String, dynamic> summary) {
  if (providerWalletBlockReason(summary) == null) {
    return null;
  }

  for (final key in [
    'walletSettlementReference',
    'settlementReference',
    'settlementRef',
  ]) {
    final reference = summary[key]?.toString().trim();
    if (reference != null && reference.isNotEmpty) {
      return reference;
    }
  }

  return null;
}

String providerWalletStatusLabel(Map<String, dynamic> summary) {
  final walletBalance = providerWalletBalance(summary);
  if (providerWalletBlockReason(summary) != null) {
    return 'Settlement required';
  }
  if (walletBalance == 0) {
    return 'No unsettled balance';
  }
  return walletBalance > 0 ? 'Available for payout review' : 'Under review';
}

List<String> providerWalletSettlementSteps(Map<String, dynamic> summary) {
  final serverSteps = asList(summary['walletSettlementSteps'])
      .map((item) => item?.toString().trim() ?? '')
      .where((item) => item.isNotEmpty)
      .toList();
  if (serverSteps.isNotEmpty) {
    return serverSteps;
  }
  if (providerWalletBlockReason(summary) == null) {
    return const [
      'Cash booking fees are settled.',
      'You can accept direct and marketplace requests.',
      'Payout still needs tax, bank, and agreement checks.',
    ];
  }
  final debtAmount = asNum(summary['walletDebtAmount']) ??
      providerWalletBalance(summary).abs();
  final currency = summary['currency']?.toString() ?? 'VND';
  final reference = providerWalletSettlementReference(summary);
  return [
    'Settle ${formatCurrency(debtAmount)} $currency for unpaid HANDS fees.',
    if (reference != null)
      'Use reference $reference when sending the deposit or requesting admin offset.',
    'After admin confirms the deposit or offset, refresh wallet status.',
    'New booking acceptance unlocks only when the wallet is no longer negative.',
  ];
}

class ProviderRequestGuidance {
  const ProviderRequestGuidance({
    required this.modeLabel,
    required this.priorityLabel,
    required this.roleLabel,
    required this.decisionLabel,
    required this.nextAction,
    required this.contextMessage,
    required this.detailMessage,
    required this.infoMessage,
  });

  final String modeLabel;
  final String priorityLabel;
  final String roleLabel;
  final String decisionLabel;
  final String nextAction;
  final String contextMessage;
  final String detailMessage;
  final String infoMessage;
}

ProviderRequestGuidance providerRequestGuidance({
  required Map<String, dynamic> booking,
  required bool isPreferredRequest,
  required bool joined,
  required bool walletBlocked,
}) {
  final preferredProvider = asMap(booking['preferredProvider']);
  final hasPreferredProvider = preferredProvider != null;
  final preferredProviderName =
      preferredProvider?['displayName']?.toString().trim();
  final hasChat = isProviderAppChatVisible(booking);
  final isMatched = booking['status'] == 'MATCHED';
  final actionBlockedByWallet =
      walletBlocked && isPreferredRequest && !isMatched;
  final responseWindowLabel = providerMatchingWindowText(booking);
  final backupRadiusLabel = providerBackupRadiusText(booking);

  final modeLabel = isPreferredRequest
      ? 'Direct request'
      : hasPreferredProvider
          ? 'Marketplace opportunity'
          : 'Open shortlist';
  final priorityLabel = isPreferredRequest
      ? 'Reply first'
      : hasPreferredProvider
          ? 'Marketplace option'
          : 'Open queue';
  final roleLabel = isPreferredRequest
      ? 'First partner'
      : hasPreferredProvider
          ? 'Marketplace option'
          : 'Open candidate';

  if (actionBlockedByWallet) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Settlement required',
      nextAction:
          'Settle your negative HANDS wallet before accepting this booking.',
      contextMessage:
          'This booking is visible, but your wallet must be settled before final acceptance.',
      detailMessage: providerWalletBlockFallbackReasonClean,
      infoMessage: providerWalletBlockHintClean,
    );
  }

  if (isPreferredRequest && hasChat) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Chat live',
      nextAction: 'Continue with the customer in chat.',
      contextMessage:
          'The customer picked your profile first and the service chat is now live.',
      detailMessage:
          'You were chosen first and the service chat is already live.',
      infoMessage: 'Service started. Chat is ready.',
    );
  }

  if (isPreferredRequest && isMatched) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Accepted',
      nextAction: 'Start the service when you are ready to unlock chat.',
      contextMessage:
          'The customer picked your profile first and is waiting for you to start the service.',
      detailMessage:
          'You were chosen first. Start service when you are ready to move this booking into chat.',
      infoMessage: 'You accepted this request. Start service to unlock chat.',
    );
  }

  if (isPreferredRequest) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Reply now',
      nextAction: 'Reply now so the customer can confirm you directly.',
      contextMessage:
          'The customer picked your profile first and is waiting for your response.',
      detailMessage:
          'You are the first partner this guest chose. Reply within $responseWindowLabel to protect the booking; marketplace partners inside $backupRadiusLabel can still volunteer while the customer waits.',
      infoMessage:
          'The customer already chose you. Accept or decline this request within $responseWindowLabel.',
    );
  }

  if (joined) {
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Visible now',
      nextAction: 'Stay visible and wait for the customer to choose you.',
      contextMessage: hasPreferredProvider
          ? 'Another partner was chosen first. You are visible as a marketplace option.'
          : 'You joined this open request. The customer will pick the final partner.',
      detailMessage:
          'You are in the shortlist. Keep the app open and wait for customer selection.',
      infoMessage:
          'You are visible to the customer now. Wait for the final selection.',
    );
  }

  if (hasPreferredProvider) {
    final name = preferredProviderName == null || preferredProviderName.isEmpty
        ? 'the preferred partner'
        : preferredProviderName;
    return ProviderRequestGuidance(
      modeLabel: modeLabel,
      priorityLabel: priorityLabel,
      roleLabel: roleLabel,
      decisionLabel: 'Can join',
      nextAction: 'Offer marketplace support if you can cover this request.',
      contextMessage:
          'Another partner was chosen first. You can still join as an alternative option within the $backupRadiusLabel marketplace radius.',
      detailMessage:
          'The guest is still waiting on $name. Join now to appear as a marketplace option.',
      infoMessage:
          'Preferred partner: $name. Only partners inside $backupRadiusLabel can join this request.',
    );
  }

  return ProviderRequestGuidance(
    modeLabel: modeLabel,
    priorityLabel: priorityLabel,
    roleLabel: roleLabel,
    decisionLabel: 'Can join',
    nextAction: 'Join this open request to enter the customer shortlist.',
    contextMessage:
        'This request is open to nearby partners inside $backupRadiusLabel. The customer will pick the final partner.',
    detailMessage:
        'No preferred partner was set. Nearby partners can join and wait for the guest selection.',
    infoMessage:
        'Customer is waiting and nearby partners may volunteer for this request.',
  );
}

int providerMatchingWindowMinutes(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['providerResponseWindowMinutes']) ??
      asNum(booking['providerResponseWindowMinutes']) ??
      asNum(booking['earlyAcceptMin']);
  final minutes = value?.round();
  if (minutes == null || minutes <= 0) {
    return 10;
  }
  return minutes;
}

int providerBackupRadiusMeters(Map<String, dynamic> booking) {
  final policy = asMap(asMap(booking['metadata'])?['matchingPolicy']);
  final value = asNum(policy?['backupProviderRadiusMeters']) ??
      asNum(booking['backupProviderRadiusMeters']);
  final meters = value?.round();
  if (meters == null || meters <= 0) {
    return 10000;
  }
  return meters;
}

String providerMatchingWindowText(Map<String, dynamic> booking) {
  final minutes = providerMatchingWindowMinutes(booking);
  return '$minutes min';
}

String providerMatchingWindowTagLabel(Map<String, dynamic> booking) {
  return '${providerMatchingWindowText(booking)} first-pick';
}

String providerBackupRadiusText(Map<String, dynamic> booking) {
  final meters = providerBackupRadiusMeters(booking);
  if (meters >= 1000) {
    final km = meters / 1000;
    final value = km == km.roundToDouble()
        ? km.toInt().toString()
        : km.toStringAsFixed(1);
    return '$value km';
  }
  return '$meters m';
}

String providerBackupRadiusTagLabel(Map<String, dynamic> booking) {
  return '${providerBackupRadiusText(booking)} marketplace';
}

bool providerBookingIsCash(Map<String, dynamic> booking) {
  final payment = asMap(booking['payment']);
  return payment?['method']?.toString().toUpperCase() == 'CASH' ||
      booking['paymentMethod']?.toString().toUpperCase() == 'CASH';
}

String providerCashBookingSettlementHint(Map<String, dynamic> booking) {
  final payment = asMap(booking['payment']);
  final amount = payment?['amount'] ?? booking['totalAmount'];
  final amountText =
      amount == null ? 'this request' : '${formatCurrency(amount)} VND';
  return 'Cash payment: the customer pays you directly for $amountText. '
      'After completion, HANDS fees and tax withholding can create wallet debt. '
      'Keep your wallet settled so future booking acceptance stays available.';
}

String providerServiceOptionLabel(Map<String, dynamic>? service) {
  final name = service?['name']?.toString().trim();
  final duration = asNum(service?['durationMin'])?.toInt();
  if (name == null || name.isEmpty) {
    return 'Massage booking';
  }
  if (duration == null || duration <= 0) {
    return name;
  }
  return '$name / $duration min';
}

String providerServiceOptionPriceLabel(
  Map<String, dynamic>? service, {
  dynamic amount,
}) {
  final serviceText = providerServiceOptionLabel(service);
  final price = amount ??
      service?['bookingPrice'] ??
      service?['effectivePrice'] ??
      service?['basePrice'];
  if (price == null) {
    return serviceText;
  }
  return '$serviceText / ${formatCurrency(price)} VND';
}

String providerServiceDurationLabel(Map<String, dynamic>? service) {
  final duration = asNum(service?['durationMin'])?.toInt();
  return duration == null || duration <= 0 ? '- min' : '$duration min';
}

String formatCurrency(dynamic amount) {
  final number = asNum(amount)?.toInt() ?? 0;
  final sign = number < 0 ? '-' : '';
  final text = number.abs().toString();
  final buffer = StringBuffer();
  buffer.write(sign);

  for (var index = 0; index < text.length; index++) {
    final reverseIndex = text.length - index;
    buffer.write(text[index]);
    if (reverseIndex > 1 && reverseIndex % 3 == 1) {
      buffer.write('.');
    }
  }

  return buffer.toString();
}

num? asNum(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value);
  }
  return null;
}

Map<String, dynamic>? asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

List<dynamic> asList(dynamic value) {
  return value is List<dynamic> ? value : const [];
}

bool providerPublicMediaIsReviewable(Map<String, dynamic> item) {
  final purpose = item['purpose']?.toString();
  final visibility = item['visibility']?.toString();
  final uploadStatus = item['uploadStatus']?.toString();
  return visibility == 'PUBLIC' &&
      uploadStatus == 'UPLOADED' &&
      (purpose == 'PROFILE_IMAGE' ||
          purpose == 'profile-image' ||
          purpose == 'PROVIDER_GALLERY' ||
          purpose == 'provider-gallery');
}

String providerPublicMediaReviewStatus(Map<String, dynamic> item) {
  final value = item['reviewStatus']?.toString();
  if (value == 'APPROVED' || value == 'REJECTED') {
    return value!;
  }
  return 'PENDING_REVIEW';
}

String providerPublicMediaPurposeLabel(String? purpose) {
  switch (purpose) {
    case 'PROFILE_IMAGE':
    case 'profile-image':
      return 'Profile image';
    case 'PROVIDER_GALLERY':
    case 'provider-gallery':
      return 'Work photo';
    default:
      return 'Public media';
  }
}

String providerPublicMediaReviewLabel(String status) {
  switch (status) {
    case 'APPROVED':
      return 'Approved and visible to customers';
    case 'REJECTED':
      return 'Needs changes before customers can see it';
    default:
      return 'Waiting for admin review';
  }
}

IconData providerPublicMediaReviewIcon(String status) {
  switch (status) {
    case 'APPROVED':
      return Icons.check_circle_outline;
    case 'REJECTED':
      return Icons.report_problem_outlined;
    default:
      return Icons.hourglass_top_outlined;
  }
}

Color providerPublicMediaReviewColor(String status) {
  switch (status) {
    case 'APPROVED':
      return Colors.green.shade700;
    case 'REJECTED':
      return Colors.red.shade700;
    default:
      return Colors.orange.shade700;
  }
}

class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class ProviderActionBlockCopy {
  const ProviderActionBlockCopy({
    required this.title,
    required this.detail,
    required this.nextStep,
    required this.icon,
  });

  final String title;
  final String detail;
  final String nextStep;
  final IconData icon;
}

class ProviderErrorCard extends StatelessWidget {
  const ProviderErrorCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final actionBlock = providerActionBlockCopy(text);
    if (actionBlock == null && !isProviderBlockedMessage(text)) {
      return ErrorCard(text: text);
    }

    final colorScheme = Theme.of(context).colorScheme;
    final accountBlocked = isProviderAccountBlockedMessage(text);
    final title = actionBlock?.title ??
        (accountBlocked
            ? 'Partner account blocked by admin'
            : 'Device blocked by admin');
    final detail = actionBlock?.detail ?? text;
    final nextStep = actionBlock?.nextStep ??
        (accountBlocked
            ? 'Contact HANDS operations. This account cannot go online or share location until an admin unblocks it.'
            : 'Do not create a new account. Contact HANDS operations so this device can be reviewed or unblocked.');
    final icon = actionBlock?.icon ??
        (accountBlocked
            ? Icons.admin_panel_settings_outlined
            : Icons.phonelink_lock_outlined);
    return Card(
      color: colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: colorScheme.error,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: colorScheme.onErrorContainer,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    detail,
                    style: TextStyle(color: colorScheme.onErrorContainer),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    nextStep,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onErrorContainer,
                        ),
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

class ErrorCard extends StatelessWidget {
  const ErrorCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text,
            style: TextStyle(
                color: Theme.of(context).colorScheme.onErrorContainer)),
      ),
    );
  }
}

String providerAppErrorMessage(Object error) {
  if (error is ApiException) {
    final apiMessage = providerApiExceptionMessage(error.body);
    if (apiMessage != null) {
      return apiMessage;
    }
  }
  final raw = error.toString();
  final normalized = raw
      .replaceFirst('Bad state: ', '')
      .replaceFirst('Exception: ', '')
      .trim();
  if (isProviderDeviceBlockedMessage(normalized)) {
    return normalized.replaceFirst(
      'This device is blocked by admin review',
      'This device is blocked by HANDS admin review',
    );
  }
  if (isProviderAccountBlockedMessage(normalized)) {
    return normalized.replaceFirst(
      'This partner account is blocked by admin review',
      'This partner account is blocked by HANDS admin review',
    );
  }
  return normalized;
}

String? providerApiExceptionMessage(Map<String, dynamic> body) {
  final directCode = body['code']?.toString().trim();
  final directMessage = body['message'];
  final directReadable = providerReadableApiMessage(
    code: directCode,
    message: directMessage,
    fallbackError: directMessage is Map ? null : body['error'],
  );
  if (directReadable != null) {
    return directReadable;
  }

  if (directMessage is Map) {
    final nestedCode = directMessage['code']?.toString().trim();
    final nestedReadable = providerReadableApiMessage(
      code: nestedCode,
      message: directMessage['message'],
      fallbackError: directMessage['error'],
    );
    if (nestedReadable != null) {
      return nestedReadable;
    }
  }

  final apiError = body['error'];
  if (apiError is String && apiError.trim().isNotEmpty) {
    return apiError.trim();
  }
  return null;
}

String? providerReadableApiMessage({
  required String? code,
  required Object? message,
  required Object? fallbackError,
}) {
  if (code == 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT') {
    return providerWalletBlockFallbackReasonClean;
  }
  if (message is String && message.trim().isNotEmpty) {
    return message.trim();
  }
  if (fallbackError is String && fallbackError.trim().isNotEmpty) {
    return fallbackError.trim();
  }
  return null;
}

bool isProviderBlockedMessage(String value) {
  return isProviderDeviceBlockedMessage(value) ||
      isProviderAccountBlockedMessage(value);
}

ProviderActionBlockCopy? providerActionBlockCopy(String value) {
  final normalized = value.toLowerCase();
  if (normalized.contains('wallet') ||
      normalized.contains('settlement') ||
      normalized.contains('hands fee') ||
      normalized.contains('unpaid hands cash-service fees')) {
    return const ProviderActionBlockCopy(
      title: 'Fee settlement required',
      detail: providerWalletBlockFallbackReasonClean,
      nextStep:
          'Open Earnings, copy the settlement reference, then refresh wallet status after HANDS confirms payment.',
      icon: Icons.account_balance_wallet_outlined,
    );
  }
  if (normalized.contains('kyc must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'KYC approval required',
      detail:
          'Your identity verification must be approved before you can accept booking requests.',
      nextStep:
          'Open Profile, submit CCCD and selfie verification, then wait for HANDS operations approval.',
      icon: Icons.badge_outlined,
    );
  }
  if (normalized.contains('required kyc document') ||
      normalized.contains('cccd') ||
      normalized.contains('selfie')) {
    return const ProviderActionBlockCopy(
      title: 'Identity document approval required',
      detail:
          'Required CCCD front, CCCD back, and selfie documents must be approved first.',
      nextStep:
          'Upload clear identity photos in Profile and ask HANDS operations to review them.',
      icon: Icons.assignment_ind_outlined,
    );
  }
  if (normalized.contains('bank account must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'Bank account approval required',
      detail:
          'Your payout bank account must be approved before you can accept booking requests.',
      nextStep:
          'Add or correct your bank account in Profile. HANDS must approve it before work starts.',
      icon: Icons.account_balance_outlined,
    );
  }
  if (normalized.contains('verification must be approved')) {
    return const ProviderActionBlockCopy(
      title: 'Partner verification required',
      detail:
          'Your partner profile verification must be approved before receiving work.',
      nextStep:
          'Complete the basic profile and wait for HANDS operations to approve your account.',
      icon: Icons.verified_user_outlined,
    );
  }
  if (normalized.contains('must be online')) {
    return const ProviderActionBlockCopy(
      title: 'Go online first',
      detail:
          'You must be online and sharing your current location before accepting requests.',
      nextStep:
          'Tap Go online, allow location permission, then refresh the request list.',
      icon: Icons.power_settings_new,
    );
  }
  return null;
}

bool isProviderDeviceBlockedMessage(String value) {
  return value.toLowerCase().contains('device is blocked');
}

bool isProviderAccountBlockedMessage(String value) {
  final normalized = value.toLowerCase();
  return normalized.contains('partner account is blocked') ||
      normalized.contains('account is blocked');
}
