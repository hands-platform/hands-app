import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_wallet_gate_helpers.dart';
import 'provider_wallet_settlement_widgets.dart';

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Earnings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Login to view completed service earnings.'
                : 'Track gross revenue, platform fees, tax withholding, and net payout.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(
                text: 'Demo partner login is available on the Requests tab.')
          else
            FutureBuilder<List<dynamic>>(
              future: ref.read(providerRepositoryProvider).earnings(),
              builder: (context, earningsSnapshot) {
                return FutureBuilder<Map<String, dynamic>>(
                  future:
                      ref.read(providerRepositoryProvider).earningsSummary(),
                  builder: (context, summarySnapshot) {
                    if (earningsSnapshot.connectionState ==
                            ConnectionState.waiting ||
                        summarySnapshot.connectionState ==
                            ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final summary = summarySnapshot.data ?? <String, dynamic>{};
                    final earnings = earningsSnapshot.data ?? [];
                    final currency = summary['currency'] ?? 'VND';
                    final settlementView =
                        ProviderWalletSettlementView.fromSummary(summary);

                    return FutureBuilder<List<dynamic>>(
                      future:
                          ref.read(providerRepositoryProvider).payoutBatches(),
                      builder: (context, payoutSnapshot) {
                        final batches = payoutSnapshot.data ?? [];
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Card(
                              color: settlementView.blocked
                                  ? Theme.of(context).colorScheme.errorContainer
                                  : Theme.of(context)
                                      .colorScheme
                                      .primaryContainer,
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Wallet balance',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      settlementView.balanceLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      settlementView.statusLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
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
                                      const SizedBox(height: 10),
                                      Text(
                                        'Amount to settle: ${settlementView.amountLabel}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(settlementView.instruction),
                                      if (settlementView.reference != null) ...[
                                        const SizedBox(height: 10),
                                        WalletSettlementReferenceCard(
                                          reference: settlementView.reference!,
                                          amountLabel:
                                              settlementView.amountLabel,
                                        ),
                                      ],
                                      const SizedBox(height: 10),
                                      WalletSettlementChecklist(
                                        items: settlementView.steps,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Net payout',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${summary['netAmount'] ?? 0} $currency',
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                        'Tax withholding ${summary['taxAmount'] ?? 0} $currency'),
                                    Text(
                                        'Platform fee ${summary['platformFee'] ?? 0} $currency'),
                                    Text('Payout batches ${batches.length}'),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (earnings.isEmpty)
                              const InfoCard(
                                  text: 'Completed jobs will appear here.')
                            else
                              for (final earning in earnings)
                                Card(
                                  child: ListTile(
                                    title: Text(
                                        '${earning['netAmount']} ${earning['currency'] ?? currency}'),
                                    subtitle: Text(
                                        'Booking ${earning['bookingId']} - ${earning['status']}'),
                                    trailing: Text(
                                        '${earning['platformFee'] ?? 0} fee'),
                                  ),
                                ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}
