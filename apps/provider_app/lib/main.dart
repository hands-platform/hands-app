import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'src/app_state.dart';
import 'src/core/app_config.dart';
import 'src/core/realtime_socket.dart';

void main() {
  runApp(const ProviderScope(child: ProviderApp()));
}

class ProviderApp extends StatelessWidget {
  const ProviderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Provider',
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
              icon: Icon(Icons.calendar_month_outlined), label: 'Schedule'),
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
          'A booking was confirmed. Review the selected therapist state.');
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
            : 'A booking request expired before a therapist was confirmed.';
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
        setState(() => error = '$exception');
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
      setState(() => error = '$exception');
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
      setState(() => error = '$exception');
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
      setState(() => error = '$exception');
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
      setState(() => error = '$exception');
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
      await ref.read(providerRepositoryProvider).joinBooking(bookingId);
      setState(() {
        joinedBookingIds = {...joinedBookingIds, bookingId};
        statusMessage =
            'You joined this request. Waiting for the customer to choose a therapist.';
      });
      await loadOpenBookings();
    } catch (exception) {
      setState(() => error = '$exception');
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
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
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
    final heartbeatSnapshot =
        ref.watch(providerLocationHeartbeatStatusProvider).valueOrNull ??
            ref.read(providerLocationHeartbeatProvider).snapshot;
    final bookingItems = openBookings.whereType<Map<String, dynamic>>().toList()
      ..sort((left, right) {
        final leftScore = providerRequestPriority(left, auth?.userId);
        final rightScore = providerRequestPriority(right, auth?.userId);
        if (leftScore != rightScore) {
          return rightScore.compareTo(leftScore);
        }
        return bookingTimestamp(right).compareTo(bookingTimestamp(left));
      });
    final visibleBookings = bookingItems.where((booking) {
      if (requestView == 'chat') {
        return booking['chatRoom'] != null;
      }
      if (requestView == 'all') {
        return true;
      }
      return booking['chatRoom'] == null;
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
                Text(auth == null ? 'Demo provider login' : 'Refresh requests'),
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
                      setState(() => error = '$exception');
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
            ErrorCard(text: error!),
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
            RequestFlowBar(
              activeStep: !isOnline
                  ? 0
                  : (bookingItems.any((item) => item['chatRoom'] != null)
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
              chatReady: bookingItems
                  .where((booking) => booking['chatRoom'] != null)
                  .length,
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
            Text('Provider login',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Use phone OTP for the production provider account, or local demo login while testing direct booking requests.',
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
        statusMessage = 'Schedule refreshed with ${loaded.length} booking(s).';
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
          Text('Schedule', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Today, active service states, and closed booking records.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed:
                loading ? null : (auth == null ? signInAndLoad : loadSchedule),
            icon: const Icon(Icons.calendar_month_outlined),
            label:
                Text(auth == null ? 'Demo provider login' : 'Refresh schedule'),
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
            const InfoCard(
                text: 'Login first to load your provider booking schedule.')
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
                    service?['name']?.toString() ?? 'Massage booking',
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
                    label: formatScheduleMoment(booking['scheduledStartAt'])),
                ProviderRequestTag(
                    label: '${service?['durationMin'] ?? '-'} min'),
                ProviderRequestTag(
                    label:
                        '${formatCurrency(payment?['amount'] ?? service?['basePrice'])} VND'),
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

String providerScheduleNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' => 'Waiting for the guest to confirm a therapist.',
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
  if (booking['chatRoom'] != null) {
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
                label: 'Backup',
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
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
    required this.onStart,
  });

  final Map<String, dynamic> booking;
  final bool isPreferredRequest;
  final bool joined;
  final bool loading;
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
    final hasPreferredProvider = preferredProvider != null;
    final hasChat = booking['chatRoom'] != null;
    final isMatched = booking['status'] == 'MATCHED';
    final preferredProviderName = preferredProvider?['displayName'] as String?;
    final customerAddress = booking['address'] as Map<String, dynamic>?;
    final customerName = customerAddress?['name']?.toString() ?? 'Guest';
    final customerPhone = customerAddress?['phone']?.toString();
    final bookingId = booking['id']?.toString() ?? '';
    final shortBookingId =
        bookingId.length <= 8 ? bookingId : bookingId.substring(0, 8);
    final updatedLabel =
        formatRelativeMoment(booking['updatedAt'] ?? booking['createdAt']);
    final scheduledLabel = formatScheduleMoment(booking['scheduledStartAt']);
    final requestModeLabel = isPreferredRequest
        ? 'Direct request'
        : hasPreferredProvider
            ? 'Backup opportunity'
            : 'Open shortlist';
    final nextAction = isPreferredRequest && !isMatched
        ? 'Reply now so the customer can confirm you directly.'
        : isPreferredRequest && isMatched && !hasChat
            ? 'Start the service when you are ready to unlock chat.'
            : isPreferredRequest && hasChat
                ? 'Continue with the customer in chat.'
                : joined
                    ? 'Stay visible and wait for the customer to choose you.'
                    : hasPreferredProvider
                        ? 'Offer backup support if you can cover this request.'
                        : 'Join this open request to enter the customer shortlist.';

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
                      Text(service?['name'] as String? ?? 'Massage booking',
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(
                        '$customerName${customerPhone == null ? '' : ' • $customerPhone'}',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.black54),
                      ),
                      Text(
                          '${booking['status']} - ${participants.length} provider(s) joined'),
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
                        : (hasPreferredProvider ? 'Backup' : 'Open'),
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
                ProviderRequestTag(label: requestModeLabel),
                ProviderRequestTag(
                    label: 'Booking $shortBookingId', highlighted: true),
                ProviderRequestTag(
                    label: '${service?['durationMin'] ?? '-'} min'),
                ProviderRequestTag(
                    label: '${formatCurrency(service?['basePrice'])} VND'),
                if (updatedLabel != 'Updated just now')
                  ProviderRequestTag(label: updatedLabel),
              ],
            ),
            const SizedBox(height: 10),
            Text('Scheduled: $scheduledLabel'),
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
                      value: isPreferredRequest
                          ? 'Reply first'
                          : (hasPreferredProvider
                              ? 'Backup option'
                              : 'Open queue'),
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
                    value: isPreferredRequest
                        ? 'First therapist'
                        : (hasPreferredProvider
                            ? 'Backup option'
                            : 'Open candidate'),
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
                    value: isPreferredRequest
                        ? (isMatched
                            ? (hasChat ? 'Chat live' : 'Accepted')
                            : 'Reply now')
                        : (joined ? 'Visible now' : 'Can join'),
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
                    nextAction,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              isPreferredRequest
                  ? (hasChat
                      ? 'The customer picked your profile first and the service chat is now live.'
                      : isMatched
                          ? 'The customer picked your profile first and is waiting for you to start the service.'
                          : 'The customer picked your profile first and is waiting for your response.')
                  : hasPreferredProvider
                      ? 'Another therapist was chosen first. You can still join as an alternative option.'
                      : 'This request is open to nearby therapists. The customer will pick the final provider.',
            ),
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
              child: Text(
                isPreferredRequest
                    ? (hasChat
                        ? 'You were chosen first and the service chat is already live.'
                        : isMatched
                            ? 'You were chosen first. Start service when you are ready to move this booking into chat.'
                            : 'You are the first therapist this guest chose. A quick reply protects the booking.')
                    : hasPreferredProvider
                        ? 'The guest is still waiting on ${preferredProviderName ?? 'the preferred therapist'}. Join now to appear as a backup option.'
                        : 'No preferred therapist was set. Nearby therapists can join and wait for the guest selection.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: 12),
            if (isPreferredRequest)
              InfoCard(
                text: isMatched
                    ? (hasChat
                        ? 'Service started. Chat is ready.'
                        : 'You accepted this request. Start service to unlock chat.')
                    : 'The customer already chose you. Accept or decline this request.',
              )
            else if (hasPreferredProvider)
              InfoCard(
                  text:
                      'Preferred therapist: ${preferredProviderName ?? 'Another provider'}. Join if you can cover this request.')
            else
              const InfoCard(
                  text:
                      'Customer is waiting and nearby therapists may volunteer for this request.'),
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
                onPressed: loading ? null : onJoin,
                icon: const Icon(Icons.add_circle_outline),
                label: Text(hasPreferredProvider
                    ? 'Offer backup support'
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
                : 'Track gross, tips, fees, and net payout.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(
                text: 'Demo provider login is available on the Requests tab.')
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

                    return FutureBuilder<List<dynamic>>(
                      future:
                          ref.read(providerRepositoryProvider).payoutBatches(),
                      builder: (context, payoutSnapshot) {
                        final batches = payoutSnapshot.data ?? [];
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
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
                                        'Tips ${summary['tipAmount'] ?? 0} $currency'),
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
                                        '+${earning['tipAmount'] ?? 0} tip'),
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
          (item) => asMap(item?['chatRoom']) != null,
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
            : 'A therapist was selected already, so this chat room is not yours.',
        'IN_SERVICE' =>
          'Service is already in progress. Reload chat to join the live room.',
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
  final List<String> _uploadedFileIds = [];
  bool _isUploadingProfileImage = false;
  bool _isUploading = false;
  bool _isSubmitting = false;
  bool _isSavingOnboarding = false;

  @override
  void initState() {
    super.initState();
    _verificationFuture = ref.read(providerRepositoryProvider).verification();
    _onboardingFuture =
        ref.read(providerRepositoryProvider).onboardingSnapshot();
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

  Future<void> _fillDemoBasicProfile() {
    return _runOnboardingAction('Basic profile saved', () async {
      await ref.read(providerRepositoryProvider).updateOnboardingBasicProfile({
        'legalName': 'Demo Provider',
        'dateOfBirth': '1995-01-01',
        'gender': 'female',
        'facebookId': 'demo.provider',
        'displayName': 'Linh Wellness',
        'activityNickname': 'Linh',
        'bio': 'Verified provider available for home massage in Vietnam.',
        'residentialAddress': 'District 1, Ho Chi Minh City, Vietnam',
        'city': 'Ho Chi Minh City',
        'serviceArea': {
          'country': 'VN',
          'cities': ['Ho Chi Minh City'],
        },
      });
    });
  }

  Future<void> _submitDemoKyc() {
    return _runOnboardingAction('KYC request submitted for admin review',
        () async {
      await ref
          .read(providerRepositoryProvider)
          .submitOnboardingKyc(cccdNumber: '000000000000');
      _refreshVerification();
    });
  }

  Future<void> _addDemoBankAccount() {
    return _runOnboardingAction('Bank account submitted for review', () async {
      await ref.read(providerRepositoryProvider).createOnboardingBankAccount(
        bankName: 'Vietcombank',
        accountNumber: '000012345678',
        accountHolderName: 'Demo Provider',
        qrBankingInfo: const {'provider': 'vietqr', 'enabled': true},
      );
    });
  }

  Future<void> _addDemoTaxProfile() {
    return _runOnboardingAction('Tax profile submitted for review', () async {
      await ref.read(providerRepositoryProvider).upsertOnboardingTaxProfile(
            taxCode: '0000000000',
            legalName: 'Demo Provider',
            registeredAddress: 'District 1, Ho Chi Minh City, Vietnam',
          );
    });
  }

  Future<void> _acceptRequiredAgreements() {
    const requiredTypes = ['TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX'];
    return _runOnboardingAction('Required agreements accepted', () async {
      for (final type in requiredTypes) {
        await ref.read(providerRepositoryProvider).acceptOnboardingAgreement(
              type: type,
              version: '2026-05',
              deviceId: 'provider-demo-device',
            );
      }
    });
  }

  Future<void> _pickAndUploadVerificationFile() async {
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
      }
      _refreshVerification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Verification file uploaded: ${image.name}')),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Profile image uploaded: ${image.name}')),
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
                  onFillBasicProfile: _fillDemoBasicProfile,
                  onSubmitKyc: _submitDemoKyc,
                  onAddBankAccount: _addDemoBankAccount,
                  onAddTaxProfile: _addDemoTaxProfile,
                  onAcceptAgreements: _acceptRequiredAgreements,
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
                    FilledButton.tonalIcon(
                      onPressed:
                          _isUploading ? null : _pickAndUploadVerificationFile,
                      icon: const Icon(Icons.file_upload_outlined),
                      label: Text(_isUploading
                          ? 'Uploading verification file...'
                          : 'Upload verification photo'),
                    ),
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
                            ].join(' · ')),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    for (final item in [
                      'Massage menu',
                      'Pricing',
                      'Online toggle'
                    ])
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
                        content: Text('Signed out and provider is offline.')),
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
    final agreements = asList(snapshot['agreements']);
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
                    'Provider onboarding',
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
            if (error != null) ...[
              ErrorCard(text: 'Onboarding load failed: $error'),
              const SizedBox(height: 12),
            ],
            _OnboardingGateRow(
              title: 'Basic profile',
              detail: addressText == null || addressText.isEmpty
                  ? 'Name, birthday, address, service area'
                  : addressText,
              complete: hasBasicProfile,
            ),
            _OnboardingGateRow(
              title: 'KYC / admin review',
              detail: kycStatus ?? 'Not submitted',
              complete: kycStatus == 'APPROVED',
            ),
            _OnboardingGateRow(
              title: 'Bank account',
              detail: bankStatus ?? 'Not submitted',
              complete: bankStatus == 'APPROVED',
            ),
            _OnboardingGateRow(
              title: 'Tax profile',
              detail: completedBookingCount == 0
                  ? 'Required before first payout'
                  : (taxStatus ?? 'Not submitted'),
              complete: completedBookingCount == 0 || taxStatus == 'APPROVED',
            ),
            _OnboardingGateRow(
              title: 'Legal agreements',
              detail: '${agreements.length}/5 accepted',
              complete: (asList(payoutMissing['agreements'])).isEmpty,
            ),
            const SizedBox(height: 12),
            if (nextActions.isEmpty)
              const InfoCard(text: 'All current onboarding gates are clear.')
            else
              InfoCard(
                text: 'Next: ${nextActions.map(_readableAction).join(', ')}',
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: isSaving ? null : onFillBasicProfile,
                  icon: const Icon(Icons.badge_outlined),
                  label: const Text('Save demo profile'),
                ),
                FilledButton.tonalIcon(
                  onPressed: isSaving ? null : onSubmitKyc,
                  icon: const Icon(Icons.verified_user_outlined),
                  label: const Text('Submit KYC'),
                ),
                FilledButton.tonalIcon(
                  onPressed: isSaving ? null : onAddBankAccount,
                  icon: const Icon(Icons.account_balance_outlined),
                  label: const Text('Add bank'),
                ),
                FilledButton.tonalIcon(
                  onPressed: isSaving ? null : onAddTaxProfile,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Add tax'),
                ),
                FilledButton.tonalIcon(
                  onPressed: isSaving ? null : onAcceptAgreements,
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Accept terms'),
                ),
              ],
            ),
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

class _OnboardingGateRow extends StatelessWidget {
  const _OnboardingGateRow({
    required this.title,
    required this.detail,
    required this.complete,
  });

  final String title;
  final String detail;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        complete ? Icons.check_circle_outline : Icons.pending_outlined,
        color: complete
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.outline,
      ),
      title: Text(title),
      subtitle: Text(detail),
    );
  }
}

String _compactLevel(String value) {
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' signup')
      .replaceAll('_ACTIVE', ' active')
      .replaceAll('_PAYOUT_ENABLED', ' payout')
      .replaceAll('_TRUSTED', ' trusted');
}

String _readableAction(String value) {
  return value
      .toLowerCase()
      .split('_')
      .map((part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
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

String formatCurrency(dynamic amount) {
  final number = asNum(amount)?.toInt() ?? 0;
  final text = number.toString();
  final buffer = StringBuffer();

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
