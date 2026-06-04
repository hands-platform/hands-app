import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../earnings/presentation/provider_wallet_settlement_widgets.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_booking_service_helpers.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_guidance_helpers.dart';

class PartnerJobsSummary extends StatelessWidget {
  const PartnerJobsSummary({
    super.key,
    required this.active,
    required this.completed,
    required this.closed,
  });

  final int active;
  final int completed;
  final int closed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Active',
              value: '$active live',
              tone: const Color(0xFFEAF2FF)),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Done',
              value: '$completed complete',
              tone: const Color(0xFFEAF5E3)),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
              label: 'Closed',
              value: '$closed closed',
              tone: const Color(0xFFF8ECD4)),
        ),
      ],
    );
  }
}

class PartnerJobsCard extends StatelessWidget {
  const PartnerJobsCard({super.key, required this.booking});

  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final service = providerBookingService(booking);
    final address = asMap(booking['address']);
    final payment = asMap(booking['payment']);
    final selectedProvider = asMap(booking['selectedProvider']);
    final isAssigned = selectedProvider != null;
    final amount = payment?['amount'] ?? service?['basePrice'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.event_available_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    providerServiceOptionLabel(service),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                ProviderRequestTag(
                    label: booking['status']?.toString() ?? 'UNKNOWN',
                    highlighted: isAssigned),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderRequestTag(
                    label:
                        'Opened ${formatRequestOpenedMoment(booking['createdAt'] ?? booking['scheduledStartAt'])}'),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(label: '${formatCurrency(amount)} VND'),
                ProviderRequestTag(
                    label: payment?['status']?.toString() ?? 'NO_PAYMENT'),
              ],
            ),
            const SizedBox(height: 10),
            Text(address?['line1']?.toString() ?? 'Guest address pending'),
            const SizedBox(height: 6),
            Text(
              partnerJobNextAction(booking),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}

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
    required this.backupRequests,
    required this.chatReady,
  });

  final int totalRequests;
  final int preferredRequests;
  final int backupRequests;
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
                value: '$backupRequests standby',
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

