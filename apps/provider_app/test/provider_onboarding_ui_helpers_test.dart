import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/main.dart';

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
}
