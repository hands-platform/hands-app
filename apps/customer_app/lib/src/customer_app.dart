import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'app_state.dart';
import 'core/realtime_socket.dart';
import 'core/customer_value_helpers.dart';
import 'core/widgets/customer_feedback_panels.dart';
import 'features/booking/presentation/customer_booking_error_messages.dart';
import 'features/booking/presentation/customer_booking_ui_helpers.dart';
import 'features/discovery/presentation/customer_service_option_helpers.dart';
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

class CustomerLocationContextCard extends StatelessWidget {
  const CustomerLocationContextCard({
    super.key,
    required this.addressText,
    required this.latitude,
    required this.longitude,
    required this.isDemoLocation,
    required this.onChooseLocation,
  });

  final String addressText;
  final double? latitude;
  final double? longitude;
  final bool isDemoLocation;
  final VoidCallback onChooseLocation;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final title = isDemoLocation ? 'Demo discovery pin' : 'Service location';
    final subtitle = isDemoLocation
        ? 'Choose the real service location before booking.'
        : addressText;

    return Card(
      elevation: 0,
      color: colorScheme.surfaceContainerHighest,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.pin_drop_outlined, color: colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                TextButton.icon(
                  onPressed: onChooseLocation,
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: const Text('Choose'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Text(
              '${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.black54),
            ),
          ],
        ),
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

class ProviderListCard extends StatelessWidget {
  const ProviderListCard({
    super.key,
    required this.provider,
    required this.onTap,
  });

  final Map<String, dynamic> provider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final displayName = provider['displayName'] as String? ?? 'Partner';
    final distanceMeters = asDouble(provider['distanceMeters']);
    final rating = providerAverageRating(provider);
    final reviewCount = providerReviewCount(provider);
    final availableLabel = provider['status'] == 'ONLINE_AVAILABLE'
        ? 'Available now'
        : 'Available soon';
    final etaLabel =
        provider['status'] == 'ONLINE_AVAILABLE' ? 'Start now' : 'Starts soon';
    final isRecentLocation = provider['isRecentLocation'] != false;
    final bookableServiceCount =
        asNum(provider['bookableServiceCount'])?.toInt();
    final hasBookableServices =
        bookableServiceCount == null ? true : bookableServiceCount > 0;
    final startingPrice = asNum(provider['startingPrice'])?.toInt();
    final startingDuration = asNum(provider['startingDurationMin'])?.toInt();
    final serviceSummary = hasBookableServices
        ? [
            if (startingPrice != null)
              'From ${formatCurrency(startingPrice)} VND',
            if (startingDuration != null) '$startingDuration min',
            if (bookableServiceCount != null)
              '$bookableServiceCount option${bookableServiceCount == 1 ? '' : 's'}',
          ].join(' / ')
        : 'No bookable services yet';

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Stack(
                children: [
                  ProviderThumbnail(
                    name: displayName,
                    size: 118,
                    imageUrl: providerProfileImageUrl(provider),
                  ),
                  Positioned(
                    left: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7E0A3),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('Top',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            displayName,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          etaLabel,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded,
                            size: 22, color: Color(0xFFF59E0B)),
                        const SizedBox(width: 4),
                        Text(
                          rating.toStringAsFixed(1),
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(width: 4),
                        Text('($reviewCount reviews)'),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 20,
                          color: isRecentLocation
                              ? Colors.grey
                              : Colors.grey.shade500,
                        ),
                        const SizedBox(width: 4),
                        Text(formatDistance(distanceMeters)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      providerLocationFreshnessLabel(provider),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isRecentLocation
                                ? Colors.black54
                                : Colors.grey.shade700,
                            fontWeight: isRecentLocation
                                ? FontWeight.w400
                                : FontWeight.w700,
                          ),
                    ),
                    if (serviceSummary.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        serviceSummary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: hasBookableServices
                                  ? Colors.black87
                                  : Theme.of(context).colorScheme.error,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            availableLabel,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: const Color(0xFF5E8E4A),
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        FilledButton(
                          onPressed: hasBookableServices ? onTap : null,
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF5E8E4A),
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('Reserve'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FilterChipRow extends StatelessWidget {
  const FilterChipRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: const [
        OutlineChip(label: 'Filters', icon: Icons.tune),
        OutlineChip(label: 'Near me'),
        OutlineChip(label: 'Top booked'),
        OutlineChip(label: 'Service type', icon: Icons.keyboard_arrow_down),
      ],
    );
  }
}

class OutlineChip extends StatelessWidget {
  const OutlineChip({
    super.key,
    required this.label,
    this.icon,
  });

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
        color: Colors.white,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18),
            const SizedBox(width: 6),
          ],
          Text(label, style: Theme.of(context).textTheme.labelLarge),
        ],
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

class ProviderDetailPage extends StatelessWidget {
  const ProviderDetailPage({
    super.key,
    required this.providerPreview,
    required this.loader,
    required this.onBookService,
  });

  final Map<String, dynamic> providerPreview;
  final Future<Map<String, dynamic>> Function() loader;
  final Future<void> Function(
      Map<String, dynamic> detail, Map<String, dynamic> service) onBookService;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<Map<String, dynamic>>(
        future: loader(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final detail = <String, dynamic>{
            ...providerPreview,
            ...(snapshot.data ?? const <String, dynamic>{}),
          };
          final reviews = detail['reviews'] is List<dynamic>
              ? detail['reviews'] as List<dynamic>
              : [];
          final services = detail['services'] is List<dynamic>
              ? detail['services'] as List<dynamic>
              : [];
          final displayName = detail['displayName'] as String? ?? 'Partner';
          final rating = providerAverageRating(detail);
          final reviewCount = providerReviewCount(detail);
          final experienceYears = asNum(detail['experienceYears'])?.toInt();
          final specialties = asStringList(detail['specialties']);
          final languages = asStringList(detail['languages']);
          final serviceStyle = detail['serviceStyle']?.toString().trim() ?? '';
          final galleryImageUrls = asStringList(detail['galleryImageUrls']);
          final photoCount =
              galleryImageUrls.isEmpty ? 1 : galleryImageUrls.length;

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 360,
                pinned: true,
                leading: const BackButton(color: Colors.black),
                backgroundColor: Colors.white,
                actions: const [
                  CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white,
                      child: Icon(Icons.favorite_border, color: Colors.black)),
                  SizedBox(width: 8),
                  CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white,
                      child: Icon(Icons.share_outlined, color: Colors.black)),
                  SizedBox(width: 12),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFFF7E8C8),
                              Color(0xFFE9DCC7),
                              Color(0xFFD6E2CF)
                            ],
                          ),
                        ),
                      ),
                      Center(
                        child: ProviderThumbnail(
                          name: displayName,
                          size: 210,
                          imageUrl: providerProfileImageUrl(detail),
                        ),
                      ),
                      Positioned(
                        right: 20,
                        bottom: 20,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('1 / $photoCount',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName,
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined,
                              size: 22, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text(formatDistance(
                              asDouble(providerPreview['distanceMeters']))),
                          const SizedBox(width: 14),
                          const Icon(Icons.star_rounded,
                              size: 22, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 4),
                          Text(
                              '${rating.toStringAsFixed(1)} ($reviewCount reviews)'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: const [
                          ServiceTag(label: 'Available soon'),
                          ServiceTag(label: 'Direct request'),
                          ServiceTag(label: 'Marketplace matching'),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF8AA773)),
                          borderRadius: BorderRadius.circular(18),
                          color: const Color(0xFFF9FCF6),
                        ),
                        child: const Column(
                          children: [
                            Row(
                              children: [
                                Icon(Icons.verified_user_outlined,
                                    color: Color(0xFF5E8E4A)),
                                SizedBox(width: 10),
                                Expanded(
                                    child: Text(
                                        'No required extra fee, no travel fee')),
                              ],
                            ),
                            SizedBox(height: 10),
                            Row(
                              children: [
                                Icon(Icons.shield_outlined,
                                    color: Color(0xFF5E8E4A)),
                                SizedBox(width: 10),
                                Expanded(
                                    child: Text(
                                        'Protected when the assigned partner changes')),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      const SectionHeader(
                        title: 'About me',
                        subtitle:
                            'Profile, service style, and guest expectations before booking.',
                      ),
                      const SizedBox(height: 12),
                      DetailInfoCard(
                        child: Text(
                          (detail['bio'] as String?) ??
                              'Experienced partner profile ready for booking.',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                      if (serviceStyle.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        DetailInfoCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.room_service_outlined,
                                  color: Color(0xFF5E8E4A)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  serviceStyle,
                                  style: Theme.of(context).textTheme.bodyLarge,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      DetailInfoCard(
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (experienceYears != null)
                              DetailFactChip(
                                icon: Icons.workspace_premium_outlined,
                                label: '$experienceYears year(s) experience',
                              ),
                            const DetailFactChip(
                              icon: Icons.schedule_outlined,
                              label: 'Typical response within minutes',
                            ),
                            DetailFactChip(
                              icon: Icons.spa_outlined,
                              label: '${services.length} service option(s)',
                            ),
                            DetailFactChip(
                              icon: Icons.star_outline_rounded,
                              label: '$reviewCount verified review(s)',
                            ),
                            if (languages.isNotEmpty)
                              DetailFactChip(
                                icon: Icons.translate_outlined,
                                label: languages.take(3).join(', '),
                              ),
                          ],
                        ),
                      ),
                      if (specialties.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        DetailInfoCard(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final specialty in specialties.take(8))
                                ServiceTag(label: specialty),
                            ],
                          ),
                        ),
                      ],
                      if (galleryImageUrls.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const SectionHeader(
                          title: 'Photos',
                          subtitle:
                              'Public profile and work photos from this partner.',
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 112,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: galleryImageUrls.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: 12),
                            itemBuilder: (context, index) {
                              return ProviderThumbnail(
                                name: displayName,
                                size: 112,
                                imageUrl: galleryImageUrls[index],
                              );
                            },
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),
                      const SectionHeader(
                        title: 'My services',
                        subtitle:
                            'Choose one service to open a booking request with this partner first.',
                      ),
                      const SizedBox(height: 12),
                      Builder(
                        builder: (context) {
                          final serviceGroups =
                              customerServiceOptionGroups(services);
                          if (serviceGroups.isEmpty) {
                            return const EmptyPanel(
                              text:
                                  'This partner has no bookable service options yet. HANDS requires an active partner price and an exact admin payout rule before booking.',
                            );
                          }
                          return Column(
                            children: [
                              for (final group in serviceGroups)
                                ServiceOptionGroupCard(
                                  group: group,
                                  onBook: (service) =>
                                      onBookService(detail, service),
                                ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 28),
                      Row(
                        children: [
                          const Expanded(
                            child: SectionHeader(
                              title: 'Reviews',
                              subtitle:
                                  'Recent guest feedback and overall rating distribution.',
                            ),
                          ),
                          TextButton(
                              onPressed: () {}, child: const Text('View all')),
                        ],
                      ),
                      ReviewSummaryCard(
                        rating: rating,
                        reviewCount: reviewCount,
                      ),
                      const SizedBox(height: 12),
                      if (reviews.isEmpty)
                        const EmptyPanel(text: 'No reviews yet.')
                      else
                        for (final review in reviews.take(3))
                          ReviewCard(review: review as Map<String, dynamic>),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class ServiceOptionGroupCard extends StatelessWidget {
  const ServiceOptionGroupCard({
    super.key,
    required this.group,
    required this.onBook,
  });

  final CustomerServiceOptionGroup group;
  final ValueChanged<Map<String, dynamic>> onBook;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(group.name,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Choose a time option. The selected partner gets the first response window, and marketplace partner options can open if needed.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                DurationPill(label: customerServiceGroupDurationSummary(group)),
                DurationPill(label: customerServiceGroupPriceRangeLabel(group)),
                const DurationPill(label: 'First-pick request'),
                const DurationPill(label: 'Marketplace matching'),
              ],
            ),
            const SizedBox(height: 18),
            for (final option in group.options) ...[
              ServiceDurationOptionTile(
                service: option,
                onBook: () => onBook(option),
              ),
              if (option != group.options.last) const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

class ServiceDurationOptionTile extends StatelessWidget {
  const ServiceDurationOptionTile({
    super.key,
    required this.service,
    required this.onBook,
  });

  final Map<String, dynamic> service;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final duration = asNum(service['durationMin'])?.toInt();
    final price = customerServicePrice(service);
    final basePrice = asNum(service['basePrice'])?.toInt();
    final hasProviderPrice =
        basePrice != null && basePrice > 0 && price != basePrice;
    final policyLabel = customerServicePricePolicyLabel(service);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DurationPill(label: '${duration ?? '-'} min'),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  policyLabel,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF5E8E4A),
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  '${formatCurrency(price)} VND',
                  textAlign: TextAlign.right,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onBook,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF5E8E4A),
                foregroundColor: Colors.white,
              ),
              child: Text('Reserve ${duration ?? '-'} min'),
            ),
          ),
          if (hasProviderPrice) ...[
            const SizedBox(height: 8),
            Text(
              'Partner price selected. Admin minimum ${formatCurrency(basePrice)} VND.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.black54),
            ),
          ],
        ],
      ),
    );
  }
}

