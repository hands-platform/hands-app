import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../app_state.dart';
import '../../../core/app_config.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import 'customer_location_helpers.dart';

class LocationMapSurface extends StatefulWidget {
  const LocationMapSurface({
    super.key,
    required this.customerPoint,
    required this.providerPoint,
    this.customerLabel = 'Customer',
    this.providerLabel = 'Partner',
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
      circleColor: '#353356',
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
      return Stack(
        fit: StackFit.expand,
        children: [
          MapLibreMap(
            styleString: AppConfig.mapTilerStyleUrl,
            initialCameraPosition: CameraPosition(
              target: widget.providerPoint ?? widget.customerPoint!,
              zoom: widget.providerPoint == null ? 13.8 : 12.8,
            ),
            onMapCreated: (value) => controller = value,
            onStyleLoadedCallback: () {
              if (mounted) {
                setState(() => styleLoaded = true);
              }
              unawaited(syncMarkers());
            },
            compassEnabled: false,
            logoEnabled: false,
            myLocationEnabled: false,
            rotateGesturesEnabled: false,
            tiltGesturesEnabled: false,
          ),
          if (!styleLoaded) const _MapLoadingSurface(),
        ],
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
    final statusColor =
        providerLocationStatusColor(context.handsColors, recordedAt);
    final statusLabel = providerLocationStatusLabel(recordedAt);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(CustomerRadii.card),
          child: SizedBox(
            height: 180,
            child: LocationMapSurface(
              customerPoint: customerPoint,
              providerPoint: providerPoint,
              customerLabel: 'Customer',
              providerLabel: 'Partner',
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

class LocationSelectionPage extends ConsumerStatefulWidget {
  const LocationSelectionPage({
    super.key,
    required this.initialLatitude,
    required this.initialLongitude,
    required this.initialAddress,
    this.initialLocationRequiresConfirmation = false,
  });

  final double initialLatitude;
  final double initialLongitude;
  final String initialAddress;
  final bool initialLocationRequiresConfirmation;

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
  bool selectionReady = false;
  bool ignoreNextCameraIdle = true;

  @override
  void initState() {
    super.initState();
    selectedPoint = LatLng(widget.initialLatitude, widget.initialLongitude);
    selectedAddress = widget.initialAddress;
    selectionReady = !widget.initialLocationRequiresConfirmation;
    if (widget.initialLocationRequiresConfirmation) {
      statusMessage =
          'Search an address, use your current location, or move the map to confirm the exact service point.';
    }
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
    if (text.length < 3) {
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
        setState(() => error = customerErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => searching = false);
      }
    }
  }

  Future<void> useCurrentLocation() async {
    final location = await resolveCustomerLocation(ref);
    if (!mounted) {
      return;
    }
    final point = LatLng(location.latitude, location.longitude);
    setState(() {
      selectedPoint = point;
      selectedAddress =
          location.isDemoLocation ? demoCustomerAddress : selectedAddress;
      selectionReady = !location.isDemoLocation;
      statusMessage = location.isDemoLocation
          ? 'Your current GPS point is unavailable or outside Vietnam. Search a Vietnam address or move the map inside Vietnam.'
          : 'Current location selected. Move the map if the service entrance is different.';
      error = null;
    });
    if (location.isDemoLocation == false) {
      ignoreNextCameraIdle = true;
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
      selectionReady = true;
      statusMessage = 'Address selected. Move the map to fine tune the pin.';
      error = null;
    });
    ignoreNextCameraIdle = true;
    await controller?.animateCamera(CameraUpdate.newLatLngZoom(point, 15));
  }

  void onCameraIdle() {
    if (ignoreNextCameraIdle) {
      ignoreNextCameraIdle = false;
      return;
    }
    final target = controller?.cameraPosition?.target;
    if (target == null) {
      return;
    }
    final adjustedAddress =
        'Map pin: ${formatCoordinate(target.latitude)}, ${formatCoordinate(target.longitude)}';
    setState(() {
      selectedPoint = target;
      selectedAddress = adjustedAddress;
      selectionReady = isVietnamCoordinate(target.latitude, target.longitude);
      statusMessage = selectionReady
          ? 'Map pin adjusted. Confirm this service point below.'
          : null;
      error =
          selectionReady ? null : 'The service point must be inside Vietnam.';
    });
  }

  void confirmSelection() {
    FocusScope.of(context).unfocus();
    if (!selectionReady) {
      setState(() {
        error =
            'Confirm the exact service point by searching an address, using your current location, or moving the map.';
      });
      return;
    }
    if (!isVietnamCoordinate(selectedPoint.latitude, selectedPoint.longitude)) {
      setState(() {
        error =
            'HANDS service locations must be inside Vietnam. Search a Vietnam address or move the pin inside Vietnam before booking.';
        statusMessage = null;
      });
      return;
    }
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
    final colors = context.handsColors;
    final mapEnabled = AppConfig.mapTilerEnabled;
    return Scaffold(
      extendBodyBehindAppBar: true,
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        title: const Text('Choose location'),
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        top: false,
        child: Stack(
          children: [
            Positioned.fill(
              child: mapEnabled
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        MapLibreMap(
                          styleString: AppConfig.mapTilerStyleUrl,
                          initialCameraPosition:
                              CameraPosition(target: selectedPoint, zoom: 15),
                          onMapCreated: (value) {
                            controller = value;
                            ignoreNextCameraIdle = true;
                          },
                          onStyleLoadedCallback: () {
                            if (mounted) {
                              setState(() => styleLoaded = true);
                            }
                          },
                          onCameraIdle: onCameraIdle,
                          compassEnabled: false,
                          logoEnabled: false,
                          myLocationEnabled: false,
                          rotateGesturesEnabled: false,
                          tiltGesturesEnabled: false,
                        ),
                        if (!styleLoaded) const _MapLoadingSurface(),
                      ],
                    )
                  : _MapPlaceholder(
                      customerLabel: 'Selected location',
                      providerLabel: 'Move the map to fine tune',
                      showProviderMarker: false,
                    ),
            ),
            IgnorePointer(
              child: Center(
                child: Transform.translate(
                  offset: const Offset(0, -18),
                  child: Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      color: colors.surface,
                      shape: BoxShape.circle,
                      border: Border.fromBorderSide(
                        BorderSide(color: colors.outline),
                      ),
                    ),
                    child: Icon(
                      Icons.location_pin,
                      size: 38,
                      color: colors.primary,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              top: MediaQuery.paddingOf(context).top + kToolbarHeight + 8,
              child: Column(
                children: [
                  Material(
                    elevation: 0,
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(CustomerRadii.control),
                    child: TextField(
                      controller: searchController,
                      onChanged: onSearchChanged,
                      decoration: InputDecoration(
                        hintText: 'Search a Vietnam address',
                        prefixIcon: const Icon(Icons.search_rounded),
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
                                : null,
                        filled: true,
                        fillColor: colors.surface,
                        border: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(CustomerRadii.control),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  if (searchResults.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Material(
                      elevation: 0,
                      borderRadius: BorderRadius.circular(CustomerRadii.card),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 220),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemBuilder: (context, index) {
                            final item = searchResults[index];
                            return ListTile(
                              leading: const Icon(Icons.location_on_outlined),
                              title: Text(item.label,
                                  maxLines: 2, overflow: TextOverflow.ellipsis),
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
              right: CustomerSpacing.page,
              bottom: 300,
              child: FloatingActionButton.small(
                heroTag: 'customer-location-current',
                onPressed: () => unawaited(useCurrentLocation()),
                backgroundColor: colors.surface,
                foregroundColor: colors.primary,
                tooltip: 'Use current location',
                child: const Icon(Icons.my_location_rounded),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                constraints: const BoxConstraints(minHeight: 276),
                padding: EdgeInsets.fromLTRB(
                  CustomerSpacing.page,
                  22,
                  CustomerSpacing.page,
                  MediaQuery.paddingOf(context).bottom + 18,
                ),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(CustomerRadii.sheet),
                  ),
                  border: Border(
                    top: BorderSide(color: colors.outline),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SELECT SERVICE ADDRESS',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.inkMuted,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: colors.primarySoft,
                            borderRadius:
                                BorderRadius.circular(CustomerRadii.control),
                          ),
                          child: Icon(
                            Icons.location_on_outlined,
                            color: colors.primary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                selectedAddress.trim().isEmpty
                                    ? 'Choose the service address'
                                    : selectedAddress.trim(),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyLarge
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                '${formatCoordinate(selectedPoint.latitude)}, ${formatCoordinate(selectedPoint.longitude)}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: colors.inkMuted),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Icon(
                          selectionReady
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          color:
                              selectionReady ? colors.success : colors.inkMuted,
                        ),
                      ],
                    ),
                    if (statusMessage != null || error != null) ...[
                      const SizedBox(height: 14),
                      _LocationSelectionFeedback(
                        text: error ?? statusMessage!,
                        isError: error != null,
                      ),
                    ],
                    if (!styleLoaded && mapEnabled) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(minHeight: 3),
                    ],
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: selectionReady ? confirmSelection : null,
                        child: const Text('Use this address'),
                      ),
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

class _LocationSelectionFeedback extends StatelessWidget {
  const _LocationSelectionFeedback({
    required this.text,
    required this.isError,
  });

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final color = isError ? colors.error : colors.primary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          isError ? Icons.error_outline : Icons.info_outline,
          size: 19,
          color: color,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color,
                  height: 1.35,
                ),
          ),
        ),
      ],
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
    final colors = context.handsColors;
    return ColoredBox(
      color: colors.surfaceMuted,
      child: Stack(
        children: [
          Center(
            child: Icon(
              Icons.map_outlined,
              size: 72,
              color: colors.outline,
            ),
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
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(customerLabel,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 6),
                Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: colors.primary,
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
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(providerLabel,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: colors.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
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
      circleColor: '#353356',
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
      final displayName = provider['displayName'] as String? ?? 'Partner';
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
      return Stack(
        fit: StackFit.expand,
        children: [
          MapLibreMap(
            styleString: AppConfig.mapTilerStyleUrl,
            initialCameraPosition:
                CameraPosition(target: customerPoint, zoom: 13.5),
            onMapCreated: (value) => controller = value,
            onStyleLoadedCallback: () {
              if (mounted) {
                setState(() => styleLoaded = true);
              }
              unawaited(syncMarkers());
            },
            compassEnabled: false,
            logoEnabled: false,
            myLocationEnabled: false,
            rotateGesturesEnabled: false,
            tiltGesturesEnabled: false,
          ),
          if (!styleLoaded) const _MapLoadingSurface(),
        ],
      );
    }

    return _MapPlaceholder(
      customerLabel: 'You',
      providerLabel: '${widget.providers.length} partner(s)',
      showProviderMarker: widget.providers.isNotEmpty,
    );
  }
}

class _MapLoadingSurface extends StatelessWidget {
  const _MapLoadingSurface();

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return ColoredBox(
      color: colors.canvas,
      child: Center(
        child: SizedBox(
          width: 26,
          height: 26,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: colors.primary,
          ),
        ),
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
    final colors = context.handsColors;
    final initials = name.isEmpty
        ? 'P'
        : name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((word) => word.characters.first.toUpperCase())
            .join();

    return ClipRRect(
      borderRadius: BorderRadius.circular(CustomerRadii.card),
      child: Container(
        width: size,
        height: size,
        color: colors.photoMatte,
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
        color: context.handsColors.primary,
      ),
    );
  }
}

String? providerProfileImageUrl(Map<String, dynamic> provider) {
  final direct = provider['profileImageUrl']?.toString();
  if (direct != null && direct.isNotEmpty) {
    return customerAccessibleMediaUrl(direct);
  }

  final gallery = provider['galleryImageUrls'];
  if (gallery is List && gallery.isNotEmpty) {
    final first = gallery.first?.toString();
    if (first != null && first.isNotEmpty) {
      return customerAccessibleMediaUrl(first);
    }
  }
  return null;
}

String customerAccessibleMediaUrl(String value) {
  if (kReleaseMode) {
    return value;
  }

  final mediaUri = Uri.tryParse(value);
  final apiUri = Uri.tryParse(AppConfig.apiBaseUrl);
  if (mediaUri == null || apiUri == null || apiUri.host.isEmpty) {
    return value;
  }

  const localHosts = {'localhost', '0.0.0.0', '127.0.0.1', '::1'};
  if (!localHosts.contains(mediaUri.host.toLowerCase()) ||
      localHosts.contains(apiUri.host.toLowerCase())) {
    return value;
  }

  return mediaUri.replace(host: apiUri.host).toString();
}
