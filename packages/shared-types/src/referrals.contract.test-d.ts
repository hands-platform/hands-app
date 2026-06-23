import type {
  ReferralAudience,
  ReferralAudienceSlug,
  ReferralCodeSelfService,
  ReferralCodeSelfServiceResponse,
} from './index';

const customerAudience: ReferralAudience = 'CUSTOMER';
const customerSlug: ReferralAudienceSlug = 'customer';

const referralCode: ReferralCodeSelfService = {
  id: 'referral-code-1',
  audience: customerAudience,
  code: 'HC2D1B20B37',
  active: true,
  sharePath: `/r/${customerSlug}/HC2D1B20B37`,
  createdAt: '2026-06-24T10:00:00.000Z',
  updatedAt: new Date('2026-06-24T10:00:00.000Z'),
};

const maybeReferralCode: ReferralCodeSelfServiceResponse = referralCode;
const noReferralCodeYet: ReferralCodeSelfServiceResponse = null;

void maybeReferralCode;
void noReferralCodeYet;
