import { ProviderAgreementType, ProviderTaxProfileStatus } from '@prisma/client';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';

export type ProviderPayoutSetupMissing = {
  taxProfileApproved: boolean;
  residentialAddress: boolean;
  agreements: readonly ProviderAgreementType[];
};

export function providerPayoutSetupMissingRequirements(provider: {
  residentialAddress?: unknown | null;
  taxProfile?: { status?: ProviderTaxProfileStatus | string | null } | null;
  agreements?: readonly { type: ProviderAgreementType | string }[] | null;
}): ProviderPayoutSetupMissing {
  const acceptedAgreementTypes = new Set((provider.agreements ?? []).map((agreement) => agreement.type));

  return {
    taxProfileApproved: provider.taxProfile?.status !== ProviderTaxProfileStatus.APPROVED,
    residentialAddress: !provider.residentialAddress,
    agreements: REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type)),
  };
}

export function providerPayoutSetupNeedsNotification(missing: ProviderPayoutSetupMissing) {
  return missing.taxProfileApproved || missing.residentialAddress || missing.agreements.length > 0;
}
