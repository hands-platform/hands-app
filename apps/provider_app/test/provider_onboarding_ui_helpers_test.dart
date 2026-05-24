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
      'TAX',
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
      'TAX',
    ]);
    expect(providerAgreementVersionFromSnapshot({}), 'current');
  });

  test('normalizes rejected review reasons', () {
    expect(reviewReason({'rejectionReason': ' Blurry CCCD photo '}),
        'Blurry CCCD photo');
    expect(reviewReason({'rejectionReason': '   '}), isNull);
    expect(reviewReason(null), isNull);
  });

  test('describes bank and tax review states for onboarding steps', () {
    expect(
      providerBankAccountStepDetail(
        status: 'REJECTED',
        rejectionReason: 'Account holder does not match CCCD',
      ),
      'Rejected: Account holder does not match CCCD. Update the bank details and submit again.',
    );
    expect(
      providerBankAccountStepDetail(status: 'PENDING_REVIEW'),
      'Submitted. Waiting for admin approval before payout.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 2,
        status: 'REJECTED',
        rejectionReason: 'MST is invalid',
        missingAgreementCount: 1,
      ),
      'Rejected: MST is invalid. Update MST, legal name, and registered address before withdrawal.',
    );
    expect(
      providerTaxProfileStepDetail(
        completedBookingCount: 0,
        status: null,
        missingAgreementCount: 5,
      ),
      'Tax and payout agreements are requested after the first completed service.',
    );
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

  test('labels provider onboarding history actions', () {
    expect(providerLogActionLabel('basic_profile.update'),
        'Basic profile updated');
    expect(providerLogActionLabel('bank_account.submit'),
        'Bank account submitted');
    expect(providerLogActionLabel('unknown.custom_action'),
        'Unknown Custom Action');
  });

  test('describes provider verification document slots', () {
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

  test('prioritizes rejected bank and tax records with the admin reason', () {
    final bankPriority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['BANK_ACCOUNT_REVIEW'],
      'bankAccounts': [
        {
          'status': 'REJECTED',
          'rejectionReason': 'Account holder does not match CCCD',
        },
      ],
    });

    expect(bankPriority.title, 'Fix rejected bank account');
    expect(bankPriority.detail, contains('Account holder does not match CCCD'));
    expect(bankPriority.buttonLabel, 'Resubmit bank');

    final taxPriority = providerOnboardingPriorityFromSnapshot({
      'nextRequiredActions': ['TAX_PROFILE_REVIEW'],
      'completedBookingCount': 1,
      'taxProfile': {
        'status': 'REJECTED',
        'rejectionReason': 'MST is invalid',
      },
    });

    expect(taxPriority.title, 'Fix rejected tax profile');
    expect(taxPriority.detail, contains('MST is invalid'));
    expect(taxPriority.buttonLabel, 'Resubmit tax');
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