class DurationPill extends StatelessWidget {
  const DurationPill({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelLarge),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: Colors.black54),
        ),
      ],
    );
  }
}

class DetailInfoCard extends StatelessWidget {
  const DetailInfoCard({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F8F4),
        borderRadius: BorderRadius.circular(18),
      ),
      child: child,
    );
  }
}

class DetailFactChip extends StatelessWidget {
  const DetailFactChip({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE6E0D2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF5E8E4A)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class ReviewSummaryCard extends StatelessWidget {
  const ReviewSummaryCard({
    super.key,
    required this.rating,
    required this.reviewCount,
  });

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${rating.toStringAsFixed(1)} / 5',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(
                      5,
                      (_) => const Icon(
                        Icons.star_rounded,
                        size: 20,
                        color: Color(0xFFF59E0B),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('($reviewCount reviews)'),
                ],
              ),
            ),
            Expanded(
              child: Column(
                children: List.generate(
                  5,
                  (index) {
                    final stars = 5 - index;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Text('$stars'),
                          const SizedBox(width: 8),
                          const Icon(Icons.star_rounded,
                              size: 18, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: LinearProgressIndicator(
                              value: stars == 5 ? 1 : 0,
                              minHeight: 8,
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ReviewCard extends StatelessWidget {
  const ReviewCard({super.key, required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.person_outline)),
                const SizedBox(width: 12),
                Text('Customer',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(review['createdAt']?.toString().split('T').first ?? ''),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: List.generate(
                5,
                (index) => Icon(
                  index < (asNum(review['rating'])?.toInt() ?? 0)
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  size: 18,
                  color: const Color(0xFFF59E0B),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(review['comment'] as String? ?? 'No comment'),
          ],
        ),
      ),
    );
  }
}

class BookingConfirmationPage extends ConsumerStatefulWidget {
  const BookingConfirmationPage({
    super.key,
    required this.providerDetail,
    required this.selectedService,
    this.initialCustomerLat,
    this.initialCustomerLng,
    this.initialCustomerAddress,
    this.initialCustomerLocationIsDemo = false,
    required this.onConfirm,
  });

  final Map<String, dynamic> providerDetail;
  final Map<String, dynamic> selectedService;
  final double? initialCustomerLat;
  final double? initialCustomerLng;
  final String? initialCustomerAddress;
  final bool initialCustomerLocationIsDemo;
  final Future<Map<String, dynamic>> Function({
    required String customerName,
    required String customerPhone,
    required String addressLine,
    required double lat,
    required double lng,
    double? currentLat,
    double? currentLng,
    DateTime? currentLocationUpdatedAt,
  }) onConfirm;

  @override
  ConsumerState<BookingConfirmationPage> createState() =>
      _BookingConfirmationPageState();
}

class _BookingConfirmationPageState
    extends ConsumerState<BookingConfirmationPage> {
  final nameController = TextEditingController(text: 'Demo Customer');
  final phoneController = TextEditingController(text: '0865907184');
  final addressController = TextEditingController(text: demoCustomerAddress);
  final couponController = TextEditingController();
  double? customerLat;
  double? customerLng;
  double? currentGpsLat;
  double? currentGpsLng;
  DateTime? currentGpsUpdatedAt;
  int couponDiscountAmount = 0;
  String? appliedCouponCode;
  String? couponMessage;
  String? locationMessage;
  bool applyingCoupon = false;
  bool submitting = false;
  bool loadingLocation = false;
  bool locationConfirmed = false;
  String? error;

  @override
  void initState() {
    super.initState();
    customerLat = widget.initialCustomerLat;
    customerLng = widget.initialCustomerLng;
    final initialAddress = widget.initialCustomerAddress?.trim();
    if (initialAddress != null && initialAddress.isNotEmpty) {
      addressController.text = initialAddress;
    }
    locationConfirmed = customerLat != null &&
        customerLng != null &&
        !widget.initialCustomerLocationIsDemo;
    if (widget.initialCustomerLocationIsDemo) {
      locationMessage =
          'Nearby partners used a demo city pin. Choose the exact service location before booking.';
    }
    if (customerLat == null || customerLng == null) {
      unawaited(loadCustomerLocation());
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    addressController.dispose();
    couponController.dispose();
    super.dispose();
  }

  Future<void> loadCustomerLocation() async {
    setState(() => loadingLocation = true);
    try {
      final location = await resolveCustomerLocation(ref);
      if (!mounted) {
        return;
      }
      setState(() {
        customerLat = location.latitude;
        customerLng = location.longitude;
        addressController.text = location.addressText ?? addressController.text;
        locationConfirmed = !location.isDemoLocation;
        if (location.isDemoLocation) {
          currentGpsLat = null;
          currentGpsLng = null;
          currentGpsUpdatedAt = null;
        } else {
          currentGpsLat = location.latitude;
          currentGpsLng = location.longitude;
          currentGpsUpdatedAt = DateTime.now();
        }
        locationMessage = location.isDemoLocation
            ? 'GPS is unavailable or outside Vietnam. Choose the service pin on the map before booking.'
            : 'GPS loaded. You can still adjust the service pin on the map.';
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        customerLat = demoCustomerLat;
        customerLng = demoCustomerLng;
        locationConfirmed = false;
        locationMessage =
            'Could not read GPS. Search the address or choose the service pin manually.';
      });
    } finally {
      if (mounted) {
        setState(() => loadingLocation = false);
      }
    }
  }

  Future<void> openLocationSelector() async {
    final selected = await Navigator.of(context).push<SelectedCustomerLocation>(
      MaterialPageRoute(
        builder: (context) => LocationSelectionPage(
          initialLatitude: customerLat ?? demoCustomerLat,
          initialLongitude: customerLng ?? demoCustomerLng,
          initialAddress: addressController.text.trim().isEmpty
              ? demoCustomerAddress
              : addressController.text.trim(),
        ),
      ),
    );
    if (selected == null || !mounted) {
      return;
    }
    setState(() {
      customerLat = selected.latitude;
      customerLng = selected.longitude;
      addressController.text = selected.addressText;
      locationConfirmed = true;
      locationMessage = 'Service location confirmed.';
      error = null;
    });
    ref.read(selectedCustomerLocationProvider.notifier).state = selected;
  }

  Future<void> confirmBooking() async {
    final lat = customerLat;
    final lng = customerLng;
    if (!locationConfirmed || lat == null || lng == null) {
      setState(() {
        error =
            'Please confirm the service location on the map before booking.';
      });
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      final savedLocation =
          await ref.read(customerRepositoryProvider).saveSelectedLocation(
                lat: lat,
                lng: lng,
                addressText: addressController.text.trim(),
              );
      final selectedLocationId = savedLocation?['id'] as String?;
      final booking = await ref.read(customerRepositoryProvider).createBooking(
            widget.selectedService['id'] as String,
            providerId: widget.providerDetail['id'] as String?,
            couponCode: appliedCouponCode,
            selectedLocationId: selectedLocationId,
            customerName: nameController.text.trim(),
            customerPhone: phoneController.text.trim(),
            addressLine: addressController.text.trim(),
            lat: lat,
            lng: lng,
            currentLat: currentGpsLat,
            currentLng: currentGpsLng,
            currentLocationUpdatedAt: currentGpsUpdatedAt,
          );
      if (mounted) {
        Navigator.of(context).pop(booking);
      }
    } catch (exception) {
      setState(() => error = customerBookingErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }

  Future<void> applyCoupon() async {
    final code = couponController.text.trim();
    final servicePrice = customerServicePrice(widget.selectedService);
    if (code.isEmpty) {
      setState(() {
        appliedCouponCode = null;
        couponDiscountAmount = 0;
        couponMessage = 'Enter a coupon code first.';
      });
      return;
    }

    setState(() {
      applyingCoupon = true;
      error = null;
      couponMessage = null;
    });

    try {
      final preview = await ref.read(customerRepositoryProvider).previewCoupon(
            code: code,
            serviceId: widget.selectedService['id'] as String,
            subtotal: servicePrice,
          );
      if (!mounted) {
        return;
      }

      setState(() {
        appliedCouponCode = preview['code'] as String?;
        couponDiscountAmount = asNum(preview['discountAmount'])?.toInt() ?? 0;
        if (appliedCouponCode != null) {
          couponController.text = appliedCouponCode!;
          couponController.selection =
              TextSelection.collapsed(offset: couponController.text.length);
        }
        final description = preview['description'] as String?;
        couponMessage = description == null || description.isEmpty
            ? 'Coupon applied successfully.'
            : '${preview['code']} applied. $description';
      });
    } catch (exception) {
      if (!mounted) {
        return;
      }

      setState(() {
        appliedCouponCode = null;
        couponDiscountAmount = 0;
        couponMessage = '$exception';
      });
    } finally {
      if (mounted) {
        setState(() => applyingCoupon = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = widget.selectedService;
    final provider = widget.providerDetail;
    final distanceMeters = asDouble(provider['distanceMeters']);
    final servicePrice = customerServicePrice(service);
    final basePrice = asNum(service['basePrice'])?.toInt() ?? servicePrice;
    final hasProviderPrice = servicePrice != basePrice;
    final providerName = provider['displayName'] as String? ?? 'Partner';
    final serviceName = customerServiceName(service);
    final durationLabel = customerServiceDurationLabel(service);
    final platformFee = 0;
    final serviceCount = 1;
    final rawTotalAmount = servicePrice + platformFee - couponDiscountAmount;
    final totalAmount = rawTotalAmount < 0 ? 0 : rawTotalAmount;
    final couponApplied = appliedCouponCode != null && couponDiscountAmount > 0;
    final customerPoint = customerLat == null || customerLng == null
        ? null
        : LatLng(customerLat!, customerLng!);
    final providerPoint = deriveProviderLatLng(provider);
    return Scaffold(
      appBar: AppBar(title: const Text('Booking information')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            BookingSectionCard(
              title: 'Request summary',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      ServiceTag(label: 'Direct request'),
                      ServiceTag(label: 'Marketplace matching if needed'),
                      ServiceTag(label: 'Chat after service start'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  BookingSummaryRow(
                    label: 'Partner',
                    value: providerName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service',
                    value: serviceName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Duration',
                    value: durationLabel,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Divider(height: 1),
                  ),
                  BookingSummaryRow(
                    label: 'Amount to pay',
                    value: '${formatCurrency(totalAmount)} VND',
                    emphasized: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'My address',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: nameController,
                          decoration: const InputDecoration(labelText: 'Name'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: phoneController,
                          decoration: const InputDecoration(labelText: 'Phone'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: addressController,
                    decoration: const InputDecoration(labelText: 'Address'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.call_outlined,
                          size: 18, color: Colors.black54),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          phoneController.text,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.black54),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Service location',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      height: 180,
                      child: LocationMapSurface(
                        customerPoint: customerPoint,
                        providerPoint: providerPoint,
                        customerLabel: 'Customer',
                        providerLabel: 'Partner area',
                        fallbackShowProviderMarker: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 20, color: Colors.grey),
                      const SizedBox(width: 6),
                      Expanded(child: Text(addressController.text)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Customer pin: ${formatCoordinate(customerLat)}, ${formatCoordinate(customerLng)}',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: Colors.black54),
                  ),
                  if (locationMessage != null) ...[
                    const SizedBox(height: 8),
                    InfoBanner(text: locationMessage!),
                  ],
                  if (loadingLocation) ...[
                    const SizedBox(height: 6),
                    const LinearProgressIndicator(minHeight: 4),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    'Partner distance: ${formatDistance(distanceMeters)}',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: openLocationSelector,
                    icon: const Icon(Icons.pin_drop_outlined),
                    label: const Text('Choose on map'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Selected service',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ProviderThumbnail(
                          name: providerName,
                          size: 72,
                          imageUrl: providerProfileImageUrl(provider)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              providerName,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${providerAverageRating(provider).toStringAsFixed(1)} (${providerReviewCount(provider)} reviews)',
                            ),
                            const SizedBox(height: 4),
                            Text(
                              formatDistance(distanceMeters),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Colors.black54),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F5EC),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          serviceName,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          durationLabel,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.black54),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ServiceTag(label: durationLabel),
                            ServiceTag(
                                label: '${formatCurrency(servicePrice)} VND'),
                            if (hasProviderPrice)
                              ServiceTag(
                                  label:
                                      'Minimum ${formatCurrency(basePrice)} VND'),
                            const ServiceTag(label: '1 partner'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Payment method',
              child: Row(
                children: [
                  const Expanded(child: Text('Cash payment on service start')),
                  FilledButton.tonal(
                      onPressed: () {}, child: const Text('View all')),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Discount code',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: couponController,
                          decoration: const InputDecoration(
                              hintText: 'Enter coupon code'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      TextButton(
                        onPressed: applyingCoupon ? null : applyCoupon,
                        child: Text(applyingCoupon ? 'Checking...' : 'Apply'),
                      ),
                    ],
                  ),
                  if (couponMessage != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      couponMessage!,
                      style: TextStyle(
                        color: appliedCouponCode != null
                            ? const Color(0xFF5E8E4A)
                            : const Color(0xFFB3261E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (couponApplied) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F8E9),
                        border: Border.all(color: const Color(0xFFCBE7BB)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Discount applied',
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  color: const Color(0xFF3F6F2D),
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$appliedCouponCode saves ${formatCurrency(couponDiscountAmount)} VND. Final cash amount is ${formatCurrency(totalAmount)} VND.',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: const Color(0xFF3F6F2D)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Payment summary',
              child: Column(
                children: [
                  BookingSummaryRow(
                    label: 'Services',
                    value: '$serviceCount item',
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service type',
                    value: serviceName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Duration',
                    value: durationLabel,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service price',
                    value: '${formatCurrency(servicePrice)} VND',
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Platform fee',
                    value: '${formatCurrency(platformFee)} VND',
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Coupon',
                    value: appliedCouponCode == null
                        ? 'Not applied'
                        : '-${formatCurrency(couponDiscountAmount)} VND ($appliedCouponCode)',
                    highlighted: appliedCouponCode != null,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Divider(height: 1),
                  ),
                  BookingSummaryRow(
                    label: 'Total',
                    value: '${formatCurrency(totalAmount)} VND',
                    emphasized: true,
                  ),
                ],
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              ErrorPanel(text: error!),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: FilledButton(
          onPressed: submitting ? null : confirmBooking,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF5E8E4A),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
          ),
          child: Text(
            submitting
                ? 'Creating booking...'
                : !locationConfirmed
                    ? 'Confirm location before booking'
                    : 'Send booking request - ${formatCurrency(totalAmount)} VND',
          ),
        ),
      ),
    );
  }
}

class BookingSectionCard extends StatelessWidget {
  const BookingSectionCard({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class BookingSummaryRow extends StatelessWidget {
  const BookingSummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasized = false,
    this.highlighted = false,
  });

  final String label;
  final String value;
  final bool emphasized;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final labelStyle = emphasized
        ? Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge;
    final valueStyle = emphasized
        ? Theme.of(context)
            .textTheme
            .titleLarge
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: highlighted ? const Color(0xFF5E8E4A) : null,
              fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
            );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: labelStyle)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            style: valueStyle,
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}

class ServiceTag extends StatelessWidget {
  const ServiceTag({
    super.key,
    required this.label,
  });

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE6E0D2)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      ),
    );
  }
}

class BookingWaitingPage extends ConsumerStatefulWidget {
  const BookingWaitingPage({
    super.key,
    required this.initialBooking,
    required this.onBookingUpdated,
  });

  final Map<String, dynamic> initialBooking;
  final ValueChanged<Map<String, dynamic>> onBookingUpdated;

  @override
  ConsumerState<BookingWaitingPage> createState() => _BookingWaitingPageState();
}

class _BookingWaitingPageState extends ConsumerState<BookingWaitingPage> {
  Timer? timer;
  Map<String, dynamic>? booking;
  late final RealtimeSocket _socket;
  Map<String, dynamic>? latestProviderLocation;
  String? statusMessage;
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
    booking = widget.initialBooking;
    final bookingId = booking?['id'] as String?;
    if (bookingId != null) {
      ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    }
    attachRealtimeListeners();
    timer = Timer.periodic(
        const Duration(seconds: 5), (_) => refreshBooking(showLoading: false));
  }

  @override
  void dispose() {
    timer?.cancel();
    detachRealtimeListeners();
    super.dispose();
  }

  void attachRealtimeListeners() {
    detachRealtimeListeners();
    _socket.onEvent('provider.location.updated', (payload) {
      final activeBookingId = booking?['id'];
      if (!mounted ||
          payload is! Map ||
          payload['bookingId'] != activeBookingId) {
        return;
      }
      setState(() {
        latestProviderLocation =
            Map<String, dynamic>.from(payload.cast<String, dynamic>());
      });
    });

    final eventMessages = <String, String>{
      'provider.joined': 'A marketplace partner joined this request.',
      'provider.accepted':
          'A partner accepted. Confirm this partner or choose another available option.',
      'provider.rejected':
          'A partner declined. We will keep showing available options.',
      'booking.matched': 'Your partner confirmed the booking.',
      'booking.opened': 'The request is still open for partner responses.',
      'booking.expired': 'This booking expired or was cancelled.',
      'service.started': 'Service started. Chat is now available.',
      'service.completed': 'Service completed. You can review the booking.',
    };

    for (final entry in eventMessages.entries) {
      _socket.onEvent(entry.key, (payload) {
        if (!mounted) {
          return;
        }
        setState(() => statusMessage = entry.value);
        unawaited(refreshBooking(showLoading: false));
      });
    }
  }

  void detachRealtimeListeners() {
    for (final event in [
      'provider.location.updated',
      'provider.joined',
      'provider.accepted',
      'provider.rejected',
      'booking.matched',
      'booking.opened',
      'booking.expired',
      'service.started',
      'service.completed',
    ]) {
      _socket.offEvent(event);
    }
  }

  Future<void> refreshBooking({bool showLoading = true}) async {
    final bookingId = booking?['id'] as String?;
    if (bookingId == null) {
      return;
    }
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final updated =
          await ref.read(customerRepositoryProvider).getBooking(bookingId);
      if (!mounted) {
        return;
      }
      setState(() => booking = updated);
      widget.onBookingUpdated(updated);
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

  Future<void> openChatRoom(String chatRoomId) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => ChatScreen(
          initialChatRoomId: chatRoomId,
          initialBookingId: booking?['id']?.toString(),
        ),
      ),
    );
    await refreshBooking(showLoading: false);
  }

  Future<void> cancelBooking() async {
    final bookingId = booking?['id'] as String?;
    if (bookingId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final updated =
          await ref.read(customerRepositoryProvider).cancelBooking(bookingId);
      if (!mounted) {
        return;
      }
      widget.onBookingUpdated(updated);
      Navigator.of(context).pop();
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> selectProvider(Map<String, dynamic> participant) async {
    final bookingId = booking?['id'] as String?;
    final providerId = participant['providerProfileId'] as String?;
    if (bookingId == null || providerId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final updated = await ref
          .read(customerRepositoryProvider)
          .selectProvider(bookingId, providerId);
      if (!mounted) {
        return;
      }
      setState(() => booking = updated);
      widget.onBookingUpdated(updated);
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
    final currentBooking = booking;
    final participants = currentBooking?['participants'] is List<dynamic>
        ? currentBooking!['participants'] as List<dynamic>
        : <dynamic>[];
    final preferredProviderData =
        currentBooking?['preferredProvider'] as Map<String, dynamic>?;
    final selectedProvider =
        currentBooking?['selectedProvider'] as Map<String, dynamic>?;
    final service =
        currentBooking == null ? null : firstBookingService(currentBooking);
    final status = currentBooking?['status'] as String? ?? 'OPEN_MATCHING';
    final canDirectCancel = canCustomerDirectlyCancelBooking(currentBooking);
    final needsOpsReview = customerCancellationNeedsOpsReview(status);
    final preferredProvider =
        status == 'OPEN_MATCHING' ? preferredProviderData : null;
    final finalizedProvider =
        status == 'OPEN_MATCHING' ? null : selectedProvider;
    final alternativeParticipants = status == 'OPEN_MATCHING'
        ? customerSelectableMarketplaceParticipants(
            participants,
            preferredProviderId: preferredProvider?['id']?.toString(),
          )
        : <Map<String, dynamic>>[];
    final expiresAt = currentBooking?['expiresAt'] as String?;
    final fallbackCount = alternativeParticipants.length;
    final customerPoint = deriveBookingLatLng(currentBooking);
    final providerPoint = deriveRealtimeLatLng(latestProviderLocation);
    final chatRoom = asMap(currentBooking?['chatRoom']);
    final chatRoomId = chatRoom?['id']?.toString();
    final matchingPolicy = bookingMatchingPolicy(currentBooking);
    final timeLeft = formatRemainingTime(expiresAt);
    final action = waitingCustomerAction(
      status: status,
      fallbackCount: fallbackCount,
      hasChatRoom: chatRoomId != null,
      matchingPolicy: matchingPolicy,
    );
    final waitingHeadline = status == 'OPEN_MATCHING'
        ? '${providerDisplayName(currentBooking)} confirmation pending'
        : status == 'MATCHED'
            ? '${providerDisplayName(currentBooking)} confirmed'
            : status == 'IN_SERVICE'
                ? 'Service in progress'
                : 'Booking update';
    final waitingText = status == 'OPEN_MATCHING'
        ? (preferredProvider == null
            ? 'Waiting for nearby partners to respond...'
            : 'Waiting for ${preferredProvider['displayName'] ?? 'your partner'} to confirm. Marketplace partners may join too.')
        : status == 'MATCHED'
            ? 'Partner accepted. Waiting for service start...'
            : status == 'IN_SERVICE'
                ? 'Service started. Continue in Chat.'
                : 'Status: $status';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  LocationMapSurface(
                    customerPoint: customerPoint,
                    providerPoint: providerPoint,
                    customerLabel: 'You',
                    providerLabel:
                        latestProviderLocation == null ? 'Waiting' : 'Partner',
                    fallbackShowProviderMarker: latestProviderLocation != null,
                  ),
                  Positioned(
                    top: 18,
                    left: 18,
                    child: const CircleAvatar(
                      radius: 24,
                      backgroundColor: Colors.white,
                      child: BackButton(),
                    ),
                  ),
                  Positioned(
                    top: 18,
                    right: 18,
                    child: canDirectCancel
                        ? FilledButton(
                            onPressed: loading ? null : cancelBooking,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFFE84B4B),
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Cancel request'),
                          )
                        : needsOpsReview
                            ? Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(999),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x22000000),
                                      blurRadius: 12,
                                      offset: Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: const Text('Chat evidence'),
                              )
                            : const SizedBox.shrink(),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            waitingHeadline,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(waitingText,
                              style: Theme.of(context).textTheme.bodyLarge),
                          const SizedBox(height: 8),
                          Text(
                              'This request closes automatically at ${formatExpiry(expiresAt)}'),
                          const SizedBox(height: 16),
                          if (loading) const LinearProgressIndicator(),
                          if (error != null) ...[
                            const SizedBox(height: 12),
                            ErrorPanel(text: error!),
                          ],
                          if (statusMessage != null) ...[
                            const SizedBox(height: 12),
                            InfoBanner(text: statusMessage!),
                          ],
                          const SizedBox(height: 12),
                          if (service != null)
                            Text(
                              customerServiceOptionPriceLabel(service),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              BookingTimelineChip(
                                icon: Icons.tag_rounded,
                                label:
                                    'Booking ${shortCode(currentBooking?['id'])}',
                              ),
                              BookingTimelineChip(
                                icon: Icons.schedule_rounded,
                                label: status == 'OPEN_MATCHING'
                                    ? timeLeft
                                    : waitingStepLabel(status),
                              ),
                              BookingTimelineChip(
                                icon: Icons.groups_rounded,
                                label: fallbackCount == 0
                                    ? 'No marketplace option yet'
                                    : '$fallbackCount marketplace ready',
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          LinearProgressIndicator(
                            value: bookingProgress(status),
                            minHeight: 8,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          const SizedBox(height: 18),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final cardWidth = (constraints.maxWidth - 12) / 2;
                              return Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  SizedBox(
                                    width: cardWidth,
                                    child: WaitingStatCard(
                                      label: 'Current step',
                                      value: waitingStepLabel(status),
                                    ),
                                  ),
                                  SizedBox(
                                    width: cardWidth,
                                    child: WaitingStatCard(
                                      label: 'Marketplace partners',
                                      value: fallbackCount.toString(),
                                    ),
                                  ),
                                  SizedBox(
                                    width: cardWidth,
                                    child: WaitingStatCard(
                                      label: 'Time left',
                                      value: timeLeft,
                                    ),
                                  ),
                                  SizedBox(
                                    width: cardWidth,
                                    child: WaitingStatCard(
                                      label: 'Signal',
                                      value: waitingSignalLabel(
                                          status, fallbackCount),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                          const SizedBox(height: 12),
                          WaitingStagePanel(
                            status: status,
                            fallbackCount: fallbackCount,
                            preferredProviderName:
                                preferredProvider?['displayName'] as String?,
                            expiresAt: expiresAt,
                            matchingPolicy: matchingPolicy,
                          ),
                          const SizedBox(height: 12),
                          WaitingInfoBanner(
                            title: action.title,
                            body: action.body,
                          ),
                          if (chatRoomId != null &&
                              isCustomerAppChatVisible(currentBooking)) ...[
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: loading
                                  ? null
                                  : () => openChatRoom(chatRoomId),
                              icon: const Icon(Icons.chat_bubble_outline),
                              label: Text(chatActionLabel(status)),
                            ),
                          ],
                          const SizedBox(height: 18),
                          BookingSectionCard(
                            title: 'Partner location',
                            child: LiveLocationDetails(
                              customerPoint: customerPoint,
                              providerLocation: latestProviderLocation,
                              emptyText:
                                  'The partner\'s last shared pin will appear here after they share location.',
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (preferredProvider != null) ...[
                            Text('Chosen partner',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            PartnerDisplayCard(
                              provider: preferredProvider,
                              badgeLabel: 'Chosen first',
                              detail: directRequestDetail(matchingPolicy),
                              subtitle: fallbackCount == 0
                                  ? 'Checking availability - $timeLeft'
                                  : 'Checking availability - $timeLeft with ${backupParticipationLabel(matchingPolicy)}',
                            ),
                            const SizedBox(height: 16),
                          ],
                          if (alternativeParticipants.isNotEmpty) ...[
                            Text('Marketplace partners',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(
                              '$fallbackCount partner(s) can take this request now. You can keep waiting or switch.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Colors.black54),
                            ),
                            const SizedBox(height: 12),
                            for (final item in alternativeParticipants)
                              PartnerSelectionCard(
                                participant: item,
                                onSelect: () => selectProvider(item),
                              ),
                          ] else if (finalizedProvider != null) ...[
                            Text('Confirmed partner',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            PartnerDisplayCard(
                              provider: finalizedProvider,
                              badgeLabel: 'Confirmed',
                              detail:
                                  'Your booking is now locked to this partner.',
                            ),
                          ] else ...[
                            const EmptyPanel(
                                text:
                                    'Waiting for a partner response. Marketplace options can appear here if the first partner is slow to confirm.'),
                          ],
                          const SizedBox(height: 10),
                          FilledButton.tonalIcon(
                            onPressed: loading ? null : () => refreshBooking(),
                            icon: const Icon(Icons.refresh),
                            label: const Text('Check latest status'),
                          ),
                        ],
                      ),
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

class PartnerSelectionCard extends StatelessWidget {
  const PartnerSelectionCard({
    super.key,
    required this.participant,
    required this.onSelect,
  });

  final Map<String, dynamic> participant;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final provider =
        asMap(participant['providerProfile']) ?? <String, dynamic>{};
    final providerName = provider['displayName']?.toString() ?? 'Partner';
    final distance = formatDistance(asDouble(participant['distanceMeters']));
    final titleStyle = Theme.of(context)
        .textTheme
        .titleMedium
        ?.copyWith(fontWeight: FontWeight.w700);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 340;
                final thumbnailSize = compact ? 68.0 : 84.0;
                final details = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      providerName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      softWrap: true,
                      style: titleStyle,
                    ),
                    const SizedBox(height: 8),
                    const Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        PartnerRoleTag(
                          label: 'Marketplace ready',
                          backgroundColor: Color(0xFFF8ECD4),
                          foregroundColor: Color(0xFF8A5B12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${participant['status'] ?? 'JOINED'} - $distance',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'This partner can replace your preferred partner if you want to switch.',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: Colors.black54),
                    ),
                  ],
                );

                if (compact) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProviderThumbnail(
                          name: providerName, size: thumbnailSize),
                      const SizedBox(height: 10),
                      details,
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProviderThumbnail(name: providerName, size: thumbnailSize),
                    const SizedBox(width: 12),
                    Expanded(child: details),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onSelect,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF5E8E4A),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Switch to this partner'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PartnerDisplayCard extends StatelessWidget {
  const PartnerDisplayCard({
    super.key,
    required this.provider,
    this.subtitle = 'Ready for confirmation / service delivery',
    this.detail,
    this.badgeLabel,
  });

  final Map<String, dynamic> provider;
  final String subtitle;
  final String? detail;
  final String? badgeLabel;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProviderThumbnail(
                name: provider['displayName'] as String? ?? 'Partner',
                size: 84),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          provider['displayName'] as String? ?? 'Partner',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (badgeLabel != null)
                        PartnerRoleTag(
                          label: badgeLabel!,
                          backgroundColor: badgeLabel == 'Final'
                              ? const Color(0xFFE8F4E3)
                              : const Color(0xFFE7F2DE),
                          foregroundColor: badgeLabel == 'Final'
                              ? const Color(0xFF2E6A2B)
                              : const Color(0xFF446B2A),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(subtitle),
                  if (detail != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      detail!,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: Colors.black54),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PartnerRoleTag extends StatelessWidget {
  const PartnerRoleTag({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class WaitingStatCard extends StatelessWidget {
  const WaitingStatCard({
    super.key,
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F5EC),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54)),
          const SizedBox(height: 8),
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class BookingTimelineChip extends StatelessWidget {
  const BookingTimelineChip({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F4EA),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE4DDCA)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF5E8E4A)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class WaitingStagePanel extends StatelessWidget {
  const WaitingStagePanel({
    super.key,
    required this.status,
    required this.fallbackCount,
    required this.preferredProviderName,
    required this.expiresAt,
    this.matchingPolicy = const {},
  });

  final String status;
  final int fallbackCount;
  final String? preferredProviderName;
  final String? expiresAt;
  final Map<String, dynamic> matchingPolicy;

  @override
  Widget build(BuildContext context) {
    final stageItems = [
      WaitingStageItem(
        title: preferredProviderName == null
            ? 'Finding a partner'
            : 'Chosen partner first',
        body: preferredProviderName == null
            ? 'Nearby partners are being checked now.'
            : '$preferredProviderName gets ${responseWindowLabel(matchingPolicy)} while ${backupWindowDescription(matchingPolicy)}.',
        accent: const Color(0xFF5E8E4A),
        caption: preferredProviderName == null
            ? 'Stage 1'
            : 'Stage 1 - direct request',
      ),
      WaitingStageItem(
        title: fallbackCount == 0
            ? 'No marketplace option yet'
            : '$fallbackCount marketplace option(s) ready',
        body: fallbackCount == 0
            ? backupStandbyDescription(matchingPolicy)
            : 'You can switch to another available partner below without restarting the booking.',
        accent: const Color(0xFFB9852F),
        caption: fallbackCount == 0
            ? 'Stage 2 - standby'
            : 'Stage 2 - alternatives ready',
      ),
      WaitingStageItem(
        title: status == 'MATCHED' ? 'Confirmed' : 'Auto-close timer',
        body: status == 'MATCHED'
            ? 'The partner is confirmed. Next step is service start and chat.'
            : 'This request closes automatically at ${formatExpiry(expiresAt)} if no partner is selected.',
        accent: const Color(0xFF2563EB),
        caption: status == 'MATCHED'
            ? 'Stage 3 - locked in'
            : 'Stage 3 - timeout protection',
      ),
    ];

    return Column(
      children: [
        for (var index = 0; index < stageItems.length; index++) ...[
          stageItems[index],
          if (index != stageItems.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class WaitingStageItem extends StatelessWidget {
  const WaitingStageItem({
    super.key,
    required this.title,
    required this.body,
    required this.accent,
    required this.caption,
  });

  final String title;
  final String body;
  final Color accent;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: accent,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  caption,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: Colors.black54),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WaitingInfoBanner extends StatelessWidget {
  const WaitingInfoBanner({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F7EC),
        border: Border.all(color: const Color(0xFFD2E1C5)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(body, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class ProviderThumbnail extends StatelessWidget {
  const ProviderThumbnail({
    super.key,
    required this.name,
    required this.size,
    this.imageUrl,
  });

  final String name;
  final double size;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final initials = name.isEmpty
        ? 'P'
        : name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((word) => word.characters.first.toUpperCase())
            .join();

    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: size,
        height: size,
        color: const Color(0xFFE8E1D3),
        alignment: Alignment.center,
        child: imageUrl == null || imageUrl!.isEmpty
            ? ProviderInitials(initials: initials, size: size)
            : Image.network(
                imageUrl!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    ProviderInitials(initials: initials, size: size),
              ),
      ),
    );
  }
}

class ProviderInitials extends StatelessWidget {
  const ProviderInitials({
    super.key,
    required this.initials,
    required this.size,
  });

  final String initials;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      initials,
      style: TextStyle(
        fontSize: size * 0.28,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF5E8E4A),
      ),
    );
  }
}

String? providerProfileImageUrl(Map<String, dynamic> provider) {
  final direct = provider['profileImageUrl']?.toString();
  if (direct != null && direct.isNotEmpty) {
    return direct;
  }

  final gallery = provider['galleryImageUrls'];
  if (gallery is List && gallery.isNotEmpty) {
    final first = gallery.first?.toString();
    if (first != null && first.isNotEmpty) {
      return first;
    }
  }
  return null;
}

class ProvidersScreen extends ConsumerStatefulWidget {
  const ProvidersScreen({super.key});

  @override
  ConsumerState<ProvidersScreen> createState() => _ProvidersScreenState();
}

class _ProvidersScreenState extends ConsumerState<ProvidersScreen> {
  List<dynamic> providers = [];
  double? customerLat;
  double? customerLng;
  String customerAddress = demoCustomerAddress;
  bool customerLocationIsDemo = false;
  bool loading = false;
  String? error;
  String? notice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = ref.read(authControllerProvider);
      if (auth != null) {
        unawaited(loadProviders());
      }
    });
  }

  Future<void> loadProviders() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final location = await resolveDiscoveryLocation(ref);
      final items = await ref.read(customerRepositoryProvider).nearbyProviders(
            lat: location.latitude,
            lng: location.longitude,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        providers = items;
        customerLat = location.latitude;
        customerLng = location.longitude;
        customerAddress = location.addressText ?? customerAddress;
        customerLocationIsDemo = location.isDemoLocation;
        notice = location.isDemoLocation
            ? 'Using demo Ho Chi Minh City location for nearby partner discovery.'
            : null;
      });
    } catch (exception) {
      if (!mounted) {
        return;
      }
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
      notice = 'Service location selected. Refreshing nearby partners.';
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
      // Keep the map selection active even if the optional location save fails.
    }

    await loadProviders();
    if (mounted) {
      setState(() {
        notice =
            'Service location selected. Nearby partners are sorted from this pin.';
      });
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
      await loadProviders();
      if (mounted) {
        setState(() => notice = pushResult.message);
      }
    } catch (exception) {
      if (!mounted) {
        return;
      }
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
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

            await navigator.push<void>(
              MaterialPageRoute(
                builder: (context) => BookingWaitingPage(
                  initialBooking: booked,
                  onBookingUpdated: (_) {},
                ),
              ),
            );
            await loadProviders();
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text('Partners', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(
            'Nearby partners sorted by distance and availability.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth != null) ...[
            CustomerLocationContextCard(
              addressText: customerAddress,
              latitude: customerLat,
              longitude: customerLng,
              isDemoLocation: customerLocationIsDemo,
              onChooseLocation: openCustomerLocationSelector,
            ),
            const SizedBox(height: 16),
          ],
          FilledButton.icon(
            onPressed: auth == null ? signInAndLoad : loadProviders,
            icon: const Icon(Icons.search),
            label:
                Text(auth == null ? 'Demo customer login' : 'Refresh partners'),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          if (notice != null) ...[
            const SizedBox(height: 12),
            InfoBanner(text: notice!),
          ],
          const SizedBox(height: 16),
          if (auth == null)
            const EmptyPanel(text: 'Login first to load nearby partner cards.')
          else if (providers.isEmpty)
            const EmptyPanel(
                text:
                    'No nearby partners loaded yet. Refresh to fetch the latest queue.')
          else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                height: 220,
                child: NearbyProvidersMap(
                  customerPoint: customerLat == null || customerLng == null
                      ? null
                      : LatLng(customerLat!, customerLng!),
                  providers:
                      providers.whereType<Map<String, dynamic>>().toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),
            for (final item in providers)
              Builder(
                builder: (context) {
                  final provider = item as Map<String, dynamic>;
                  return ProviderListCard(
                    provider: provider,
                    onTap: () => openProviderDetail(provider),
                  );
                },
              ),
          ],
        ],
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

int customerBookingTimestamp(Map<String, dynamic> booking) {
  final value = booking['updatedAt'] ??
      booking['createdAt'] ??
      booking['scheduledStartAt'];
  if (value is String) {
    return DateTime.tryParse(value)?.millisecondsSinceEpoch ?? 0;
  }
  return 0;
}

bool isCustomerActiveBooking(Map<String, dynamic> booking) {
  return const {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE'
  }.contains(booking['status']);
}

bool isCustomerClosedBooking(Map<String, dynamic> booking) {
  return const {'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'}
      .contains(booking['status']);
}

bool isCustomerAppChatVisible(Map<String, dynamic>? booking) {
  if (booking == null) {
    return false;
  }
  return asMap(booking['chatRoom']) != null &&
      !isCustomerClosedBooking(booking);
}

bool canCustomerDirectlyCancelBooking(Map<String, dynamic>? booking) {
  if (booking == null || booking['status'] != 'OPEN_MATCHING') {
    return false;
  }
  if (asMap(booking['selectedProvider']) != null) {
    return false;
  }
  final participants = asList(booking['participants']);
  return !participants.whereType<Map<String, dynamic>>().any((participant) {
    return participant['status'] == 'ACCEPTED' ||
        participant['status'] == 'SELECTED';
  });
}

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    this.initialChatRoomId,
    this.initialBookingId,
  });

  final String? initialChatRoomId;
  final String? initialBookingId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  late final RealtimeSocket _socket;
  final messageController = TextEditingController();
  List<dynamic> messages = [];
  Map<String, dynamic>? activeBooking;
  Map<String, dynamic>? latestProviderLocation;
  String? chatRoomId;
  String? statusMessage;
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final initialRoomId = widget.initialChatRoomId;
      if (initialRoomId != null && initialRoomId.isNotEmpty) {
        unawaited(loadChatRoom(
          initialRoomId,
          bookingId: widget.initialBookingId,
        ));
      }
    });
  }

  @override
  void dispose() {
    _socket.offEvent('chat.message.created');
    _socket.offEvent('provider.location.updated');
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
        statusMessage = 'New message received.';
      });
    });
  }

  void attachLocationListener(String? bookingId) {
    _socket.offEvent('provider.location.updated');
    if (bookingId == null || bookingId.isEmpty) {
      return;
    }
    ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    _socket.onEvent('provider.location.updated', (payload) {
      if (!mounted ||
          payload is! Map ||
          payload['bookingId']?.toString() != bookingId) {
        return;
      }
      setState(() {
        latestProviderLocation =
            Map<String, dynamic>.from(payload.cast<String, dynamic>());
        statusMessage = 'Partner location updated.';
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
        await ref.read(authControllerProvider.notifier).signInDemoCustomer();
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
    final bookings = await ref.read(customerRepositoryProvider).listBookings();
    final bookingWithChat = bookings.map(asMap).firstWhere(
          (item) => isCustomerAppChatVisible(item),
          orElse: () => null,
        );
    final latestBooking = bookings.isNotEmpty ? asMap(bookings.first) : null;
    final booking = bookingWithChat ?? latestBooking;
    final room = asMap(bookingWithChat?['chatRoom']);
    if (room == null) {
      final status = booking?['status']?.toString();
      final providerName = providerDisplayName(booking);
      final nextMessage = switch (status) {
        'OPEN_MATCHING' =>
          '$providerName has not been locked in yet. Stay on the waiting screen until a partner is selected.',
        'MATCHED' =>
          '$providerName is confirmed. Chat opens when the partner starts the service.',
        'PROVIDER_ON_THE_WAY' =>
          '$providerName is on the way. Chat will open as soon as service start is triggered.',
        'IN_SERVICE' =>
          'The service is already in progress. Reload chat to join the live room.',
        'COMPLETED' =>
          'Service is complete. Chat is archived for admin records and no longer shown in the app.',
        'CANCELLED' ||
        'EXPIRED' ||
        'REFUNDED' =>
          'This booking is closed. Chat is archived for admin records.',
        _ => 'No service chat yet. The partner has to start the service first.',
      };
      setState(() => statusMessage = nextMessage);
      return;
    }

    final roomId = room['id']?.toString();
    if (roomId == null || roomId.isEmpty) {
      setState(() => statusMessage = 'Chat room is not ready yet.');
      return;
    }
    await loadChatRoom(
      roomId,
      bookingId: booking?['id']?.toString(),
      booking: booking,
    );
  }

  Future<void> loadChatRoom(
    String roomId, {
    String? bookingId,
    Map<String, dynamic>? booking,
  }) async {
    ref.read(customerRepositoryProvider).joinChat(roomId);
    final bookingContext = booking ??
        (bookingId == null
            ? null
            : await ref.read(customerRepositoryProvider).getBooking(bookingId));
    final loadedMessages =
        await ref.read(customerRepositoryProvider).listChatMessages(roomId);
    setState(() {
      chatRoomId = roomId;
      activeBooking = bookingContext;
      latestProviderLocation = null;
      messages = loadedMessages;
      statusMessage = bookingId == null
          ? 'Chat is ready.'
          : 'Chat is ready for booking $bookingId.';
    });
    attachChatListener();
    attachLocationListener(bookingId);
  }

  Future<void> sendMessage() async {
    final roomId = chatRoomId;
    final text = messageController.text.trim();
    if (roomId == null || text.isEmpty) {
      return;
    }
    messageController.clear();
    ref.read(customerRepositoryProvider).sendChatMessage(roomId, text);
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
                ? 'Login to load the latest booking chat.'
                : 'Realtime messages with your assigned partner.',
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
            EmptyPanel(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          const SizedBox(height: 16),
          if (chatRoomId == null)
            const EmptyPanel(
                text:
                    'Chat opens after a partner is selected and the service start step begins.')
          else ...[
            Text('Room $chatRoomId',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            BookingSectionCard(
              title: 'Live service location',
              child: LiveLocationDetails(
                customerPoint: deriveBookingLatLng(activeBooking),
                providerLocation: latestProviderLocation,
                emptyText:
                    'Partner location appears here after the partner shares their current pin.',
              ),
            ),
            const SizedBox(height: 12),
            if (messages.isEmpty)
              const EmptyPanel(
                  text:
                      'No messages yet. Send the first message when you are ready.')
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
