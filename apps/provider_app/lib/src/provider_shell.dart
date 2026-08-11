import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'core/app_session_reporter.dart';
import 'core/fcm_message_handling_service.dart';
import 'core/mobile_app_version.dart';
import 'core/provider_design_system.dart';
import 'features/booking/presentation/partner_jobs_screen.dart';
import 'features/booking/presentation/provider_jobs_helpers.dart';
import 'features/booking/presentation/provider_requests_screen.dart';
import 'features/chat/presentation/provider_chat_screen.dart';
import 'features/chat/presentation/provider_chat_priority.dart';
import 'features/earnings/presentation/provider_earnings_screen.dart';
import 'features/notification/domain/entities/push_notification_open_intent.dart';
import 'features/provider_profile/presentation/provider_profile_screen.dart';

class ProviderShell extends ConsumerStatefulWidget {
  const ProviderShell({
    super.key,
    this.notificationOpens,
  });

  final Stream<FcmNotificationOpen>? notificationOpens;

  @override
  ConsumerState<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends ConsumerState<ProviderShell>
    with WidgetsBindingObserver {
  static const _requestsIndex = 0;
  static const _jobsIndex = 1;
  static const _earningsIndex = 2;
  static const _chatIndex = 3;
  static const _profileIndex = 4;
  int index = 0;
  String? _notificationChatRoomId;
  String? _notificationBookingId;
  String? _notificationEarningId;
  String? _notificationPayoutBatchId;
  int _chatOpenVersion = 0;
  int _requestsOpenVersion = 0;
  int _jobsOpenVersion = 0;
  int _earningsOpenVersion = 0;
  int _openRequestCount = 0;
  int _activeJobCount = 0;
  int _unreadChatCount = 0;
  bool _queueCountsLoading = false;
  bool _queueCountsRefreshRequested = false;
  bool _pushRegistrationStarted = false;
  bool _versionChecked = false;
  ProviderLocationHeartbeat? _activeLocationHeartbeat;
  DateTime? _lastAppOpenReportedAt;
  StreamSubscription<FcmNotificationOpen>? _notificationOpenSubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notificationOpenSubscription =
        (widget.notificationOpens ?? handsFcmNotificationOpens)
            .listen(_handleNotificationOpen);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAppVersion();
      if (!mounted || ref.read(authControllerProvider) == null) {
        return;
      }
      _startPushRegistration();
      _recordAppOpen();
      unawaited(_refreshQueueCounts());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _activeLocationHeartbeat?.stop();
    unawaited(_notificationOpenSubscription?.cancel());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _recordAppOpen();
      unawaited(_refreshQueueCounts());
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (_, next) {
      if (next == null) {
        _pushRegistrationStarted = false;
        _clearQueueCounts();
        return;
      }
      _startPushRegistration();
      _recordAppOpen();
      unawaited(_refreshQueueCounts());
    });

    final screens = [
      RequestsScreen(
        key: ValueKey('provider-push-requests-$_requestsOpenVersion'),
        initialBookingId: _notificationBookingId,
        onOpenRequestCountChanged: _setOpenRequestCount,
        onQueueStateChanged: () => unawaited(_refreshQueueCounts()),
      ),
      PartnerJobsScreen(
        key: ValueKey('provider-push-jobs-$_jobsOpenVersion'),
        initialBookingId: _notificationBookingId,
        onActiveJobCountChanged: _setActiveJobCount,
        onOpenChat: _openJobChat,
      ),
      EarningsScreen(
        key: ValueKey('provider-push-earnings-$_earningsOpenVersion'),
        initialEarningId: _notificationEarningId,
        initialPayoutBatchId: _notificationPayoutBatchId,
      ),
      ChatScreen(
        key: ValueKey('provider-push-chat-$_chatOpenVersion'),
        initialChatRoomId: _notificationChatRoomId,
        initialBookingId: _notificationBookingId,
        onUnreadCountChanged: _setUnreadChatCount,
        onQueueStateChanged: () => unawaited(_refreshQueueCounts()),
        onOpenJobs: _openJobsFromChat,
      ),
      const ProfileScreen(),
    ];

