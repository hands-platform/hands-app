import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_flow_screens.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_discovery_widgets.dart';
import 'customer_provider_detail_page.dart';

class ProvidersScreen extends ConsumerStatefulWidget {
  const ProvidersScreen({super.key, this.onOpenMore});

  final VoidCallback? onOpenMore;

  @override
  ConsumerState<ProvidersScreen> createState() => _ProvidersScreenState();
}

class _ProvidersScreenState extends ConsumerState<ProvidersScreen> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> providers = [];
  Set<String> favoriteProviderIds = {};
  CustomerProviderSort sort = CustomerProviderSort.nearest;
  String? selectedServiceKey;
  bool favoritesOnly = false;
  double? customerLat;
  double? customerLng;
  String customerAddress = localDemoAccessEnabled ? demoCustomerAddress : '';
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

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> loadProviders() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final location = await resolveDiscoveryLocation(ref);
      final repository = ref.read(customerRepositoryProvider);
      final results = await Future.wait<dynamic>([
        repository.nearbyProviders(
            lat: location.latitude, lng: location.longitude),
        repository.listFavoriteProviderIds(),
      ]);
      final items = sortNearbyProvidersByDistance(results[0] as List<dynamic>);
      if (!mounted) {
        return;
      }
      setState(() {
        providers = items;
        favoriteProviderIds = results[1] as Set<String>;
        customerLat = location.latitude;
        customerLng = location.longitude;
        customerAddress = location.addressText ?? customerAddress;
        customerLocationIsDemo = location.isDemoLocation;
        notice = location.isDemoLocation
            ? 'Choose a service address to confirm distance and book.'
            : null;
      });
    } catch (exception) {
      if (!mounted) {
        return;
      }
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
      notice = 'Vietnam service location selected. Refreshing nearby partners.';
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
            'Vietnam service location selected. Nearby partners are sorted from this pin.';
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
    final profileLabel = auth?.user['displayName']?.toString() ??
        auth?.user['phone']?.toString();
    final addressLabel = customerLocationIsDemo
        ? 'Choose service address'
        : locationTitle(customerAddress, false);
    final serviceFilters = customerProviderServiceFilters(providers);
    final visibleProviders = filterCustomerProviders(
      providers,
      query: searchController.text,
      serviceKey: selectedServiceKey,
      favoriteProviderIds: favoriteProviderIds,
      favoritesOnly: favoritesOnly,
      sort: sort,
    );

    return ColoredBox(
      color: context.handsColors.canvas,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            CustomerAddressBar(
              address: addressLabel,
              profileLabel: profileLabel,
              onTap: openCustomerLocationSelector,
              onProfileTap: widget.onOpenMore,
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: auth == null ? () async {} : loadProviders,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(
                    CustomerSpacing.page,
                    26,
                    CustomerSpacing.page,
                    32,
                  ),
                  children: [
                    CustomerPageHeader(
                      title: 'Choose a partner',
                      subtitle: 'Nearest first from your service address.',
                      trailing: IconButton(
                        onPressed: auth == null ? null : loadProviders,
                        tooltip: 'Refresh partners',
                        icon: const Icon(Icons.refresh_rounded),
                      ),
                    ),
                    if (loading) ...[
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
                    const SizedBox(height: 20),
                    TextField(
                      controller: searchController,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        hintText: 'Search partner or service',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: searchController.text.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear search',
                                onPressed: () {
                                  searchController.clear();
                                  setState(() {});
                                },
                                icon: const Icon(Icons.close_rounded),
                              ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          ChoiceChip(
                            label: const Text('Near me'),
                            selected: sort == CustomerProviderSort.nearest,
                            onSelected: (_) => setState(
                                () => sort = CustomerProviderSort.nearest),
                          ),
                          const SizedBox(width: 8),
                          ChoiceChip(
                            label: const Text('Top booked'),
                            selected: sort == CustomerProviderSort.mostBooked,
                            onSelected: (_) => setState(
                                () => sort = CustomerProviderSort.mostBooked),
                          ),
                          const SizedBox(width: 8),
                          FilterChip(
                            label: const Text('Favorites'),
                            selected: favoritesOnly,
                            onSelected: (value) =>
                                setState(() => favoritesOnly = value),
                          ),
                        ],
                      ),
                    ),
                    if (serviceFilters.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String?>(
                        initialValue: selectedServiceKey,
                        decoration:
                            const InputDecoration(labelText: 'Service type'),
                        items: [
                          const DropdownMenuItem<String?>(
                              value: null, child: Text('All services')),
                          for (final option in serviceFilters.entries)
                            DropdownMenuItem<String?>(
                                value: option.key, child: Text(option.value)),
                        ],
                        onChanged: (value) =>
                            setState(() => selectedServiceKey = value),
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (auth == null)
                      const EmptyPanel(
                        text: 'Sign in on Home to find nearby partners.',
                      )
                    else if (providers.isEmpty)
                      const EmptyPanel(
                        text:
                            'No available partners nearby. Pull down to refresh.',
                      )
                    else if (visibleProviders.isEmpty)
                      const EmptyPanel(text: 'No partners match these filters.')
                    else
                      for (final provider in visibleProviders)
                        ProviderListCard(
                          provider: provider,
                          onTap: () => openProviderDetail(provider),
                        ),
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
