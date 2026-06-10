import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { servicePricingHealth } from './service-pricing-health';

describe('service pricing health', () => {
  it('reports healthy active services with grouped duration coverage and payout rules', () => {
    const service = serviceFixture({
      basePrice: 1000,
      name: 'Foot Massage',
      payoutRules: [payoutRuleFixture({ customerPrice: 1000, providerPayoutAmount: 700 })],
      priceStep: 100,
      serviceGroupKey: 'foot',
    });

    const health = servicePricingHealth({
      activeTaxPolicy: undefined,
      actualCompanyCommission: () => 200,
      services: [service],
    });

    expect(health.map((item) => [item.label, item.ok, item.value])).toEqual([
      ['Service groups', true, '1 group(s)'],
      ['Minimum price increments', true, '0 invalid'],
      ['Base payout rules', true, '0 missing'],
      ['Rule consistency', true, '0 invalid'],
      ['Company commission floor', true, '0 low'],
    ]);
  });

  it('reports invalid minimums, missing payout rules, invalid rules, and low commission', () => {
    const invalidRule = payoutRuleFixture({ customerPrice: 950, providerPayoutAmount: 1200 });
    const lowCommissionRule = payoutRuleFixture({ customerPrice: 1000, providerPayoutAmount: 900 });
    const health = servicePricingHealth({
      activeTaxPolicy: undefined,
      actualCompanyCommission: (_service, rule) => (rule.id === lowCommissionRule.id ? 0 : 100),
      services: [
        serviceFixture({
          basePrice: 950,
          name: 'Invalid Minimum',
          payoutRules: [invalidRule],
          priceStep: 100,
        }),
        serviceFixture({
          basePrice: 1000,
          name: 'Missing Rule',
          payoutRules: [],
          priceStep: 100,
        }),
        serviceFixture({
          basePrice: 1000,
          name: 'Low Commission',
          payoutRules: [lowCommissionRule],
          priceStep: 100,
        }),
      ],
    });

    expect(health.map((item) => [item.label, item.ok, item.value])).toEqual([
      ['Service groups', true, '3 group(s)'],
      ['Minimum price increments', false, '1 invalid'],
      ['Base payout rules', false, '1 missing'],
      ['Rule consistency', false, '1 invalid'],
      ['Company commission floor', false, '1 low'],
    ]);
  });
});

function serviceFixture({
  basePrice,
  name,
  payoutRules,
  priceStep,
  serviceGroupKey,
}: {
  readonly basePrice: number;
  readonly name: string;
  readonly payoutRules: readonly AdminServicePayoutRule[];
  readonly priceStep: number;
  readonly serviceGroupKey?: string;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice,
    displayOrder: 0,
    durationMin: 60,
    id: `${name}-service`,
    name,
    payoutRules: [...payoutRules],
    priceStep,
    serviceGroupKey,
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
    id: `rule-${customerPrice}-${providerPayoutAmount}`,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
