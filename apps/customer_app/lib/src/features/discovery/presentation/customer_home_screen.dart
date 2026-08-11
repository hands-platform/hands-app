import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_flow_screens.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import '../../notification/domain/entities/customer_app_notification.dart';
import '../../notification/presentation/customer_notification_screen.dart';
import 'customer_discovery_widgets.dart';
import 'customer_provider_detail_page.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({
    super.key,
    this.onOpenMore,
    this.onOpenBooking,
  });

  final VoidCallback? onOpenMore;
  final VoidCallback? onOpenBooking;

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final loginPhoneController = TextEditingController(
    text: localDemoAccessEnabled ? '+84900000001' : '',
  );
  final loginOtpController = TextEditingController(
    text: localDemoAccessEnabled ? '123456' : '',
  );
  List<Map<String, dynamic>> favoritePartners = [];
  List<Map<String, dynamic>> completedPartners = [];
  Map<String, dynamic>? activeBooking;
  int walletBalance = 0;
  int unreadNotificationCount = 0;
  String walletCurrency = 'VND';
  double? customerLat;
  double? customerLng;
  String customerAddress = localDemoAccessEnabled ? demoCustomerAddress : '';
  bool customerLocationIsDemo = false;
  bool loading = false;
  bool otpRequested = false;
  int otpCooldownSeconds = 0;
  Timer? _otpCooldownTimer;
  bool restoringSession = true;
  String? error;
  String? notice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(restoreSessionAndLoad());
    });
  }

  @override
  void dispose() {
    _otpCooldownTimer?.cancel();
    loginPhoneController.dispose();
    loginOtpController.dispose();
    super.dispose();
  }

  Future<void> restoreSessionAndLoad() async {
    try {
      final session =
          await ref.read(authControllerProvider.notifier).restoreSession();
      if (session != null) {
        ref.read(pushTokenRefreshRegistrationProvider);
        await ref.read(registerCurrentDevicePushTokenProvider).call();
        await loadHome();
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => restoringSession = false);
      }
    }
  }

  Future<void> requestLoginOtp() async {
    final phone = loginPhoneController.text.trim();
    if (!isValidCustomerPhone(phone)) {
      setState(
          () => error = 'Enter a valid phone number including country code.');
      return;
    }
    if (otpCooldownSeconds > 0) return;
    setState(() {
      loading = true;
      error = null;
      notice = null;
    });
    try {
      final result = await ref.read(authControllerProvider.notifier).requestOtp(
            phone: phone,
          );
      setState(() {
        otpRequested = true;
        notice = result.devOtp == null
            ? 'OTP sent to ${result.phone}. Enter the SMS code to continue.'
            : 'OTP requested for ${result.phone}. Local dev OTP: ${result.devOtp}.';
      });
      _startOtpCooldown();
    } catch (exception) {
      setState(() => error = customerErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> signInWithOtpAndLoad() async {
    final otp = loginOtpController.text.trim();
    if (!otpRequested) {
      setState(() => error = 'Request an OTP before signing in.');
      return;
    }
    if (!isValidCustomerOtp(otp)) {
      setState(() => error = 'Enter the 6-digit OTP code.');
      return;
    }
    setState(() {
      loading = true;
      error = null;
      notice = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInWithOtp(
            phone: loginPhoneController.text.trim(),
            otp: otp,
          );
      ref.read(pushTokenRefreshRegistrationProvider);
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      await loadHome();
      if (mounted) {
        setState(() => notice = pushResult.message);
      }
    } catch (exception) {
      setState(() => error = customerErrorMessage(exception));
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

  Future<void> loadHome() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final repository = ref.read(customerRepositoryProvider);
      final location = await resolveDiscoveryLocation(ref);
      final activeLat = location.latitude;
      final activeLng = location.longitude;
      final results = await Future.wait([
        repository.getHomeSummary(lat: activeLat, lng: activeLng),
        repository.listBookings(),
        ref
            .read(customerNotificationInboxRepositoryProvider)
            .list(take: 1)
            .catchError(
              (_) => const CustomerNotificationInboxPage(
                rows: [],
                nextCursor: null,
              ),
            ),
      ]);
      final summary = Map<String, dynamic>.from(results[0] as Map);
      final bookings = results[1] as List<dynamic>;
      final notifications = results[2] as CustomerNotificationInboxPage;
      final booking = latestActiveBooking(bookings);
      final wallet = summary['wallet'] is Map
          ? Map<String, dynamic>.from(summary['wallet'] as Map)
          : <String, dynamic>{};
      if (booking != null) {
        repository.joinBookingRoom(booking['id'] as String);
      }
      setState(() {
        favoritePartners = sortNearbyProvidersByDistance(
          summary['favoritePartners'] is List
              ? summary['favoritePartners'] as List
              : const <dynamic>[],
        );
        completedPartners = sortNearbyProvidersByDistance(
          summary['completedPartners'] is List
              ? summary['completedPartners'] as List
              : const <dynamic>[],
        );
        walletBalance = asNum(wallet['balance'])?.toInt() ?? 0;
        walletCurrency = wallet['currency']?.toString() ?? 'VND';
        unreadNotificationCount = notifications.unreadCount;
        activeBooking = booking;
        customerLat = activeLat;
        customerLng = activeLng;
        customerAddress = location.addressText ?? customerAddress;
        customerLocationIsDemo = location.isDemoLocation;
        notice = null;
      });
    } catch (exception) {
      setState(() => error = customerErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> signInAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      notice = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInDemoCustomer();
      ref.read(pushTokenRefreshRegistrationProvider);
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      await loadHome();
      if (mounted) {
        setState(() => notice = pushResult.message);
      }
    } catch (exception) {
      setState(() => error = customerErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> openCustomerLocationSelector() async {
    final selected = await Navigator.of(context).push<SelectedCustomerLocation>(
      MaterialPageRoute(
        builder: (context) => LocationSelectionPage(
          initialLatitude: customerLat ?? demoCustomerLat,
          initialLongitude: customerLng ?? demoCustomerLng,
          initialAddress: customerAddress,
        ),
      ),
    );
    if (selected == null || !mounted) {
      return;
    }

    ref.read(selectedCustomerLocationProvider.notifier).state = selected;
    setState(() {
      customerLat = selected.latitude;
      customerLng = selected.longitude;
      customerAddress = selected.addressText;
      customerLocationIsDemo = false;
      notice =
          'Vietnam service location selected. Nearby partners are now sorted from this pin.';
      error = null;
    });

    try {
      final savedLocation =
          await ref.read(customerRepositoryProvider).saveSelectedLocation(
                lat: selected.latitude,
                lng: selected.longitude,
                addressText: selected.addressText,
              );
      final savedId = savedLocation?['id'] as String?;
      if (savedId != null) {
        ref.read(selectedCustomerLocationProvider.notifier).state =
            selected.copyWith(id: savedId);
      }
    } catch (_) {
      // Location selection should still work locally if the optional save call fails.
    }

    await loadHome();
    if (mounted) {
      setState(() {
        notice =
            'Vietnam service location selected. Nearby partners are now sorted from this pin.';
      });
    }
  }

  Future<void> openCustomerAddressMenu() async {
    final action = await showCustomerAddressSheet(
      context: context,
      currentAddress: customerLocationIsDemo ? '' : customerAddress,
    );
    if (action == CustomerAddressSheetAction.addNew && mounted) {
      await openCustomerLocationSelector();
    }
  }

  Future<void> openProviderDetail(Map<String, dynamic> provider) async {
    final providerId = provider['id'] as String?;
    if (providerId == null) {
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => ProviderDetailPage(
          providerPreview: provider,
          favoriteLoader: () => ref
              .read(customerRepositoryProvider)
              .isFavoriteProvider(providerId),
          loader: () => ref
              .read(customerRepositoryProvider)
              .getProviderDetail(providerId),
          onFavoriteChanged: (favorite) => ref
              .read(customerRepositoryProvider)
              .setFavoriteProvider(providerId: providerId, favorite: favorite),
          onBookService: (detail, service) async {
            final navigator = Navigator.of(context);
            final booked = await navigator.push<Map<String, dynamic>>(
              MaterialPageRoute(
                builder: (context) => BookingConfirmationPage(
                  providerDetail: detail,
                  selectedService: service,
                  initialCustomerLat: customerLat,
                  initialCustomerLng: customerLng,
                  initialCustomerAddress: customerAddress,
                  initialCustomerLocationIsDemo: customerLocationIsDemo,
                ),
              ),
            );

            if (!mounted || booked == null) {
              return;
            }

            setState(() {
              activeBooking = booked;
              notice = 'Booking created. Waiting for partner response.';
            });

            await navigator.push<void>(
              MaterialPageRoute(
                builder: (context) => BookingWaitingPage(
                  initialBooking: booked,
                  onBookingUpdated: (booking) =>
                      setState(() => activeBooking = booking),
                ),
              ),
            );
            await loadHome();
          },
        ),
      ),
    );
    if (mounted) {
      await loadHome();
    }
  }

  Future<void> openActiveBooking() async {
    final booking = activeBooking;
    if (booking == null) {
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => BookingWaitingPage(
          initialBooking: booking,
          onBookingUpdated: (updated) =>
              setState(() => activeBooking = updated),
        ),
      ),
    );
    await loadHome();
  }

  Future<void> openNotifications() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
          builder: (context) => const CustomerNotificationScreen()),
    );
    if (mounted) {
      final page = await ref
          .read(customerNotificationInboxRepositoryProvider)
          .list(take: 1)
          .catchError(
            (_) => const CustomerNotificationInboxPage(
              rows: [],
              nextCursor: null,
            ),
          );
      if (mounted) {
        setState(() => unreadNotificationCount = page.unreadCount);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    final profileLabel = auth?.user['displayName']?.toString() ??
        auth?.user['phone']?.toString();
    final addressLabel = customerLocationIsDemo
        ? 'Choose service address'
        : locationTitle(customerAddress, false);

    return ColoredBox(
      color: context.handsColors.canvas,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            CustomerAddressBar(
              address: addressLabel,
              profileLabel: profileLabel,
              onTap: openCustomerAddressMenu,
              onProfileTap: widget.onOpenMore,
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: auth == null ? () async {} : loadHome,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    CustomerSpacing.page,
                    26,
                    CustomerSpacing.page,
                    32,
                  ),
                  children: [
                    _CustomerHomeHero(
                      activeBooking: activeBooking,
                      authenticated: auth != null,
                      onPrimaryAction: auth == null
                          ? (localDemoAccessEnabled ? signInAndLoad : null)
                          : activeBooking == null
                              ? (widget.onOpenBooking ?? loadHome)
                              : openActiveBooking,
                      onNotifications: auth == null ? null : openNotifications,
                      notificationCount: unreadNotificationCount,
                    ),
                    if (loading || restoringSession) ...[
                      const SizedBox(height: 14),
                      const LinearProgressIndicator(minHeight: 2),
                    ],
                    if (error != null) ...[
                      const SizedBox(height: 14),
                      ErrorPanel(text: error!),
                    ],
                    if (notice != null) ...[
                      const SizedBox(height: 14),
                      InfoBanner(text: notice!),
                    ],
                    if (auth == null) ...[
                      const SizedBox(height: CustomerSpacing.section),
                      CustomerOtpLoginPanel(
                        phoneController: loginPhoneController,
                        otpController: loginOtpController,
                        otpRequested: otpRequested,
                        otpCooldownSeconds: otpCooldownSeconds,
                        loading: loading,
                        onRequestOtp: requestLoginOtp,
                        onVerifyOtp: signInWithOtpAndLoad,
                        onDemoLogin: signInAndLoad,
                      ),
                    ] else ...[
                      const SizedBox(height: CustomerSpacing.section),
                      CustomerWalletSummaryCard(
                        balance: walletBalance,
                        currency: walletCurrency,
                        onTap: widget.onOpenMore,
                      ),
                      const SizedBox(height: CustomerSpacing.section),
                      CustomerHomePartnerSection(
                        title: 'Favorites',
                        emptyText:
                            'Favorite partners will appear here for quick booking.',
                        partners: favoritePartners,
                        onPartnerTap: openProviderDetail,
                      ),
                      const SizedBox(height: CustomerSpacing.section),
                      CustomerHomePartnerSection(
                        title: 'Booked before',
                        emptyText:
                            'Partners from completed bookings will appear here.',
                        partners: completedPartners,
                        onPartnerTap: openProviderDetail,
                      ),
                      if (activeBooking != null) ...[
                        const SizedBox(height: CustomerSpacing.section),
                        ActiveBookingBanner(
                          booking: activeBooking!,
                          onOpen: openActiveBooking,
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerWalletSummaryCard extends StatelessWidget {
  const CustomerWalletSummaryCard({
    super.key,
    required this.balance,
    required this.currency,
    this.onTap,
  });

  final int balance;
  final String currency;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(HandsShapes.large),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HandsShapes.large),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(
                    Icons.account_balance_wallet_outlined,
                    color: colors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Wallet',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${formatCurrency(balance)} $currency',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 16,
                  color: colors.inkMuted,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class CustomerHomePartnerSection extends StatelessWidget {
  const CustomerHomePartnerSection({
    super.key,
    required this.title,
    required this.emptyText,
    required this.partners,
    required this.onPartnerTap,
  });

  final String title;
  final String emptyText;
  final List<Map<String, dynamic>> partners;
  final ValueChanged<Map<String, dynamic>> onPartnerTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 14),
        if (partners.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(
              vertical: HandsSpacing.space16,
            ),
            child: Text(
              emptyText,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.inkMuted,
                  ),
            ),
          )
        else
          SizedBox(
            height: 188,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: partners.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(width: HandsSpacing.space16),
              itemBuilder: (context, index) {
                final partner = partners[index];
                return CustomerHomePartnerAvatar(
                  partner: partner,
                  onTap: () => onPartnerTap(partner),
                );
              },
            ),
          ),
      ],
    );
  }
}

class CustomerHomePartnerAvatar extends StatelessWidget {
  const CustomerHomePartnerAvatar({
    super.key,
    required this.partner,
    required this.onTap,
  });

  final Map<String, dynamic> partner;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final name = partner['displayName']?.toString() ?? 'Partner';
    final imageUrl = providerProfileImageUrl(partner);
    final distanceMeters = asDouble(partner['distanceMeters']);
    final distanceLabel = distanceMeters == null
        ? null
        : distanceMeters <= 0
            ? '<1 km'
            : formatDistance(distanceMeters);

    return SizedBox(
      width: 100,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HandsPortraitStage(
              name: name,
              imageUrl: imageUrl,
              width: 100,
              height: 125,
            ),
            const SizedBox(height: HandsSpacing.space8),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium,
            ),
            if (distanceLabel != null)
              Text(
                distanceLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                      fontSize: 12,
                    ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CustomerHomeHero extends StatelessWidget {
  const _CustomerHomeHero({
    required this.activeBooking,
    required this.authenticated,
    required this.onPrimaryAction,
    required this.onNotifications,
    required this.notificationCount,
  });

  final Map<String, dynamic>? activeBooking;
  final bool authenticated;
  final VoidCallback? onPrimaryAction;
  final VoidCallback? onNotifications;
  final int notificationCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final hasActiveBooking = activeBooking != null;
    final service =
        hasActiveBooking ? firstBookingService(activeBooking!) : null;
    final title = hasActiveBooking
        ? (service?['name']?.toString() ?? 'Your booking is active')
        : 'Care that comes to you';
    final actionLabel = !authenticated
        ? 'Sign in'
        : hasActiveBooking
            ? 'Open booking'
            : 'Find a partner';

    return Container(
      height: 176,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(HandsShapes.large),
        border: Border.all(color: colors.outline),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 28,
            right: 78,
            top: 24,
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          Positioned(
            left: 28,
            bottom: 22,
            child: FilledButton(
              onPressed: onPrimaryAction,
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, HandsButtonTheme.compactHeight),
                padding: const EdgeInsets.symmetric(
                  horizontal: HandsSpacing.space16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(actionLabel),
            ),
          ),
          if (onNotifications != null)
            Positioned(
              right: 16,
              top: 14,
              child: IconButton(
                onPressed: onNotifications,
                tooltip: 'Notifications',
                style: IconButton.styleFrom(
                  backgroundColor: colors.primarySoft,
                  foregroundColor: colors.primary,
                ),
                icon: Badge.count(
                  count: notificationCount,
                  isLabelVisible: notificationCount > 0,
                  child: const Icon(Icons.notifications_none_rounded),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class CustomerOtpLoginPanel extends StatelessWidget {
  const CustomerOtpLoginPanel({
    super.key,
    required this.phoneController,
    required this.otpController,
    required this.otpRequested,
    required this.otpCooldownSeconds,
    required this.loading,
    required this.onRequestOtp,
    required this.onVerifyOtp,
    required this.onDemoLogin,
  });

  final TextEditingController phoneController;
  final TextEditingController otpController;
  final bool otpRequested;
  final int otpCooldownSeconds;
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
            Text('Customer login',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              localDemoAccessEnabled
                  ? 'Use phone OTP, or use the local demo account while testing.'
                  : 'Use phone OTP to sign in to your HANDS account.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Phone number',
                hintText: '+84900000001',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'OTP code',
                hintText: '123456',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed:
                        loading || otpCooldownSeconds > 0 ? null : onRequestOtp,
                    icon: const Icon(Icons.sms_outlined),
                    label: Text(
                      otpCooldownSeconds > 0
                          ? 'Resend in ${otpCooldownSeconds}s'
                          : otpRequested
                              ? 'Resend OTP'
                              : 'Request OTP',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: loading || !otpRequested ? null : onVerifyOtp,
                    icon: const Icon(Icons.login),
                    label: const Text('Verify'),
                  ),
                ),
              ],
            ),
            if (localDemoAccessEnabled) ...[
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
          ],
        ),
      ),
    );
  }
}

bool isValidCustomerPhone(String value) {
  return RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(value.trim());
}

bool isValidCustomerOtp(String value) {
  return RegExp(r'^\d{6}$').hasMatch(value.trim());
}

class ActiveBookingBanner extends StatelessWidget {
  const ActiveBookingBanner({
    super.key,
    required this.booking,
    required this.onOpen,
  });

  final Map<String, dynamic> booking;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final service = firstBookingService(booking);
    final provider = activeBookingProvider(booking);

    return Card(
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(CustomerRadii.card),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: context.handsColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.calendar_month_outlined,
                  color: context.handsColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service?['name'] as String? ?? 'Active booking',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      provider == null
                          ? 'Waiting for partner response'
                          : 'Partner: ${provider['displayName']}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, size: 16),
            ],
          ),
        ),
      ),
    );
  }
}
