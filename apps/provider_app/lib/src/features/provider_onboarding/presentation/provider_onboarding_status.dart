import 'widgets/provider_document_upload_slots.dart';

const partnerBankCorrectionDefaultReason = '입금 정보가 정확하지 않아 입금이 되지 않습니다';

class ProviderOnboardingPriority {
  const ProviderOnboardingPriority({
    required this.title,
    required this.detail,
    required this.tone,
    this.actionKey,
    this.buttonLabel,
  });

  final String title;
  final String detail;
  final String tone;
  final String? actionKey;
  final String? buttonLabel;
}

class ProviderOnboardingGateItem {
  const ProviderOnboardingGateItem({
    required this.label,
    required this.detail,
    required this.complete,
  });

  final String label;
  final String detail;
  final bool complete;
}

class ProviderKycDecisionItem {
  const ProviderKycDecisionItem({
    required this.label,
    required this.detail,
    required this.complete,
  });

  final String label;
  final String detail;
  final bool complete;
}

class ProviderOnboardingLevelMilestone {
  const ProviderOnboardingLevelMilestone({
    required this.level,
    required this.title,
    required this.detail,
    required this.complete,
    required this.current,
  });

  final String level;
  final String title;
  final String detail;
  final bool complete;
  final bool current;
}

ProviderOnboardingPriority providerOnboardingPriorityFromSnapshot(
    Map<String, dynamic> snapshot) {
  final nextActions = _asList(snapshot['nextRequiredActions'])
      .map((action) => action.toString())
      .toList();
  final documents = _asList(snapshot['documents']);
  final requiredKycTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
  final submittedKycRequiredCount = documents
      .map(_asMap)
      .whereType<Map<String, dynamic>>()
      .where(isProviderSubmittedDocumentUsableForKyc)
      .map((document) => document['type']?.toString())
      .where((type) => requiredKycTypes.contains(type))
      .toSet()
      .length;
  final kycDocumentsReady =
      submittedKycRequiredCount >= requiredKycTypes.length;
  final bankAccounts = _asList(snapshot['bankAccounts']);
  final bankStatus = bankAccounts.isEmpty
      ? null
      : _asMap(bankAccounts.first)?['status']?.toString();
  final bankRejectionReason =
      bankAccounts.isEmpty ? null : reviewReason(_asMap(bankAccounts.first));
  final kyc = _asMap(snapshot['kyc']);
  final verification = _asMap(snapshot['verification']);
  final kycStatus =
      kyc?['status']?.toString() ?? verification?['status']?.toString();
  final taxProfile = _asMap(snapshot['taxProfile']);
  final taxStatus = taxProfile?['status']?.toString();
  final taxRejectionReason = reviewReason(taxProfile);
  final payoutGate = _asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
  final payoutMissing = _asMap(payoutGate['missing']) ?? <String, dynamic>{};
  final canWithdraw = payoutGate['canWithdraw'] == true;
  final completedBookingCount =
      _asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
  final missingAgreementCount = _asList(payoutMissing['agreements']).length;

  if (nextActions.contains('BASIC_PROFILE')) {
    return const ProviderOnboardingPriority(
      title: 'Start with your public profile',
      detail:
          'Add your legal name, public display name, birthday, and service area before taking requests. Tax address can wait until first earning.',
      tone: 'warning',
      actionKey: 'BASIC_PROFILE',
      buttonLabel: 'Complete profile',
    );
  }

  if (nextActions.contains('KYC_REVIEW')) {
    if (kycStatus == 'REJECTED') {
      return const ProviderOnboardingPriority(
        title: 'Fix rejected KYC',
        detail:
            'Review the rejection message, upload clearer CCCD and selfie photos, then resubmit.',
        tone: 'warning',
        actionKey: 'KYC_REVIEW',
        buttonLabel: 'Resubmit KYC',
      );
    }
    if (kycDocumentsReady) {
      return const ProviderOnboardingPriority(
        title: 'Submit KYC for admin review',
        detail:
            'All required identity photos are attached. Submit them so admin can unlock Level 2.',
        tone: 'info',
        actionKey: 'KYC_REVIEW',
        buttonLabel: 'Submit KYC',
      );
    }
    return ProviderOnboardingPriority(
      title: 'Upload identity photos',
      detail:
          '$submittedKycRequiredCount of ${requiredKycTypes.length} required KYC photos are ready. Upload the missing photos below.',
      tone: 'warning',
      actionKey: 'KYC_REVIEW',
      buttonLabel: 'Open KYC checklist',
    );
  }

  if (nextActions.contains('BANK_ACCOUNT_REVIEW')) {
    return ProviderOnboardingPriority(
      title: bankStatus == 'REJECTED'
          ? 'Fix rejected bank account'
          : 'Add payout bank account',
      detail: bankStatus == 'REJECTED'
          ? providerBankAccountStepDetail(
              status: bankStatus,
              rejectionReason: bankRejectionReason,
            )
          : 'Bank details are used for manual wallet withdrawal/deposit checks when money movement is requested.',
      tone: 'warning',
      actionKey: 'BANK_ACCOUNT_REVIEW',
      buttonLabel: bankStatus == 'REJECTED' ? 'Resubmit bank' : 'Add bank',
    );
  }

  if (nextActions.contains('TAX_PROFILE_REVIEW')) {
    return ProviderOnboardingPriority(
      title: taxStatus == 'REJECTED'
          ? 'Fix rejected tax profile'
          : 'Add tax profile for payout',
      detail: taxStatus == 'REJECTED'
          ? providerTaxProfileStepDetail(
              completedBookingCount: completedBookingCount,
              status: taxStatus,
              rejectionReason: taxRejectionReason,
              missingAgreementCount: missingAgreementCount,
            )
          : 'Tax information is only required after earnings exist, but it must be approved before withdrawal.',
      tone: 'warning',
      actionKey: 'TAX_PROFILE_REVIEW',
      buttonLabel: taxStatus == 'REJECTED' ? 'Resubmit tax' : 'Add tax',
    );
  }

  if (nextActions.contains('RESIDENTIAL_ADDRESS')) {
    return const ProviderOnboardingPriority(
      title: 'Add tax address',
      detail:
          'First earning is recorded. Save a residential/tax address before withdrawal is available.',
      tone: 'warning',
      actionKey: 'RESIDENTIAL_ADDRESS',
      buttonLabel: 'Update address',
    );
  }

  if (nextActions.contains('AGREEMENTS')) {
    return ProviderOnboardingPriority(
      title: 'Accept payout agreements',
      detail:
          '$missingAgreementCount payout agreement(s) still need acceptance before withdrawal is available.',
      tone: 'warning',
      actionKey: 'AGREEMENTS',
      buttonLabel: 'Review agreements',
    );
  }

  if (canWithdraw) {
    return const ProviderOnboardingPriority(
      title: 'Partner setup is complete',
      detail:
          'This partner can receive bookings and request payouts when earnings are available.',
      tone: 'success',
    );
  }

  if (completedBookingCount == 0) {
    return const ProviderOnboardingPriority(
      title: 'Ready for the first booking',
      detail:
          'Core setup is clear. Keep the app online so customers can send direct requests.',
      tone: 'success',
    );
  }

  return const ProviderOnboardingPriority(
    title: 'Waiting for admin review',
    detail:
        'Submitted information is saved. Refresh this page after admin finishes the remaining review.',
    tone: 'info',
  );
}

