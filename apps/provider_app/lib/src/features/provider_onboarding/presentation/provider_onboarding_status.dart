import 'widgets/provider_document_upload_slots.dart';

const partnerBankCorrectionDefaultReason =
    'Thông tin ngân hàng nhận tiền không chính xác nên chưa thể chuyển khoản.';

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
  final payoutGate = _asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
  final payoutMissing = _asMap(payoutGate['missing']) ?? <String, dynamic>{};
  final bankCorrectionRequest =
      providerBankCorrectionRequestFromSnapshot(snapshot);
  final canWithdraw = payoutGate['canWithdraw'] == true;
  final completedBookingCount =
      _asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
  final missingAgreementCount = _asList(payoutMissing['agreements']).length;

  if (nextActions.contains('BASIC_PROFILE')) {
    return const ProviderOnboardingPriority(
      title: 'Hoàn thiện hồ sơ công khai',
      detail:
          'Thêm họ tên pháp lý, tên hiển thị, ngày sinh và khu vực phục vụ trước khi nhận yêu cầu.',
      tone: 'warning',
      actionKey: 'BASIC_PROFILE',
      buttonLabel: 'Hoàn thiện hồ sơ',
    );
  }

  if (nextActions.contains('KYC_REVIEW')) {
    if (kycStatus == 'REJECTED') {
      return const ProviderOnboardingPriority(
        title: 'Cập nhật hồ sơ KYC bị từ chối',
        detail:
            'Xem lý do từ chối, tải lại ảnh CCCD và ảnh chân dung rõ hơn rồi gửi lại.',
        tone: 'warning',
        actionKey: 'KYC_REVIEW',
        buttonLabel: 'Gửi lại KYC',
      );
    }
    if (kycDocumentsReady) {
      return const ProviderOnboardingPriority(
        title: 'Gửi KYC để xét duyệt',
        detail:
            'Đã đủ ảnh định danh bắt buộc. Gửi hồ sơ để HANDS xét duyệt quyền nhận việc.',
        tone: 'info',
        actionKey: 'KYC_REVIEW',
        buttonLabel: 'Gửi KYC',
      );
    }
    return ProviderOnboardingPriority(
      title: 'Tải ảnh định danh',
      detail:
          'Đã có $submittedKycRequiredCount/${requiredKycTypes.length} ảnh KYC bắt buộc. Hãy tải các ảnh còn thiếu bên dưới.',
      tone: 'warning',
      actionKey: 'KYC_REVIEW',
      buttonLabel: 'Mở danh sách KYC',
    );
  }

  if (nextActions.contains('BANK_ACCOUNT_REVIEW')) {
    return ProviderOnboardingPriority(
      title: bankStatus == 'REJECTED'
          ? 'Sửa thông tin ngân hàng'
          : 'Thêm thông tin ngân hàng',
      detail: bankStatus == 'REJECTED'
          ? providerBankAccountStepDetail(
              status: bankStatus,
              rejectionReason: bankRejectionReason,
            )
          : 'Thông tin ngân hàng được dùng khi yêu cầu rút tiền hoặc xác nhận nộp tiền.',
      tone: 'warning',
      actionKey: 'BANK_ACCOUNT_REVIEW',
      buttonLabel: bankStatus == 'REJECTED'
          ? 'Gửi lại thông tin ngân hàng'
          : 'Thêm thông tin ngân hàng',
    );
  }

  if (nextActions.contains('BANK_ACCOUNT_CORRECTION')) {
    return ProviderOnboardingPriority(
      title: 'Sửa thông tin ngân hàng',
      detail: providerBankCorrectionStepDetail(bankCorrectionRequest),
      tone: 'warning',
      actionKey: 'BANK_ACCOUNT_CORRECTION',
      buttonLabel: 'Gửi lại thông tin ngân hàng',
    );
  }

  if (nextActions.contains('RESIDENTIAL_ADDRESS')) {
    return const ProviderOnboardingPriority(
      title: 'Xác nhận địa chỉ liên hệ',
      detail:
          'Đã ghi nhận thu nhập đầu tiên. Hãy lưu địa chỉ liên hệ để tiếp tục xét duyệt ví.',
      tone: 'warning',
      actionKey: 'RESIDENTIAL_ADDRESS',
      buttonLabel: 'Cập nhật địa chỉ',
    );
  }

  if (nextActions.contains('AGREEMENTS')) {
    return ProviderOnboardingPriority(
      title: 'Chấp nhận thỏa thuận ví',
      detail:
          'Còn $missingAgreementCount thỏa thuận cần chấp nhận trước khi xét duyệt rút tiền.',
      tone: 'warning',
      actionKey: 'AGREEMENTS',
      buttonLabel: 'Xem thỏa thuận',
    );
  }

  if (canWithdraw) {
    return const ProviderOnboardingPriority(
      title: 'Ví đã sẵn sàng',
      detail: 'Bạn có thể nhận đặt lịch và yêu cầu hỗ trợ ví khi có thu nhập.',
      tone: 'success',
    );
  }

  if (completedBookingCount == 0) {
    return const ProviderOnboardingPriority(
      title: 'Sẵn sàng nhận đặt lịch đầu tiên',
      detail:
          'Thiết lập chính đã hoàn tất. Hãy bật trạng thái trực tuyến để nhận yêu cầu trực tiếp.',
      tone: 'success',
    );
  }

  return const ProviderOnboardingPriority(
    title: 'Tiếp tục thiết lập ví trong Thu nhập',
    detail:
        'Thông tin ngân hàng và thỏa thuận thanh toán sẽ được kiểm tra khi bạn yêu cầu rút tiền hoặc hỗ trợ nộp tiền.',
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
      title: 'Cấp 1 - hoàn tất đăng ký',
      detail: basicProfileComplete
          ? 'Đăng nhập bằng số điện thoại và hồ sơ cơ bản đã hoàn tất.'
          : 'Hãy hoàn tất đăng nhập và hồ sơ công khai cơ bản.',
      complete:
          completedByLevelOrCondition('LEVEL_1_SIGNUP', basicProfileComplete),
      current: currentLevel == 'LEVEL_1_SIGNUP',
    ),
    ProviderOnboardingLevelMilestone(
      level: 'LEVEL_2_ACTIVE',
      title: 'Cấp 2 - có thể nhận việc',
      detail: kycApproved && basicProfileComplete
          ? 'Hồ sơ, KYC và giấy tờ bắt buộc đã được duyệt. Bạn có thể nhận đặt lịch.'
          : 'Cần hồ sơ, CCCD, ảnh chân dung và thông tin dịch vụ được duyệt.',
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
      label: 'Đã gửi yêu cầu KYC',
      detail: kycStatus == null
          ? 'Tải ảnh định danh rồi gửi KYC để HANDS xét duyệt.'
          : 'Trạng thái xét duyệt hiện tại: $kycStatus.',
      complete: kycStatus != null,
    ),
    ProviderKycDecisionItem(
      label: 'Họ tên pháp lý',
      detail: legalName ?? 'Nhập đúng họ tên trên CCCD/CMND.',
      complete: legalName != null,
    ),
    ProviderKycDecisionItem(
      label: 'Số CCCD/CMND',
      detail: identityNumber ??
          'Nhập số giấy tờ định danh Việt Nam trước khi xét duyệt.',
      complete: identityNumber != null,
    ),
    ProviderKycDecisionItem(
      label: 'Ảnh định danh bắt buộc đã duyệt',
      detail: 'Đã duyệt $approvedCount/${requiredTypes.length} ảnh bắt buộc.',
      complete: approvedCount >= requiredTypes.length,
    ),
    ProviderKycDecisionItem(
      label: 'Đã xử lý ảnh bị từ chối',
      detail: rejectedRequiredSummaries.isEmpty
          ? 'Không có ảnh KYC bắt buộc nào cần thay thế.'
          : rejectedRequiredSummaries.join('; '),
      complete: rejectedRequiredSummaries.isEmpty,
    ),
  ];
}

