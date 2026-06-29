import {
  calculateCustomerReferralReward,
  calculatePartnerReferralWalletOffsetPlan,
} from './referrals.accounting';

describe('referral accounting policy', () => {
  it('calculates customer referral rewards from platform fee net revenue after company output VAT', () => {
    expect(
      calculateCustomerReferralReward({
        platformFeeGross: 128_000,
        platformFeeVatRateBps: 800,
        referralRateBps: 3_000,
      }),
    ).toEqual({
      companyOutputVat: 9_481,
      platformFeeGross: 128_000,
      platformFeeNetRevenue: 118_519,
      platformFeeVatRateBps: 800,
      referralRateSnapshotBps: 3_000,
      rewardGross: 35_556,
    });
  });

  it('plans partner referral wallet offsets without reducing revenue', () => {
    expect(
      calculatePartnerReferralWalletOffsetPlan({
        negativeWalletAmount: 0,
        partnerTaxPayable: 42_000,
        platformFeeGross: 128_000,
        referralWalletAmount: 300_000,
      }),
    ).toEqual({
      offsetNegativeWallet: 0,
      offsetPartnerTax: 42_000,
      offsetPlatformFee: 128_000,
      remainingWallet: 130_000,
      totalOffset: 170_000,
    });
  });
});
