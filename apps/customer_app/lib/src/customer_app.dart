import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_state.dart';
import 'core/widgets/customer_feedback_panels.dart';
import 'features/booking/presentation/customer_booking_flow_screens.dart';
import 'features/booking/presentation/customer_booking_ui_helpers.dart';
import 'features/chat/presentation/customer_chat_screen.dart';
import 'features/discovery/presentation/customer_service_option_helpers.dart';
import 'features/discovery/presentation/customer_discovery_widgets.dart';
import 'features/discovery/presentation/customer_provider_detail_page.dart';
import 'features/discovery/presentation/customer_providers_screen.dart';
import 'features/map/presentation/customer_location_helpers.dart';
import 'features/map/presentation/customer_map_widgets.dart';
import 'features/profile/presentation/customer_profile_screen.dart';

export 'core/customer_value_helpers.dart';
export 'features/discovery/presentation/customer_service_option_helpers.dart';
export 'features/booking/presentation/customer_booking_ui_helpers.dart';
export 'features/map/presentation/customer_location_helpers.dart';

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HANDS Customer',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF5E8E4A)),
        useMaterial3: true,
      ),
      home: const CustomerShell(),
    );
  }
}

class CustomerShell extends ConsumerStatefulWidget {
  const CustomerShell({super.key});

