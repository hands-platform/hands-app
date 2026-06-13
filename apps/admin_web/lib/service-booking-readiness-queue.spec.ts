import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { serviceBookingReadinessQueue } from './service-booking-readiness-queue';

describe('service booking readiness queue', () => {
  it('builds blocked and warning queue items for service booking exposure issues', () => {
    const baseRule = payoutRuleFixture({
      customerPrice: 1000,
      id: 'base-rule',
      providerPayoutAmount: 700,
    });
    const invalidRule = payoutRuleFixture({
      customerPrice: 900,
      id: 'invalid-rule',
      providerPayoutAmount: 1200,
    });
    const lowFeeRule = payoutRuleFixture({
      customerPrice: 1200,
      id: 'low-fee-rule',
      providerPayoutAmount: 1000,
    });

    const items = serviceBookingReadinessQueue({
      activeTaxPolicy: undefined,
      actualCompanyCommission: (_service, rule) => (rule.id === lowFeeRule.id ? 0 : 200),
      formatMoney: (amount, currency) => `${currency} ${amount}`,
      providerPriceImpact: () => ({
        belowMinimumCount: 1,
        hiddenCount: 2,
        inactiveOrBlockedCount: 0,
        rows: [
          {
            currency: 'VND',
            id: 'partner-a-price',
            price: 900,
            providerName: 'Partner A',
            providerStatus: 'APPROVED',
            reason: 'Partner price is below the admin minimum.',
            rule: null,
            state: 'below_minimum',
          },
          {
            currency: 'VND',
            id: 'partner-b-price',
            price: 1300,
            providerName: 'Partner B',
            providerStatus: 'APPROVED',
            reason: 'No payout rule exists.',
            rule: null,
            state: 'missing_payout',
          },
        ],
        unsupportedCount: 1,
        visibleCount: 0,
      }),
      services: [
        serviceFixture({
          basePrice: 1000,
          name: 'Foot massage',
          payoutRules: [baseRule, invalidRule, lowFeeRule],
        }),
        serviceFixture({
          basePrice: 1500,
          name: 'Thai massage',
          payoutRules: [],
        }),
      ],
    });

    expect(items.map((item) => [item.status, item.tone, item.title])).toEqual([
      ['BLOCKED', 'blocked', 'Foot massage / 60 min'],
      ['INVALID', 'blocked', 'Foot massage / 60 min'],
      ['BLOCKED', 'blocked', 'Thai massage / 60 min'],
      ['BLOCKED', 'blocked', 'Thai massage / 60 min'],
      ['HIDDEN', 'warning', 'Foot massage / 60 min'],
      ['LOW FEE', 'warning', 'Foot massage / 60 min'],
      ['HIDDEN', 'warning', 'Thai massage / 60 min'],
    ]);
    expect(items[0]?.detail).toContain('Partner A price VND 900');
    expect(items[2]?.detail).toBe('Base price VND 1500 has no active payout rule.');
  });

  it('ignores inactive services', () => {
    const items = serviceBookingReadinessQueue({
      activeTaxPolicy: undefined,
      actualCompanyCommission: () => 0,
      formatMoney: (amount, currency) => `${currency} ${amount}`,
      providerPriceImpact: () => ({
        belowMinimumCount: 0,
        hiddenCount: 0,
        inactiveOrBlockedCount: 0,
        rows: [],
        unsupportedCount: 0,
        visibleCount: 0,
      }),
      services: [
        {
          ...serviceFixture({
            basePrice: 1000,
            name: 'Inactive service',
            payoutRules: [],
          }),
          active: false,
        },
      ],
    });

    expect(items).toEqual([]);
  });
});

function serviceFixture({
  basePrice,
  name,
  payoutRules,
}: {
  readonly basePrice: number;
  readonly name: string;
  readonly payoutRules: readonly AdminServicePayoutRule[];
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice,
    displayOrder: 0,
    durationMin: 60,
    id: `${name}-service`,
    name,
    payoutRules: [...payoutRules],
    priceStep: 100,
  };
}

function payoutRuleFixture({
  customerPrice,
  id,
  providerPayoutAmount,
}: {
  readonly customerPrice: number;
  readonly id: string;
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice,
    id,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
