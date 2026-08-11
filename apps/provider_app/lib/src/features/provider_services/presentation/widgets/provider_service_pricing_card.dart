import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../provider_profile/presentation/provider_error_helpers.dart';
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
          SnackBar(content: Text('Đã lưu giá ${service.name}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              providerAppErrorMessage(
                error,
                fallback: 'Không thể cập nhật giá dịch vụ.',
              ),
            ),
          ),
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
                    'Giá dịch vụ',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: _saving ? null : _refresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Làm mới giá',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Mỗi dịch vụ có các thời lượng như 60, 90 và 120 phút. Giá cho khách hàng phải từ mức tối thiểu của HANDS, theo bước 100.000 VND và khớp quy tắc chi trả trước khi có thể đặt.',
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
                    text: providerAppErrorMessage(
                      snapshot.error,
                      fallback: 'Không thể tải giá dịch vụ.',
                    ),
                  );
                }
                final services = snapshot.data ?? const [];
                if (services.isEmpty) {
                  return const PricingNotice(
                    icon: Icons.spa_outlined,
                    text: 'Chưa có dịch vụ nào được cấu hình.',
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
                        label: Text('${group.activeOptionCount} đang bật'),
                      ),
                      Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text(
                            '${group.payoutReadyOptionCount} sẵn sàng chi trả'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Thời lượng: ${group.durationSummary}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Mỗi thời lượng cần giá cho khách hàng và quy tắc chi trả riêng.',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: Colors.black54),
              ),
              if (missingStandardDurations.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'HANDS chưa bật thời lượng ${missingStandardDurations.join('/')} phút cho dịch vụ này.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.black54),
                ),
              ],
              if (group.payoutMissingOptionCount > 0) ...[
                const SizedBox(height: 6),
                Text(
                  '${group.payoutMissingOptionCount} lựa chọn đang bật cần quy tắc chi trả chính xác trước khi nhận đặt lịch.',
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
        ? 'Giá thấp hơn mức tối thiểu của HANDS. Hãy tăng giá trước khi bật.'
        : service.currentPriceOffStep
            ? 'Giá phải theo bước ${formatVnd(service.priceStep)}.'
            : (service.payoutRuleConfigured
                ? 'Bạn nhận ${formatVnd(service.providerPayoutAmount ?? 0)}'
                : 'Thiếu quy tắc chi trả cho ${formatVnd(service.effectivePrice)}');
    final statusText = service.active
        ? service.canActivateAtCurrentPrice
            ? 'Có thể đặt'
            : 'Cần quy tắc'
        : 'Đang tạm dừng';
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
          title: Text('Lựa chọn ${service.durationMin} phút'),
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
                        label: 'Tối thiểu',
                        value: formatVnd(service.basePrice)),
                    _PricingChip(
                      label: 'Bước giá',
                      value: formatVnd(service.priceStep),
                    ),
                    _PricingChip(
                      label: statusText,
                      value: service.active && service.canActivateAtCurrentPrice
                          ? 'BẬT'
                          : 'TẮT',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _ProviderServiceMoneyFlow(service: service),
                const SizedBox(height: 8),
                Text(payoutText),
                if (service.payoutRuleConfigured)
                  Text(
                    'VAT dự kiến ${formatVnd(service.estimatedVatAmount)} / chi phí khác ${formatVnd(service.otherCostAmount ?? 0)}',
                  ),
                if (service.payoutRuleConfigured)
                  Text(
                    'Phí ròng của công ty sau chi phí ${formatVnd(service.estimatedCompanyFeeAfterCosts)}',
                  ),
                if (availablePrices.isNotEmpty)
                  Text(
                    'Mức giá có thể đặt: $availablePrices${service.bookablePayoutOptions.length > 4 ? '...' : ''}',
                  ),
                if (!service.hasBookablePriceOptions)
                  Text(
                    'Chưa thể đặt cho đến khi HANDS thêm thời lượng và mức giá này vào bảng chi trả.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
              ],
            ),
          ),
          trailing: FilledButton.tonal(
            onPressed: saving ? null : onEdit,
            child: const Text('Chỉnh sửa'),
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
        label: 'Khách trả',
        value: formatVnd(service.effectivePrice),
      ),
      _MoneyFlowItem(
        label: 'Bạn nhận',
        value: service.payoutRuleConfigured
            ? formatVnd(service.providerPayoutAmount ?? 0)
            : 'Cần quy tắc',
      ),
      _MoneyFlowItem(
        label: 'Phí HANDS',
        value: service.payoutRuleConfigured
            ? formatVnd(service.platformFee ?? 0)
            : 'Đang chờ',
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