List<ProviderOnboardingLevelMilestone> providerLevelMilestonesFromSnapshot(
    Map<String, dynamic> snapshot) {
  final currentLevel = snapshot['level']?.toString() ?? 'LEVEL_1_SIGNUP';
  final nextActions = _asList(snapshot['nextRequiredActions'])
      .map((action) => action.toString())
      .toSet();
  final kyc = _asMap(snapshot['kyc']);
  final verification = _asMap(snapshot['verification']);
  final basicProfileComplete = !nextActions.contains('BASIC_PROFILE');
  final kycApproved =
      (kyc?['status']?.toString() ?? verification?['status']?.toString()) ==
          'APPROVED';
  final currentIndex = _providerLevelIndex(currentLevel);

  bool completedByLevelOrCondition(String level, bool condition) {
    return currentIndex >= _providerLevelIndex(level) || condition;
  }

  return [
    ProviderOnboardingLevelMilestone(
      level: 'LEVEL_1_SIGNUP',
      title: 'Level 1 - signup ready',
      detail: basicProfileComplete
          ? 'Phone login and public/basic profile are ready.'
          : 'Complete phone login and basic public profile first.',
      complete:
          completedByLevelOrCondition('LEVEL_1_SIGNUP', basicProfileComplete),
      current: currentLevel == 'LEVEL_1_SIGNUP',
    ),
    ProviderOnboardingLevelMilestone(
      level: 'LEVEL_2_ACTIVE',
      title: 'Level 2 - can receive work',
      detail: kycApproved && basicProfileComplete
          ? 'Profile, KYC, and required documents are approved. This partner can receive bookings.'
          : 'Requires approved profile, CCCD/selfie KYC, and service-ready details. Bank setup is handled later from wallet operations.',
      complete: completedByLevelOrCondition(
          'LEVEL_2_ACTIVE', kycApproved && basicProfileComplete),
      current: currentLevel == 'LEVEL_2_ACTIVE',
    ),
  ];
}

