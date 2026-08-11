import 'package:flutter/material.dart';

import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../earnings/presentation/provider_wallet_settlement_widgets.dart';
import 'provider_request_common_widgets.dart';

class RequestFlowBar extends StatelessWidget {
  const RequestFlowBar({super.key, required this.activeStep});

  final int activeStep;

  @override
  Widget build(BuildContext context) {
    final steps = ['Trực tuyến', 'Yêu cầu', 'Chấp nhận', 'Trò chuyện'];
    return Row(
      children: [
        for (var index = 0; index < steps.length; index++)
          Expanded(
            child: Padding(
              padding:
                  EdgeInsets.only(right: index == steps.length - 1 ? 0 : 6),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: index <= activeStep
                      ? Theme.of(context).colorScheme.primaryContainer
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(steps[index], textAlign: TextAlign.center),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class RequestQueueSummary extends StatelessWidget {
  const RequestQueueSummary({
    super.key,
    required this.totalRequests,
    required this.preferredRequests,
    required this.marketplaceRequests,
    required this.chatReady,
  });

  final int totalRequests;
  final int preferredRequests;
  final int marketplaceRequests;
  final int chatReady;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: RequestSummaryCard(
                label: 'Hàng chờ',
                value: '$totalRequests đang mở',
                tone: const Color(0xFFEAF2FF),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Trực tiếp',
                value: '$preferredRequests yêu cầu',
                tone: const Color(0xFFEAF5E3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: RequestSummaryCard(
                label: 'Công khai',
                value: '$marketplaceRequests yêu cầu',
                tone: const Color(0xFFFBF0DE),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Trò chuyện',
                value: '$chatReady sẵn sàng',
                tone: const Color(0xFFF2EAFE),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class ProviderWalletGateCard extends StatelessWidget {
  const ProviderWalletGateCard({
    super.key,
    required this.summary,
    required this.isLoading,
    required this.onRefresh,
    this.error,
  });

  final Map<String, dynamic> summary;
  final bool isLoading;
  final VoidCallback onRefresh;
  final Object? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final settlementView = ProviderWalletSettlementView.fromSummary(summary);

    if (isLoading) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Đang kiểm tra thanh toán ví trước khi tham gia đặt lịch công khai.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      color: settlementView.blocked
          ? colorScheme.errorContainer
          : colorScheme.primaryContainer.withValues(alpha: 0.55),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  settlementView.blocked
                      ? Icons.lock_outline
                      : Icons.account_balance_wallet_outlined,
                  color: settlementView.blocked
                      ? colorScheme.onErrorContainer
                      : colorScheme.onPrimaryContainer,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    settlementView.blocked
                        ? 'Cần thanh toán ví'
                        : 'Ví đã thanh toán',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  settlementView.balanceLabel,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              settlementView.statusLabel,
              style: theme.textTheme.labelLarge?.copyWith(
                color: settlementView.blocked
                    ? colorScheme.onErrorContainer
                    : colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              settlementView.blocked
                  ? settlementView.reasonLabel
                  : 'Bạn có thể tham gia yêu cầu công khai và nhận yêu cầu trực tiếp.',
            ),
            if (settlementView.blocked) ...[
              const SizedBox(height: 8),
              Text(
                'Số tiền cần thanh toán: ${settlementView.amountLabel}',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(settlementView.instruction),
              if (settlementView.reference != null) ...[
                const SizedBox(height: 10),
                WalletSettlementReferenceCard(
                  reference: settlementView.reference!,
                  amountLabel: settlementView.amountLabel,
                ),
              ],
              const SizedBox(height: 10),
              WalletSettlementChecklist(items: settlementView.steps),
              const SizedBox(height: 10),
              FilledButton.tonalIcon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Làm mới trạng thái ví'),
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                'Không thể làm mới trạng thái ví. Thao tác đặt lịch vẫn hiển thị quyết định từ máy chủ.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
