import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { serviceBasePayoutRule } from './service-base-payout-rule';

describe('serviceBasePayoutRule', () => {
  it('returns the active payout rule matching the service base price', () => {
    const baseRule = payoutRuleFixture({ active: true, customerPrice: 300000, id: 'base-rule' });
    const service = serviceFixture({
      basePrice: 300000,
      payoutRules: [
        payoutRuleFixture({ active: true, customerPrice: 400000, id: 'higher-rule' }),
        payoutRuleFixture({ active: false, customerPrice: 300000, id: 'inactive-base-rule' }),
        baseRule,
      ],
    });

    expect(serviceBasePayoutRule(service)).toBe(baseRule);
  });

  it('returns null when the base price has no active payout rule', () => {
    const service = serviceFixture({
      basePrice: 300000,
      payoutRules: [payoutRuleFixture({ active: false, customerPrice: 300000, id: 'inactive-rule' })],
    });

    expect(serviceBasePayoutRule(service)).toBeNull();
  });
});

function serviceFixture(input: {
  readonly basePrice: number;
  readonly payoutRules: readonly AdminServicePayoutRule[];
}): AdminServiceCatalogItem {
  return {
    _count: { bookings: 0, providers: 0 },
    active: true,
    basePrice: input.basePrice,
    bookings: [],
    description: null,
    displayOrder: 1,
    durationMin: 60,
    id: 'service-1',
    name: 'Test service',
    payoutRules: [...input.payoutRules],
    priceStep: 100000,
    providers: [],
    serviceGroupKey: 'test_service',
  };
}

function payoutRuleFixture(input: {
  readonly active: boolean;
  readonly customerPrice: number;
  readonly id: string;
}): AdminServicePayoutRule {
  return {
    active: input.active,
    createdAt: '2026-01-01T00:00:00.000Z',
    currency: 'VND',
    customerPrice: input.customerPrice,
    id: input.id,
    notes: null,
    otherCostAmount: 0,
    providerPayoutAmount: 200000,
    serviceId: 'service-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    vatBps: 0,
  };
}
