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
    expect(providerAgreementVersionFromSnapshot({}), 'current');
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
      'Rejected: Account holder does not match CCCD. Update the bank details and submit again.',
    );
    expect(
      providerBankAccountStepDetail(status: 'REJECTED'),
      'Withdrawal bank information is incorrect, so the payout cannot be sent. Update the bank details and submit again.',
    );
    expect(
      providerBankAccountStepDetail(status: 'PENDING_REVIEW'),
      'Submitted. Waiting for admin approval before wallet withdrawal/deposit processing.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 2,
        status: 'REJECTED',
        rejectionReason: 'MST is invalid',
        missingAgreementCount: 1,
      ),
      'Legacy tax profile was rejected: MST is invalid. Tax profile is not required for Vietnam MVP.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 0,
        status: null,
        missingAgreementCount: 5,
      ),
      'Tax profile is not required for Vietnam MVP.',
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
    expect(lockedItems[1].label, 'Wallet bank details');
    expect(lockedItems[1].detail, contains('requested from Earnings'));
    expect(lockedItems.last.detail,
        contains('deferred until first earned revenue'));

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
    expect(readyItems[1].detail,
        contains('approved for manual wallet operations'));
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
    expect(missingItems[2].detail, contains('Vietnamese identity number'));
    expect(missingItems[3].detail, '1 of 3 required photo(s) approved.');
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
    expect(milestones[1].detail, contains('can receive bookings'));

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
      contains('Correct the Vietnamese bank account details'),
    );
    expect(
      bankAccountFormDescription(status: 'REJECTED'),
      startsWith('Withdrawal bank information is incorrect, so the payout cannot be sent.'),
    );
    expect(
      taxProfileFormDescription(
        status: 'REJECTED',
        rejectionReason: 'Tax code is not valid',
      ),
      contains('Correct MST'),
    );
    expect(
      bankAccountFormDescription(status: 'APPROVED'),
      contains('approved for payout'),
    );
    expect(
      taxProfileFormDescription(status: 'PENDING_REVIEW'),
      contains('waiting for admin review'),
    );
  });

  test('labels partner onboarding history actions', () {
    expect(providerLogActionLabel('basic_profile.update'),
        'Basic profile updated');
    expect(providerLogActionLabel('bank_account.submit'),
        'Bank account submitted');
    expect(providerLogActionLabel('unknown.custom_action'),
        'Unknown Custom Action');
  });

  test('describes partner verification document slots', () {
    expect(providerDocumentTypeLabel('CCCD_FRONT'), 'CCCD front side');
    expect(providerDocumentTypeStep('CCCD_BACK'), 'Step 2');
    expect(
      providerDocumentTypeDescription('SELFIE'),
      contains('match the ID document'),
    );
    expect(optionalProviderDocumentTypes, [
      'PROFILE_PHOTO',
      'WORK_PHOTO',
      'BANK_QR',
    ]);
    expect(
      providerDocumentStatusLabel('REJECTED'),
      'Rejected. Upload a clearer replacement image.',
    );
    expect(
      providerDocumentSlotStatusLabel(
        type: 'CCCD_FRONT',
        uploaded: true,
        submittedDocument: const {'status': 'REJECTED'},
      ),
      'Replacement attached. Submit KYC to send it for review.',
    );
    expect(
      providerDocumentSlotActionHint(uploaded: false, status: 'REJECTED'),
      'Next: tap Replace and upload a clearer photo.',
    );
    expect(providerDocumentTypeStep('BANK_QR'), 'Optional');
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

    expect(summaries, ['CCCD front side: Text is blurry']);
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
    expect(priority.buttonLabel, 'Complete profile');
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
    expect(priority.title, 'Submit KYC for admin review');
    expect(priority.buttonLabel, 'Submit KYC');
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

    expect(priority.title, 'Upload identity photos');
    expect(priority.buttonLabel, 'Open KYC checklist');
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

    expect(bankPriority.title, 'Fix wallet bank details');
    expect(bankPriority.detail, contains('Account holder does not match CCCD'));
    expect(bankPriority.buttonLabel, 'Resubmit bank details');
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

    expect(taxPriority.title, 'Wallet review continues from Earnings');
    expect(taxPriority.detail, contains('Tax profile is not required'));
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
    expect(priority.title, 'Confirm wallet contact address');
    expect(priority.detail, contains('operations contact'));
    expect(priority.buttonLabel, 'Update address');
  });

  test('shows ready state after core setup before first booking', () {
    final priority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': <String>[],
      'completedBookingCount': 0,
      'payoutGate': {'canWithdraw': false},
    });

    expect(priority.actionKey, isNull);
    expect(priority.title, 'Ready for the first booking');
    expect(priority.tone, 'success');
  });
}
