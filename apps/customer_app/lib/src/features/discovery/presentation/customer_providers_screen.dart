import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../app_state.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_flow_screens.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_discovery_widgets.dart';
import 'customer_provider_detail_page.dart';

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
            ? 'Using Ho Chi Minh City fallback location for nearby partner discovery.'
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
