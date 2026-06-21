import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import '../../provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import 'provider_feedback_cards.dart';
import 'provider_onboarding_support_widgets.dart';

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
    required this.onAcceptAgreements,
  });

  final Map<String, dynamic> snapshot;
  final Object? error;
  final bool isSaving;
  final VoidCallback onRefresh;
  final Future<void> Function() onFillBasicProfile;
  final Future<void> Function() onSubmitKyc;
  final Future<void> Function() onAddBankAccount;
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
    final basicProfile = asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
    final hasBasicProfile = !nextActions.contains('BASIC_PROFILE');
    final kycStatus =
        kyc?['status']?.toString() ?? verification?['status']?.toString();
    final bankStatus = bankAccounts.isEmpty
        ? null
        : asMap(bankAccounts.first)?['status']?.toString();
    final addressText = basicProfile['residentialAddress']?.toString();
    final primaryBank = bankAccounts.isEmpty ? null : asMap(bankAccounts.first);
    final kycRejectionReason = reviewReason(kyc) ?? reviewReason(verification);
    final bankRejectionReason = reviewReason(primaryBank);
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
      'AGREEMENTS' => onAcceptAgreements,
      _ => null,
    };
    final walletOperationsDetail = completedBookingCount == 0
        ? 'Wallet withdrawal/deposit review starts after the first earning. Bank details are requested from Earnings only when needed.'
        : missingAgreementCount > 0
            ? '$missingAgreementCount wallet agreement(s) need acceptance before withdrawal review.'
            : canWithdraw
                ? 'Wallet requirements are clear for withdrawal review.'
                : 'Use Earnings to request withdrawal or report deposit support when money movement is needed.';

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
                ProviderOnboardingPill(
                    label: 'Current', value: _compactLevel(level)),
                ProviderOnboardingPill(
                    label: 'Recommended', value: _compactLevel(recommended)),
                ProviderOnboardingPill(
                    label: 'Completed',
                    value: '$completedBookingCount service(s)'),
                ProviderOnboardingPill(
                    label: 'Payout',
                    value: canWithdraw ? 'Ready' : 'Locked',
                    isPositive: canWithdraw),
              ],
            ),
            const SizedBox(height: 12),
            ProviderLevelRoadmap(milestones: levelMilestones),
            const SizedBox(height: 12),
            if (error != null) ...[
              ErrorCard(text: 'Onboarding load failed: $error'),
              const SizedBox(height: 12),
            ],
            ProviderOnboardingPriorityPanel(
              priority: priority,
              onPressed: isSaving || priorityAction == null
                  ? null
                  : () {
                      priorityAction();
                    },
            ),
            const SizedBox(height: 12),
            if (firstRevenuePayoutSetupActive) ...[
              ProviderFirstRevenuePayoutSetupPanel(
                completedBookingCount: completedBookingCount,
                addressReady: addressText?.trim().isNotEmpty ?? false,
                missingAgreementCount: missingAgreementCount,
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
              ProviderReviewAlert(
                title: 'KYC needs updates',
                detail: kycRejectionReason,
              ),
              const SizedBox(height: 8),
            ],
            if (rejectedDocuments.isNotEmpty) ...[
              ProviderReviewAlert(
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
              ProviderReviewAlert(
                title: 'Wallet bank details need updates',
                detail:
                    '$bankRejectionReason\n\nOpen Earnings and submit corrected bank details when withdrawal or deposit support is requested.',
              ),
              const SizedBox(height: 8),
            ],
            ProviderOnboardingStepCard(
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
            ProviderOnboardingStepCard(
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
            ProviderKycDecisionChecklist(
              items: kycDecisionItems,
              reviewStatus: kycStatus ?? 'Not submitted',
            ),
            ProviderOnboardingStepCard(
              step: '3',
              title: 'Wallet bank details',
              detail: providerBankAccountStepDetail(
                status: bankStatus,
                rejectionReason: bankRejectionReason,
              ),
              status: bankStatus == 'APPROVED'
                  ? 'Approved'
                  : bankStatus == 'REJECTED'
                      ? 'Needs correction'
                      : bankStatus == 'PENDING_REVIEW'
                          ? 'Under review'
                          : 'On request',
              complete: bankStatus == 'APPROVED',
              icon: Icons.account_balance_outlined,
              actionLabel: bankStatus == 'REJECTED'
                  ? 'Resubmit bank details'
                  : bankStatus == null
                      ? null
                      : 'Update bank details',
              onPressed:
                  isSaving || bankStatus == null ? null : onAddBankAccount,
            ),
            ProviderOnboardingStepCard(
              step: '4',
              title: 'Wallet operations',
              detail: walletOperationsDetail,
              status: canWithdraw
                  ? 'Ready'
                  : payoutPrerequisiteReady
                      ? 'Manual review'
                      : completedBookingCount == 0
                          ? 'After first earning'
                          : 'Agreements needed',
              complete: canWithdraw || payoutPrerequisiteReady,
              icon: Icons.payments_outlined,
              actionLabel: completedBookingCount == 0
                  ? null
                  : missingAgreementCount > 0
                      ? 'Review agreements'
                      : null,
              onPressed: isSaving
                  ? null
                  : completedBookingCount == 0
                      ? null
                      : missingAgreementCount > 0
                          ? onAcceptAgreements
                          : null,
            ),
            ProviderPayoutGateChecklist(
              items: payoutGateItems,
              agreementVersion: providerAgreementVersionFromSnapshot(snapshot),
            ),
            if (recentLogs.isNotEmpty) ...[
              const SizedBox(height: 6),
              ProviderOnboardingHistoryList(logs: recentLogs),
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

String _compactLevel(String value) {
  if (value == 'LEVEL_3_PAYOUT_ENABLED' || value == 'LEVEL_4_TRUSTED') {
    return 'L2 active';
  }
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' signup')
      .replaceAll('_ACTIVE', ' active')
      .replaceAll('_PAYOUT_ENABLED', ' payout')
      .replaceAll('_TRUSTED', ' reviewed');
}
