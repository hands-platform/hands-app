import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { serviceDurationMatrix } from './service-duration-matrix';

describe('service duration matrix', () => {
  it('groups services by duration and sums payout totals for configured base rules', () => {
    const rule60 = payoutRuleFixture({ customerPrice: 1000, providerPayoutAmount: 700 });
    const rule90 = payoutRuleFixture({ customerPrice: 1500, providerPayoutAmount: 1000 });

    const matrix = serviceDurationMatrix({
      activeTaxPolicy: undefined,
      basePayoutRule: (service) => service.payoutRules?.[0] ?? null,
      items: [
        serviceFixture({ active: true, basePrice: 1000, durationMin: 60, payoutRules: [rule60] }),
        serviceFixture({ active: true, basePrice: 1500, durationMin: 90, payoutRules: [rule90] }),
        serviceFixture({ active: false, basePrice: 2000, durationMin: 120, payoutRules: [] }),
      ],
      servicePayoutFinance: (_service, rule) => ({
        actualCompanyCommission: rule.customerPrice - rule.providerPayoutAmount - 50,
        fee: rule.customerPrice - rule.providerPayoutAmount,
        taxRuleLabel: null,
        vatAmount: 30,
        withholdingAmount: 20,
      }),
    });

    expect(matrix.activeCount).toBe(2);
    expect(matrix.blockedCount).toBe(0);
    expect(matrix.payoutRuleCount).toBe(2);
    expect([...matrix.byDuration.keys()]).toEqual([60, 90, 120]);
    expect(matrix.totals).toEqual({
      currency: 'VND',
      customerMinimum: 2500,
      grossFee: 800,
      netCompanyFee: 700,
      providerPayout: 1700,
      taxAndCost: 100,
    });
  });

  it('counts active durations without a base payout rule as blocked', () => {
    const matrix = serviceDurationMatrix({
      activeTaxPolicy: undefined,
      basePayoutRule: (service) => service.payoutRules?.[0] ?? null,
      items: [serviceFixture({ active: true, basePrice: 1000, durationMin: 60, payoutRules: [] })],
      servicePayoutFinance: () => ({
        actualCompanyCommission: 0,
        fee: 0,
        taxRuleLabel: null,
        vatAmount: 0,
        withholdingAmount: 0,
      }),
    });

    expect(matrix.blockedCount).toBe(1);
    expect(matrix.byDuration.get(60)?.baseRule).toBeNull();
    expect(matrix.totals.netCompanyFee).toBe(0);
  });
});

function serviceFixture({
  active,
  basePrice,
  durationMin,
  payoutRules,
}: {
  readonly active: boolean;
  readonly basePrice: number;
  readonly durationMin: number;
  readonly payoutRules: readonly AdminServicePayoutRule[];
}): AdminServiceCatalogItem {
  return {
    active,
    basePrice,
    displayOrder: 0,
    durationMin,
    id: `service-${durationMin}`,
    name: `Service ${durationMin}`,
    payoutRules: [...payoutRules],
    priceStep: 100,
  };
}

function payoutRuleFixture({
  customerPrice,
  providerPayoutAmount,
}: {
  readonly customerPrice: number;
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice,
    id: `rule-${customerPrice}`,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