  @override
  ConsumerState<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends ConsumerState<CustomerShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      const HomeScreen(),
      const ProvidersScreen(),
      const BookingsScreen(),
      const ChatScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: screens[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.spa_outlined), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.groups_outlined), label: 'Partners'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined), label: 'Bookings'),
          NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final loginPhoneController = TextEditingController(text: '+84900000001');
  final loginOtpController = TextEditingController(text: '123456');
  List<dynamic> providers = [];
  Map<String, dynamic>? activeBooking;
  double? customerLat;
  double? customerLng;
  String customerAddress = demoCustomerAddress;
  bool customerLocationIsDemo = false;
  bool loading = false;
  bool otpRequested = false;
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
    loginPhoneController.dispose();
    loginOtpController.dispose();
    super.dispose();
  }

  Future<void> restoreSessionAndLoad() async {
    try {
      final session =
          await ref.read(authControllerProvider.notifier).restoreSession();
      if (session != null) {
        await loadHome();
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

  Future<void> requestLoginOtp() async {
    setState(() {
      loading = true;
      error = null;
      notice = null;
    });
    try {
      final result = await ref.read(authControllerProvider.notifier).requestOtp(
            phone: loginPhoneController.text.trim(),
          );
      setState(() {
        otpRequested = true;
        notice = result.devOtp == null
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
      notice = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).signInWithOtp(
            phone: loginPhoneController.text.trim(),
            otp: loginOtpController.text.trim(),
          );
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      await loadHome();
      if (mounted) {
        setState(() => notice = pushResult.message);
      }
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
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
        repository.nearbyProviders(lat: activeLat, lng: activeLng),
        repository.listBookings(),
      ]);
      final bookings = results[1];
      final booking = latestActiveBooking(bookings);
      if (booking != null) {
        repository.joinBookingRoom(booking['id'] as String);
      }
      setState(() {
        providers = results[0];
        activeBooking = booking;
        customerLat = activeLat;
        customerLng = activeLng;
        customerAddress = location.addressText ?? customerAddress;
        customerLocationIsDemo = location.isDemoLocation;
        notice = location.isDemoLocation
            ? 'Using demo Ho Chi Minh City location for discovery only. Confirm your exact service pin before booking.'
            : null;
      });
    } catch (exception) {
      setState(() => error = '$exception');
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
      final pushResult =
          await ref.read(registerCurrentDevicePushTokenProvider).call();
      await loadHome();
      if (mounted) {
        setState(() => notice = pushResult.message);
      }
    } catch (exception) {
      setState(() => error = '$exception');
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
          'Service location selected. Nearby partners are now sorted from this pin.';
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
            'Service location selected. Nearby partners are now sorted from this pin.';
      });
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
          loader: () => ref
              .read(customerRepositoryProvider)
              .getProviderDetail(providerId),
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
                  onConfirm: ({
                    required customerName,
                    required customerPhone,
                    required addressLine,
                    required lat,
                    required lng,
                    currentLat,
                    currentLng,
                    currentLocationUpdatedAt,
                  }) =>
                      ref.read(customerRepositoryProvider).createBooking(
                            service['id'] as String,
                            providerId: detail['id'] as String,
                            selectedLocationId:
                                ref.read(selectedCustomerLocationProvider)?.id,
                            customerName: customerName,
                            customerPhone: customerPhone,
                            addressLine: addressLine,
                            lat: lat,
                            lng: lng,
                            currentLat: currentLat,
                            currentLng: currentLng,
                            currentLocationUpdatedAt: currentLocationUpdatedAt,
                          ),
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

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Row(
            children: [
              const Icon(Icons.arrow_back_outlined),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  locationTitle(customerAddress, customerLocationIsDemo),
                  style: Theme.of(context).textTheme.titleLarge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(Icons.favorite_border),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: auth == null ? signInAndLoad : loadHome,
                  icon: const Icon(Icons.search),
                  label: Text(auth == null
                      ? 'Demo customer login'
                      : 'Refresh partners'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (loading || restoringSession) const LinearProgressIndicator(),
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          if (notice != null) ...[
            const SizedBox(height: 12),
            InfoBanner(text: notice!),
          ],
          if (auth == null) ...[
            const SizedBox(height: 12),
            CustomerOtpLoginPanel(
              phoneController: loginPhoneController,
              otpController: loginOtpController,
              otpRequested: otpRequested,
              loading: loading,
              onRequestOtp: requestLoginOtp,
              onVerifyOtp: signInWithOtpAndLoad,
              onDemoLogin: signInAndLoad,
            ),
          ] else ...[
            if (activeBooking != null) ...[
              const SizedBox(height: 12),
              ActiveBookingBanner(
                booking: activeBooking!,
                onOpen: openActiveBooking,
              ),
            ],
            const SizedBox(height: 16),
            CustomerLocationContextCard(
              addressText: customerAddress,
              latitude: customerLat,
              longitude: customerLng,
              isDemoLocation: customerLocationIsDemo,
              onChooseLocation: openCustomerLocationSelector,
            ),
            const SizedBox(height: 16),
            const FilterChipRow(),
            const SizedBox(height: 16),
            if (providers.isEmpty)
              const EmptyPanel(
                  text: 'Nearby partners will appear here after refresh.')
            else
              for (final item in providers)
                ProviderListCard(
                  provider: item,
                  onTap: () => openProviderDetail(item),
                ),
          ],
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
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Customer login',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Use phone OTP for Supabase/Nest login, or keep using the local demo account while building the MVP.',
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
                hintText: '+84900000001',
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
      color: Theme.of(context).colorScheme.primaryContainer,
      child: ListTile(
        title: Text(service?['name'] as String? ?? 'Active booking'),
        subtitle: Text(provider == null
            ? 'Waiting for partner response'
            : 'Partner: ${provider['displayName']}'),
        trailing: FilledButton.tonal(
          onPressed: onOpen,
          child: const Text('Open'),
        ),
      ),
    );
  }
}

class BookingsScreen extends ConsumerStatefulWidget {
  const BookingsScreen({super.key});

  @override
  ConsumerState<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends ConsumerState<BookingsScreen> {
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
        await ref.read(authControllerProvider.notifier).signInDemoCustomer();
      }
      await loadBookings(showLoading: false);
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadBookings({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final loaded = await ref.read(customerRepositoryProvider).listBookings();
      if (!mounted) {
        return;
      }
      setState(() {
        bookings = loaded;
        statusMessage = 'Loaded ${loaded.length} booking(s).';
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
      ..sort((left, right) => customerBookingTimestamp(right)
          .compareTo(customerBookingTimestamp(left)));
    final activeCount = items.where(isCustomerActiveBooking).length;
    final closedCount = items.where(isCustomerClosedBooking).length;
    final chatReadyCount = items.where(isCustomerAppChatVisible).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Bookings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
              'Recent requests, assigned partners, payment state, and chat readiness.',
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed:
                loading ? null : (auth == null ? signInAndLoad : loadBookings),
            icon: const Icon(Icons.receipt_long_outlined),
            label:
                Text(auth == null ? 'Demo customer login' : 'Refresh bookings'),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (statusMessage != null) ...[
            const SizedBox(height: 12),
            InfoBanner(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          const SizedBox(height: 16),
          CustomerBookingSummary(
              active: activeCount,
              chatReady: chatReadyCount,
              closed: closedCount),
          const SizedBox(height: 16),
          if (auth == null)
            const EmptyPanel(text: 'Login first to load customer bookings.')
          else if (items.isEmpty)
            const EmptyPanel(
                text:
                    'No bookings yet. Choose a partner and book a service to start.')
          else
            for (final booking in items)
              CustomerBookingHistoryCard(booking: booking),
        ],
      ),
    );
  }
}

class CustomerBookingSummary extends StatelessWidget {
  const CustomerBookingSummary({
    super.key,
    required this.active,
    required this.chatReady,
    required this.closed,
  });

  final int active;
  final int chatReady;
  final int closed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        CustomerSummaryTile(
            label: 'Active',
            value: '$active live',
            color: const Color(0xFFEAF5E3)),
        CustomerSummaryTile(
            label: 'Chat',
            value: '$chatReady ready',
            color: const Color(0xFFEAF2FF)),
        CustomerSummaryTile(
            label: 'Closed',
            value: '$closed done',
            color: const Color(0xFFF8ECD4)),
      ],
    );
  }
}

class CustomerSummaryTile extends StatelessWidget {
  const CustomerSummaryTile({
    super.key,
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: color, borderRadius: BorderRadius.circular(18)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: Theme.of(context)
                    .textTheme
                    .labelLarge
                    ?.copyWith(color: Colors.black54)),
            const SizedBox(height: 6),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class CustomerBookingHistoryCard extends StatelessWidget {
  const CustomerBookingHistoryCard({super.key, required this.booking});

  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final service = firstBookingService(booking);
    final provider = activeBookingProvider(booking);
    final payment = booking['payment'] as Map<String, dynamic>?;
    final chatVisible = isCustomerAppChatVisible(booking);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ProviderThumbnail(
                    name: provider?['displayName'] as String? ?? 'HANDS',
                    size: 52,
                    imageUrl: provider == null
                        ? null
                        : providerProfileImageUrl(provider)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(customerServiceOptionLabel(service),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(provider?['displayName'] as String? ??
                          'Partner pending'),
                    ],
                  ),
                ),
                BookingHistoryPill(
                    label: booking['status']?.toString() ?? 'UNKNOWN'),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                BookingHistoryPill(
                    label:
                        'Opened ${formatCustomerRequestOpenedMoment(booking['createdAt'] ?? booking['scheduledStartAt'])}'),
                BookingHistoryPill(
                    label: customerServiceOptionPriceLabel(
                  service,
                  amount: payment?['amount'],
                )),
                BookingHistoryPill(
                    label: payment?['status']?.toString() ?? 'NO_PAYMENT'),
                if (chatVisible)
                  const BookingHistoryPill(
                      label: 'Chat ready', highlighted: true),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              customerBookingNextAction(booking),
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

class BookingHistoryPill extends StatelessWidget {
  const BookingHistoryPill(
      {super.key, required this.label, this.highlighted = false});

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFEAF5E3) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
            color: highlighted
                ? const Color(0xFFBFD6AA)
                : Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text(label,
          style: Theme.of(context)
              .textTheme
              .labelLarge
              ?.copyWith(fontWeight: FontWeight.w700)),
    );
  }
}
