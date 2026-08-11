import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/customer_design_system.dart';
import '../../../core/customer_value_helpers.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';

List<Map<String, dynamic>> sortNearbyProvidersByDistance(
  Iterable<dynamic> providers,
) {
  final sorted = providers
      .whereType<Map>()
      .map((provider) => Map<String, dynamic>.from(provider))
      .toList();
  sorted.sort((left, right) {
    final leftDistance = asDouble(left['distanceMeters']);
    final rightDistance = asDouble(right['distanceMeters']);
    if (leftDistance == null && rightDistance == null) return 0;
    if (leftDistance == null) return 1;
    if (rightDistance == null) return -1;
    return leftDistance.compareTo(rightDistance);
  });
  return sorted;
}

enum CustomerProviderSort { nearest, mostBooked }

List<Map<String, dynamic>> filterCustomerProviders(
  Iterable<dynamic> providers, {
  String query = '',
  String? serviceKey,
  Set<String> favoriteProviderIds = const {},
  bool favoritesOnly = false,
  CustomerProviderSort sort = CustomerProviderSort.nearest,
}) {
  final normalizedQuery = query.trim().toLowerCase();
  final filtered = providers
      .whereType<Map>()
      .map(Map<String, dynamic>.from)
      .where((provider) {
    if (favoritesOnly &&
        !favoriteProviderIds.contains(provider['id']?.toString())) {
      return false;
    }
    final services =
        provider['services'] is List ? provider['services'] as List : const [];
    if (serviceKey != null &&
        !services.any((item) => _providerServiceKey(item) == serviceKey)) {
      return false;
    }
    if (normalizedQuery.isEmpty) return true;
    final searchable = [
      provider['displayName'],
      provider['city'],
      ...services.map((item) => _providerServiceLabel(item)),
    ].whereType<Object>().join(' ').toLowerCase();
    return searchable.contains(normalizedQuery);
  }).toList();

  filtered.sort((left, right) {
    if (sort == CustomerProviderSort.mostBooked) {
      final countComparison =
          (asNum(right['completedBookingCount'])?.toInt() ?? 0)
              .compareTo(asNum(left['completedBookingCount'])?.toInt() ?? 0);
      if (countComparison != 0) return countComparison;
    }
    final leftDistance = asDouble(left['distanceMeters']);
    final rightDistance = asDouble(right['distanceMeters']);
    if (leftDistance == null && rightDistance == null) return 0;
    if (leftDistance == null) return 1;
    if (rightDistance == null) return -1;
    return leftDistance.compareTo(rightDistance);
  });
  return filtered;
}

Map<String, String> customerProviderServiceFilters(
    Iterable<dynamic> providers) {
  final options = <String, String>{};
  for (final provider in providers.whereType<Map>()) {
    final services = provider['services'];
    if (services is! List) continue;
    for (final service in services) {
      final key = _providerServiceKey(service);
      final label = _providerServiceLabel(service);
      if (key != null && label != null) options[key] = label;
    }
  }
  return Map.fromEntries(
      options.entries.toList()..sort((a, b) => a.value.compareTo(b.value)));
}

String? _providerServiceKey(dynamic value) {
  if (value is! Map) return null;
  final service = value['service'] is Map ? value['service'] as Map : value;
  return (service['serviceGroupKey'] ?? service['id'] ?? service['name'])
      ?.toString();
}

