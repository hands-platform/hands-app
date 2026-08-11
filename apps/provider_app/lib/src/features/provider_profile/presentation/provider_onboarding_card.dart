import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import '../../provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import 'provider_error_helpers.dart';
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
    final bankCorrectionRequest =
        providerBankCorrectionRequestFromSnapshot(snapshot);
    final addressText = basicProfile['residentialAddress']?.toString();
    final primaryBank = bankAccounts.isEmpty ? null : asMap(bankAccounts.first);
    final kycRejectionReason = reviewReason(kyc) ?? reviewReason(verification);
    final bankCorrectionReason =
        bankCorrectionRequest?['reason']?.toString().trim();
    final bankRejectionReason = reviewReason(primaryBank) ??
        (bankCorrectionReason == null || bankCorrectionReason.isEmpty
            ? null
            : bankCorrectionReason);
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
      'BANK_ACCOUNT_CORRECTION' => onAddBankAccount,
      'AGREEMENTS' => onAcceptAgreements,
      _ => null,
    };
    final walletOperationsDetail = completedBookingCount == 0
        ? 'Việc xét duyệt rút hoặc nộp tiền bắt đầu sau thu nhập đầu tiên. Chỉ cần thêm thông tin ngân hàng trong mục Thu nhập khi phát sinh giao dịch.'
        : missingAgreementCount > 0
            ? 'Cần chấp nhận $missingAgreementCount thỏa thuận ví trước khi xét duyệt rút tiền.'
            : canWithdraw
                ? 'Đã đáp ứng yêu cầu xét duyệt rút tiền.'
                : 'Vào mục Thu nhập để yêu cầu rút tiền hoặc báo cáo khoản nộp khi cần.';

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
                    'Thiết lập tài khoản',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: isSaving ? null : onRefresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Làm mới trạng thái',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderOnboardingPill(
                    label: 'Hiện tại', value: _compactLevel(level)),
                ProviderOnboardingPill(
                    label: 'Đề xuất', value: _compactLevel(recommended)),
                ProviderOnboardingPill(
                    label: 'Đã hoàn tất',
                    value: '$completedBookingCount dịch vụ'),
                ProviderOnboardingPill(
                    label: 'Thanh toán',
                    value: canWithdraw ? 'Sẵn sàng' : 'Chưa mở',
                    isPositive: canWithdraw),
              ],
            ),
            const SizedBox(height: 12),
            ProviderLevelRoadmap(milestones: levelMilestones),
            const SizedBox(height: 12),
            if (error != null) ...[
              ErrorCard(
                text: providerAppErrorMessage(
                  error,
                  fallback: 'Không thể tải trạng thái thiết lập tài khoản.',
                ),
              ),
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
                        '${providerDocumentTypeLabel(type)}: ${providerDocumentStatusLabel(status)}',
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (kycRejectionReason != null) ...[
              ProviderReviewAlert(
                title: 'KYC cần cập nhật',
                detail: kycRejectionReason,
              ),
              const SizedBox(height: 8),
            ],
            if (rejectedDocuments.isNotEmpty) ...[
              ProviderReviewAlert(
                title: 'Giấy tờ bị từ chối',
                detail: rejectedRequiredSummaries.isNotEmpty
                    ? '${rejectedRequiredSummaries.join('\n')}\n\nMở danh sách KYC và thay từng ảnh bắt buộc bị từ chối.'
                    : rejectedDocuments.map((document) {
                        final type = providerDocumentTypeLabel(
                            document['type'].toString());
                        final reason =
                            reviewReason(document) ?? 'Hãy tải ảnh rõ hơn.';
                        return '$type: $reason';
                      }).join('\n'),
              ),
              const SizedBox(height: 8),
            ],
            if (bankRejectionReason != null) ...[
              ProviderReviewAlert(
                title: 'Thông tin ngân hàng cần cập nhật',
                detail:
                    '$bankRejectionReason\n\nMở mục Thu nhập và gửi lại thông tin ngân hàng khi cần rút hoặc nộp tiền.',
              ),
              const SizedBox(height: 8),
            ],
            ProviderOnboardingStepCard(
              step: '1',
              title: 'Hồ sơ cơ bản',
              detail: addressText == null || addressText.isEmpty
                  ? 'Thêm họ tên pháp lý, tên hiển thị, ngày sinh và khu vực phục vụ.'
                  : addressText,
              status: hasBasicProfile ? 'Hoàn tất' : 'Bắt buộc',
              complete: hasBasicProfile,
              icon: Icons.badge_outlined,
              actionLabel: hasBasicProfile ? 'Sửa hồ sơ' : 'Tạo hồ sơ',
              onPressed: isSaving ? null : onFillBasicProfile,
            ),
            ProviderOnboardingStepCard(
              step: '2',
              title: 'Xác minh KYC',
              detail: rejectedRequiredSummaries.isNotEmpty
                  ? 'Thay ${rejectedRequiredSummaries.length} ảnh bắt buộc bị từ chối rồi gửi lại KYC.'
                  : 'Đã có $submittedKycRequiredCount/${requiredKycTypes.length} ảnh bắt buộc. Trạng thái: ${providerOnboardingReviewStatusLabel(kycStatus)}.',
              status: kycStatus == 'APPROVED'
                  ? 'Đã duyệt'
                  : kycDocumentsReady
                      ? 'Sẵn sàng gửi'
                      : 'Cần tải giấy tờ',
              complete: kycStatus == 'APPROVED',
              icon: Icons.verified_user_outlined,
              actionLabel: kycStatus == 'REJECTED'
                  ? 'Gửi lại KYC'
                  : kycDocumentsReady
                      ? 'Gửi KYC'
                      : 'Mở danh sách KYC',
              onPressed: isSaving ? null : onSubmitKyc,
            ),
            ProviderKycDecisionChecklist(
              items: kycDecisionItems,
              reviewStatus: providerOnboardingReviewStatusLabel(kycStatus),
            ),
            ProviderOnboardingStepCard(
              step: '3',
              title: 'Thông tin ngân hàng',
              detail: providerBankAccountStepDetail(
                status: bankStatus,
                rejectionReason: bankRejectionReason,
              ),
              status: bankStatus == 'APPROVED'
                  ? 'Đã duyệt'
                  : bankStatus == 'REJECTED'
                      ? 'Cần sửa'
                      : bankStatus == 'PENDING_REVIEW'
                          ? 'Đang xét duyệt'
                          : 'Khi cần',
              complete: bankStatus == 'APPROVED',
              icon: Icons.account_balance_outlined,
              actionLabel: bankStatus == 'REJECTED'
                  ? 'Gửi lại thông tin ngân hàng'
                  : bankStatus == null
                      ? null
                      : 'Cập nhật thông tin ngân hàng',
              onPressed:
                  isSaving || bankStatus == null ? null : onAddBankAccount,
            ),
            ProviderOnboardingStepCard(
              step: '4',
              title: 'Hoạt động ví',
              detail: walletOperationsDetail,
              status: canWithdraw
                  ? 'Sẵn sàng'
                  : payoutPrerequisiteReady
                      ? 'Xét duyệt thủ công'
                      : completedBookingCount == 0
                          ? 'Sau thu nhập đầu tiên'
                          : 'Cần thỏa thuận',
              complete: canWithdraw || payoutPrerequisiteReady,
              icon: Icons.payments_outlined,
              actionLabel: completedBookingCount == 0
                  ? null
                  : missingAgreementCount > 0
                      ? 'Xem thỏa thuận'
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
    return 'Cấp 2 đang hoạt động';
  }
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' đăng ký')
      .replaceAll('_ACTIVE', ' hoạt động')
      .replaceAll('_PAYOUT_ENABLED', ' thanh toán')
      .replaceAll('_TRUSTED', ' đã xét duyệt');
}
