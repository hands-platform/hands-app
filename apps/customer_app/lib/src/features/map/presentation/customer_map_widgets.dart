import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../app_state.dart';
import '../../../core/app_config.dart';
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
        setState(() => error = '$exception');
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
      statusMessage = location.isDemoLocation
          ? 'GPS unavailable or outside Vietnam. You can browse partners from anywhere, but booking needs a Vietnam service pin.'
          : 'Current GPS location loaded. Drag the map to fine tune the pin.';
    });
    if (location.isDemoLocation == false) {
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
      providerLabel: '${widget.providers.length} partner(s)',
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
