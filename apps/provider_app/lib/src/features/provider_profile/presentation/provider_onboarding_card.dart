import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../booking/presentation/provider_jobs_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import '../../provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import 'provider_feedback_cards.dart';

class ProviderOnboardingCard extends StatelessWidget {
  const ProviderOnboardingCard({
    super.key,
    required this.snapshot,
    required this.error,
    required this.isSaving,
    required this.onRefresh,
    required this.onFillBasicProfile,
    required this.onSubmitKyc,
    required this.onAddBankAccount,
    required this.onAddTaxProfile,
    required this.onAcceptAgreements,
  });

  final Map<String, dynamic> snapshot;
  final Object? error;
  final bool isSaving;
  final VoidCallback onRefresh;
  final Future<void> Function() onFillBasicProfile;
  final Future<void> Function() onSubmitKyc;
  final Future<void> Function() onAddBankAccount;
  final Future<void> Function() onAddTaxProfile;
  final Future<void> Function() onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final level = snapshot['level']?.toString() ?? 'LEVEL_1_SIGNUP';
    final recommended =
        snapshot['recommendedLevel']?.toString() ?? 'LEVEL_1_SIGNUP';
    final nextActions = asList(snapshot['nextRequiredActions'])
        .map((action) => action.toString())
        .toList();
    final bankAccounts = asList(snapshot['bankAccounts']);
    final documents = asList(snapshot['documents']);
    final recentLogs = asList(snapshot['recentVerificationLogs'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .toList();
    final requiredKycTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
    final payoutGate = asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
    final payoutMissing = asMap(payoutGate['missing']) ?? <String, dynamic>{};
    final canWithdraw = payoutGate['canWithdraw'] == true;
    final completedBookingCount =
        asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
    final kyc = asMap(snapshot['kyc']);
    final verification = asMap(snapshot['verification']);
    final taxProfile = asMap(snapshot['taxProfile']);
    final basicProfile = asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
    final hasBasicProfile = !nextActions.contains('BASIC_PROFILE');
    final kycStatus =
        kyc?['status']?.toString() ?? verification?['status']?.toString();
    final bankStatus = bankAccounts.isEmpty
        ? null
        : asMap(bankAccounts.first)?['status']?.toString();
    final taxStatus = taxProfile?['status']?.toString();
    final addressText = basicProfile['residentialAddress']?.toString();
    final primaryBank = bankAccounts.isEmpty ? null : asMap(bankAccounts.first);
    final kycRejectionReason = reviewReason(kyc) ?? reviewReason(verification);
    final bankRejectionReason = reviewReason(primaryBank);
    final taxRejectionReason = reviewReason(taxProfile);
    final rejectedDocuments = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where((document) => document['status']?.toString() == 'REJECTED')
        .toList();
    final rejectedRequiredSummaries = providerRejectedKycDocumentSummaries(
      submittedDocuments: documents,
      uploadedDocumentIds: const {},
      requiredTypes: requiredKycTypes,
    );
    final submittedKycRequiredCount = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(isProviderSubmittedDocumentUsableForKyc)
        .map((document) => document['type']?.toString())
        .where((type) => requiredKycTypes.contains(type))
        .toSet()
        .length;
    final kycDocumentsReady =
        submittedKycRequiredCount >= requiredKycTypes.length;
    final missingAgreementCount = (asList(payoutMissing['agreements'])).length;
    final payoutPrerequisiteReady = completedBookingCount > 0 &&
        taxStatus == 'APPROVED' &&
        (addressText?.trim().isNotEmpty ?? false) &&
        missingAgreementCount == 0;
    final payoutGateItems = providerPayoutGateItemsFromSnapshot(snapshot);
    final kycDecisionItems = providerKycDecisionChecklistFromSnapshot(snapshot);
    final levelMilestones = providerLevelMilestonesFromSnapshot(snapshot);
    final priority = providerOnboardingPriorityFromSnapshot(snapshot);
    final firstRevenuePayoutSetupActive =
        providerFirstRevenuePayoutSetupActiveFromSnapshot(snapshot);
    final priorityAction = switch (priority.actionKey) {
      'BASIC_PROFILE' => onFillBasicProfile,
      'RESIDENTIAL_ADDRESS' => onFillBasicProfile,
      'KYC_REVIEW' => onSubmitKyc,
      'BANK_ACCOUNT_REVIEW' => onAddBankAccount,
      'TAX_PROFILE_REVIEW' => onAddTaxProfile,
      'AGREEMENTS' => onAcceptAgreements,
      _ => null,
    };

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
                    'Partner onboarding',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: isSaving ? null : onRefresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh onboarding',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _OnboardingPill(label: 'Current', value: _compactLevel(level)),
                _OnboardingPill(
                    label: 'Recommended', value: _compactLevel(recommended)),
                _OnboardingPill(
                    label: 'Completed',
                    value: '$completedBookingCount service(s)'),
                _OnboardingPill(
                    label: 'Payout',
                    value: canWithdraw ? 'Ready' : 'Locked',
                    isPositive: canWithdraw),
              ],
            ),
            const SizedBox(height: 12),
            _ProviderLevelRoadmap(milestones: levelMilestones),
            const SizedBox(height: 12),
            if (error != null) ...[
              ErrorCard(text: 'Onboarding load failed: $error'),
              const SizedBox(height: 12),
            ],
            _OnboardingPriorityPanel(
              priority: priority,
              onPressed: isSaving || priorityAction == null
                  ? null
                  : () {
                      priorityAction();
                    },
            ),
            const SizedBox(height: 12),
            if (firstRevenuePayoutSetupActive) ...[
              _FirstRevenuePayoutSetupPanel(
                completedBookingCount: completedBookingCount,
                taxStatus: taxStatus,
                addressReady: addressText?.trim().isNotEmpty ?? false,
                missingAgreementCount: missingAgreementCount,
                onAddTaxProfile: isSaving
                    ? null
                    : () {
                        onAddTaxProfile();
                      },
                onUpdateAddress: isSaving
                    ? null
                    : () {
                        onFillBasicProfile();
                      },
                onAcceptAgreements: isSaving
                    ? null
                    : () {
                        onAcceptAgreements();
                      },
              ),
              const SizedBox(height: 12),
            ],
            if (documents.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: documents.map((document) {
                    final item = asMap(document) ?? <String, dynamic>{};
                    final type = item['type']?.toString() ?? 'DOCUMENT';
                    final status = item['status']?.toString() ?? 'PENDING';
                    final rejected = status == 'REJECTED';
                    return Chip(
                      backgroundColor: rejected
                          ? Theme.of(context).colorScheme.errorContainer
                          : null,
                      label: Text(
                        '${providerDocumentTypeLabel(type)}: $status',
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (kycRejectionReason != null) ...[
              _ReviewAlert(
                title: 'KYC needs updates',
                detail: kycRejectionReason,
              ),
              const SizedBox(height: 8),
            ],
            if (rejectedDocuments.isNotEmpty) ...[
              _ReviewAlert(
                title: 'Rejected document(s)',
                detail: rejectedRequiredSummaries.isNotEmpty
                    ? '${rejectedRequiredSummaries.join('\n')}\n\nOpen the KYC checklist and replace each rejected required photo.'
                    : rejectedDocuments.map((document) {
                        final type = providerDocumentTypeLabel(
                            document['type'].toString());
                        final reason =
                            reviewReason(document) ?? 'Upload a clearer image.';
                        return '$type: $reason';
                      }).join('\n'),
              ),
              const SizedBox(height: 8),
            ],
            if (bankRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Bank account needs updates',
                detail:
                    '$bankRejectionReason\n\nOpen Bank account and submit corrected details.',
              ),
              const SizedBox(height: 8),
            ],
            if (taxRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Tax profile needs updates',
                detail:
                    '$taxRejectionReason\n\nOpen Tax profile and submit corrected MST, legal name, and registered address.',
              ),
              const SizedBox(height: 8),
            ],
            _OnboardingStepCard(
              step: '1',
              title: 'Basic profile',
              detail: addressText == null || addressText.isEmpty
                  ? 'Add legal name, public name, birthday, and service area. Tax address can wait until first earning.'
                  : addressText,
              status: hasBasicProfile ? 'Complete' : 'Required',
              complete: hasBasicProfile,
              icon: Icons.badge_outlined,
              actionLabel: hasBasicProfile ? 'Edit profile' : 'Start profile',
              onPressed: isSaving ? null : onFillBasicProfile,
            ),
            _OnboardingStepCard(
              step: '2',
              title: 'KYC verification',
              detail: rejectedRequiredSummaries.isNotEmpty
                  ? 'Replace ${rejectedRequiredSummaries.length} rejected required photo(s), then resubmit KYC.'
                  : '$submittedKycRequiredCount of ${requiredKycTypes.length} required photos ready. Status: ${kycStatus ?? 'Not submitted'}.',
              status: kycStatus == 'APPROVED'
                  ? 'Approved'
                  : kycDocumentsReady
                      ? 'Ready to submit'
                      : 'Upload documents first',
              complete: kycStatus == 'APPROVED',
              icon: Icons.verified_user_outlined,
              actionLabel: kycStatus == 'REJECTED'
                  ? 'Resubmit KYC'
                  : kycDocumentsReady
                      ? 'Submit KYC'
                      : 'Open KYC checklist',
              onPressed: isSaving ? null : onSubmitKyc,
            ),
            _KycDecisionChecklist(
              items: kycDecisionItems,
              reviewStatus: kycStatus ?? 'Not submitted',
            ),
            _OnboardingStepCard(
              step: '3',
              title: 'Bank account',
              detail: providerBankAccountStepDetail(
                status: bankStatus,
                rejectionReason: bankRejectionReason,
              ),
              status: bankStatus == 'APPROVED' ? 'Approved' : 'Required',
              complete: bankStatus == 'APPROVED',
              icon: Icons.account_balance_outlined,
              actionLabel: bankStatus == 'REJECTED'
                  ? 'Resubmit bank'
                  : bankStatus == null
                      ? 'Add bank account'
                      : 'Update bank account',
              onPressed: isSaving ? null : onAddBankAccount,
            ),
            _OnboardingStepCard(
              step: '4',
              title: 'Payout unlock',
              detail: providerTaxProfileStepDetail(
                completedBookingCount: completedBookingCount,
                status: taxStatus,
                rejectionReason: taxRejectionReason,
                missingAgreementCount: missingAgreementCount,
              ),
              status: canWithdraw
                  ? 'Withdrawals enabled'
                  : payoutPrerequisiteReady
                      ? 'Ready for admin refresh'
                      : 'Locked',
              complete: canWithdraw,
              icon: Icons.payments_outlined,
              actionLabel: completedBookingCount == 0
                  ? 'After first earning'
                  : taxStatus == 'REJECTED'
                      ? 'Resubmit tax'
                      : taxStatus == 'APPROVED'
                          ? 'Review terms'
                          : 'Add tax profile',
              onPressed: isSaving
                  ? null
                  : completedBookingCount == 0
                      ? null
                      : taxStatus == 'APPROVED'
                          ? onAcceptAgreements
                          : onAddTaxProfile,
            ),
            _PayoutGateChecklist(
              items: payoutGateItems,
              agreementVersion: providerAgreementVersionFromSnapshot(snapshot),
            ),
            _OnboardingStepCard(
              step: '5',
              title: 'Profile review',
              detail:
                  'Admin can complete an optional profile review after identity, experience, and profile evidence are reviewed.',
              status: recommended == 'LEVEL_4_TRUSTED' ? 'Complete' : 'Later',
              complete: recommended == 'LEVEL_4_TRUSTED',
              icon: Icons.workspace_premium_outlined,
            ),
            if (recentLogs.isNotEmpty) ...[
              const SizedBox(height: 6),
              _OnboardingHistoryList(logs: recentLogs),
            ],
            if (isSaving) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}

class _FirstRevenuePayoutSetupPanel extends StatelessWidget {
  const _FirstRevenuePayoutSetupPanel({
    required this.completedBookingCount,
    required this.taxStatus,
    required this.addressReady,
    required this.missingAgreementCount,
    required this.onAddTaxProfile,
    required this.onUpdateAddress,
    required this.onAcceptAgreements,
  });

  final int completedBookingCount;
  final String? taxStatus;
  final bool addressReady;
  final int missingAgreementCount;
  final VoidCallback? onAddTaxProfile;
  final VoidCallback? onUpdateAddress;
  final VoidCallback? onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final taxReady = taxStatus == 'APPROVED';
    final agreementsReady = missingAgreementCount == 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.tertiaryContainer.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colorScheme.tertiary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.account_balance_wallet_outlined,
                  color: colorScheme.tertiary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'First earning recorded',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$completedBookingCount completed service(s). Finish tax, address, and payout agreements before withdrawal. You can still receive bookings unless the HANDS wallet is negative.',
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _PayoutSetupStatusRow(
            label: 'Tax profile',
            value: taxReady ? 'Approved' : taxStatus ?? 'Missing',
            complete: taxReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Residential address',
            value: addressReady ? 'Saved' : 'Missing',
            complete: addressReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Payout agreements',
            value: agreementsReady ? 'Accepted' : '$missingAgreementCount left',
            complete: agreementsReady,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!taxReady)
                FilledButton.tonalIcon(
                  onPressed: onAddTaxProfile,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: Text(
                    taxStatus == 'REJECTED' ? 'Resubmit tax' : 'Add tax',
                  ),
                ),
              if (!addressReady)
                FilledButton.tonalIcon(
                  onPressed: onUpdateAddress,
                  icon: const Icon(Icons.home_outlined),
                  label: const Text('Update address'),
                ),
              if (!agreementsReady)
                FilledButton.tonalIcon(
                  onPressed: onAcceptAgreements,
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Accept agreements'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayoutSetupStatusRow extends StatelessWidget {
  const _PayoutSetupStatusRow({
    required this.label,
    required this.value,
    required this.complete,
  });

  final String label;
  final String value;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            complete ? Icons.check_circle_outline : Icons.radio_button_checked,
            color: complete ? colorScheme.primary : colorScheme.tertiary,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _ProviderLevelRoadmap extends StatelessWidget {
  const _ProviderLevelRoadmap({required this.milestones});

  final List<ProviderOnboardingLevelMilestone> milestones;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completedCount =
        milestones.where((milestone) => milestone.complete).length;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.stairs_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Partner level roadmap',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completedCount/${milestones.length}')),
            ],
          ),
          const SizedBox(height: 10),
          for (final milestone in milestones) ...[
            _ProviderLevelRoadmapRow(milestone: milestone),
            if (milestone != milestones.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ProviderLevelRoadmapRow extends StatelessWidget {
  const _ProviderLevelRoadmapRow({required this.milestone});

  final ProviderOnboardingLevelMilestone milestone;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final icon = milestone.complete
        ? Icons.check_circle_outline
        : milestone.current
            ? Icons.radio_button_checked
            : Icons.radio_button_unchecked;
    final iconColor = milestone.complete || milestone.current
        ? colorScheme.primary
        : colorScheme.onSurfaceVariant;
    final background = milestone.current
        ? colorScheme.primaryContainer.withValues(alpha: 0.35)
        : Colors.transparent;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  milestone.title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  milestone.detail,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          if (milestone.current) ...[
            const SizedBox(width: 8),
            const Chip(label: Text('Current')),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklist extends StatelessWidget {
  const _PayoutGateChecklist({
    required this.items,
    required this.agreementVersion,
  });

  final List<ProviderOnboardingGateItem> items;
  final String agreementVersion;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.fact_check_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Payout gate checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Agreement version: $agreementVersion',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _PayoutGateChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklistRow extends StatelessWidget {
  const _PayoutGateChecklistRow({required this.item});

  final ProviderOnboardingGateItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final iconColor = item.complete ? colorScheme.primary : colorScheme.error;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.lock_outline,
          color: iconColor,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _KycDecisionChecklist extends StatelessWidget {
  const _KycDecisionChecklist({
    required this.items,
    required this.reviewStatus,
  });

  final List<ProviderKycDecisionItem> items;
  final String reviewStatus;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.assignment_ind_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'KYC review checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'HANDS operations checks these items before Level 2 work access. Review status: $reviewStatus.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _KycDecisionChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _KycDecisionChecklistRow extends StatelessWidget {
  const _KycDecisionChecklistRow({required this.item});

  final ProviderKycDecisionItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.error_outline,
          color: item.complete ? colorScheme.primary : colorScheme.error,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OnboardingHistoryList extends StatelessWidget {
  const _OnboardingHistoryList({required this.logs});

  final List<Map<String, dynamic>> logs;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.history_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Recent review activity',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final log in logs.take(5)) ...[
            _OnboardingHistoryRow(log: log),
            if (log != logs.take(5).last)
              Divider(color: colorScheme.outlineVariant),
          ],
        ],
      ),
    );
  }
}

class _OnboardingPriorityPanel extends StatelessWidget {
  const _OnboardingPriorityPanel({
    required this.priority,
    required this.onPressed,
  });

  final ProviderOnboardingPriority priority;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final colors = switch (priority.tone) {
      'success' => (
          background: colorScheme.primaryContainer,
          foreground: colorScheme.onPrimaryContainer,
          icon: Icons.check_circle_outline,
        ),
      'warning' => (
          background: colorScheme.tertiaryContainer,
          foreground: colorScheme.onTertiaryContainer,
          icon: Icons.priority_high_outlined,
        ),
      _ => (
          background: colorScheme.secondaryContainer,
          foreground: colorScheme.onSecondaryContainer,
          icon: Icons.flag_outlined,
        ),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(colors.icon, color: colors.foreground),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      priority.title,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(color: colors.foreground),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      priority.detail,
                      style: TextStyle(color: colors.foreground),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (priority.buttonLabel != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.arrow_forward),
              label: Text(priority.buttonLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _OnboardingHistoryRow extends StatelessWidget {
  const _OnboardingHistoryRow({required this.log});

  final Map<String, dynamic> log;

  @override
  Widget build(BuildContext context) {
    final action = log['action']?.toString() ?? 'event';
    final fromStatus = log['fromStatus']?.toString();
    final toStatus = log['toStatus']?.toString();
    final actor = asMap(log['actor']);
    final actorName = actor?['fullName']?.toString().trim().isNotEmpty == true
        ? actor!['fullName'].toString()
        : actor?['phone']?.toString();
    final statusText = fromStatus == null && toStatus == null
        ? 'Recorded'
        : '${fromStatus ?? 'New'} -> ${toStatus ?? 'Updated'}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3),
            child: Icon(Icons.circle, size: 10),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerLogActionLabel(action),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(statusText),
                Text(
                  [
                    formatRelativeMoment(log['createdAt']),
                    if (actorName != null) 'by $actorName',
                  ].join(' / '),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingPill extends StatelessWidget {
  const _OnboardingPill({
    required this.label,
    required this.value,
    this.isPositive,
  });

  final String label;
  final String value;
  final bool? isPositive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = isPositive == null
        ? colorScheme.secondaryContainer
        : isPositive!
            ? colorScheme.primaryContainer
            : colorScheme.errorContainer;
    return Chip(
      backgroundColor: color,
      label: Text('$label: $value'),
    );
  }
}

class _ReviewAlert extends StatelessWidget {
  const _ReviewAlert({
    required this.title,
    required this.detail,
  });

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.error),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.report_problem_outlined, color: colorScheme.error),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(detail),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingStepCard extends StatelessWidget {
  const _OnboardingStepCard({
    required this.step,
    required this.title,
    required this.detail,
    required this.status,
    required this.complete,
    required this.icon,
    this.actionLabel,
    this.onPressed,
  });

  final String step;
  final String title;
  final String detail;
  final String status;
  final bool complete;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background = complete
        ? colorScheme.primaryContainer
        : colorScheme.surfaceContainerHighest;
    final foreground = complete
        ? colorScheme.onPrimaryContainer
        : colorScheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: complete ? colorScheme.primary : colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: complete
                    ? colorScheme.primary
                    : colorScheme.surfaceContainerHighest,
                foregroundColor:
                    complete ? colorScheme.onPrimary : colorScheme.primary,
                child: complete
                    ? const Icon(Icons.check, size: 20)
                    : Text(step,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(detail, style: TextStyle(color: foreground)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: foreground),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Chip(
                label: Text(status),
                backgroundColor:
                    complete ? colorScheme.primary : colorScheme.surface,
              ),
              if (actionLabel != null)
                FilledButton.tonal(
                  onPressed: onPressed,
                  child: Text(actionLabel!),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

String _compactLevel(String value) {
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' signup')
      .replaceAll('_ACTIVE', ' active')
      .replaceAll('_PAYOUT_ENABLED', ' payout')
      .replaceAll('_TRUSTED', ' reviewed');
}
