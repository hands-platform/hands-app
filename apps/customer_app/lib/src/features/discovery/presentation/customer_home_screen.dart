import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_flow_screens.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_discovery_widgets.dart';
import 'customer_provider_detail_page.dart';

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
        ref.read(pushTokenRefreshRegistrationProvider);
        await ref.read(registerCurrentDevicePushTokenProvider).call();
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
      ref.read(pushTokenRefreshRegistrationProvider);
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
            ? 'Browsing uses a Vietnam demo pin. Customers can browse from anywhere; booking requires a confirmed Vietnam service pin.'
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
      ref.read(pushTokenRefreshRegistrationProvider);
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
