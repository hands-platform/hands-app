import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/fcm_message_handling_service.dart';
import 'core/app_session_reporter.dart';
import 'core/mobile_app_version.dart';
import 'core/providers.dart';
import 'core/widgets/customer_app_chrome.dart';
import 'features/auth/presentation/providers/auth_providers.dart';
import 'features/booking/presentation/customer_bookings_screen.dart';
import 'features/chat/presentation/customer_chat_screen.dart';
import 'features/discovery/presentation/customer_home_screen.dart';
import 'features/discovery/presentation/customer_providers_screen.dart';
import 'features/notification/domain/entities/push_notification_open_intent.dart';
import 'features/notification/presentation/customer_notification_screen.dart';
import 'features/notification/presentation/providers/notification_providers.dart';
import 'features/profile/presentation/customer_profile_screen.dart';

class CustomerShell extends ConsumerStatefulWidget {
  const CustomerShell({super.key});

  @override
  ConsumerState<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends ConsumerState<CustomerShell>
    with WidgetsBindingObserver {
  static const _homeIndex = 0;
  static const _bookingsIndex = 1;
  static const _profileIndex = 2;
  int index = 0;
  String? _notificationChatRoomId;
  int _chatOpenVersion = 0;
  int _bookingOpenVersion = 0;
  bool _pushRegistrationStarted = false;
  bool _versionChecked = false;
  DateTime? _lastAppOpenReportedAt;
  StreamSubscription<FcmNotificationOpen>? _notificationOpenSubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notificationOpenSubscription =
        handsFcmNotificationOpens.listen(_handleNotificationOpen);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAppVersion();
      if (!mounted || ref.read(authControllerProvider) == null) {
        return;
      }
      _startPushRegistration();
      _recordAppOpen();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_notificationOpenSubscription?.cancel());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _recordAppOpen();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (_, next) {
      if (next == null) {
        _pushRegistrationStarted = false;
        return;
      }
      _startPushRegistration();
      _recordAppOpen();
    });

    final screens = [
      HomeScreen(
        onOpenMore: () => _selectDestination(_profileIndex),
        onOpenBooking: () => _selectDestination(_bookingsIndex),
      ),
      ProvidersScreen(onOpenMore: () => _selectDestination(_profileIndex)),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: CustomerBottomNavigation(
        index: index,
        onSelected: _selectDestination,
      ),
    );
  }

  void _handleNotificationOpen(FcmNotificationOpen notificationOpen) {
    final intent = PushNotificationOpenIntent.fromData(notificationOpen.data);
    if (intent.destination ==
        PushNotificationOpenDestination.notificationCenter) {
      if (mounted) {
        Navigator.of(context).push<void>(
          MaterialPageRoute(
              builder: (context) => const CustomerNotificationScreen()),
        );
      }
      return;
    }
    if (intent.destination == PushNotificationOpenDestination.chat) {
      if (!mounted) {
        return;
      }
      _notificationChatRoomId = intent.chatRoomId;
      _chatOpenVersion += 1;
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            key: ValueKey('customer-push-chat-$_chatOpenVersion'),
            initialChatRoomId: _notificationChatRoomId,
            initialBookingId: intent.bookingId,
          ),
        ),
      );
      return;
    }
    if (intent.destination == PushNotificationOpenDestination.booking ||
        intent.destination == PushNotificationOpenDestination.payment) {
      if (!mounted) {
        return;
      }
      _bookingOpenVersion += 1;
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (context) => BookingsScreen(
            key: ValueKey('customer-push-booking-$_bookingOpenVersion'),
            initialBookingId: intent.bookingId,
            initialPaymentId: intent.paymentId,
          ),
        ),
      );
      return;
    }
    final nextIndex = _tabIndexForNotificationDestination(intent.destination);
    if (!mounted) {
      return;
    }

    setState(() => index = nextIndex);
  }

  void _selectDestination(int value) {
    setState(() => index = value);
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
          await loadCustomerAppVersionPolicy(ref.read(apiClientProvider));
      if (!mounted || !policy.requiresUpdate()) return;
      final updateUri = Uri.tryParse(policy.updateUrl ?? '');
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Update required'),
          content: Text(
            policy.releaseNotes ??
                'Install the latest HANDS version to continue.',
          ),
          actions: [
            if (updateUri == null)
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              )
            else
              FilledButton(
                onPressed: () => launchUrl(
                  updateUri,
                  mode: LaunchMode.externalApplication,
                ),
                child: const Text('Update app'),
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
        return _bookingsIndex;
      case PushNotificationOpenDestination.payment:
      case PushNotificationOpenDestination.earnings:
      case PushNotificationOpenDestination.jobs:
      case PushNotificationOpenDestination.booking:
        return _bookingsIndex;
      case PushNotificationOpenDestination.providerProfile:
        return _homeIndex;
      case PushNotificationOpenDestination.profile:
        return _profileIndex;
      case PushNotificationOpenDestination.notificationCenter:
        return _homeIndex;
    }
  }
}
