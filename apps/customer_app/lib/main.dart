import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'src/app_state.dart';
import 'src/core/app_config.dart';
import 'src/core/realtime_socket.dart';

void main() {
  runApp(const ProviderScope(child: CustomerApp()));
}

const double demoCustomerLat = 10.7769;
const double demoCustomerLng = 106.7009;
const String demoCustomerCity = 'Ho Chi Minh City';
const String demoCustomerAddress = 'District 1, Ho Chi Minh City, Vietnam';

final selectedCustomerLocationProvider =
    StateProvider<SelectedCustomerLocation?>((ref) => null);

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
              icon: Icon(Icons.groups_outlined), label: 'Providers'),
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
          'Service location selected. Nearby providers are now sorted from this pin.';
      error = null;
    });

    try {
      await ref.read(customerRepositoryProvider).saveSelectedLocation(
            lat: selected.latitude,
            lng: selected.longitude,
            addressText: selected.addressText,
          );
    } catch (_) {
      // Location selection should still work locally if the optional save call fails.
    }

    await loadHome();
    if (mounted) {
      setState(() {
        notice =
            'Service location selected. Nearby providers are now sorted from this pin.';
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
                  }) =>
                      ref.read(customerRepositoryProvider).createBooking(
                            service['id'] as String,
                            providerId: detail['id'] as String,
                            customerName: customerName,
                            customerPhone: customerPhone,
                            addressLine: addressLine,
                            lat: lat,
                            lng: lng,
                          ),
                ),
              ),
            );

            if (!mounted || booked == null) {
              return;
            }

            setState(() {
              activeBooking = booked;
              notice = 'Booking created. Waiting for provider response.';
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
                      : 'Refresh providers'),
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
                  text: 'Nearby providers will appear here after refresh.')
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
    final displayName = provider['displayName'] as String? ?? 'Provider';
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
            ? 'Waiting for provider response'
            : 'Provider: ${provider['displayName']}'),
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
          final displayName = detail['displayName'] as String? ?? 'Provider';
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
                          ServiceTag(label: 'Backup matching'),
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
                                Expanded(child: Text('No tip, no travel fee')),
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
                                        'Protected when the assigned therapist changes')),
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
                              'Experienced therapist profile ready for booking.',
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
                              'Public profile and work photos from this therapist.',
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
                            'Choose one service to open a booking request with this therapist first.',
                      ),
                      const SizedBox(height: 12),
                      Builder(
                        builder: (context) {
                          final serviceGroups =
                              customerServiceOptionGroups(services);
                          if (serviceGroups.isEmpty) {
                            return const EmptyPanel(
                              text:
                                  'This therapist has no bookable service options yet. HANDS requires an active provider price and an exact admin payout rule before booking.',
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
              'Choose a time option. The selected therapist gets the first response window, and backup matching can open if needed.',
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
                const DurationPill(label: 'Backup matching'),
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
              'Provider price selected. Admin minimum ${formatCurrency(basePrice)} VND.',
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

class CustomerServiceOptionGroup {
  const CustomerServiceOptionGroup({
    required this.key,
    required this.name,
    required this.options,
  });

  final String key;
  final String name;
  final List<Map<String, dynamic>> options;
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
          'Nearby providers used a demo city pin. Choose the exact service location before booking.';
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
      await ref.read(customerRepositoryProvider).saveSelectedLocation(
            lat: lat,
            lng: lng,
            addressText: addressController.text.trim(),
          );
      final booking = await ref.read(customerRepositoryProvider).createBooking(
            widget.selectedService['id'] as String,
            providerId: widget.providerDetail['id'] as String?,
            couponCode: appliedCouponCode,
            customerName: nameController.text.trim(),
            customerPhone: phoneController.text.trim(),
            addressLine: addressController.text.trim(),
            lat: lat,
            lng: lng,
          );
      if (mounted) {
        Navigator.of(context).pop(booking);
      }
    } catch (exception) {
      setState(() => error = '$exception');
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
    final providerName = provider['displayName'] as String? ?? 'Provider';
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
                      ServiceTag(label: 'Backup matching if needed'),
                      ServiceTag(label: 'Chat after service start'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  BookingSummaryRow(
                    label: 'Therapist',
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
                        providerLabel: 'Therapist area',
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
                    'Therapist distance: ${formatDistance(distanceMeters)}',
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
                            const ServiceTag(label: '1 therapist'),
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
      'provider.joined': 'A backup therapist joined this request.',
      'provider.accepted':
          'A therapist accepted. Confirm this therapist or choose another available option.',
      'booking.matched': 'Your therapist confirmed the booking.',
      'booking.opened': 'The request is still open for therapist responses.',
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
    final preferredProvider =
        status == 'OPEN_MATCHING' ? preferredProviderData : null;
    final finalizedProvider =
        status == 'OPEN_MATCHING' ? null : selectedProvider;
    final alternativeParticipants = status == 'OPEN_MATCHING'
        ? participants
            .whereType<Map<String, dynamic>>()
            .where(
                (item) => item['providerProfileId'] != preferredProvider?['id'])
            .toList()
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
            ? 'Waiting for nearby therapists to respond...'
            : 'Waiting for ${preferredProvider['displayName'] ?? 'your therapist'} to confirm. Other therapists may join too.')
        : status == 'MATCHED'
            ? 'Provider accepted. Waiting for service start...'
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
                    providerLabel: latestProviderLocation == null
                        ? 'Waiting'
                        : 'Therapist',
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
                    child: FilledButton(
                      onPressed: loading ? null : cancelBooking,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFE84B4B),
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Cancel request'),
                    ),
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
                                    ? 'No backup yet'
                                    : '$fallbackCount backup ready',
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
                                      label: 'Backup therapists',
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
                          if (chatRoomId != null) ...[
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
                            title: 'Therapist location',
                            child: LiveLocationDetails(
                              customerPoint: customerPoint,
                              providerLocation: latestProviderLocation,
                              emptyText:
                                  'The therapist\'s last shared pin will appear here after they share location.',
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (preferredProvider != null) ...[
                            Text('Chosen therapist',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            TherapistDisplayCard(
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
                            Text('Backup therapists',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(
                              '$fallbackCount therapist(s) can take this request now. You can keep waiting or switch.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Colors.black54),
                            ),
                            const SizedBox(height: 12),
                            for (final item in alternativeParticipants)
                              TherapistSelectionCard(
                                participant: item,
                                onSelect: () => selectProvider(item),
                              ),
                          ] else if (finalizedProvider != null) ...[
                            Text('Confirmed therapist',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            TherapistDisplayCard(
                              provider: finalizedProvider,
                              badgeLabel: 'Confirmed',
                              detail:
                                  'Your booking is now locked to this therapist.',
                            ),
                          ] else ...[
                            const EmptyPanel(
                                text:
                                    'Waiting for a therapist response. Backup options can appear here if the first therapist is slow to confirm.'),
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

class TherapistSelectionCard extends StatelessWidget {
  const TherapistSelectionCard({
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
    final providerName = provider['displayName']?.toString() ?? 'Provider';
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
                        TherapistRoleTag(
                          label: 'Backup ready',
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
                      'This therapist can replace your preferred therapist if you want to switch.',
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
                child: const Text('Switch to this therapist'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TherapistDisplayCard extends StatelessWidget {
  const TherapistDisplayCard({
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
                name: provider['displayName'] as String? ?? 'Provider',
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
                          provider['displayName'] as String? ?? 'Provider',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (badgeLabel != null)
                        TherapistRoleTag(
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

class TherapistRoleTag extends StatelessWidget {
  const TherapistRoleTag({
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
            ? 'Finding a therapist'
            : 'Chosen therapist first',
        body: preferredProviderName == null
            ? 'Nearby therapists are being checked now.'
            : '$preferredProviderName gets ${responseWindowLabel(matchingPolicy)} while ${backupWindowDescription(matchingPolicy)}.',
        accent: const Color(0xFF5E8E4A),
        caption: preferredProviderName == null
            ? 'Stage 1'
            : 'Stage 1 - direct request',
      ),
      WaitingStageItem(
        title: fallbackCount == 0
            ? 'No backup yet'
            : '$fallbackCount backup option(s) ready',
        body: fallbackCount == 0
            ? backupStandbyDescription(matchingPolicy)
            : 'You can switch to another available therapist below without restarting the booking.',
        accent: const Color(0xFFB9852F),
        caption: fallbackCount == 0
            ? 'Stage 2 - standby'
            : 'Stage 2 - alternatives ready',
      ),
      WaitingStageItem(
        title: status == 'MATCHED' ? 'Confirmed' : 'Auto-close timer',
        body: status == 'MATCHED'
            ? 'The therapist is confirmed. Next step is service start and chat.'
            : 'This request closes automatically at ${formatExpiry(expiresAt)} if no therapist is selected.',
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

class LocationMapSurface extends StatefulWidget {
  const LocationMapSurface({
    super.key,
    required this.customerPoint,
    required this.providerPoint,
    this.customerLabel = 'Customer',
    this.providerLabel = 'Provider',
    this.fallbackShowProviderMarker = false,
  });

  final LatLng? customerPoint;
  final LatLng? providerPoint;
  final String customerLabel;
  final String providerLabel;
  final bool fallbackShowProviderMarker;

  @override
  State<LocationMapSurface> createState() => _LocationMapSurfaceState();
}

class _LocationMapSurfaceState extends State<LocationMapSurface> {
  MapLibreMapController? controller;
  bool styleLoaded = false;

  @override
  void didUpdateWidget(covariant LocationMapSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (styleLoaded) {
      unawaited(syncMarkers());
    }
  }

  Future<void> syncMarkers() async {
    final map = controller;
    if (map == null || !styleLoaded || widget.customerPoint == null) {
      return;
    }
    await map.clearCircles();
    await map.clearSymbols();
    await map.addCircle(CircleOptions(
      geometry: widget.customerPoint,
      circleColor: '#5E8E4A',
      circleRadius: 8,
      circleStrokeColor: '#FFFFFF',
      circleStrokeWidth: 2,
    ));
    await map.addSymbol(SymbolOptions(
      geometry: widget.customerPoint,
      textField: widget.customerLabel,
      textSize: 13,
      textColor: '#111827',
      textHaloColor: '#FFFFFF',
      textHaloWidth: 1.5,
      textOffset: const Offset(0, -1.2),
    ));
    if (widget.providerPoint != null) {
      await map.addCircle(CircleOptions(
        geometry: widget.providerPoint,
        circleColor: '#E84B4B',
        circleRadius: 8,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 2,
      ));
      await map.addSymbol(SymbolOptions(
        geometry: widget.providerPoint,
        textField: widget.providerLabel,
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
    if (AppConfig.mapTilerEnabled && widget.customerPoint != null) {
      return MapLibreMap(
        styleString: AppConfig.mapTilerStyleUrl,
        initialCameraPosition: CameraPosition(
          target: widget.providerPoint ?? widget.customerPoint!,
          zoom: widget.providerPoint == null ? 13.8 : 12.8,
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

    return _MapPlaceholder(
      customerLabel: widget.customerLabel,
      providerLabel: widget.providerLabel,
      showProviderMarker: widget.fallbackShowProviderMarker,
    );
  }
}

class LiveLocationDetails extends StatelessWidget {
  const LiveLocationDetails({
    super.key,
    required this.customerPoint,
    required this.providerLocation,
    required this.emptyText,
  });

  final LatLng? customerPoint;
  final Map<String, dynamic>? providerLocation;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    final providerPoint = deriveRealtimeLatLng(providerLocation);
    final hasProviderPoint = providerPoint != null;
    final recordedAt = providerLocation?['recordedAt'];
    final statusColor = providerLocationStatusColor(recordedAt);
    final statusLabel = providerLocationStatusLabel(recordedAt);

    return Column(
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
              providerLabel: 'Therapist',
              fallbackShowProviderMarker: hasProviderPoint,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            LocationStatusChip(
              label: hasProviderPoint ? statusLabel : 'Waiting for location',
              color: hasProviderPoint ? statusColor : Colors.black54,
            ),
            if (hasProviderPoint)
              LocationStatusChip(
                label:
                    'Lat ${formatCoordinate(providerPoint.latitude)} / Lng ${formatCoordinate(providerPoint.longitude)}',
                color: Colors.black87,
              ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          hasProviderPoint
              ? 'Last shared ${formatLastLocation(recordedAt)}. Customers see the last saved location, not continuous tracking.'
              : emptyText,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: Colors.black54),
        ),
      ],
    );
  }
}

class LocationStatusChip extends StatelessWidget {
  const LocationStatusChip({
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

class SelectedCustomerLocation {
  const SelectedCustomerLocation({
    required this.latitude,
    required this.longitude,
    required this.addressText,
  });

  final double latitude;
  final double longitude;
  final String addressText;
}

class LocationSelectionPage extends ConsumerStatefulWidget {
  const LocationSelectionPage({
    super.key,
    required this.initialLatitude,
    required this.initialLongitude,
    required this.initialAddress,
  });

  final double initialLatitude;
  final double initialLongitude;
  final String initialAddress;

  @override
  ConsumerState<LocationSelectionPage> createState() =>
      _LocationSelectionPageState();
}

class _LocationSelectionPageState extends ConsumerState<LocationSelectionPage> {
  final searchController = TextEditingController();
  MapLibreMapController? controller;
  Timer? debounce;
  List<AddressSearchResult> searchResults = [];
  late LatLng selectedPoint;
  late String selectedAddress;
  String? statusMessage;
  String? error;
  bool searching = false;
  bool styleLoaded = false;

  @override
  void initState() {
    super.initState();
    selectedPoint = LatLng(widget.initialLatitude, widget.initialLongitude);
    selectedAddress = widget.initialAddress;
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => unawaited(useCurrentLocation(initialLoad: true)));
  }

  @override
  void dispose() {
    debounce?.cancel();
    searchController.dispose();
    super.dispose();
  }

  void onSearchChanged(String value) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 500),
        () => unawaited(searchAddress(value)));
  }

  Future<void> searchAddress(String query) async {
    final text = query.trim();
    if (text.length < 2) {
      setState(() => searchResults = []);
      return;
    }
    setState(() {
      searching = true;
      error = null;
    });
    try {
      final results = await ref.read(geoapifySearchProvider).search(text);
      if (!mounted) {
        return;
      }
      setState(() {
        searchResults = results;
        statusMessage = AppConfig.geoapifyEnabled
            ? null
            : 'Geoapify key is missing. Use GPS or manual map adjustment.';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted) {
        setState(() => searching = false);
      }
    }
  }

  Future<void> useCurrentLocation({bool initialLoad = false}) async {
    final location = await resolveCustomerLocation(ref);
    if (!mounted) {
      return;
    }
    final point = LatLng(location.latitude, location.longitude);
    setState(() {
      selectedPoint = point;
      selectedAddress =
          location.isDemoLocation ? demoCustomerAddress : selectedAddress;
      statusMessage = location.isDemoLocation
          ? 'GPS unavailable or outside Vietnam. Using demo Ho Chi Minh City; search or drag the map to adjust.'
          : 'Current GPS location loaded. Drag the map to fine tune the pin.';
    });
    if (!initialLoad || location.isDemoLocation == false) {
      await controller?.animateCamera(CameraUpdate.newLatLngZoom(point, 15));
    }
  }

  Future<void> selectSearchResult(AddressSearchResult result) async {
    FocusScope.of(context).unfocus();
    final point = LatLng(result.latitude, result.longitude);
    setState(() {
      selectedPoint = point;
      selectedAddress = result.label;
      searchResults = [];
      searchController.text = result.label;
      searchController.selection =
          TextSelection.collapsed(offset: searchController.text.length);
      statusMessage =
          'Address selected. Drag the map if the pin needs adjustment.';
    });
    await controller?.animateCamera(CameraUpdate.newLatLngZoom(point, 15));
  }

  void onCameraIdle() {
    final target = controller?.cameraPosition?.target;
    if (target == null) {
      return;
    }
    final adjustedAddress =
        'Map pin: ${formatCoordinate(target.latitude)}, ${formatCoordinate(target.longitude)}';
    setState(() {
      selectedPoint = target;
      selectedAddress = adjustedAddress;
      statusMessage =
          'Pin adjusted to ${formatCoordinate(target.latitude)}, ${formatCoordinate(target.longitude)}.';
    });
  }

  void confirmSelection() {
    FocusScope.of(context).unfocus();
    Navigator.of(context).pop(
      SelectedCustomerLocation(
        latitude: selectedPoint.latitude,
        longitude: selectedPoint.longitude,
        addressText: selectedAddress.trim().isEmpty
            ? demoCustomerAddress
            : selectedAddress.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mapEnabled = AppConfig.mapTilerEnabled;
    return Scaffold(
      appBar: AppBar(title: const Text('Choose service location')),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: mapEnabled
                  ? MapLibreMap(
                      styleString: AppConfig.mapTilerStyleUrl,
                      initialCameraPosition:
                          CameraPosition(target: selectedPoint, zoom: 15),
                      onMapCreated: (value) => controller = value,
                      onStyleLoadedCallback: () =>
                          setState(() => styleLoaded = true),
                      onCameraIdle: onCameraIdle,
                      compassEnabled: false,
                      logoEnabled: false,
                      myLocationEnabled: false,
                      rotateGesturesEnabled: false,
                      tiltGesturesEnabled: false,
                    )
                  : _MapPlaceholder(
                      customerLabel: 'Selected pin',
                      providerLabel: 'MapTiler key missing',
                      showProviderMarker: false,
                    ),
            ),
            IgnorePointer(
              child: Center(
                child: Transform.translate(
                  offset: const Offset(0, -18),
                  child: Icon(
                    Icons.location_pin,
                    size: 48,
                    color: Theme.of(context).colorScheme.primary,
                    shadows: const [Shadow(color: Colors.white, blurRadius: 8)],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              top: 16,
              child: Column(
                children: [
                  Material(
                    elevation: 3,
                    borderRadius: BorderRadius.circular(18),
                    child: TextField(
                      controller: searchController,
                      onChanged: onSearchChanged,
                      decoration: InputDecoration(
                        hintText: 'Search Vietnam address',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: searching
                            ? const Padding(
                                padding: EdgeInsets.all(14),
                                child: SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2)),
                              )
                            : searchController.text.isNotEmpty
                                ? IconButton(
                                    onPressed: () {
                                      debounce?.cancel();
                                      searchController.clear();
                                      setState(() => searchResults = []);
                                    },
                                    icon: const Icon(Icons.close),
                                  )
                                : IconButton(
                                    onPressed: () =>
                                        unawaited(useCurrentLocation()),
                                    icon:
                                        const Icon(Icons.my_location_outlined),
                                  ),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(18),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  if (searchResults.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Material(
                      elevation: 3,
                      borderRadius: BorderRadius.circular(18),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 220),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemBuilder: (context, index) {
                            final item = searchResults[index];
                            return ListTile(
                              leading: const Icon(Icons.place_outlined),
                              title: Text(item.label,
                                  maxLines: 2, overflow: TextOverflow.ellipsis),
                              subtitle: Text(
                                  '${formatCoordinate(item.latitude)}, ${formatCoordinate(item.longitude)}'),
                              onTap: () => unawaited(selectSearchResult(item)),
                            );
                          },
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemCount: searchResults.length,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (statusMessage != null || error != null)
                    Card(
                      color: error == null
                          ? Colors.white
                          : Theme.of(context).colorScheme.errorContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(error ?? statusMessage!),
                      ),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Selected pin',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(
                              '${formatCoordinate(selectedPoint.latitude)}, ${formatCoordinate(selectedPoint.longitude)}'),
                          if (!styleLoaded && mapEnabled) ...[
                            const SizedBox(height: 8),
                            const LinearProgressIndicator(minHeight: 4),
                          ],
                        ],
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: confirmSelection,
                    icon: const Icon(Icons.check),
                    label: const Text('Use this location'),
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

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({
    required this.customerLabel,
    required this.providerLabel,
    required this.showProviderMarker,
  });

  final String customerLabel;
  final String providerLabel;
  final bool showProviderMarker;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFD6F2DD),
            Color(0xFFEFE8D5),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: MapPainter()),
          ),
          Align(
            alignment: const Alignment(0, -0.1),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(customerLabel,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 6),
                Container(
                  width: 18,
                  height: 18,
                  decoration: const BoxDecoration(
                    color: Color(0xFF5E8E4A),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
          ),
          if (showProviderMarker)
            Align(
              alignment: const Alignment(0.38, -0.34),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(providerLabel,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: 18,
                    height: 18,
                    decoration: const BoxDecoration(
                      color: Color(0xFFE84B4B),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),
          Align(
            alignment: const Alignment(-0.25, -0.05),
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

class NearbyProvidersMap extends StatefulWidget {
  const NearbyProvidersMap({
    super.key,
    required this.customerPoint,
    required this.providers,
  });

  final LatLng? customerPoint;
  final List<Map<String, dynamic>> providers;

  @override
  State<NearbyProvidersMap> createState() => _NearbyProvidersMapState();
}

class _NearbyProvidersMapState extends State<NearbyProvidersMap> {
  MapLibreMapController? controller;
  bool styleLoaded = false;

  @override
  void didUpdateWidget(covariant NearbyProvidersMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (styleLoaded) {
      unawaited(syncMarkers());
    }
  }

  Future<void> syncMarkers() async {
    final map = controller;
    final customerPoint = widget.customerPoint;
    if (map == null || !styleLoaded || customerPoint == null) {
      return;
    }

    await map.clearCircles();
    await map.clearSymbols();
    await map.addCircle(CircleOptions(
      geometry: customerPoint,
      circleColor: '#5E8E4A',
      circleRadius: 8,
      circleStrokeColor: '#FFFFFF',
      circleStrokeWidth: 2,
    ));
    await map.addSymbol(SymbolOptions(
      geometry: customerPoint,
      textField: 'You',
      textColor: '#111827',
      textSize: 12,
      textHaloColor: '#FFFFFF',
      textHaloWidth: 1.5,
      textOffset: const Offset(0, -1.2),
    ));

    for (final provider in widget.providers) {
      final point = deriveProviderLatLng(provider);
      if (point == null) {
        continue;
      }
      final isRecent = provider['isRecentLocation'] != false;
      final displayName = provider['displayName'] as String? ?? 'Provider';
      final locationLabel = providerLocationFreshnessLabel(provider)
          .replaceFirst('Location ', '')
          .replaceFirst('Last updated ', 'Updated ');
      await map.addCircle(CircleOptions(
        geometry: point,
        circleColor: isRecent ? '#2563EB' : '#9CA3AF',
        circleRadius: 7,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 2,
      ));
      await map.addSymbol(SymbolOptions(
        geometry: point,
        textField: '$displayName\n$locationLabel',
        textColor: '#111827',
        textSize: 11,
        textHaloColor: '#FFFFFF',
        textHaloWidth: 1.5,
        textOffset: const Offset(0, -1.4),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final customerPoint = widget.customerPoint;
    if (AppConfig.mapTilerEnabled && customerPoint != null) {
      return MapLibreMap(
        styleString: AppConfig.mapTilerStyleUrl,
        initialCameraPosition:
            CameraPosition(target: customerPoint, zoom: 13.5),
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

    return _MapPlaceholder(
      customerLabel: 'You',
      providerLabel: '${widget.providers.length} provider(s)',
      showProviderMarker: widget.providers.isNotEmpty,
    );
  }
}

class MapPainter extends CustomPainter {
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
      ..moveTo(size.width * 0.1, size.height * 0.65)
      ..quadraticBezierTo(size.width * 0.35, size.height * 0.55,
          size.width * 0.5, size.height * 0.35)
      ..quadraticBezierTo(size.width * 0.68, size.height * 0.15,
          size.width * 0.9, size.height * 0.2);
    canvas.drawPath(mainRoad, roadPaint);

    final branch = Path()
      ..moveTo(size.width * 0.42, size.height * 0.58)
      ..quadraticBezierTo(size.width * 0.32, size.height * 0.45,
          size.width * 0.24, size.height * 0.28);
    canvas.drawPath(branch, thinPaint);

    final branchTwo = Path()
      ..moveTo(size.width * 0.55, size.height * 0.42)
      ..quadraticBezierTo(size.width * 0.64, size.height * 0.55,
          size.width * 0.78, size.height * 0.72);
    canvas.drawPath(branchTwo, thinPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
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
            ? 'Using demo Ho Chi Minh City location for nearby provider discovery.'
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
      notice = 'Service location selected. Refreshing nearby therapists.';
      error = null;
    });

    try {
      await ref.read(customerRepositoryProvider).saveSelectedLocation(
            lat: selected.latitude,
            lng: selected.longitude,
            addressText: selected.addressText,
          );
    } catch (_) {
      // Keep the map selection active even if the optional location save fails.
    }

    await loadProviders();
    if (mounted) {
      setState(() {
        notice =
            'Service location selected. Nearby therapists are sorted from this pin.';
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
                  }) =>
                      ref.read(customerRepositoryProvider).createBooking(
                            service['id'] as String,
                            providerId: detail['id'] as String,
                            customerName: customerName,
                            customerPhone: customerPhone,
                            addressLine: addressLine,
                            lat: lat,
                            lng: lng,
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
          Text('Providers', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(
            'Nearby therapists sorted by distance and availability.',
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
            label: Text(
                auth == null ? 'Demo customer login' : 'Refresh providers'),
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
            const EmptyPanel(text: 'Login first to load nearby provider cards.')
          else if (providers.isEmpty)
            const EmptyPanel(
                text:
                    'No nearby therapists loaded yet. Refresh to fetch the latest queue.')
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
    final chatReadyCount =
        items.where((booking) => booking['chatRoom'] != null).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Bookings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
              'Recent requests, assigned therapists, payment state, and chat readiness.',
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
                    'No bookings yet. Choose a therapist and book a service to start.')
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
    final chatRoom = booking['chatRoom'] as Map<String, dynamic>?;
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
                          'Therapist pending'),
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
                    label: formatCustomerScheduleMoment(
                        booking['scheduledStartAt'])),
                BookingHistoryPill(
                    label: customerServiceOptionPriceLabel(
                  service,
                  amount: payment?['amount'],
                )),
                BookingHistoryPill(
                    label: payment?['status']?.toString() ?? 'NO_PAYMENT'),
                if (chatRoom != null)
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

String formatCustomerScheduleMoment(dynamic value) {
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
  return '${parsed.month.toString().padLeft(2, '0')}/${parsed.day.toString().padLeft(2, '0')} $hour:$minute';
}

String customerBookingNextAction(Map<String, dynamic> booking) {
  return switch (booking['status']) {
    'OPEN_MATCHING' =>
      'Waiting for the selected therapist or backup therapists to respond.',
    'MATCHED' =>
      'Therapist confirmed. Chat opens when the provider starts the service.',
    'PROVIDER_ON_THE_WAY' =>
      'Track the therapist location and keep your phone nearby.',
    'ARRIVED' => 'Therapist arrived. Confirm details before service starts.',
    'IN_SERVICE' => 'Service is in progress. Use Chat if you need help.',
    'COMPLETED' => 'Service complete. Review and tip when ready.',
    'CANCELLED' => 'Cancelled. Any payment hold should be released.',
    'REFUNDED' => 'Refund recorded. Check payment status if needed.',
    _ => 'Review this booking status before taking action.',
  };
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
        statusMessage = 'Therapist location updated.';
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
          (item) => asMap(item?['chatRoom']) != null,
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
          '$providerName has not been locked in yet. Stay on the waiting screen until a therapist is selected.',
        'MATCHED' =>
          '$providerName is confirmed. Chat opens when the therapist starts the service.',
        'PROVIDER_ON_THE_WAY' =>
          '$providerName is on the way. Chat will open as soon as service start is triggered.',
        'IN_SERVICE' =>
          'The service is already in progress. Reload chat to join the live room.',
        _ =>
          'No service chat yet. The provider has to start the service first.',
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
                : 'Realtime messages with your assigned therapist.',
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
                    'Chat opens after a therapist is selected and the service start step begins.')
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
                    'Therapist location appears here after the provider shares their current pin.',
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

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
          const SizedBox(height: 20),
          const Card(
            child: ListTile(
              title: Text('Saved addresses'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Wallet'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Reviews'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const Card(
            child: ListTile(
              title: Text('Support'),
              trailing: Icon(Icons.chevron_right),
            ),
          ),
          const SizedBox(height: 12),
          if (auth != null)
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Signed out locally.')),
                  );
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
        ],
      ),
    );
  }
}

class MvpAsyncList extends StatelessWidget {
  const MvpAsyncList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.disabledText,
    required this.loader,
    required this.labelBuilder,
  });

  final String title;
  final String subtitle;
  final bool enabled;
  final String disabledText;
  final Future<List<dynamic>> Function() loader;
  final String Function(dynamic item) labelBuilder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
          if (!enabled)
            EmptyPanel(text: disabledText)
          else
            FutureBuilder<List<dynamic>>(
              future: loader(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final items = snapshot.data ?? [];
                if (items.isEmpty) {
                  return const EmptyPanel(text: 'No records yet.');
                }
                return Column(
                  children: [
                    for (final item in items)
                      Card(
                        child: ListTile(
                          title: Text(labelBuilder(item)),
                          trailing: const Icon(Icons.chevron_right),
                        ),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

class MvpScreen extends StatelessWidget {
  const MvpScreen(
      {super.key,
      required this.title,
      required this.subtitle,
      required this.items});

  final String title;
  final String subtitle;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
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

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({super.key, required this.text});

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

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.text});

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

Map<String, dynamic>? latestActiveBooking(List<dynamic> bookings) {
  const activeStatuses = {
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  };
  final items = bookings
      .whereType<Map<String, dynamic>>()
      .where((booking) => activeStatuses.contains(booking['status']))
      .toList()
    ..sort((left, right) {
      final leftValue = (left['openedAt'] ?? left['createdAt'] ?? '') as String;
      final rightValue =
          (right['openedAt'] ?? right['createdAt'] ?? '') as String;
      return rightValue.compareTo(leftValue);
    });
  return items.isEmpty ? null : items.first;
}

Map<String, dynamic>? firstBookingService(Map<String, dynamic> booking) {
  final services = booking['services'] is List<dynamic>
      ? booking['services'] as List<dynamic>
      : [];
  if (services.isEmpty) {
    return null;
  }
  final first = asMap(services.first);
  if (first == null) {
    return null;
  }
  final service = asMap(first['service']);
  if (service == null) {
    return null;
  }
  final bookingPrice = asNum(first['price'])?.toInt();
  return {
    ...service,
    'bookingServiceId': first['id'],
    if (bookingPrice != null) 'bookingPrice': bookingPrice,
    if (bookingPrice != null) 'effectivePrice': bookingPrice,
  };
}

Map<String, dynamic> customerBookableService(
    Map<String, dynamic> providerService) {
  final service = asMap(providerService['service']) ?? <String, dynamic>{};
  final providerPrice = asNum(providerService['price'])?.toInt();
  final basePrice = asNum(service['basePrice'])?.toInt() ?? 0;
  final effectivePrice = providerPrice ?? basePrice;

  return {
    ...service,
    'providerServiceId': providerService['id'],
    if (providerPrice != null) 'providerPrice': providerPrice,
    'effectivePrice': effectivePrice,
    'customerPrice': effectivePrice,
    'providerServiceActive': providerService['active'] ?? true,
  };
}

List<CustomerServiceOptionGroup> customerServiceOptionGroups(
    List<dynamic> providerServices) {
  final grouped = <String, List<Map<String, dynamic>>>{};
  final names = <String, String>{};

  for (final item in providerServices) {
    final providerService = asMap(item);
    if (providerService == null) {
      continue;
    }

    final service = customerBookableService(providerService);
    if (!customerProviderServiceIsBookable(providerService, service)) {
      continue;
    }
    final key = customerServiceGroupKey(service);
    grouped.putIfAbsent(key, () => <Map<String, dynamic>>[]).add(service);
    names.putIfAbsent(key, () => service['name'] as String? ?? 'Service');
  }

  return grouped.entries.map((entry) {
    final options = [...entry.value]..sort((left, right) {
        final leftDuration = asNum(left['durationMin'])?.toInt() ?? 0;
        final rightDuration = asNum(right['durationMin'])?.toInt() ?? 0;
        final durationCompare = leftDuration.compareTo(rightDuration);
        if (durationCompare != 0) {
          return durationCompare;
        }
        return customerServicePrice(left)
            .compareTo(customerServicePrice(right));
      });

    return CustomerServiceOptionGroup(
      key: entry.key,
      name: names[entry.key] ?? 'Service',
      options: options,
    );
  }).toList();
}

String customerServiceGroupKey(Map<String, dynamic> service) {
  final groupKey = service['serviceGroupKey'];
  if (groupKey is String && groupKey.trim().isNotEmpty) {
    return groupKey.trim();
  }

  final slug = service['slug'];
  if (slug is String && slug.trim().isNotEmpty) {
    return slug.trim();
  }

  final name = service['name'];
  if (name is String && name.trim().isNotEmpty) {
    return name.trim().toLowerCase();
  }

  return service['id']?.toString() ?? 'service';
}

bool customerProviderServiceIsBookable(
  Map<String, dynamic> providerService,
  Map<String, dynamic> service,
) {
  if (providerService['active'] == false ||
      service['providerServiceActive'] == false) {
    return false;
  }

  final nestedService = asMap(providerService['service']);
  if (nestedService?['active'] == false) {
    return false;
  }

  if (nestedService == null) {
    return false;
  }

  final price = customerServicePrice(service);
  final basePrice = asNum(nestedService['basePrice'])?.toInt() ?? 0;
  final priceStep = asNum(nestedService['priceStep'])?.toInt() ?? 100000;
  if (price < basePrice || priceStep <= 0 || price % priceStep != 0) {
    return false;
  }

  final payoutRules = asList(nestedService['payoutRules']);
  return payoutRules.any((rule) {
    final mapped = asMap(rule);
    if (mapped == null || mapped['active'] == false) {
      return false;
    }
    return asNum(mapped['customerPrice'])?.toInt() == price;
  });
}

int customerServicePrice(Map<String, dynamic>? service) {
  if (service == null) {
    return 0;
  }
  return asNum(service['effectivePrice'])?.toInt() ??
      asNum(service['customerPrice'])?.toInt() ??
      asNum(service['providerPrice'])?.toInt() ??
      asNum(service['bookingPrice'])?.toInt() ??
      asNum(service['basePrice'])?.toInt() ??
      0;
}

String customerServiceOptionLabel(Map<String, dynamic>? service) {
  if (service == null) {
    return 'Selected service';
  }
  final name = customerServiceName(service);
  final duration = asNum(service['durationMin'])?.toInt();
  if (duration == null || duration <= 0) {
    return name;
  }
  return '$name / $duration min';
}

String customerServiceName(Map<String, dynamic>? service) {
  final name = service?['name']?.toString().trim();
  return name == null || name.isEmpty ? 'Selected service' : name;
}

String customerServiceDurationLabel(Map<String, dynamic>? service) {
  final duration = asNum(service?['durationMin'])?.toInt();
  return duration == null || duration <= 0
      ? 'Duration not set'
      : '$duration min';
}

String customerServiceGroupDurationSummary(CustomerServiceOptionGroup group) {
  final durations = group.options
      .map((option) => asNum(option['durationMin'])?.toInt())
      .whereType<int>()
      .where((duration) => duration > 0)
      .toSet()
      .toList()
    ..sort();
  if (durations.isEmpty) {
    return '${group.options.length} option(s)';
  }
  return durations.map((duration) => '$duration min').join(' / ');
}

String customerServiceGroupPriceRangeLabel(CustomerServiceOptionGroup group) {
  final prices = group.options
      .map(customerServicePrice)
      .where((price) => price > 0)
      .toList()
    ..sort();
  if (prices.isEmpty) {
    return 'Price pending';
  }
  final lowest = prices.first;
  final highest = prices.last;
  if (lowest == highest) {
    return '${formatCurrency(lowest)} VND';
  }
  return '${formatCurrency(lowest)}-${formatCurrency(highest)} VND';
}

String customerServicePricePolicyLabel(Map<String, dynamic>? service) {
  if (service == null) {
    return 'Policy pending';
  }
  final price = customerServicePrice(service);
  final basePrice = asNum(service['basePrice'])?.toInt() ?? 0;
  final step = asNum(service['priceStep'])?.toInt() ?? 100000;
  if (price <= 0) {
    return 'Price pending';
  }
  if (basePrice > 0 && price < basePrice) {
    return 'Below minimum';
  }
  if (step > 0 && price % step != 0) {
    return 'Price step check';
  }
  if (basePrice > 0 && price > basePrice) {
    return 'Provider price';
  }
  return 'Admin minimum';
}

String customerServiceOptionPriceLabel(Map<String, dynamic>? service,
    {dynamic amount}) {
  final price = asNum(amount)?.toInt() ?? customerServicePrice(service);
  return '${customerServiceOptionLabel(service)} / ${formatCurrency(price)} VND';
}

String providerDisplayName(Map<String, dynamic>? booking) {
  if (booking == null) {
    return 'Booking';
  }
  final provider = activeBookingProvider(booking);
  if (provider != null) {
    return provider['displayName'] as String? ?? 'Selected provider';
  }
  final participants = booking['participants'] is List<dynamic>
      ? booking['participants'] as List<dynamic>
      : [];
  if (participants.isNotEmpty) {
    final first = participants.first as Map<String, dynamic>;
    final providerProfile = first['providerProfile'] as Map<String, dynamic>?;
    if (providerProfile != null) {
      return providerProfile['displayName'] as String? ?? 'Provider';
    }
  }
  return 'Booking request';
}

Map<String, dynamic>? activeBookingProvider(Map<String, dynamic>? booking) {
  if (booking == null) {
    return null;
  }

  final status = booking['status'] as String?;
  if (status == 'OPEN_MATCHING') {
    final preferred = booking['preferredProvider'];
    if (preferred is Map<String, dynamic>) {
      return preferred;
    }
  }

  final selected = booking['selectedProvider'];
  return selected is Map<String, dynamic> ? selected : null;
}

double providerAverageRating(Map<String, dynamic> provider) {
  final reviews = asList(provider['reviews']);
  if (reviews.isEmpty) {
    return 5;
  }
  final total = reviews.fold<double>(0, (sum, item) {
    final rating = asNum(asMap(item)?['rating']) ?? 0;
    return sum + rating.toDouble();
  });
  return total / reviews.length;
}

int providerReviewCount(Map<String, dynamic> provider) {
  final reviews = provider['reviews'];
  if (reviews is List<dynamic>) {
    return reviews.length;
  }
  return 0;
}

Future<CustomerLocationSnapshot> resolveCustomerLocation(WidgetRef ref) async {
  final position = await ref.read(customerLocationProvider).currentPosition();
  final lat = position?.latitude;
  final lng = position?.longitude;
  if (lat != null && lng != null && isVietnamCoordinate(lat, lng)) {
    return CustomerLocationSnapshot(
      latitude: lat,
      longitude: lng,
      addressText: 'Current GPS location',
    );
  }
  return const CustomerLocationSnapshot(
    latitude: demoCustomerLat,
    longitude: demoCustomerLng,
    addressText: demoCustomerAddress,
    isDemoLocation: true,
  );
}

Future<CustomerLocationSnapshot> resolveDiscoveryLocation(WidgetRef ref) async {
  final selected = ref.read(selectedCustomerLocationProvider);
  if (selected != null) {
    return CustomerLocationSnapshot(
      latitude: selected.latitude,
      longitude: selected.longitude,
      addressText: selected.addressText,
    );
  }
  return resolveCustomerLocation(ref);
}

String locationTitle(String addressText, bool isDemoLocation) {
  if (isDemoLocation) {
    return demoCustomerCity;
  }
  final first = addressText.split(',').first.trim();
  if (first.isEmpty || first.startsWith('Map pin:')) {
    return 'Selected location';
  }
  return first;
}

bool isVietnamCoordinate(double lat, double lng) {
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0;
}

String formatDistance(num? meters) {
  if (meters == null) {
    return '?';
  }
  if (meters >= 1000) {
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }
  return '${meters.round()} m';
}

LatLng? deriveProviderLatLng(Map<String, dynamic>? provider) {
  final lat = asDouble(provider?['currentLat']) ?? asDouble(provider?['lat']);
  final lng = asDouble(provider?['currentLng']) ?? asDouble(provider?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

String formatLastLocation(dynamic value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return 'not shared yet';
  }
  final date = DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return 'not shared yet';
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 1) {
    return 'just now';
  }
  if (difference.inMinutes < 60) {
    return '${difference.inMinutes}m ago';
  }
  if (difference.inHours < 24) {
    return '${difference.inHours}h ago';
  }
  return '${difference.inDays}d ago';
}

String providerLocationStatusLabel(dynamic value) {
  final raw = value?.toString();
  final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return 'Location not shared';
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 30) {
    return 'Recent location';
  }
  if (difference.inHours < 24) {
    return 'Last location not recent';
  }
  return 'Old saved location';
}

Color providerLocationStatusColor(dynamic value) {
  final raw = value?.toString();
  final date = raw == null ? null : DateTime.tryParse(raw)?.toLocal();
  if (date == null) {
    return Colors.black54;
  }
  final difference = DateTime.now().difference(date);
  if (difference.inMinutes < 30) {
    return const Color(0xFF5E8E4A);
  }
  if (difference.inHours < 24) {
    return const Color(0xFF9A6A18);
  }
  return Colors.black54;
}

String providerLocationFreshnessLabel(Map<String, dynamic> provider) {
  final ageLabel = formatLastLocation(provider['currentLocationUpdatedAt']);
  if (ageLabel == 'not shared yet') {
    return 'Location not shared yet';
  }
  if (provider['isRecentLocation'] == false) {
    return 'Last updated $ageLabel';
  }
  return 'Location $ageLabel';
}

class CustomerLocationSnapshot {
  const CustomerLocationSnapshot({
    required this.latitude,
    required this.longitude,
    this.addressText,
    this.isDemoLocation = false,
  });

  final double latitude;
  final double longitude;
  final String? addressText;
  final bool isDemoLocation;
}

LatLng? deriveBookingLatLng(Map<String, dynamic>? booking) {
  final lat = asDouble(booking?['lat']);
  final lng = asDouble(booking?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

LatLng? deriveRealtimeLatLng(Map<String, dynamic>? payload) {
  final lat = asDouble(payload?['lat']);
  final lng = asDouble(payload?['lng']);
  if (lat == null || lng == null) {
    return null;
  }
  return LatLng(lat, lng);
}

String formatCoordinate(double? value) {
  if (value == null) {
    return '-';
  }
  return value.toStringAsFixed(4);
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

double? asDouble(dynamic value) {
  return asNum(value)?.toDouble();
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

List<String> asStringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return const [];
}

double bookingProgress(String status) {
  switch (status) {
    case 'OPEN_MATCHING':
      return 0.15;
    case 'MATCHED':
      return 0.5;
    case 'PROVIDER_ON_THE_WAY':
      return 0.7;
    case 'ARRIVED':
      return 0.82;
    case 'IN_SERVICE':
      return 1;
    default:
      return 0.08;
  }
}

String waitingStepLabel(String status) {
  switch (status) {
    case 'OPEN_MATCHING':
      return 'Waiting';
    case 'MATCHED':
      return 'Confirmed';
    case 'PROVIDER_ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_SERVICE':
      return 'In service';
    default:
      return status;
  }
}

String waitingSignalLabel(String status, int fallbackCount) {
  if (status == 'IN_SERVICE') {
    return 'Live';
  }
  if (status == 'MATCHED') {
    return 'Ready';
  }
  if (fallbackCount > 0) {
    return 'Options open';
  }
  return 'Pending';
}

WaitingCustomerAction waitingCustomerAction({
  required String status,
  required int fallbackCount,
  required bool hasChatRoom,
  Map<String, dynamic> matchingPolicy = const {},
}) {
  if (status == 'OPEN_MATCHING' && fallbackCount > 0) {
    return const WaitingCustomerAction(
      title: 'Backup options are ready',
      body:
          'Your first therapist is still being checked. You can keep waiting or switch to a backup therapist below.',
    );
  }
  if (status == 'OPEN_MATCHING') {
    return WaitingCustomerAction(
      title: 'Waiting for therapist response',
      body:
          'No action is needed yet. HANDS is waiting for your chosen therapist. ${backupStandbyDescription(matchingPolicy)}',
    );
  }
  if (hasChatRoom && (status == 'MATCHED' || status == 'PROVIDER_ON_THE_WAY')) {
    return const WaitingCustomerAction(
      title: 'Booking confirmed',
      body:
          'Your therapist is confirmed. Chat will help coordinate service start and location details.',
    );
  }
  if (status == 'IN_SERVICE') {
    return const WaitingCustomerAction(
      title: 'Service is live',
      body:
          'Continue in chat if you need help during the service. Review and tip become available after completion.',
    );
  }
  return WaitingCustomerAction(
    title: 'Booking progress',
    body: 'Current booking status: $status.',
  );
}

Map<String, dynamic> bookingMatchingPolicy(Map<String, dynamic>? booking) {
  final metadata = asMap(booking?['metadata']);
  final policy = asMap(metadata?['matchingPolicy']);
  final earlyAcceptMin = asNum(booking?['earlyAcceptMin'])?.toInt();
  return {
    if (policy != null) ...policy,
    if (earlyAcceptMin != null) 'providerResponseWindowMinutes': earlyAcceptMin,
  };
}

String responseWindowLabel(Map<String, dynamic> policy) {
  final minutes = asNum(policy['providerResponseWindowMinutes'])?.toInt();
  if (minutes == null || minutes <= 0) {
    return 'the first response window';
  }
  return 'the first $minutes minute response window';
}

String backupRadiusLabel(Map<String, dynamic> policy) {
  final meters = asNum(policy['backupProviderRadiusMeters'])?.toInt();
  if (meters == null || meters <= 0) {
    return 'nearby';
  }
  if (meters >= 1000) {
    final km = meters / 1000;
    final text = km == km.roundToDouble()
        ? km.toInt().toString()
        : km.toStringAsFixed(1);
    return 'within ${text}km';
  }
  return 'within ${meters}m';
}

bool backupOpensImmediately(Map<String, dynamic> policy) {
  return policy['backupOpenMode']?.toString() == 'IMMEDIATE_WITHIN_WINDOW';
}

String backupWindowDescription(Map<String, dynamic> policy) {
  final radius = backupRadiusLabel(policy);
  if (backupOpensImmediately(policy)) {
    return 'backup therapists $radius can also join during this window';
  }
  return 'backup therapists $radius can join after this window if needed';
}

String backupStandbyDescription(Map<String, dynamic> policy) {
  final radius = backupRadiusLabel(policy);
  if (backupOpensImmediately(policy)) {
    return 'Backup therapists $radius can appear as soon as they offer support.';
  }
  return 'Backup therapists $radius can appear after the first response window if the chosen therapist is slow.';
}

String backupParticipationLabel(Map<String, dynamic> policy) {
  return backupOpensImmediately(policy)
      ? 'backup options open'
      : 'backup options on standby';
}

String directRequestDetail(Map<String, dynamic> policy) {
  return 'This therapist is getting ${responseWindowLabel(policy)} for your request.';
}

class WaitingCustomerAction {
  const WaitingCustomerAction({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;
}

String chatActionLabel(String status) {
  return switch (status) {
    'IN_SERVICE' => 'Open service chat',
    'COMPLETED' => 'Open chat history',
    _ => 'Open chat room',
  };
}

String shortCode(Object? value) {
  final text = value?.toString() ?? '';
  if (text.isEmpty) {
    return '---';
  }
  return text.length <= 8 ? text : text.substring(0, 8);
}

String formatExpiry(String? isoValue) {
  if (isoValue == null) {
    return '--:--';
  }
  final date = DateTime.tryParse(isoValue)?.toLocal();
  if (date == null) {
    return '--:--';
  }
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

String formatRemainingTime(String? isoValue) {
  if (isoValue == null) {
    return '--';
  }
  final date = DateTime.tryParse(isoValue)?.toLocal();
  if (date == null) {
    return '--';
  }
  final difference = date.difference(DateTime.now());
  if (difference.isNegative) {
    return 'expired';
  }
  if (difference.inMinutes <= 0) {
    return '${difference.inSeconds.remainder(60).abs()}s left';
  }
  return '${difference.inMinutes}m left';
}
