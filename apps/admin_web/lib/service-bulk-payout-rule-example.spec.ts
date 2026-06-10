import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { serviceBulkPayoutRuleExample } from './service-bulk-payout-rule-example';

describe('service bulk payout rule example', () => {
  it('uses up to four active existing rules sorted by customer price', () => {
    const service = serviceFixture({
      payoutRules: [
        payoutRuleFixture({ active: false, customerPrice: 1000, providerPayoutAmount: 700 }),
        payoutRuleFixture({ active: true, customerPrice: 1400, providerPayoutAmount: 900 }),
        payoutRuleFixture({ active: true, customerPrice: 1200, providerPayoutAmount: 800 }),
        payoutRuleFixture({ active: true, customerPrice: 1600, providerPayoutAmount: 1000 }),
        payoutRuleFixture({ active: true, customerPrice: 1800, providerPayoutAmount: 1100 }),
        payoutRuleFixture({ active: true, customerPrice: 2000, providerPayoutAmount: 1200 }),
      ],
    });

    expect(serviceBulkPayoutRuleExample(service)).toBe(
      ['1200,800', '1400,900', '1600,1000', '1800,1100'].join('\n'),
    );
  });

  it('creates three default rows from the base price and minimum price step when no active rules exist', () => {
    const service = serviceFixture({
      basePrice: 500000,
      payoutRules: [],
      priceStep: 0,
    });

    expect(serviceBulkPayoutRuleExample(service)).toBe(
      ['500000,400000', '600000,480000', '700000,560000'].join('\n'),
    );
  });
});

function serviceFixture({
  basePrice = 1000,
  payoutRules,
  priceStep = 100,
}: {
  readonly basePrice?: number;
  readonly payoutRules: readonly AdminServicePayoutRule[];
  readonly priceStep?: number;
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
  providerPayoutAmount,
}: {
  readonly active: boolean;
  readonly customerPrice: number;
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active,
    currency: 'VND',
    customerPrice,
    id: `rule-${customerPrice}`,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
