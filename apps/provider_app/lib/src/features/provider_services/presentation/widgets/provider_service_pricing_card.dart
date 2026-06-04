import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/provider_service_price.dart';
import '../providers/provider_service_price_providers.dart';
import 'provider_service_price_formatters.dart';
import 'provider_service_price_sheet.dart';
import 'provider_service_pricing_notice.dart';

class ProviderServicePricingCard extends ConsumerStatefulWidget {
  const ProviderServicePricingCard({super.key});

  @override
  ConsumerState<ProviderServicePricingCard> createState() =>
      _ProviderServicePricingCardState();
}

class _ProviderServicePricingCardState
    extends ConsumerState<ProviderServicePricingCard> {
  late Future<List<ProviderServicePrice>> _future;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ProviderServicePrice>> _load() {
    return ref.read(providerServicePriceRepositoryProvider).listServices();
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _edit(ProviderServicePrice service) async {
    final input = await showProviderServicePriceSheet(context, service);
    if (input == null) return;
    setState(() {
      _saving = true;
    });
    try {
      await ref.read(providerServicePriceRepositoryProvider).updateService(
            serviceId: service.id,
            price: input.price,
            active: input.active,
          );
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${service.name} price saved')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Price update failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Service pricing',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: _saving ? null : _refresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh pricing',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Each service has time options such as 60, 90, and 120 minutes. Your customer price must stay above the HANDS minimum, follow 100.000 VND steps, and match an admin payout rule before customers can book it.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<ProviderServicePrice>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return PricingNotice(
                    icon: Icons.error_outline,
                    text: 'Pricing load failed: ${snapshot.error}',
                  );
                }
                final services = snapshot.data ?? const [];
                if (services.isEmpty) {
                  return const PricingNotice(
                    icon: Icons.spa_outlined,
                    text: 'No active services are configured yet.',
                  );
                }
                final groups = groupProviderServicePrices(services);
                return Column(
                  children: [
                    for (final group in groups)
                      _ProviderServicePriceGroupCard(
                        group: group,
                        saving: _saving,
                        onEdit: _edit,
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ProviderServicePriceGroupCard extends StatelessWidget {
  const _ProviderServicePriceGroupCard({
    required this.group,
    required this.saving,
    required this.onEdit,
  });

  final ProviderServicePriceGroup group;
  final bool saving;
  final ValueChanged<ProviderServicePrice> onEdit;

  @override
  Widget build(BuildContext context) {
    final missingStandardDurations = [60, 90, 120]
        .where((duration) => !group.options
            .where((option) => option.active)
            .map((option) => option.durationMin)
            .contains(duration))
        .toList();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(20),
          border:
              Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      group.name,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text('${group.activeOptionCount} active'),
                      ),
                      Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text(
                            '${group.payoutReadyOptionCount} payout ready'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Time options: ${group.durationSummary}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Each time option needs its own customer price and admin payout rule.',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: Colors.black54),
              ),
              if (missingStandardDurations.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Admin has not enabled ${missingStandardDurations.join('/')} min for this service yet.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.black54),
                ),
              ],
              if (group.payoutMissingOptionCount > 0) ...[
                const SizedBox(height: 6),
                Text(
                  '${group.payoutMissingOptionCount} active option(s) need an exact admin payout rule before partners can take bookings.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                ),
              ],
              const SizedBox(height: 8),
              for (final service in group.options)
                _ProviderServicePriceTile(
                  service: service,
                  saving: saving,
                  onEdit: () => onEdit(service),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderServicePriceTile extends StatelessWidget {
  const _ProviderServicePriceTile({
    required this.service,
    required this.saving,
    required this.onEdit,
  });

  final ProviderServicePrice service;
  final bool saving;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final availablePrices = service.bookablePayoutOptions
        .map((option) => formatVnd(option.customerPrice))
        .take(4)
        .join(', ');
    final payoutText = service.currentPriceBelowMinimum
        ? 'Price is below the HANDS minimum. Raise it before activation.'
        : service.currentPriceOffStep
            ? 'Price must use ${formatVnd(service.priceStep)} steps.'
            : (service.payoutRuleConfigured
                ? 'You receive ${formatVnd(service.providerPayoutAmount ?? 0)}'
                : 'Admin payout rule missing for ${formatVnd(service.effectivePrice)}');
    final statusText = service.active
        ? service.canActivateAtCurrentPrice
            ? 'Bookable'
            : 'Needs rule'
        : 'Paused';
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: service.active
              ? Theme.of(context).colorScheme.surfaceContainerHighest
              : Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: service.canActivateAtCurrentPrice
                ? Theme.of(context).colorScheme.outlineVariant
                : Theme.of(context).colorScheme.error.withValues(alpha: 0.45),
          ),
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          leading: CircleAvatar(
            child: Text('${service.durationMin}'),
          ),
          title: Text('${service.durationMin} min option'),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _PricingChip(
                        label: 'Min', value: formatVnd(service.basePrice)),
                    _PricingChip(
                      label: 'Step',
                      value: formatVnd(service.priceStep),
                    ),
                    _PricingChip(
                      label: statusText,
                      value: service.active && service.canActivateAtCurrentPrice
                          ? 'ON'
                          : 'OFF',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _ProviderServiceMoneyFlow(service: service),
                const SizedBox(height: 8),
                Text(payoutText),
                if (service.payoutRuleConfigured)
                  Text(
                    'VAT estimate ${formatVnd(service.estimatedVatAmount)} / other cost ${formatVnd(service.otherCostAmount ?? 0)}',
                  ),
                if (service.payoutRuleConfigured)
                  Text(
                    'Company net fee after costs ${formatVnd(service.estimatedCompanyFeeAfterCosts)}',
                  ),
                if (availablePrices.isNotEmpty)
                  Text(
                    'Bookable price options: $availablePrices${service.bookablePayoutOptions.length > 4 ? '...' : ''}',
                  ),
                if (!service.hasBookablePriceOptions)
                  Text(
                    'Not bookable until admin adds this duration and price to the payout matrix.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
              ],
            ),
          ),
          trailing: FilledButton.tonal(
            onPressed: saving ? null : onEdit,
            child: const Text('Edit'),
          ),
        ),
      ),
    );
  }
}

class _ProviderServiceMoneyFlow extends StatelessWidget {
  const _ProviderServiceMoneyFlow({required this.service});

  final ProviderServicePrice service;

  @override
  Widget build(BuildContext context) {
    final items = [
      _MoneyFlowItem(
        label: 'Customer pays',
        value: formatVnd(service.effectivePrice),
      ),
      _MoneyFlowItem(
        label: 'You receive',
        value: service.payoutRuleConfigured
            ? formatVnd(service.providerPayoutAmount ?? 0)
            : 'Rule needed',
      ),
      _MoneyFlowItem(
        label: 'HANDS fee',
        value: service.payoutRuleConfigured
            ? formatVnd(service.platformFee ?? 0)
            : 'Pending',
      ),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final item in items)
          DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context).colorScheme.outlineVariant,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.label,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.value,
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _MoneyFlowItem {
  const _MoneyFlowItem({required this.label, required this.value});

  final String label;
  final String value;
}

class _PricingChip extends StatelessWidget {
  const _PricingChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      visualDensity: VisualDensity.compact,
      label: Text('$label $value'),
    );
  }
}
