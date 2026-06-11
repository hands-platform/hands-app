import { ProviderAgreementType, ProviderTaxProfileStatus } from '@prisma/client';
import {
  providerPayoutSetupMissingRequirements,
  providerPayoutSetupNeedsNotification,
} from './bookings.payout-setup';

describe('booking payout setup helpers', () => {
  it('detects missing payout setup requirements for first revenue notification', () => {
    const missing = providerPayoutSetupMissingRequirements({
      residentialAddress: null,
      taxProfile: { status: ProviderTaxProfileStatus.PENDING_REVIEW },
      agreements: [
        { type: ProviderAgreementType.TERMS },
        { type: ProviderAgreementType.PRIVACY },
      ],
    });

    expect(missing).toEqual({
      taxProfileApproved: true,
      residentialAddress: true,
      agreements: [
        ProviderAgreementType.LOCATION,
        ProviderAgreementType.PAYOUT,
        ProviderAgreementType.TAX,
      ],
    });
    expect(providerPayoutSetupNeedsNotification(missing)).toBe(true);
  });

  it('skips notification when payout setup is complete', () => {
    const missing = providerPayoutSetupMissingRequirements({
      residentialAddress: '12 Nguyen Hue',
      taxProfile: { status: ProviderTaxProfileStatus.APPROVED },
      agreements: [
        { type: ProviderAgreementType.TERMS },
        { type: ProviderAgreementType.PRIVACY },
        { type: ProviderAgreementType.LOCATION },
        { type: ProviderAgreementType.PAYOUT },
        { type: ProviderAgreementType.TAX },
      ],
    });

    expect(missing).toEqual({
      taxProfileApproved: false,
      residentialAddress: false,
      agreements: [],
    });
    expect(providerPayoutSetupNeedsNotification(missing)).toBe(false);
  });
});