List<ProviderKycDecisionItem> providerKycDecisionChecklistFromSnapshot(
    Map<String, dynamic> snapshot) {
  final kyc = _asMap(snapshot['kyc']);
  final verification = _asMap(snapshot['verification']);
  final basicProfile = _asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
  final documents = _asList(snapshot['documents']);
  final requiredTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
  final kycStatus =
      kyc?['status']?.toString() ?? verification?['status']?.toString();
  final legalName = _firstNonEmptyString([
    kyc?['legalName'],
    kyc?['fullName'],
    basicProfile['legalName'],
    basicProfile['fullName'],
  ]);
  final identityNumber = _firstNonEmptyString([
    kyc?['identityNumber'],
    kyc?['cccdNumber'],
    kyc?['cmndNumber'],
    kyc?['documentNumber'],
    verification?['identityNumber'],
  ]);
  final approvedRequiredTypes = documents
      .map(_asMap)
      .whereType<Map<String, dynamic>>()
      .where((document) => document['status']?.toString() == 'APPROVED')
      .map((document) => document['type']?.toString())
      .where((type) => requiredTypes.contains(type))
      .toSet();
  final rejectedRequiredSummaries = providerRejectedKycDocumentSummaries(
    submittedDocuments: documents,
    uploadedDocumentIds: const {},
    requiredTypes: requiredTypes,
  );
  final approvedCount = approvedRequiredTypes.length;

  return [
    ProviderKycDecisionItem(
      label: 'KYC request submitted',
      detail: kycStatus == null
          ? 'Upload identity photos, then submit KYC for HANDS review.'
          : 'Current review status: $kycStatus.',
      complete: kycStatus != null,
    ),
    ProviderKycDecisionItem(
      label: 'Legal name captured',
      detail:
          legalName ?? 'Add the legal name exactly as shown on CCCD/CMND.',
      complete: legalName != null,
    ),
    ProviderKycDecisionItem(
      label: 'CCCD/CMND number captured',
      detail: identityNumber ??
          'Add the Vietnamese identity number before admin approval.',
      complete: identityNumber != null,
    ),
    ProviderKycDecisionItem(
      label: 'Required identity photos approved',
      detail:
          '$approvedCount of ${requiredTypes.length} required photo(s) approved.',
      complete: approvedCount >= requiredTypes.length,
    ),
    ProviderKycDecisionItem(
      label: 'Rejected evidence resolved',
      detail: rejectedRequiredSummaries.isEmpty
          ? 'No rejected required KYC photo needs replacement.'
          : rejectedRequiredSummaries.join('; '),
      complete: rejectedRequiredSummaries.isEmpty,
    ),
  ];
}

