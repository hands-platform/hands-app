import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { servicePriceLadderCoverage } from './service-price-ladder-coverage';

describe('service price ladder coverage', () => {
  it('includes the next four minimum price steps and existing payout rule prices in ascending order', () => {
    const activeRule = payoutRuleFixture({
      active: true,
      customerPrice: 1200,
      id: 'active-rule',
      providerPayoutAmount: 800,
    });
    const inactiveRule = payoutRuleFixture({
      active: false,
      customerPrice: 1800,
      id: 'inactive-rule',
      providerPayoutAmount: 1200,
    });
    const service = serviceFixture({
      basePrice: 1000,
      payoutRules: [inactiveRule, activeRule],
      priceStep: 100,
    });

    const coverage = servicePriceLadderCoverage(service);

    expect(coverage.map((item) => item.price)).toEqual([1000, 1200, 1800, 101000, 201000, 301000]);
    expect(coverage.map((item) => item.rule?.id ?? null)).toEqual([null, 'active-rule', null, null, null, null]);
  });

  it('uses the default minimum step when the configured service step is empty', () => {
    const service = serviceFixture({
      basePrice: 500000,
      payoutRules: [],
      priceStep: 0,
    });

    const coverage = servicePriceLadderCoverage(service);

    expect(coverage.map((item) => item.price)).toEqual([500000, 600000, 700000, 800000]);
  });
});

function serviceFixture({
  basePrice,
  payoutRules,
  priceStep,
}: {
  readonly basePrice: number;
  readonly payoutRules: readonly AdminServicePayoutRule[];
  readonly priceStep: number;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice,
    displayOrder: 0,
    durationMin: 60,
    id: 'service-1',
    name: 'Foot massage',
    payoutRules: [...payoutRules],
    priceStep,
  };
}

function payoutRuleFixture({
  active,
  customerPrice,
  id,
  providerPayoutAmount,
}: {
  readonly active: boolean;
  readonly customerPrice: number;
  readonly id: string;
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active,
    currency: 'VND',
    customerPrice,
    id,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
