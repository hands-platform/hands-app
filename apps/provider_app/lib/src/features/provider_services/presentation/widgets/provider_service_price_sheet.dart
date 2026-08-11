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
          ? 'Cần quy tắc chi trả của quản trị viên đúng với ${formatVnd(_selectedPrice)}. Hãy chọn một trong các mức: $options.'
          : validationMessage == 'Giá phải từ mức tối thiểu của HANDS.'
              ? 'Giá phải từ ${formatVnd(service.basePrice)} trở lên.'
              : validationMessage == 'Giá phải theo bước VND đã cấu hình.'
                  ? 'Giá phải tăng theo bước ${formatVnd(service.priceStep)}.'
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
            '${service.name} / ${service.durationMin} phút',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          _PricingSummaryLine(
            label: 'Giá tối thiểu',
            value: formatVnd(service.basePrice),
          ),
          _PricingSummaryLine(
            label: 'Bước giá',
            value: formatVnd(service.priceStep),
          ),
          if (service.payoutRuleConfigured) ...[
            _PricingSummaryLine(
              label: 'Chi trả hiện tại',
              value: formatVnd(service.providerPayoutAmount ?? 0),
            ),
            _PricingSummaryLine(
              label: 'Phí HANDS hiện tại',
              value: formatVnd(service.platformFee ?? 0),
            ),
          ],
          if (service.bookablePayoutOptions.isNotEmpty)
            _PricingSummaryLine(
              label: 'Mức giá có thể đặt',
              value: service.bookablePayoutOptions
                  .map((option) => formatVnd(option.customerPrice))
                  .take(3)
                  .join(', '),
            ),
          const SizedBox(height: 14),
          Text(
            'Chọn giá cho khách hàng',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          if (!selectedPriceIsAvailable && service.effectivePrice > 0) ...[
            ChoiceChip(
              label: Text('Hiện tại ${formatVnd(service.effectivePrice)}'),
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
                      'Chưa có mức giá được phê duyệt. Hãy tạm dừng dịch vụ hoặc yêu cầu HANDS cấu hình mức chi trả.',
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
              label: Text('Dùng mức đề xuất ${formatVnd(recommendedPrice)}'),
            ),
          ],
          const SizedBox(height: 12),
          PricingNotice(
            icon: matchingRule
                ? Icons.fact_check_outlined
                : Icons.admin_panel_settings_outlined,
            text: matchingRule
                ? 'Mức giá này đã có quy tắc chi trả. Bạn nhận ${formatVnd(previewRule.providerPayoutAmount)} và phí HANDS là ${formatVnd(previewRule.platformFee)}.'
                : service.hasBookablePriceOptions
                    ? 'Dịch vụ đang bật phải dùng một trong các mức giá chi trả đã liệt kê. Chọn giá đề xuất hoặc lưu ở trạng thái tạm dừng.'
                    : 'Dịch vụ đang bật cần quy tắc chi trả chính xác. Hãy tạm dừng hoặc yêu cầu HANDS cấu hình mức giá này.',
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            value: _active,
            onChanged: (value) => setState(() => _active = value),
            title: const Text('Nhận đặt lịch cho dịch vụ này'),
            subtitle: const Text('Dịch vụ tắt sẽ không thể được đặt.'),
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
            label: const Text('Lưu giá'),
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
