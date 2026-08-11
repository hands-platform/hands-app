import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class WalletSettlementChecklist extends StatelessWidget {
  const WalletSettlementChecklist({super.key, required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle_outline, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(item, style: theme.textTheme.bodySmall)),
              ],
            ),
          ),
      ],
    );
  }
}

class WalletSettlementReferenceCard extends StatelessWidget {
  const WalletSettlementReferenceCard({
    super.key,
    required this.reference,
    required this.amountLabel,
  });

  final String reference;
  final String amountLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.72),
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Mã thanh toán',
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          SelectableText(
            reference,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Số tiền nộp hoặc bù trừ: $amountLabel',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: reference));
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Đã sao chép mã thanh toán.'),
                  ),
                );
              },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('Sao chép mã'),
            ),
          ),
        ],
      ),
    );
  }
}