List<ProviderOnboardingGateItem> providerPayoutGateItemsFromSnapshot(
    Map<String, dynamic> snapshot) {
  final payoutGate = _asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
  final payoutMissing = _asMap(payoutGate['missing']) ?? <String, dynamic>{};
  final bankCorrectionRequest =
      providerBankCorrectionRequestFromSnapshot(snapshot);
  final completedBookingCount =
      _asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
  final payoutSetupStarted = completedBookingCount > 0;
  final bankAccounts = _asList(snapshot['bankAccounts']);
  final bankStatus = bankAccounts.isEmpty
      ? null
      : _asMap(bankAccounts.first)?['status']?.toString();
  final missingAgreements = _asList(payoutMissing['agreements'])
      .map((value) => value.toString())
      .where((value) => value.isNotEmpty && value != 'TAX')
      .toList();
  final requiredAgreements = requiredPayoutAgreementTypesFromSnapshot(snapshot);
  final acceptedAgreementCount =
      (requiredAgreements.length - missingAgreements.length)
          .clamp(0, requiredAgreements.length);
  final bankDetail = !payoutSetupStarted
      ? 'Thông tin ngân hàng được yêu cầu trong mục Thu nhập khi cần rút hoặc nộp tiền.'
      : bankCorrectionRequest != null
          ? providerBankCorrectionStepDetail(bankCorrectionRequest)
          : bankStatus == 'APPROVED'
              ? 'Thông tin ngân hàng đã được duyệt cho giao dịch ví.'
              : bankStatus == 'PENDING_REVIEW'
                  ? 'Thông tin ngân hàng đang chờ xét duyệt.'
                  : bankStatus == 'REJECTED'
                      ? 'Cần sửa thông tin ngân hàng trước khi tiếp tục rút hoặc nộp tiền.'
                      : 'Thêm thông tin ngân hàng trong mục Thu nhập khi cần rút hoặc nộp tiền.';

  return [
    ProviderOnboardingGateItem(
      label: 'Dịch vụ hoàn tất đầu tiên',
      detail: completedBookingCount > 0
          ? 'Đã ghi nhận $completedBookingCount dịch vụ hoàn tất.'
          : 'Hoàn tất đặt lịch đầu tiên trước khi bắt đầu xét duyệt rút hoặc nộp tiền.',
      complete: payoutMissing['firstCompletedService'] != true &&
          completedBookingCount > 0,
    ),
    ProviderOnboardingGateItem(
      label: 'Thông tin ngân hàng',
      detail: bankDetail,
      complete: payoutSetupStarted && bankStatus == 'APPROVED',
    ),
    ProviderOnboardingGateItem(
      label: 'Thỏa thuận ví',
      detail: !payoutSetupStarted
          ? 'Thỏa thuận thanh toán sẽ được yêu cầu sau khi có thu nhập đầu tiên.'
          : missingAgreements.isEmpty
              ? 'Đã chấp nhận tất cả thỏa thuận bắt buộc.'
              : 'Đã chấp nhận $acceptedAgreementCount/${requiredAgreements.length}. Còn thiếu: ${missingAgreements.map(_agreementLabel).join(', ')}.',
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
      return 'Đã cập nhật hồ sơ cơ bản';
    case 'kyc.submit':
      return 'Đã gửi KYC';
    case 'kyc.approved':
      return 'KYC đã được duyệt';
    case 'kyc.rejected':
      return 'KYC bị từ chối';
    case 'document.approved':
      return 'Giấy tờ đã được duyệt';
    case 'document.rejected':
      return 'Giấy tờ bị từ chối';
    case 'bank_account.submit':
      return 'Đã gửi tài khoản ngân hàng';
    case 'bank_account.approved':
      return 'Tài khoản ngân hàng đã được duyệt';
    case 'bank_account.rejected':
      return 'Tài khoản ngân hàng bị từ chối';
    case 'tax_profile.submit':
      return 'Đã gửi thông tin thuế';
    case 'tax_profile.approved':
      return 'Thông tin thuế đã được duyệt';
    case 'tax_profile.rejected':
      return 'Thông tin thuế bị từ chối';
    case 'agreement.accept':
      return 'Đã chấp nhận thỏa thuận';
    default:
      return 'Hoạt động tài khoản';
  }
}

String providerOnboardingReviewStatusLabel(Object? value) => switch (value) {
      'DRAFT' => 'Bản nháp',
      'SUBMITTED' || 'PENDING_REVIEW' => 'Đang chờ xét duyệt',
      'APPROVED' => 'Đã duyệt',
      'REJECTED' => 'Bị từ chối',
      null => 'Chưa gửi',
      _ => 'Chưa xác định',
    };

String _agreementLabel(String value) {
  switch (value) {
    case 'TERMS':
      return 'Điều khoản dịch vụ';
    case 'PRIVACY':
      return 'Quyền riêng tư';
    case 'LOCATION':
      return 'Vị trí';
    case 'PAYOUT':
      return 'Thanh toán';
    case 'TAX':
      return 'Thuế';
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
    return 'Thông tin ngân hàng được yêu cầu trong mục Thu nhập khi cần rút hoặc nộp tiền.';
  }
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix = reason == null || reason.isEmpty
        ? partnerBankCorrectionDefaultReason
        : 'Bị từ chối: $reason.';
    return '$prefix Hãy cập nhật thông tin ngân hàng và gửi lại.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Đã gửi. Đang chờ duyệt trước khi xử lý rút hoặc nộp tiền.';
  }
  if (status == 'APPROVED') {
    return 'Đã được duyệt cho giao dịch ví.';
  }
  return 'Trạng thái xét duyệt: $status.';
}

