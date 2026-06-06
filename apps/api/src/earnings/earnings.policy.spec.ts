import { PaymentMethod } from '@prisma/client';

import { calculateProviderWalletDelta, calculateServicePayoutFeeFromRules } from './earnings.policy';

describe('earnings policy', () => {
  it('credits non-cash bookings after platform fee and withholding', () => {
    const delta = calculateProviderWalletDelta({
      paymentMethod: PaymentMethod.MOMO,
      grossAmount: 500000,
      platformFee: 120000,
      withholdingAmount: 25000,
    });

    expect(delta).toBe(355000);
  });

  it('creates negative wallet debt for cash bookings because the partner receives cash directly', () => {
    const delta = calculateProviderWalletDelta({
      paymentMethod: PaymentMethod.CASH,
      grossAmount: 500000,
      platformFee: 120000,
      withholdingAmount: 25000,
    });

    expect(delta).toBe(-145000);
  });

  it('calculates service payout fee snapshots from admin-defined service duration rules', () => {
    const fee = calculateServicePayoutFeeFromRules({
      grossAmount: 500000,
      currency: 'VND',
      services: [
        {
          serviceId: 'foot-massage',
          serviceName: 'Foot Massage',
          price: 500000,
          quantity: 1,
        },
      ],
      payoutRules: [
        {
          id: 'rule-foot-60-500',
          serviceId: 'foot-massage',
          customerPrice: 500000,
          providerPayoutAmount: 380000,
          vatBps: 1000,
          otherCostAmount: 20000,
        },
      ],
    });

    expect(fee).not.toBeNull();
    expect(fee?.platformFeeAmount).toBe(120000);
    expect(fee?.ruleSnapshot.providerPayoutAmount).toBe(380000);
    expect(fee?.ruleSnapshot.vatAmount).toBe(12000);
    expect(fee?.ruleSnapshot.otherCostAmount).toBe(20000);
    expect(fee?.ruleSnapshot.netCompanyFeeBeforeWithholding).toBe(88000);
    expect(fee?.ruleSnapshot.lines).toEqual([
      expect.objectContaining({
        serviceId: 'foot-massage',
        quantity: 1,
        customerPrice: 500000,
        providerPayoutAmount: 380000,
        platformFeeAmount: 120000,
        ruleId: 'rule-foot-60-500',
      }),
    ]);
  });

  it('returns null when a selected service has no matching payout rule', () => {
    const fee = calculateServicePayoutFeeFromRules({
      grossAmount: 500000,
      currency: 'VND',
      services: [
        {
          serviceId: 'deep-tissue',
          price: 500000,
          quantity: 1,
        },
      ],
      payoutRules: [],
    });

    expect(fee).toBeNull();
  });
});
