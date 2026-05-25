import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/provider_service_price.dart';
import '../providers/provider_service_price_providers.dart';

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
              'Set prices at or above the HANDS minimum. Prices must use 100.000 VND steps and need an admin payout rule before activation.',
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
                  return _PricingNotice(
                    icon: Icons.error_outline,
                    text: 'Pricing load failed: ${snapshot.error}',
                  );
                }
                final services = snapshot.data ?? const [];
                if (services.isEmpty) {
                  return const _PricingNotice(
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
                  Chip(
                    visualDensity: VisualDensity.compact,
                    label: Text('${group.activeOptionCount} active'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${group.durationSummary} option(s)',
                style: Theme.of(context).textTheme.bodyMedium,
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
    final platformFee = service.platformFee ?? 0;
    final availablePrices = service.payoutOptions
        .map((option) => formatVnd(option.customerPrice))
        .take(4)
        .join(', ');
    final payoutText = service.payoutRuleConfigured
        ? 'You receive ${formatVnd(service.providerPayoutAmount ?? 0)}'
        : 'Admin payout rule missing for ${formatVnd(service.effectivePrice)}';
    final statusText = service.active ? 'Bookable' : 'Paused';
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: service.active
              ? Theme.of(context).colorScheme.surfaceContainerHighest
              : Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: service.payoutRuleConfigured
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
                      value: service.active ? 'ON' : 'OFF',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text('Customer price ${formatVnd(service.effectivePrice)}'),
                Text(payoutText),
                Text('HANDS fee ${formatVnd(platformFee)}'),
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
                    'Bookable price options: $availablePrices${service.payoutOptions.length > 4 ? '...' : ''}',
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

class _PricingNotice extends StatelessWidget {
  const _PricingNotice({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 10),
            Expanded(child: Text(text)),
          ],
        ),
      ),
    );
  }
}

class ProviderServicePriceInput {
  const ProviderServicePriceInput({
    required this.price,
    required this.active,
  });

  final int price;
  final bool active;
}

Future<ProviderServicePriceInput?> showProviderServicePriceSheet(
  BuildContext context,
  ProviderServicePrice service,
) {
  return showModalBottomSheet<ProviderServicePriceInput>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ProviderServicePriceSheet(service: service),
  );
}

class _ProviderServicePriceSheet extends StatefulWidget {
  const _ProviderServicePriceSheet({required this.service});

  final ProviderServicePrice service;

  @override
  State<_ProviderServicePriceSheet> createState() =>
      _ProviderServicePriceSheetState();
}

class _ProviderServicePriceSheetState
    extends State<_ProviderServicePriceSheet> {
  late final TextEditingController _priceController;
  late bool _active;
  String? _error;

  @override
  void initState() {
    super.initState();
    _priceController = TextEditingController(
      text: widget.service.effectivePrice.toString(),
    );
    _active = widget.service.active;
  }

  @override
  void dispose() {
    _priceController.dispose();
    super.dispose();
  }

  void _submit() {
    final price = int.tryParse(
      _priceController.text.replaceAll(RegExp(r'[^0-9]'), ''),
    );
    final service = widget.service;
    if (price == null) {
      setState(() => _error = 'Enter a valid VND amount.');
      return;
    }
    if (price < service.basePrice) {
      setState(() =>
          _error = 'Price must be at least ${formatVnd(service.basePrice)}.');
      return;
    }
    if (price % service.priceStep != 0) {
      setState(() => _error =
          'Price must increase by ${formatVnd(service.priceStep)} steps.');
      return;
    }
    Navigator.of(context).pop(
      ProviderServicePriceInput(price: price, active: _active),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final service = widget.service;
    final previewPrice = int.tryParse(
          _priceController.text.replaceAll(RegExp(r'[^0-9]'), ''),
        ) ??
        service.effectivePrice;
    final matchingRule = service.payoutOptions
        .any((option) => option.customerPrice == previewPrice);
    final previewRule = matchingRule
        ? service.payoutOptions
            .firstWhere((option) => option.customerPrice == previewPrice)
        : null;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${service.name} / ${service.durationMin} min',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          _PricingSummaryLine(
            label: 'Admin minimum',
            value: formatVnd(service.basePrice),
          ),
          _PricingSummaryLine(
            label: 'Allowed step',
            value: formatVnd(service.priceStep),
          ),
          if (service.payoutRuleConfigured) ...[
            _PricingSummaryLine(
              label: 'Current provider payout',
              value: formatVnd(service.providerPayoutAmount ?? 0),
            ),
            _PricingSummaryLine(
              label: 'Current HANDS fee',
              value: formatVnd(service.platformFee ?? 0),
            ),
          ],
          if (service.payoutOptions.isNotEmpty)
            _PricingSummaryLine(
              label: 'Bookable price options',
              value: service.payoutOptions
                  .map((option) => formatVnd(option.customerPrice))
                  .take(3)
                  .join(', '),
            ),
          const SizedBox(height: 14),
          TextField(
            controller: _priceController,
            onChanged: (_) => setState(() => _error = null),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Your customer price',
              suffixText: 'VND',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          _PricingNotice(
            icon: matchingRule
                ? Icons.fact_check_outlined
                : Icons.admin_panel_settings_outlined,
            text: matchingRule
                ? 'This price has an admin payout rule. You receive ${formatVnd(previewRule?.providerPayoutAmount ?? 0)} and HANDS fee is ${formatVnd(previewRule?.platformFee ?? 0)}.'
                : 'If this exact price does not have an admin payout rule, activation will be blocked until admin configures it.',
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            value: _active,
            onChanged: (value) => setState(() => _active = value),
            title: const Text('Accept bookings for this service'),
            subtitle: const Text('Inactive services will not be bookable.'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.save_outlined),
            label: const Text('Save price'),
          ),
        ],
      ),
    );
  }
}

class _PricingSummaryLine extends StatelessWidget {
  const _PricingSummaryLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

String formatVnd(int value) {
  final raw = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < raw.length; i++) {
    final indexFromEnd = raw.length - i;
    buffer.write(raw[i]);
    if (indexFromEnd > 1 && indexFromEnd % 3 == 1) {
      buffer.write('.');
    }
  }
  return '${buffer.toString()} VND';
}