    final colors = context.handsColors;
    return Scaffold(
      body: screens[index],
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.outline)),
        ),
        child: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: _selectDestination,
          destinations: [
            NavigationDestination(
              icon: _navigationIcon(
                Icons.radar_outlined,
                _openRequestCount,
              ),
              selectedIcon: _navigationIcon(
                Icons.radar_rounded,
                _openRequestCount,
              ),
              label: 'Yêu cầu',
            ),
            NavigationDestination(
              icon: _navigationIcon(
                Icons.work_history_outlined,
                _activeJobCount,
              ),
              selectedIcon: _navigationIcon(
                Icons.work_history_rounded,
                _activeJobCount,
              ),
              label: 'Công việc',
            ),
            const NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments_rounded),
              label: 'Thu nhập',
            ),
            NavigationDestination(
              icon: _navigationIcon(
                Icons.chat_bubble_outline,
                _unreadChatCount,
              ),
              selectedIcon: _navigationIcon(
                Icons.chat_bubble_rounded,
                _unreadChatCount,
              ),
              label: 'Trò chuyện',
            ),
            const NavigationDestination(
              icon: Icon(Icons.account_circle_outlined),
              selectedIcon: Icon(Icons.account_circle_rounded),
              label: 'Hồ sơ',
            ),
          ],
        ),
      ),
    );
  }

  void _handleNotificationOpen(FcmNotificationOpen notificationOpen) {
    final intent = PushNotificationOpenIntent.fromData(notificationOpen.data);
    final nextIndex = _tabIndexForNotificationDestination(intent.destination);
    if (!mounted) {
      return;
    }

    setState(() {
      if (intent.destination == PushNotificationOpenDestination.chat) {
        _notificationChatRoomId = intent.chatRoomId;
        _notificationBookingId = intent.bookingId;
        _chatOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.booking) {
        _notificationBookingId = intent.bookingId;
        _requestsOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.jobs) {
        _notificationBookingId = intent.bookingId;
        _jobsOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.earnings) {
        _notificationEarningId = intent.earningId;
        _notificationPayoutBatchId = intent.payoutBatchId;
        _earningsOpenVersion += 1;
      }
      if (intent.destination == PushNotificationOpenDestination.payment) {
        _notificationEarningId = null;
        _notificationPayoutBatchId = null;
        _earningsOpenVersion += 1;
      }
      index = nextIndex;
    });
    unawaited(_refreshQueueCounts());
  }

  void _selectDestination(int value) {
    setState(() {
      if (value == _chatIndex) {
        _notificationChatRoomId = null;
        _notificationBookingId = null;
        _chatOpenVersion += 1;
      }
      if (value == _requestsIndex) {
        _notificationBookingId = null;
        _requestsOpenVersion += 1;
      }
      if (value == _jobsIndex) {
        _notificationBookingId = null;
        _jobsOpenVersion += 1;
      }
      if (value == _earningsIndex) {
        _notificationEarningId = null;
        _notificationPayoutBatchId = null;
        _earningsOpenVersion += 1;
      }
      index = value;
    });
    unawaited(_refreshQueueCounts());
  }

  void _openJobChat(String bookingId, String chatRoomId) {
    setState(() {
      _notificationBookingId = bookingId;
      _notificationChatRoomId = chatRoomId;
      _chatOpenVersion += 1;
      index = _chatIndex;
    });
  }

  void _openJobsFromChat() {
    setState(() {
      _notificationChatRoomId = null;
      _jobsOpenVersion += 1;
      index = _jobsIndex;
    });
    unawaited(_refreshQueueCounts());
  }

  Widget _navigationIcon(IconData icon, int count) {
    return Badge.count(
      count: count,
      isLabelVisible: count > 0,
      child: Icon(icon),
    );
  }

  void _setOpenRequestCount(int count) {
    if (!mounted || count == _openRequestCount) {
      return;
    }
    setState(() => _openRequestCount = count);
  }

  void _setActiveJobCount(int count) {
    if (!mounted || count == _activeJobCount) {
      return;
    }
    setState(() => _activeJobCount = count);
  }

  void _setUnreadChatCount(int count) {
    if (!mounted || count == _unreadChatCount) {
      return;
    }
    setState(() => _unreadChatCount = count);
  }

  void _clearQueueCounts() {
    if (!mounted) {
      return;
    }
    _queueCountsRefreshRequested = false;
    if (_openRequestCount == 0 &&
        _activeJobCount == 0 &&
        _unreadChatCount == 0) {
      return;
    }
    setState(() {
      _openRequestCount = 0;
      _activeJobCount = 0;
      _unreadChatCount = 0;
    });
  }

  Future<void> _refreshQueueCounts() async {
    if (ref.read(authControllerProvider) == null) {
      return;
    }
    if (_queueCountsLoading) {
      _queueCountsRefreshRequested = true;
      return;
    }
    _queueCountsLoading = true;
    try {
      final bookingRepository = ref.read(providerBookingRepositoryProvider);
      final providerRepository = ref.read(providerRepositoryProvider);
      final results = await Future.wait<dynamic>([
        bookingRepository.requestBookings(),
        bookingRepository.listBookings(),
        providerRepository.chatNotificationSummary(),
      ]);
      final activeTravelBooking = (results[1] as Iterable<dynamic>)
          .whereType<Map<String, dynamic>>()
          .where(
            (booking) => const {
              'PROVIDER_ON_THE_WAY',
              'ARRIVED',
              'IN_SERVICE',
            }.contains(booking['status']),
          )
          .firstOrNull;
      final activeTravelBookingId = activeTravelBooking?['id']?.toString();
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      _activeLocationHeartbeat = heartbeat;
      if (activeTravelBookingId != null &&
          activeTravelBookingId.isNotEmpty &&
          (!heartbeat.snapshot.active ||
              heartbeat.snapshot.bookingId != activeTravelBookingId)) {
        try {
          await heartbeat.startActiveBooking(
            activeTravelBookingId,
            runImmediately:
                activeTravelBooking?['status'] == 'PROVIDER_ON_THE_WAY',
          );
        } catch (_) {
          // Queue screens surface location failures with actionable controls.
        }
      }
      if (!mounted || ref.read(authControllerProvider) == null) {
        return;
      }
      setState(() {
        _openRequestCount = providerOpenRequestCount(results[0]);
        _activeJobCount = providerActiveJobCount(results[1]);
        _unreadChatCount = providerUnreadChatCount(results[2]);
      });
    } catch (_) {
      // Queue screens retain their own error states; stale badges are safer than
      // interrupting navigation when a background refresh fails.
    } finally {
      _queueCountsLoading = false;
      if (_queueCountsRefreshRequested && mounted) {
        _queueCountsRefreshRequested = false;
        unawaited(_refreshQueueCounts());
      }
    }
  }

  void _startPushRegistration() {
    if (_pushRegistrationStarted) {
      return;
    }
    _pushRegistrationStarted = true;
    ref.read(pushTokenRefreshRegistrationProvider);
    unawaited(ref.read(registerCurrentDevicePushTokenProvider).call());
  }

  Future<void> _checkAppVersion() async {
    if (_versionChecked) return;
    _versionChecked = true;
    try {
      final policy =
          await loadProviderAppVersionPolicy(ref.read(apiClientProvider));
      if (!mounted || !policy.requiresUpdate()) return;
      final updateUri = Uri.tryParse(policy.updateUrl ?? '');
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Cần cập nhật'),
          content: Text(
            policy.releaseNotes ??
                'Hãy cài phiên bản HANDS Partner mới nhất để tiếp tục.',
          ),
          actions: [
            if (updateUri == null)
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Đóng'),
              )
            else
              FilledButton(
                onPressed: () => launchUrl(
                  updateUri,
                  mode: LaunchMode.externalApplication,
                ),
                child: const Text('Cập nhật ứng dụng'),
              ),
          ],
        ),
      );
    } catch (_) {
      // Version policy is advisory until the API returns a forced update.
    }
  }

  void _recordAppOpen() {
    if (!mounted || ref.read(authControllerProvider) == null) {
      return;
    }
    final now = DateTime.now();
    final lastReportedAt = _lastAppOpenReportedAt;
    if (!shouldReportAppOpen(now: now, lastReportedAt: lastReportedAt)) {
      return;
    }
    _lastAppOpenReportedAt = now;
    unawaited(ref
        .read(appSessionReporterProvider)
        .recordAppOpen()
        .catchError(reportAppUsageFailure));
  }

  int _tabIndexForNotificationDestination(
    PushNotificationOpenDestination destination,
  ) {
    switch (destination) {
      case PushNotificationOpenDestination.chat:
        return _chatIndex;
      case PushNotificationOpenDestination.payment:
      case PushNotificationOpenDestination.earnings:
        return _earningsIndex;
      case PushNotificationOpenDestination.booking:
      case PushNotificationOpenDestination.notificationCenter:
        return _requestsIndex;
      case PushNotificationOpenDestination.jobs:
        return _jobsIndex;
      case PushNotificationOpenDestination.providerProfile:
      case PushNotificationOpenDestination.profile:
        return _profileIndex;
    }
  }
}
