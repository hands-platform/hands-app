import 'package:flutter/material.dart';

import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../earnings/presentation/provider_wallet_settlement_widgets.dart';
import 'provider_request_common_widgets.dart';

class RequestFlowBar extends StatelessWidget {
  const RequestFlowBar({super.key, required this.activeStep});

  final int activeStep;

  @override
  Widget build(BuildContext context) {
    final steps = ['Online', 'Request', 'Accept', 'Chat'];
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
                label: 'Queue',
                value: '$totalRequests active',
                tone: const Color(0xFFEAF2FF),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Direct',
                value: '$preferredRequests first-pick',
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
                label: 'Marketplace',
                value: '$marketplaceRequests standby',
                tone: const Color(0xFFFBF0DE),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: RequestSummaryCard(
                label: 'Chat',
                value: '$chatReady ready',
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
                  'Checking wallet settlement before marketplace participation.',
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
                        ? 'Wallet settlement required'
                        : 'Wallet clear',
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
                  : 'You can join marketplace and direct booking requests.',
            ),
            if (settlementView.blocked) ...[
              const SizedBox(height: 8),
              Text(
                'Amount to settle: ${settlementView.amountLabel}',
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
                label: const Text('Refresh wallet status'),
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                'Wallet status could not be refreshed. Booking actions will still show the server decision.',
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
