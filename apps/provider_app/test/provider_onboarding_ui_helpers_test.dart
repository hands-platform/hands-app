import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/features/provider_onboarding/presentation/provider_onboarding_status.dart';
import 'package:provider_app/src/features/provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';

void main() {
  test('reads onboarding requirements from API snapshot', () {
    final snapshot = {
      'requirements': {
        'requiredKycDocumentTypes': ['CCCD_FRONT', 'SELFIE'],
        'requiredPayoutAgreements': ['TERMS', 'TAX'],
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
  });

  test('normalizes rejected review reasons', () {
    expect(reviewReason({'rejectionReason': ' Blurry CCCD photo '}),
        'Blurry CCCD photo');
    expect(reviewReason({'rejectionReason': '   '}), isNull);
    expect(reviewReason(null), isNull);
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