class RequestSummaryCard extends StatelessWidget {
  const RequestSummaryCard({
    super.key,
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tone,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: Colors.black54, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class InlineRequestFact extends StatelessWidget {
  const InlineRequestFact({
    super.key,
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.black54,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class OpenBookingCard extends StatelessWidget {
  const OpenBookingCard({
    super.key,
    required this.booking,
    required this.isPreferredRequest,
    required this.joined,
    required this.loading,
    required this.walletBlocked,
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
    required this.onStart,
  });

  final Map<String, dynamic> booking;
  final bool isPreferredRequest;
  final bool joined;
  final bool loading;
  final bool walletBlocked;
  final VoidCallback onJoin;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final services = booking['services'] is List<dynamic>
        ? booking['services'] as List<dynamic>
        : [];
    final firstService = services.isNotEmpty
        ? services.first as Map<String, dynamic>
        : <String, dynamic>{};
    final service = firstService['service'] as Map<String, dynamic>?;
    final participants = booking['participants'] is List<dynamic>
        ? booking['participants'] as List<dynamic>
        : [];
    final preferredProvider =
        booking['preferredProvider'] as Map<String, dynamic>?;
    final payment = asMap(booking['payment']);
    final hasPreferredProvider = preferredProvider != null;
    final hasChat = isProviderAppChatVisible(booking);
    final isMatched = booking['status'] == 'MATCHED';
    final walletBlocksMarketplaceJoin = providerWalletBlocksMarketplaceJoin(
      walletBlocked: walletBlocked,
      isPreferredRequest: isPreferredRequest,
      isMatched: isMatched,
      joined: joined,
    );
    final isCashBooking = providerBookingIsCash(booking);
    final customerAmount = payment?['amount'] ?? service?['basePrice'];
    final customerAddress = booking['address'] as Map<String, dynamic>?;
    final customerName = customerAddress?['name']?.toString() ?? 'Guest';
    final customerPhone = customerAddress?['phone']?.toString();
    final bookingId = booking['id']?.toString() ?? '';
    final shortBookingId =
        bookingId.length <= 8 ? bookingId : bookingId.substring(0, 8);
    final updatedLabel =
        formatRelativeMoment(booking['updatedAt'] ?? booking['createdAt']);
    final openedLabel = formatRequestOpenedMoment(
        booking['createdAt'] ?? booking['scheduledStartAt']);
    final guidance = providerRequestGuidance(
      booking: booking,
      isPreferredRequest: isPreferredRequest,
      joined: joined,
      walletBlocked: walletBlocked,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.spa_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(providerServiceOptionLabel(service),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(
                        '$customerName${customerPhone == null ? '' : ' - $customerPhone'}',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.black54),
                      ),
                      Text(
                          '${booking['status']} - ${participants.length} partner(s) joined'),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isPreferredRequest
                        ? const Color(0xFFE7F2DE)
                        : (hasPreferredProvider
                            ? const Color(0xFFF8ECD4)
                            : const Color(0xFFE5ECFB)),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    isPreferredRequest
                        ? 'Preferred'
                        : (hasPreferredProvider ? 'Marketplace' : 'Open'),
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderRequestTag(label: guidance.modeLabel),
                ProviderRequestTag(
                    label: 'Booking $shortBookingId', highlighted: true),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(
                    label: '${formatCurrency(customerAmount)} VND'),
                ProviderRequestTag(
                    label: providerMatchingWindowTagLabel(booking)),
                ProviderRequestTag(
                    label: providerBackupRadiusTagLabel(booking)),
                ProviderRequestTag(
                  label: payment?['method']?.toString() ??
                      (isCashBooking ? 'CASH' : 'PAYMENT'),
                  highlighted: isCashBooking,
                ),
                if (updatedLabel != 'Updated just now')
                  ProviderRequestTag(label: updatedLabel),
              ],
            ),
            const SizedBox(height: 10),
            Text('Opened: $openedLabel'),
            if (customerAddress != null) ...[
              const SizedBox(height: 4),
              Text(
                'Guest address: ${customerAddress['line1'] ?? 'Address pending'}',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: Colors.black54),
              ),
            ],
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE4EAF2)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Guest',
                      value: customerName,
                    ),
                  ),
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Phone',
                      value: customerPhone ?? 'Pending',
                    ),
                  ),
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Priority',
                      value: guidance.priorityLabel,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: RequestSummaryCard(
                    label: 'Role',
                    value: guidance.roleLabel,
                    tone: isPreferredRequest
                        ? const Color(0xFFEAF5E3)
                        : (hasPreferredProvider
                            ? const Color(0xFFFBF0DE)
                            : const Color(0xFFEAF2FF)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: RequestSummaryCard(
                    label: 'Decision',
                    value: guidance.decisionLabel,
                    tone: isMatched
                        ? const Color(0xFFF2EAFE)
                        : const Color(0xFFF7F8FA),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F8FA),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Next action',
                    style: Theme.of(context)
                        .textTheme
                        .labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    guidance.nextAction,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(guidance.contextMessage),
            if (walletBlocksMarketplaceJoin) ...[
              const SizedBox(height: 12),
              const MarketplaceJoinLockCard(),
            ] else ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isPreferredRequest
                      ? const Color(0xFFF1F8EC)
                      : const Color(0xFFF8F6EC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isPreferredRequest
                        ? const Color(0xFFD6E9C8)
                        : const Color(0xFFE7D9B7),
                  ),
                ),
                child: Text(guidance.detailMessage,
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
              const SizedBox(height: 12),
              InfoCard(text: guidance.infoMessage),
              if (isCashBooking &&
                  ((isPreferredRequest && !isMatched) ||
                      (!isPreferredRequest && !joined))) ...[
                const SizedBox(height: 12),
                InfoCard(text: providerCashBookingSettlementHint(booking)),
              ],
            ],
            const SizedBox(height: 12),
            if (isPreferredRequest && !isMatched)
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: loading ? null : onReject,
                      icon: const Icon(Icons.close),
                      label: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: loading ? null : onAccept,
                      icon: const Icon(Icons.check),
                      label: const Text('Accept request'),
                    ),
                  ),
                ],
              )
            else if (isPreferredRequest && isMatched && !hasChat)
              FilledButton.icon(
                onPressed: loading ? null : onStart,
                icon: const Icon(Icons.play_arrow_outlined),
                label: const Text('Start service chat'),
              )
            else if (isPreferredRequest && hasChat)
              const InfoCard(text: 'Chat is ready. Continue from the Chat tab.')
            else if (!joined)
              FilledButton.icon(
                onPressed:
                    loading || walletBlocksMarketplaceJoin ? null : onJoin,
                icon: Icon(walletBlocksMarketplaceJoin
                    ? Icons.lock_outline
                    : Icons.add_circle_outline),
                label: Text(providerMarketplaceJoinButtonLabel(
                  walletBlocksMarketplaceJoin: walletBlocksMarketplaceJoin,
                  hasPreferredProvider: hasPreferredProvider,
                )),
              )
            else ...[
              const InfoCard(
                  text:
                      'You are visible to the customer now. Wait for the final selection.'),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: loading ? null : onReject,
                icon: const Icon(Icons.close),
                label: const Text('Withdraw from shortlist'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class MarketplaceJoinLockCard extends StatelessWidget {
  const MarketplaceJoinLockCard({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.error.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, color: colorScheme.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Marketplace visible, join locked',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: colorScheme.onErrorContainer,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(providerWalletBlockFallbackReasonClean),
                const SizedBox(height: 8),
                Text(
                  providerWalletBlockHintClean,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onErrorContainer,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderRequestTag extends StatelessWidget {
  const ProviderRequestTag({
    super.key,
    required this.label,
    this.highlighted = false,
  });

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFE8F2DF) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: highlighted
              ? const Color(0xFFBFD6AA)
              : Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .labelLarge
            ?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}
