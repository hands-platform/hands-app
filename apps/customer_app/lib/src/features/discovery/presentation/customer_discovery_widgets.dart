import 'package:flutter/material.dart';

import '../../../core/customer_value_helpers.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';

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