String? _providerServiceLabel(dynamic value) {
  if (value is! Map) return null;
  final service = value['service'] is Map ? value['service'] as Map : value;
  return service['name']?.toString();
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
    final title = isDemoLocation ? 'Choose service address' : 'Service address';
    final subtitle = isDemoLocation
        ? 'Browse partners from anywhere. Choose a Vietnam service pin before booking.'
        : addressText;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
                  label: const Text('Change'),
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
                  ?.copyWith(color: context.handsColors.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class HandsPortraitStage extends StatelessWidget {
  const HandsPortraitStage({
    super.key,
    required this.name,
    this.imageUrl,
    this.width,
    this.height,
    this.borderRadius,
  });

  final String name;
  final String? imageUrl;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final radius = borderRadius ??
        HandsShapes.portrait(textDirection: Directionality.of(context));
    final source = imageUrl?.trim() ?? '';

    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: width,
        height: height,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.photoMatte),
          child: source.isEmpty
              ? _PortraitInitials(name: name)
              : Stack(
                  fit: StackFit.expand,
                  children: [
                    ImageFiltered(
                      imageFilter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: ColorFiltered(
                        colorFilter: const ColorFilter.matrix(<double>[
                          0.55,
                          0.35,
                          0.10,
                          0,
                          0,
                          0.10,
                          0.75,
                          0.15,
                          0,
                          0,
                          0.10,
                          0.35,
                          0.55,
                          0,
                          0,
                          0,
                          0,
                          0,
                          1,
                          0,
                        ]),
                        child: Image.network(
                          source,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              _PortraitInitials(name: name),
                        ),
                      ),
                    ),
                    ColoredBox(
                      color: colors.sand.withValues(alpha: 0.07),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(2),
                      child: Image.network(
                        source,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                            _PortraitInitials(name: name),
                      ),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: radius,
                        border: Border.all(
                          color: colors.ink.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _PortraitInitials extends StatelessWidget {
  const _PortraitInitials({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final words =
        name.trim().split(RegExp(r'\s+')).where((word) => word.isNotEmpty);
    final initials = words.take(2).map((word) => word.characters.first).join();
    return ColoredBox(
      color: colors.photoMatte,
      child: Center(
        child: Text(
          initials.isEmpty ? 'H' : initials.toUpperCase(),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class HandsPartnerRow extends StatelessWidget {
  const HandsPartnerRow({
    super.key,
    required this.provider,
    required this.onTap,
  });

  final Map<String, dynamic> provider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final displayName = provider['displayName'] as String? ?? 'Partner';
    final distanceMeters = asDouble(provider['distanceMeters']);
    final rating = providerAverageRating(provider);
    final reviewCount = providerReviewCount(provider);
    final availableNow = provider['status'] == 'ONLINE_AVAILABLE';
    final bookableServiceCount =
        asNum(provider['bookableServiceCount'])?.toInt();
    final hasBookableServices =
        bookableServiceCount == null || bookableServiceCount > 0;
    final startingPrice = asNum(provider['startingPrice'])?.toInt();
    final startingDuration = asNum(provider['startingDurationMin'])?.toInt();
    final width = MediaQuery.sizeOf(context).width >= 400 ? 136.0 : 128.0;
    final height = width * 1.25;
    final metadata = [
      '${rating.toStringAsFixed(1)} ($reviewCount)',
      formatDistance(distanceMeters),
      providerLocationFreshnessLabel(provider),
    ].join(' · ');
    final serviceSummary = hasBookableServices
        ? [
            if (startingPrice != null)
              'From ${formatCurrency(startingPrice)} VND',
            if (startingDuration != null) '$startingDuration min',
            if (bookableServiceCount != null)
              '$bookableServiceCount option${bookableServiceCount == 1 ? '' : 's'}',
          ].join(' · ')
        : 'No bookable services yet';

    return Column(
      children: [
        Semantics(
          button: true,
          label: 'Open $displayName',
          child: InkWell(
            onTap: hasBookableServices ? onTap : null,
            borderRadius: BorderRadius.circular(HandsShapes.medium),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                vertical: HandsSpacing.space12,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  HandsPortraitStage(
                    name: displayName,
                    imageUrl: providerProfileImageUrl(provider),
                    width: width,
                    height: height,
                  ),
                  const SizedBox(width: HandsSpacing.space16),
                  Expanded(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: height),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            displayName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: HandsSpacing.space8),
                          Row(
                            children: [
                              Icon(
                                Icons.star_rounded,
                                size: HandsIconTheme.metadata,
                                color: colors.primary,
                              ),
                              const SizedBox(width: HandsSpacing.space4),
                              Expanded(
                                child: Text(
                                  metadata,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(color: colors.inkMuted),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: HandsSpacing.space8),
                          Text(
                            serviceSummary,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .labelLarge
                                ?.copyWith(
                                  color: hasBookableServices
                                      ? colors.ink
                                      : colors.error,
                                ),
                          ),
                          const SizedBox(height: HandsSpacing.space12),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: availableNow
                                  ? colors.primarySoft
                                  : colors.surfaceMuted,
                              borderRadius:
                                  BorderRadius.circular(HandsShapes.full),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: HandsSpacing.space12,
                                vertical: HandsSpacing.space4,
                              ),
                              child: Text(
                                availableNow
                                    ? 'Available now'
                                    : 'Available soon',
                                style: Theme.of(context)
                                    .textTheme
                                    .labelMedium
                                    ?.copyWith(
                                      color: availableNow
                                          ? colors.primary
                                          : colors.inkMuted,
                                    ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: HandsSpacing.space8),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: HandsIconTheme.inline,
                    color: colors.inkMuted,
                  ),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.only(left: width + HandsSpacing.space16),
          child: Divider(color: colors.outline),
        ),
      ],
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
    return HandsPartnerRow(provider: provider, onTap: onTap);
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
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        border: Border.all(color: colors.outline),
        borderRadius: BorderRadius.circular(22),
        color: colors.surface,
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