List<ProviderOnboardingGateItem> providerPayoutGateItemsFromSnapshot(
    Map<String, dynamic> snapshot) {
  final payoutGate = _asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
  final payoutMissing = _asMap(payoutGate['missing']) ?? <String, dynamic>{};
  final completedBookingCount =
      _asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
  final payoutSetupStarted = completedBookingCount > 0;
  final taxProfile = _asMap(snapshot['taxProfile']);
  final taxStatus = taxProfile?['status']?.toString();
  final basicProfile = _asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
  final address = basicProfile['residentialAddress']?.toString().trim() ?? '';
  final missingAgreements = _asList(payoutMissing['agreements'])
      .map((value) => value.toString())
      .where((value) => value.isNotEmpty)
      .toList();
  final requiredAgreements = requiredPayoutAgreementTypesFromSnapshot(snapshot);
  final acceptedAgreementCount =
      (requiredAgreements.length - missingAgreements.length)
          .clamp(0, requiredAgreements.length);

  return [
    ProviderOnboardingGateItem(
      label: 'First completed service',
      detail: completedBookingCount > 0
          ? '$completedBookingCount completed service(s) recorded.'
          : 'Complete the first customer booking before tax and settlement setup starts.',
      complete: payoutMissing['firstCompletedService'] != true &&
          completedBookingCount > 0,
    ),
    ProviderOnboardingGateItem(
      label: 'Tax profile',
      detail: taxStatus == 'APPROVED'
          ? 'MST/tax profile is approved by admin.'
          : !payoutSetupStarted
              ? 'Tax information is deferred until revenue exists.'
              : 'Submit MST, legal name, and registered address for admin review.',
      complete: payoutSetupStarted &&
          payoutMissing['taxProfileApproved'] != true &&
          taxStatus == 'APPROVED',
    ),
    ProviderOnboardingGateItem(
      label: 'Residential address',
      detail: address.isNotEmpty
          ? address
          : !payoutSetupStarted
              ? 'Residential address is requested before withdrawal after revenue exists.'
              : 'Save a residential address before payout approval.',
      complete: payoutSetupStarted &&
          payoutMissing['residentialAddress'] != true &&
          address.isNotEmpty,
    ),
    ProviderOnboardingGateItem(
      label: 'Payout agreements',
      detail: !payoutSetupStarted
          ? 'Payout and tax agreements are deferred until first earned revenue.'
          : missingAgreements.isEmpty
              ? 'All required agreements are accepted.'
              : '$acceptedAgreementCount of ${requiredAgreements.length} accepted. Missing: ${missingAgreements.map(_agreementLabel).join(', ')}.',
      complete: payoutSetupStarted && missingAgreements.isEmpty,
    ),
  ];
}

bool providerFirstRevenuePayoutSetupActiveFromSnapshot(
    Map<String, dynamic> snapshot) {
  final completedBookingCount =
      _asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
  final payoutGate = _asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
  return completedBookingCount > 0 && payoutGate['canWithdraw'] != true;
}

String providerLogActionLabel(String value) {
  switch (value) {
    case 'basic_profile.update':
      return 'Basic profile updated';
    case 'kyc.submit':
      return 'KYC submitted';
    case 'kyc.approved':
      return 'KYC approved';
    case 'kyc.rejected':
      return 'KYC rejected';
    case 'document.approved':
      return 'Document approved';
    case 'document.rejected':
      return 'Document rejected';
    case 'bank_account.submit':
      return 'Bank account submitted';
    case 'bank_account.approved':
      return 'Bank account approved';
    case 'bank_account.rejected':
      return 'Bank account rejected';
    case 'tax_profile.submit':
      return 'Tax profile submitted';
    case 'tax_profile.approved':
      return 'Tax profile approved';
    case 'tax_profile.rejected':
      return 'Tax profile rejected';
    case 'agreement.accept':
      return 'Agreement accepted';
    default:
      return _readableAction(value.replaceAll('.', '_'));
  }
}