Map<String, dynamic>? providerBankCorrectionRequestFromSnapshot(
    Map<String, dynamic> snapshot) {
  final payoutGate = _asMap(snapshot['payoutGate']);
  final correction = _asMap(payoutGate?['bankCorrectionRequest']);
  if (correction?['required'] != true) {
    return null;
  }
  return correction;
}

String providerBankCorrectionStepDetail(Map<String, dynamic>? correction) {
  final reason = correction?['reason']?.toString().trim();
  final message = correction?['message']?.toString().trim();
  final detail = reason != null && reason.isNotEmpty
      ? reason
      : message != null && message.isNotEmpty
          ? message
          : partnerBankCorrectionDefaultReason;
  return '$detail Hãy cập nhật thông tin ngân hàng và gửi lại.';
}

String providerTaxProfileStepDetail({
  required int completedBookingCount,
  required String? status,
  String? rejectionReason,
  required int missingAgreementCount,
}) {
  if (completedBookingCount == 0) {
    return 'Hiện chưa yêu cầu hồ sơ thuế.';
  }
  if (status == 'REJECTED') {
    final reason = rejectionReason?.trim();
    final prefix = reason == null || reason.isEmpty
        ? 'Hồ sơ thuế cũ đã bị từ chối.'
        : 'Hồ sơ thuế cũ đã bị từ chối: $reason.';
    return '$prefix Hiện chưa yêu cầu hồ sơ thuế.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Hồ sơ thuế cũ đang chờ xét duyệt và không chặn quyền nhận việc.';
  }
  if (status == 'APPROVED') {
    return 'Hồ sơ thuế cũ đã được lưu và không làm thay đổi cấp tài khoản.';
  }
  return 'Hiện chưa yêu cầu hồ sơ thuế.';
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
      ? const ['TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT']
      : values.where((value) => value != 'TAX').toList();
}

String providerAgreementVersionFromSnapshot(Map<String, dynamic> snapshot) {
  final requirements = _asMap(snapshot['requirements']);
  final version = requirements?['agreementVersion']?.toString().trim();
  return version == null || version.isEmpty ? 'hiện tại' : version;
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
