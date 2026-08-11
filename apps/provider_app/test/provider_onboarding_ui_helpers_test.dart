import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/provider_onboarding/presentation/provider_onboarding_status.dart';
import 'package:provider_app/src/features/provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import 'package:provider_app/src/features/provider_onboarding/presentation/widgets/provider_onboarding_forms.dart';

void main() {
  test('reads onboarding requirements from API snapshot', () {
    final snapshot = {
      'requirements': {
        'requiredKycDocumentTypes': ['CCCD_FRONT', 'SELFIE'],
        'requiredPayoutAgreements': ['TERMS', 'TAX'],
        'agreementVersion': 'hands-provider-2026-06',
      },
    };

    expect(requiredKycDocumentTypesFromSnapshot(snapshot), [
      'CCCD_FRONT',
      'SELFIE',
    ]);
    expect(requiredPayoutAgreementTypesFromSnapshot(snapshot), [
      'TERMS',
    ]);
    expect(providerAgreementVersionFromSnapshot(snapshot),
        'hands-provider-2026-06');
  });

  test('falls back to default onboarding requirements', () {
    expect(requiredKycDocumentTypesFromSnapshot({}), [
      'CCCD_FRONT',
      'CCCD_BACK',
      'SELFIE',
    ]);
    expect(requiredPayoutAgreementTypesFromSnapshot({}), [
      'TERMS',
      'PRIVACY',
      'LOCATION',
      'PAYOUT',
    ]);
    expect(providerAgreementVersionFromSnapshot({}), 'hiện tại');
  });

  test('normalizes rejected review reasons', () {
    expect(reviewReason({'rejectionReason': ' Blurry CCCD photo '}),
        'Blurry CCCD photo');
    expect(reviewReason({'rejectionReason': '   '}), isNull);
    expect(reviewReason(null), isNull);
  });

  test(
      'describes wallet bank and legacy tax review states for onboarding steps',
      () {
    expect(
      providerBankAccountStepDetail(
        status: 'REJECTED',
        rejectionReason: 'Account holder does not match CCCD',
      ),
      'Bị từ chối: Account holder does not match CCCD. Hãy cập nhật thông tin ngân hàng và gửi lại.',
    );
    expect(
      providerBankAccountStepDetail(status: 'REJECTED'),
      'Thông tin ngân hàng nhận tiền không chính xác nên chưa thể chuyển khoản. Hãy cập nhật thông tin ngân hàng và gửi lại.',
    );
    expect(
      providerBankAccountStepDetail(status: 'PENDING_REVIEW'),
      'Đã gửi. Đang chờ duyệt trước khi xử lý rút hoặc nộp tiền.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 2,
        status: 'REJECTED',
        rejectionReason: 'MST is invalid',
        missingAgreementCount: 1,
      ),
      'Hồ sơ thuế cũ đã bị từ chối: MST is invalid. Hiện chưa yêu cầu hồ sơ thuế.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 0,
        status: null,
        missingAgreementCount: 5,
      ),
      'Hiện chưa yêu cầu hồ sơ thuế.',
    );
  });

  test('builds payout gate checklist from onboarding snapshot', () {
    final lockedItems = providerPayoutGateItemsFromSnapshot({
      'completedBookingCount': 0,
      'basicProfile': {'residentialAddress': ''},
      'payoutGate': {
        'missing': {
          'firstCompletedService': true,
          'taxProfileApproved': false,
          'residentialAddress': false,
          'agreements': <String>[],
        },
      },
      'requirements': {
        'requiredPayoutAgreements': ['TERMS', 'PAYOUT', 'TAX'],
      },
    });

    expect(lockedItems, hasLength(3));
    expect(lockedItems.where((item) => item.complete), isEmpty);
    expect(lockedItems[1].label, 'Thông tin ngân hàng');
    expect(lockedItems[1].detail, contains('được yêu cầu trong mục Thu nhập'));
    expect(lockedItems.last.detail, contains('sau khi có thu nhập đầu tiên'));

    final readyItems = providerPayoutGateItemsFromSnapshot({
      'completedBookingCount': 2,
      'bankAccounts': [
        {'status': 'APPROVED'},
      ],
      'basicProfile': {
        'residentialAddress': 'District 1, Ho Chi Minh City',
      },
      'payoutGate': {
        'missing': {'agreements': <String>[]},
      },
    });

    expect(readyItems.every((item) => item.complete), isTrue);
    expect(readyItems[1].detail, contains('đã được duyệt cho giao dịch ví'));
  });

  test('builds KYC decision checklist from onboarding snapshot', () {
    final missingItems = providerKycDecisionChecklistFromSnapshot({
      'kyc': {'status': 'PENDING_REVIEW'},
      'basicProfile': {'legalName': '   '},
      'documents': const [
        {'type': 'CCCD_FRONT', 'status': 'APPROVED'},
        {
          'type': 'CCCD_BACK',
          'status': 'REJECTED',
          'rejectionReason': 'Back side is blurry',
        },
      ],
    });

    expect(missingItems, hasLength(5));
    expect(missingItems[0].complete, isTrue);
    expect(missingItems[1].complete, isFalse);
    expect(missingItems[2].detail, contains('giấy tờ định danh Việt Nam'));
    expect(missingItems[3].detail, 'Đã duyệt 1/3 ảnh bắt buộc.');
    expect(missingItems[4].detail, contains('Back side is blurry'));

    final readyItems = providerKycDecisionChecklistFromSnapshot({
      'kyc': {
        'status': 'APPROVED',
        'legalName': 'Nguyen Thi Thuy',
        'identityNumber': '079123456789',
      },
      'documents': const [
        {'type': 'CCCD_FRONT', 'status': 'APPROVED'},
        {'type': 'CCCD_BACK', 'status': 'APPROVED'},
        {'type': 'SELFIE', 'status': 'APPROVED'},
      ],
    });

    expect(readyItems.every((item) => item.complete), isTrue);
    expect(readyItems[1].detail, 'Nguyen Thi Thuy');
  });

  test('activates payout setup only after first revenue', () {
    expect(
      providerFirstRevenuePayoutSetupActiveFromSnapshot({
        'completedBookingCount': 0,
        'payoutGate': {'canWithdraw': false},
      }),
      isFalse,
    );
    expect(
      providerFirstRevenuePayoutSetupActiveFromSnapshot({
        'completedBookingCount': 1,
        'payoutGate': {'canWithdraw': false},
      }),
      isTrue,
    );
    expect(
      providerFirstRevenuePayoutSetupActiveFromSnapshot({
        'completedBookingCount': 3,
        'payoutGate': {'canWithdraw': true},
      }),
      isFalse,
    );
  });

  test('builds partner level roadmap milestones', () {
    final milestones = providerLevelMilestonesFromSnapshot({
      'level': 'LEVEL_2_ACTIVE',
      'nextRequiredActions': <String>[],
      'kyc': {'status': 'APPROVED'},
      'bankAccounts': [
        {'status': 'REJECTED'},
      ],
      'completedBookingCount': 1,
      'taxProfile': {'status': 'PENDING_REVIEW'},
      'payoutGate': {'canWithdraw': false},
    });

    expect(milestones, hasLength(2));
    expect(milestones[0].complete, isTrue);
    expect(milestones[1].current, isTrue);
    expect(milestones[1].complete, isTrue);
    expect(milestones[1].detail, contains('có thể nhận đặt lịch'));

    final trusted = providerLevelMilestonesFromSnapshot({
      'level': 'LEVEL_4_TRUSTED',
      'payoutGate': {'canWithdraw': true},
    });

    expect(trusted, hasLength(2));
    expect(trusted.last.level, 'LEVEL_2_ACTIVE');
  });

  test('describes bank and tax resubmission forms', () {
    expect(
      bankAccountFormDescription(
        status: 'REJECTED',
        rejectionReason: 'Bank number is wrong',
      ),
      contains('sửa thông tin tài khoản ngân hàng Việt Nam'),
    );
    expect(
      bankAccountFormDescription(status: 'REJECTED'),
      startsWith(
          'Thông tin ngân hàng nhận tiền không chính xác nên chưa thể chuyển khoản.'),
    );
    expect(
      taxProfileFormDescription(
        status: 'REJECTED',
        rejectionReason: 'Tax code is not valid',
      ),
      contains('sửa MST'),
    );
    expect(
      bankAccountFormDescription(status: 'APPROVED'),
      contains('đã được duyệt'),
    );
    expect(
      taxProfileFormDescription(status: 'PENDING_REVIEW'),
      contains('đang chờ xét duyệt'),
    );
  });

  test('labels partner onboarding history actions', () {
    expect(providerLogActionLabel('basic_profile.update'),
        'Đã cập nhật hồ sơ cơ bản');
    expect(providerLogActionLabel('bank_account.submit'),
        'Đã gửi tài khoản ngân hàng');
    expect(
        providerLogActionLabel('unknown.custom_action'), 'Hoạt động tài khoản');
  });

  test('describes partner verification document slots', () {
    expect(providerDocumentTypeLabel('CCCD_FRONT'), 'Mặt trước CCCD');
    expect(providerDocumentTypeStep('CCCD_BACK'), 'Bước 2');
    expect(
      providerDocumentTypeDescription('SELFIE'),
      contains('khớp với giấy tờ định danh'),
    );
    expect(optionalProviderDocumentTypes, [
      'PROFILE_PHOTO',
      'WORK_PHOTO',
      'BANK_QR',
    ]);
    expect(
      providerDocumentStatusLabel('REJECTED'),
      'Bị từ chối. Hãy tải ảnh thay thế rõ hơn.',
    );
    expect(
      providerDocumentSlotStatusLabel(
        type: 'CCCD_FRONT',
        uploaded: true,
        submittedDocument: const {'status': 'REJECTED'},
      ),
      'Đã đính kèm ảnh thay thế. Hãy gửi KYC để xét duyệt.',
    );
    expect(
      providerDocumentSlotActionHint(uploaded: false, status: 'REJECTED'),
      'Tiếp theo: nhấn Thay ảnh và tải ảnh rõ hơn.',
    );
    expect(providerDocumentTypeStep('BANK_QR'), 'Không bắt buộc');
  });

  test('ignores rejected KYC documents when checking readiness', () {
    final documents = [
      {'type': 'CCCD_FRONT', 'status': 'REJECTED'},
      {'type': 'CCCD_BACK', 'status': 'PENDING_REVIEW'},
      {'type': 'SELFIE', 'status': 'APPROVED'},
    ];

    expect(
      isProviderKycDocumentReady(
        type: 'CCCD_FRONT',
        uploadedDocumentIds: const {},
        submittedDocuments: documents,
      ),
      isFalse,
    );
    expect(
      isProviderKycDocumentReady(
        type: 'CCCD_FRONT',
        uploadedDocumentIds: const {'CCCD_FRONT': 'replacement-file-id'},
        submittedDocuments: documents,
      ),
      isTrue,
    );
  });

  test('prefers usable document status over rejected replacement history', () {
    final documentsByType = providerDocumentSlotDocumentsByType([
      {'type': 'CCCD_FRONT', 'status': 'REJECTED'},
      {'type': 'CCCD_FRONT', 'status': 'APPROVED'},
    ]);

    expect(documentsByType['CCCD_FRONT']?['status'], 'APPROVED');
  });

  test('summarizes rejected required KYC documents that need replacement', () {
    final summaries = providerRejectedKycDocumentSummaries(
      submittedDocuments: const [
        {
          'type': 'CCCD_FRONT',
          'status': 'REJECTED',
          'rejectionReason': 'Text is blurry',
        },
        {'type': 'CCCD_BACK', 'status': 'PENDING_REVIEW'},
        {'type': 'SELFIE', 'status': 'APPROVED'},
        {'type': 'WORK_PHOTO', 'status': 'REJECTED'},
      ],
      uploadedDocumentIds: const {},
    );

    expect(summaries, ['Mặt trước CCCD: Text is blurry']);
  });

  test('does not summarize rejected KYC document after replacement upload', () {
    final summaries = providerRejectedKycDocumentSummaries(
      submittedDocuments: const [
        {
          'type': 'CCCD_FRONT',
          'status': 'REJECTED',
          'rejectionReason': 'Text is blurry',
        },
      ],
      uploadedDocumentIds: const {'CCCD_FRONT': 'new-file-id'},
    );

    expect(summaries, isEmpty);
  });

  test('prioritizes basic profile before other onboarding gates', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['BASIC_PROFILE', 'KYC_REVIEW'],
    });

    expect(priority.actionKey, 'BASIC_PROFILE');
    expect(priority.buttonLabel, 'Hoàn thiện hồ sơ');
    expect(priority.tone, 'warning');
  });

  test('prioritizes KYC submission when required photos are ready', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['KYC_REVIEW'],
      'documents': [
        {'type': 'CCCD_FRONT', 'status': 'PENDING_REVIEW'},
        {'type': 'CCCD_BACK', 'status': 'PENDING_REVIEW'},
        {'type': 'SELFIE', 'status': 'PENDING_REVIEW'},
      ],
    });

    expect(priority.actionKey, 'KYC_REVIEW');
    expect(priority.title, 'Gửi KYC để xét duyệt');
    expect(priority.buttonLabel, 'Gửi KYC');
  });

  test('does not prioritize KYC submit when only rejected documents exist', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['KYC_REVIEW'],
      'documents': [
        {'type': 'CCCD_FRONT', 'status': 'REJECTED'},
        {'type': 'CCCD_BACK', 'status': 'REJECTED'},
        {'type': 'SELFIE', 'status': 'REJECTED'},
      ],
    });

    expect(priority.title, 'Tải ảnh định danh');
    expect(priority.buttonLabel, 'Mở danh sách KYC');
  });

  test('prioritizes rejected wallet bank records with the admin reason', () {
    final bankPriority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['BANK_ACCOUNT_REVIEW'],
      'bankAccounts': [
        {
          'status': 'REJECTED',
          'rejectionReason': 'Account holder does not match CCCD',
        },
      ],
    });

    expect(bankPriority.title, 'Sửa thông tin ngân hàng');
    expect(bankPriority.detail, contains('Account holder does not match CCCD'));
    expect(bankPriority.buttonLabel, 'Gửi lại thông tin ngân hàng');
  });

  test('prioritizes bank correction requests from the payout gate payload', () {
    final bankPriority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['BANK_ACCOUNT_CORRECTION'],
      'payoutGate': {
        'bankCorrectionRequest': {
          'required': true,
          'reason': 'Account holder name does not match KYC.',
          'message': '입금 정보가 정확하지 않아 입금이 되지 않습니다.',
        },
      },
    });

    expect(bankPriority.actionKey, 'BANK_ACCOUNT_CORRECTION');
    expect(bankPriority.title, 'Sửa thông tin ngân hàng');
    expect(bankPriority.detail,
        contains('Account holder name does not match KYC'));
    expect(bankPriority.buttonLabel, 'Gửi lại thông tin ngân hàng');
  });

  test('does not treat legacy tax review as a partner level gate', () {
    final taxPriority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['TAX_PROFILE_REVIEW'],
      'completedBookingCount': 1,
      'taxProfile': {
        'status': 'REJECTED',
        'rejectionReason': 'MST is invalid',
      },
    });

    expect(taxPriority.title, 'Tiếp tục thiết lập ví trong Thu nhập');
    expect(taxPriority.detail, contains('thỏa thuận thanh toán'));
    expect(taxPriority.buttonLabel, isNull);
  });

  test('prioritizes wallet contact address after first earning', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['RESIDENTIAL_ADDRESS', 'AGREEMENTS'],
      'completedBookingCount': 1,
      'payoutGate': {
        'canWithdraw': false,
        'missing': {
          'residentialAddress': true,
          'agreements': ['PAYOUT'],
        },
      },
    });

    expect(priority.actionKey, 'RESIDENTIAL_ADDRESS');
    expect(priority.title, 'Xác nhận địa chỉ liên hệ');
    expect(priority.detail, contains('địa chỉ liên hệ'));
    expect(priority.buttonLabel, 'Cập nhật địa chỉ');
  });

  test('shows ready state after core setup before first booking', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': <String>[],
      'completedBookingCount': 0,
      'payoutGate': {'canWithdraw': false},
    });

    expect(priority.actionKey, isNull);
    expect(priority.title, 'Sẵn sàng nhận đặt lịch đầu tiên');
    expect(priority.tone, 'success');
  });
}
