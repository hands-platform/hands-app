import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_booking_service_helpers.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_common_widgets.dart';
import 'provider_request_guidance_helpers.dart';

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
    final walletBlocksMarketplaceParticipation =
        providerWalletBlocksMarketplaceParticipation(
      walletBlocked: walletBlocked,
      isPreferredRequest: isPreferredRequest,
      isMatched: isMatched,
    );
    final isCashBooking = providerBookingIsCash(booking);
    final customerAmount = payment?['amount'] ?? service?['basePrice'];
    final customerAddress = booking['address'] as Map<String, dynamic>?;
    final addressPreview = customerAddress?['addressPreview']?.toString();
    final guestArea = addressPreview ?? 'Area pending';
    final bookingId = booking['id']?.toString() ?? '';
    final shortBookingId =
        bookingId.length <= 8 ? bookingId : bookingId.substring(0, 8);
    final updatedLabel =
        formatRelativeMoment(booking['updatedAt'] ?? booking['createdAt']);
    final openedLabel =
        formatRequestOpenedMoment(providerBookingRequestOpenedAt(booking));
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
                      Text(
                        providerServiceOptionLabel(service),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hasPreferredProvider
                            ? 'Guest request with marketplace alternatives'
                            : 'Marketplace request',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.black54),
                      ),
                      Text(
                        '${booking['status']} - ${participants.length} marketplace participant(s)',
                      ),
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
                  label: 'Booking $shortBookingId',
                  highlighted: true,
                ),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(
                  label: '${formatCurrency(customerAmount)} VND',
                ),
                ProviderRequestTag(
                    label: providerMatchingWindowTagLabel(booking)),
                ProviderRequestTag(
                    label: providerMarketplaceRadiusTagLabel(booking)),
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
                'Guest area: $guestArea',
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
                      label: 'Area',
                      value: guestArea,
                    ),
                  ),
                  Expanded(
                    child: InlineRequestFact(
                      label: 'Request',
                      value: hasPreferredProvider
                          ? 'First-pick marketplace'
                          : 'Marketplace',
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
            if (walletBlocksMarketplaceParticipation) ...[
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
                child: Text(
                  guidance.detailMessage,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
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
                label: const Text('Start service'),
              )
            else if (isPreferredRequest && hasChat)
              const InfoCard(text: 'Chat is ready. Continue from the Chat tab.')
            else if (walletBlocksMarketplaceParticipation)
              FilledButton.icon(
                onPressed: null,
                icon: const Icon(Icons.lock_outline),
                label: const Text(providerMarketplaceJoinBlockedButtonLabel),
              )
            else if (!joined)
              FilledButton.icon(
                onPressed: loading ? null : onJoin,
                icon: const Icon(Icons.add_circle_outline),
                label: Text(
                  providerMarketplaceJoinButtonLabel(
                    walletBlocksMarketplaceParticipation:
                        walletBlocksMarketplaceParticipation,
                    hasPreferredProvider: hasPreferredProvider,
                  ),
                ),
              )
            else ...[
              const InfoCard(
                text:
                    'You are visible to the customer now. Wait for the final selection.',
              ),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: loading ? null : onReject,
                icon: const Icon(Icons.close),
                label: const Text('Withdraw from candidate list'),
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
                  'Cannot participate until fees are settled',
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
