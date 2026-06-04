import 'package:flutter/material.dart';

import '../../domain/entities/provider_service_price.dart';
import 'provider_service_price_formatters.dart';
import 'provider_service_pricing_notice.dart';

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
  late int _selectedPrice;
  late bool _active;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedPrice = widget.service.recommendedCustomerPrice ??
        widget.service.effectivePrice;
    _active = widget.service.active;
  }

  void _submit() {
    final service = widget.service;
    final validationMessage =
        service.validationMessageForPrice(_selectedPrice, active: _active);
    if (validationMessage != null) {
      final options = service.bookablePayoutOptions
          .map((option) => formatVnd(option.customerPrice))
          .join(', ');
      final detailedMessage = _active &&
              service.hasBookablePriceOptions &&
              service.bookablePayoutOptionForPrice(_selectedPrice) == null
          ? 'Admin payout rule is required for exactly ${formatVnd(_selectedPrice)}. Choose one of: $options.'
          : validationMessage == 'Price must be at least the HANDS minimum.'
              ? 'Price must be at least ${formatVnd(service.basePrice)}.'
              : validationMessage ==
                      'Price must follow the configured VND step.'
                  ? 'Price must increase by ${formatVnd(service.priceStep)} steps.'
                  : validationMessage;
      setState(() => _error = detailedMessage);
      return;
    }
    Navigator.of(context).pop(
      ProviderServicePriceInput(price: _selectedPrice, active: _active),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final service = widget.service;
    final priceOptions = service.bookablePayoutOptions;
    final selectedPriceIsAvailable = priceOptions.any(
      (option) => option.customerPrice == _selectedPrice,
    );
    final previewRule = service.bookablePayoutOptionForPrice(_selectedPrice);
    final matchingRule = previewRule != null;
    final recommendedPrice = service.recommendedCustomerPrice;
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
              label: 'Current partner payout',
              value: formatVnd(service.providerPayoutAmount ?? 0),
            ),
            _PricingSummaryLine(
              label: 'Current HANDS fee',
              value: formatVnd(service.platformFee ?? 0),
            ),
          ],
          if (service.bookablePayoutOptions.isNotEmpty)
            _PricingSummaryLine(
              label: 'Bookable price options',
              value: service.bookablePayoutOptions
                  .map((option) => formatVnd(option.customerPrice))
                  .take(3)
                  .join(', '),
            ),
          const SizedBox(height: 14),
          Text(
            'Choose customer price',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (!selectedPriceIsAvailable && service.effectivePrice > 0) ...[
            ChoiceChip(
              label: Text('Current ${formatVnd(service.effectivePrice)}'),
              selected: _selectedPrice == service.effectivePrice,
              onSelected: (_) => setState(() {
                _selectedPrice = service.effectivePrice;
                _error = null;
              }),
            ),
            const SizedBox(height: 8),
          ],
          DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Theme.of(context).colorScheme.outlineVariant,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: priceOptions.isEmpty
                  ? const Text(
                      'No admin-approved price is available yet. Save this service as paused or ask admin to configure the payout matrix.',
                    )
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final option in priceOptions)
                          ChoiceChip(
                            label: Text(formatVnd(option.customerPrice)),
                            selected: _selectedPrice == option.customerPrice,
                            onSelected: (_) => setState(() {
                              _selectedPrice = option.customerPrice;
                              _error = null;
                            }),
                          ),
                      ],
                    ),
            ),
          ),
          if (recommendedPrice != null &&
              recommendedPrice != _selectedPrice) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => setState(() {
                _selectedPrice = recommendedPrice;
                _error = null;
              }),
              icon: const Icon(Icons.recommend_outlined),
              label: Text('Use recommended ${formatVnd(recommendedPrice)}'),
            ),
          ],
          const SizedBox(height: 12),
          PricingNotice(
            icon: matchingRule
                ? Icons.fact_check_outlined
                : Icons.admin_panel_settings_outlined,
            text: matchingRule
                ? 'This price has an admin payout rule. You receive ${formatVnd(previewRule.providerPayoutAmount)} and HANDS fee is ${formatVnd(previewRule.platformFee)}.'
                : service.hasBookablePriceOptions
                    ? 'Active services require one of the listed admin payout prices. Pick a suggested price or save as paused.'
                    : 'Active services require an exact admin payout rule. Save as paused or ask admin to configure this price.',
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
