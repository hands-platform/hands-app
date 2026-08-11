import 'package:flutter/material.dart';

import 'provider_wallet_gate_helpers.dart';
import 'provider_wallet_settlement_widgets.dart';

Future<void> showProviderWalletSettlementDialog({
  required BuildContext context,
  required Map<String, dynamic> summary,
  required VoidCallback onRefresh,
}) async {
  final settlementView = ProviderWalletSettlementView.fromSummary(summary);

  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      final theme = Theme.of(dialogContext);
      return AlertDialog(
        icon: const Icon(Icons.lock_outline),
        title: const Text('Cần thanh toán phí'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                settlementView.reasonLabel,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              Text(
                'Bạn không thể tham gia đặt lịch công khai cho đến khi thanh toán phí HANDS còn thiếu.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              Text(
                'Số tiền cần thanh toán: ${settlementView.amountLabel}',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(settlementView.instruction),
              if (settlementView.reference != null) ...[
                const SizedBox(height: 12),
                WalletSettlementReferenceCard(
                  reference: settlementView.reference!,
                  amountLabel: settlementView.amountLabel,
                ),
              ],
              const SizedBox(height: 12),
              WalletSettlementChecklist(items: settlementView.steps),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Đóng'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              onRefresh();
            },
            icon: const Icon(Icons.refresh),
            label: const Text('Làm mới ví'),
          ),
        ],
      );
    },
  );
}
