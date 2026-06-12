import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_wallet_gate_helpers.dart';
import 'provider_wallet_settlement_widgets.dart';

class EarningsScreen extends ConsumerStatefulWidget {
  const EarningsScreen({
    super.key,
    this.initialEarningId,
    this.initialPayoutBatchId,
  });

  final String? initialEarningId;
  final String? initialPayoutBatchId;

  @override
  ConsumerState<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends ConsumerState<EarningsScreen> {
  bool restoringSession = false;
  String? restoreMessage;
  String? restoreError;

  @override
  void initState() {
    super.initState();
    if (_hasInitialTarget) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(restoreSessionForTarget());
      });
    }
  }

  bool get _hasInitialTarget =>
      widget.initialEarningId != null || widget.initialPayoutBatchId != null;

  Future<void> restoreSessionForTarget() async {
    setState(() {
      restoringSession = true;
      restoreMessage = null;
      restoreError = null;
    });
    try {
      final authController = ref.read(authControllerProvider.notifier);
      final session = ref.read(authControllerProvider) ??
          await authController.restoreSession();
      if (!mounted) {
        return;
      }
      if (session == null) {
        setState(() => restoreMessage = 'Login to view this earnings update.');
      }
    } catch (exception) {
      if (mounted) {
        setState(() => restoreError = '$exception');
      }
    } finally {
      if (mounted) {
        setState(() => restoringSession = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
          if (restoringSession)
            const Center(child: CircularProgressIndicator())
          else if (restoreMessage != null)
            InfoCard(text: restoreMessage!)
          else if (restoreError != null)
            ProviderErrorCard(text: restoreError!)
          else if (auth == null)
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
                    final earnings = sortedProviderEarningsForTarget(
                      (earningsSnapshot.data ?? [])
                          .whereType<Map<String, dynamic>>()
                          .toList(),
                      earningId: widget.initialEarningId,
                      payoutBatchId: widget.initialPayoutBatchId,
                    );
                    final currency = summary['currency'] ?? 'VND';
                    final settlementView =
                        ProviderWalletSettlementView.fromSummary(summary);

                    return FutureBuilder<List<dynamic>>(
                      future:
                          ref.read(providerRepositoryProvider).payoutBatches(),
                      builder: (context, payoutSnapshot) {
                        final batches = (payoutSnapshot.data ?? [])
                            .whereType<Map<String, dynamic>>()
                            .toList();
                        final targetPayoutBatch = providerTargetPayoutBatch(
                          batches,
                          payoutBatchId: widget.initialPayoutBatchId,
                        );
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
                                          : 'You can participate in marketplace requests and receive direct booking requests.',
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
                            if (targetPayoutBatch != null) ...[
                              Card(
                                shape: providerTargetEarningsCardShape(context),
                                child: ListTile(
                                  leading: const Icon(Icons.payments_outlined),
                                  title: Text(
                                      'Payout ${targetPayoutBatch['id'] ?? widget.initialPayoutBatchId}'),
                                  subtitle: Text(
                                      targetPayoutBatch['status']?.toString() ??
                                          'Payout update'),
                                  trailing: Text(
                                      '${targetPayoutBatch['totalAmount'] ?? targetPayoutBatch['amount'] ?? 0} ${targetPayoutBatch['currency'] ?? currency}'),
                                ),
                              ),
                              const SizedBox(height: 12),
                            ],
                            if (earnings.isEmpty)
                              const InfoCard(
                                  text: 'Completed jobs will appear here.')
                            else
                              for (final earning in earnings)
                                Card(
                                  shape: isProviderEarningTarget(
                                    earning,
                                    earningId: widget.initialEarningId,
                                    payoutBatchId: widget.initialPayoutBatchId,
                                  )
                                      ? providerTargetEarningsCardShape(context)
                                      : null,
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

List<Map<String, dynamic>> sortedProviderEarningsForTarget(
  List<Map<String, dynamic>> earnings, {
  String? earningId,
  String? payoutBatchId,
}) {
  return earnings
    ..sort((left, right) {
      final leftTarget = isProviderEarningTarget(
        left,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
      );
      final rightTarget = isProviderEarningTarget(
        right,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
      );
      if (leftTarget != rightTarget) {
        return leftTarget ? -1 : 1;
      }

      return 0;
    });
}

bool isProviderEarningTarget(
  Map<String, dynamic> earning, {
  String? earningId,
  String? payoutBatchId,
}) {
  final matchesEarning =
      earningId != null && earning['id']?.toString() == earningId;
  final matchesPayout = payoutBatchId != null &&
      earning['payoutBatchId']?.toString() == payoutBatchId;

  return matchesEarning || matchesPayout;
}

Map<String, dynamic>? providerTargetPayoutBatch(
  List<Map<String, dynamic>> batches, {
  String? payoutBatchId,
}) {
  if (payoutBatchId == null) {
    return null;
  }

  for (final batch in batches) {
    if (batch['id']?.toString() == payoutBatchId) {
      return batch;
    }
  }
  return null;
}

ShapeBorder providerTargetEarningsCardShape(BuildContext context) {
  return RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(8),
    side: BorderSide(
      color: Theme.of(context).colorScheme.primary,
      width: 2,
    ),
  );
}
