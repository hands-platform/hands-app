import {
  buildReferralManualReviewFlags,
  calculateCustomerReferralReward,
  calculateCustomerReferralServicePaymentSplit,
  calculateReferralTaxWithholding,
  calculateReferralWalletLiabilityClosing,
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

  it('keeps GMV intact when customer referral wallet credit pays for service', () => {
    expect(
      calculateCustomerReferralServicePaymentSplit({
        grossBookingValue: 500_000,
        requestedReferralWalletUse: 35_556,
      }),
    ).toEqual({
      customerCashPaid: 464_444,
      grossBookingValue: 500_000,
      referralWalletUsed: 35_556,
    });
  });

  it('reconciles monthly referral wallet liability from credited, used, offset, cashout, and reversed flows', () => {
    expect(
      calculateReferralWalletLiabilityClosing({
        cashoutPaid: 30_000,
        netCredited: 400_000,
        offsetAmount: 170_000,
        openingLiability: 250_000,
        reversedAmount: 20_000,
        usedForService: 80_000,
      }),
    ).toEqual({
      cashoutPaid: 30_000,
      closingLiability: 350_000,
      netCredited: 400_000,
      offsetAmount: 170_000,
      openingLiability: 250_000,
      reversedAmount: 20_000,
      usedForService: 80_000,
    });
  });

  it('flags referral rewards that require manual tax or risk review', () => {
    expect(
      buildReferralManualReviewFlags({
        audience: 'CUSTOMER',
        highMonthlyRewardThreshold: 1_000_000,
        monthlyGrossRewardAmount: 1_250_000,
        monthlyQualifiedReferralCount: 8,
        repeatedReferralThreshold: 5,
        requestedCashout: true,
        residencyCountryCode: 'KR',
        taxPolicy: 'INDIVIDUAL_COMMISSION_PIT_10',
      }).map((flag) => flag.code),
    ).toEqual([
      'CUSTOMER_CASHOUT_TAX_REVIEW',
      'NON_RESIDENT_MANUAL_REVIEW',
      'HIGH_MONTHLY_REWARD_AMOUNT',
      'REPEATED_REFERRAL_ACTIVITY',
    ]);
  });

  it('does not flag service-credit-only customer rewards for cashout review', () => {
    expect(
      buildReferralManualReviewFlags({
        audience: 'CUSTOMER',
        highMonthlyRewardThreshold: 1_000_000,
        monthlyGrossRewardAmount: 35_556,
        monthlyQualifiedReferralCount: 1,
        repeatedReferralThreshold: 5,
        requestedCashout: false,
        residencyCountryCode: 'VN',
        taxPolicy: 'CUSTOMER_SERVICE_CREDIT_ONLY',
      }),
    ).toEqual([]);
  });

  it('calculates individual commission PIT withholding for referral rewards', () => {
    expect(
      calculateReferralTaxWithholding({
        grossRewardAmount: 300_000,
        taxPolicy: 'INDIVIDUAL_COMMISSION_PIT_10',
      }),
    ).toEqual({
      grossRewardAmount: 300_000,
      manualReviewRequired: false,
      netWalletAmount: 270_000,
      pitWithheldAmount: 30_000,
      taxPolicySnapshot: 'INDIVIDUAL_COMMISSION_PIT_10',
      totalWithheldAmount: 30_000,
      vatWithheldAmount: 0,
    });
  });

  it('calculates business service VAT and PIT withholding for referral rewards', () => {
    expect(
      calculateReferralTaxWithholding({
        grossRewardAmount: 300_000,
        taxPolicy: 'BUSINESS_SERVICE_VAT5_PIT2',
      }),
    ).toMatchObject({
      netWalletAmount: 279_000,
      pitWithheldAmount: 6_000,
      totalWithheldAmount: 21_000,
      vatWithheldAmount: 15_000,
    });
  });

  it('marks manual referral tax policies for review without auto withholding', () => {
    expect(
      calculateReferralTaxWithholding({
        grossRewardAmount: 300_000,
        taxPolicy: 'MANUAL_REVIEW',
      }),
    ).toMatchObject({
      manualReviewRequired: true,
      netWalletAmount: 300_000,
      totalWithheldAmount: 0,
    });
  });
});
