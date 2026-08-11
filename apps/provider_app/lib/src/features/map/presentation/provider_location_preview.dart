import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../core/app_config.dart';

class ProviderLocationPreviewCard extends StatelessWidget {
  const ProviderLocationPreviewCard({
    super.key,
    required this.customerLatitude,
    required this.customerLongitude,
    required this.latitude,
    required this.longitude,
    required this.lastSharedAt,
  });

  final double? customerLatitude;
  final double? customerLongitude;
  final double? latitude;
  final double? longitude;
  final DateTime? lastSharedAt;

  @override
  Widget build(BuildContext context) {
    final hasLocation = latitude != null && longitude != null;
    final statusColor = hasLocation ? const Color(0xFF5E8E4A) : Colors.black54;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Vị trí đã chia sẻ',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: SizedBox(
                height: 180,
                child: ProviderMapSurface(
                  customerLatitude: customerLatitude,
                  customerLongitude: customerLongitude,
                  providerLatitude: latitude,
                  providerLongitude: longitude,
                  fallbackShowProviderPin: hasLocation,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderStatusChip(
                  label: hasLocation
                      ? 'Đã chia sẻ ${formatProviderSharedAt(lastSharedAt)}'
                      : 'Chưa chia sẻ',
                  color: statusColor,
                ),
                if (hasLocation)
                  ProviderStatusChip(
                    label:
                        'Vĩ độ ${formatCoordinate(latitude)} / Kinh độ ${formatCoordinate(longitude)}',
                    color: Colors.black87,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              buildProviderLocationSummary(
                customerLatitude: customerLatitude,
                customerLongitude: customerLongitude,
                providerLatitude: latitude,
                providerLongitude: longitude,
                lastSharedAt: lastSharedAt,
              ),
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

class ProviderStatusChip extends StatelessWidget {
  const ProviderStatusChip({
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

class ProviderMapSurface extends StatefulWidget {
  const ProviderMapSurface({
    super.key,
    required this.customerLatitude,
    required this.customerLongitude,
    required this.providerLatitude,
    required this.providerLongitude,
    required this.fallbackShowProviderPin,
  });

  final double? customerLatitude;
  final double? customerLongitude;
  final double? providerLatitude;
  final double? providerLongitude;
  final bool fallbackShowProviderPin;

  @override
  State<ProviderMapSurface> createState() => _ProviderMapSurfaceState();
}

class _ProviderMapSurfaceState extends State<ProviderMapSurface> {
  MapLibreMapController? controller;
  bool styleLoaded = false;

  @override
  void didUpdateWidget(covariant ProviderMapSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (styleLoaded) {
      unawaited(syncMarkers());
    }
  }

  LatLng? get customerPoint =>
      widget.customerLatitude == null || widget.customerLongitude == null
          ? null
          : LatLng(widget.customerLatitude!, widget.customerLongitude!);

  LatLng? get providerPoint =>
      widget.providerLatitude == null || widget.providerLongitude == null
          ? null
          : LatLng(widget.providerLatitude!, widget.providerLongitude!);

  Future<void> syncMarkers() async {
    final map = controller;
    final customer = customerPoint;
    if (map == null || !styleLoaded || customer == null) {
      return;
    }
    await map.clearCircles();
    await map.clearSymbols();
    await map.addCircle(
      CircleOptions(
        geometry: customer,
        circleColor: '#5E8E4A',
        circleRadius: 8,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 2,
      ),
    );
    await map.addSymbol(
      SymbolOptions(
        geometry: customer,
        textField: 'Khách hàng',
        textSize: 13,
        textColor: '#111827',
        textHaloColor: '#FFFFFF',
        textHaloWidth: 1.5,
        textOffset: const Offset(0, -1.2),
      ),
    );

    final provider = providerPoint;
    if (provider != null) {
      await map.addCircle(
        CircleOptions(
          geometry: provider,
          circleColor: '#E84B4B',
          circleRadius: 8,
          circleStrokeColor: '#FFFFFF',
          circleStrokeWidth: 2,
        ),
      );
      await map.addSymbol(
        SymbolOptions(
          geometry: provider,
          textField: 'Bạn',
          textSize: 13,
          textColor: '#111827',
          textHaloColor: '#FFFFFF',
          textHaloWidth: 1.5,
          textOffset: const Offset(0, -1.2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final customer = customerPoint;
    final provider = providerPoint;
    if (AppConfig.mapTilerEnabled && customer != null) {
      return MapLibreMap(
        styleString: AppConfig.mapTilerStyleUrl,
        initialCameraPosition: CameraPosition(
          target: provider ?? customer,
          zoom: provider == null ? 13.8 : 12.8,
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

    return _ProviderMapPlaceholder(
      showProviderPin: widget.fallbackShowProviderPin,
    );
  }
}

class _ProviderMapPlaceholder extends StatelessWidget {
  const _ProviderMapPlaceholder({
    required this.showProviderPin,
  });

  final bool showProviderPin;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFD8F1DF),
            Color(0xFFF0E7D7),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: ProviderMapPainter())),
          Align(
            alignment: const Alignment(-0.25, -0.08),
            child: _MapPinChip(
              label: 'Khách hàng',
              color: const Color(0xFF5E8E4A),
            ),
          ),
          if (showProviderPin)
            Align(
              alignment: const Alignment(0.36, -0.34),
              child: _MapPinChip(
                label: 'Bạn',
                color: const Color(0xFFE84B4B),
              ),
            ),
          Align(
            alignment: const Alignment(-0.22, -0.04),
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

class _MapPinChip extends StatelessWidget {
  const _MapPinChip({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}

class ProviderMapPainter extends CustomPainter {
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
      ..moveTo(size.width * 0.12, size.height * 0.68)
      ..quadraticBezierTo(
        size.width * 0.34,
        size.height * 0.56,
        size.width * 0.48,
        size.height * 0.38,
      )
      ..quadraticBezierTo(
        size.width * 0.7,
        size.height * 0.18,
        size.width * 0.9,
        size.height * 0.22,
      );
    canvas.drawPath(mainRoad, roadPaint);

    final branch = Path()
      ..moveTo(size.width * 0.44, size.height * 0.56)
      ..quadraticBezierTo(
        size.width * 0.34,
        size.height * 0.42,
        size.width * 0.24,
        size.height * 0.24,
      );
    canvas.drawPath(branch, thinPaint);

    final branchTwo = Path()
      ..moveTo(size.width * 0.56, size.height * 0.44)
      ..quadraticBezierTo(
        size.width * 0.66,
        size.height * 0.58,
        size.width * 0.8,
        size.height * 0.74,
      );
    canvas.drawPath(branchTwo, thinPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

String formatCoordinate(double? value) {
  if (value == null) {
    return '-';
  }
  return value.toStringAsFixed(4);
}

String buildProviderLocationSummary({
  required double? customerLatitude,
  required double? customerLongitude,
  required double? providerLatitude,
  required double? providerLongitude,
  required DateTime? lastSharedAt,
}) {
  if (providerLatitude == null || providerLongitude == null) {
    return 'Chia sẻ vị trí hiện tại để khách hàng thấy vị trí gần nhất của bạn.';
  }

  final distance = approximateDistanceMeters(
    customerLatitude,
    customerLongitude,
    providerLatitude,
    providerLongitude,
  );
  final distanceText = distance == null
      ? ''
      : '\nKhoảng cách ước tính đến khách hàng: ${formatDistance(distance)}';
  return 'Khách hàng thấy vị trí đã lưu này, không phải theo dõi liên tục. Chia sẻ lần cuối ${formatProviderSharedAt(lastSharedAt)}.$distanceText';
}

String formatProviderSharedAt(DateTime? value) {
  if (value == null) {
    return 'vừa xong';
  }
  final diff = DateTime.now().difference(value);
  if (diff.inMinutes < 1) {
    return 'vừa xong';
  }
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes} phút trước';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours} giờ trước';
  }
  return '${diff.inDays} ngày trước';
}

String formatDistance(double meters) {
  if (meters >= 1000) {
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }
  return '${meters.round()} m';
}

double? approximateDistanceMeters(
  double? startLat,
  double? startLng,
  double? endLat,
  double? endLng,
) {
  if (startLat == null ||
      startLng == null ||
      endLat == null ||
      endLng == null) {
    return null;
  }
  const earthRadiusMeters = 6371000.0;
  final lat1 = _degreesToRadians(startLat);
  final lat2 = _degreesToRadians(endLat);
  final deltaLat = _degreesToRadians(endLat - startLat);
  final deltaLng = _degreesToRadians(endLng - startLng);
  final haversine = math.sin(deltaLat / 2) * math.sin(deltaLat / 2) +
      math.cos(lat1) *
          math.cos(lat2) *
          math.sin(deltaLng / 2) *
          math.sin(deltaLng / 2);
  return earthRadiusMeters *
      2 *
      math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine));
}

double _degreesToRadians(double degrees) => degrees * math.pi / 180;