String _agreementLabel(String value) {
  switch (value) {
    case 'TERMS':
      return 'Service terms';
    case 'PRIVACY':
      return 'Privacy';
    case 'LOCATION':
      return 'Location';
    case 'PAYOUT':
      return 'Payout';
    case 'TAX':
      return 'Tax';
    default:
      return _readableAction(value);
  }
}

String? reviewReason(Map<String, dynamic>? value) {
  final reason = value?['rejectionReason']?.toString().trim();
  return reason == null || reason.isEmpty ? null : reason;
}

String providerBankAccountStepDetail({
  required String? status,
  String? rejectionReason,
}) {
  if (status == null) {
    return 'Add bank name, account number, account holder, and optional QR banking info.';
  }
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix = reason == null || reason.isEmpty
        ? '$partnerBankCorrectionDefaultReason.'
        : 'Rejected: $reason.';
    return '$prefix Update the bank details and submit again.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Submitted. Waiting for admin approval before payout.';
  }
  if (status == 'APPROVED') {
    return 'Approved for payout.';
  }
  return 'Review status: $status.';
}

String providerTaxProfileStepDetail({
  required int completedBookingCount,
  required String? status,
  String? rejectionReason,
  required int missingAgreementCount,
}) {
  if (completedBookingCount == 0) {
    return 'Tax and payout agreements are requested after the first earned revenue.';
  }
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix =
        reason == null || reason.isEmpty ? 'Rejected.' : 'Rejected: $reason.';
    return '$prefix Update MST, legal name, and registered address before withdrawal.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Submitted. Waiting for admin tax review. Agreements missing: $missingAgreementCount.';
  }
  if (status == 'APPROVED') {
    return 'Tax approved. Agreements missing: $missingAgreementCount.';
  }
  return 'Tax: ${status ?? 'missing'}, agreements missing: $missingAgreementCount.';
}

List<String> requiredKycDocumentTypesFromSnapshot(
    Map<String, dynamic> snapshot) {
  final requirements = _asMap(snapshot['requirements']);
  final values = _asList(requirements?['requiredKycDocumentTypes'])
      .map((value) => value.toString())
      .where((value) => value.isNotEmpty)
      .toList();
  return values.isEmpty ? requiredProviderDocumentTypes : values;
}

List<String> requiredPayoutAgreementTypesFromSnapshot(
    Map<String, dynamic> snapshot) {
  final requirements = _asMap(snapshot['requirements']);
  final values = _asList(requirements?['requiredPayoutAgreements'])
      .map((value) => value.toString())
      .where((value) => value.isNotEmpty)
      .toList();
  return values.isEmpty
      ? const ['TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX']
      : values;
}

String providerAgreementVersionFromSnapshot(Map<String, dynamic> snapshot) {
  final requirements = _asMap(snapshot['requirements']);
  final version = requirements?['agreementVersion']?.toString().trim();
  return version == null || version.isEmpty ? 'current' : version;
}

String _readableAction(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

num? _asNum(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value);
  }
  return null;
}

String? _firstNonEmptyString(List<dynamic> values) {
  for (final value in values) {
    final text = value?.toString().trim();
    if (text != null && text.isNotEmpty) {
      return text;
    }
  }
  return null;
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

List<dynamic> _asList(dynamic value) {
  return value is List<dynamic> ? value : const [];
}

int _providerLevelIndex(String level) {
  switch (level) {
    case 'LEVEL_4_TRUSTED':
      return 4;
    case 'LEVEL_3_PAYOUT_ENABLED':
      return 3;
    case 'LEVEL_2_ACTIVE':
      return 2;
    case 'LEVEL_1_SIGNUP':
      return 1;
    default:
      return 0;
  }
}
