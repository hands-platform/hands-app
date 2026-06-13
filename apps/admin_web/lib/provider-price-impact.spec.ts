import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { providerPriceImpact } from './provider-price-impact';

describe('provider price impact', () => {
  it('builds sorted partner price visibility rows and summary counts', () => {
    const bookableRule = payoutRuleFixture({
      customerPrice: 1000,
      id: 'rule-1000',
      providerPayoutAmount: 700,
    });
    const zeroCommissionRule = payoutRuleFixture({
      customerPrice: 1500,
      id: 'rule-1500',
      providerPayoutAmount: 1500,
    });
    const service = serviceFixture({
      basePrice: 1000,
      payoutRules: [bookableRule, zeroCommissionRule],
      providers: [
        providerFixture({ active: false, id: 'inactive', name: 'C Partner', price: 1000 }),
        providerFixture({
          active: true,
          blockedAt: '2026-01-01T00:00:00.000Z',
          id: 'blocked',
          name: 'D Partner',
          price: 1000,
        }),
        providerFixture({ active: true, id: 'below', name: 'B Partner', price: 900 }),
        providerFixture({ active: true, id: 'missing', name: 'A Partner', price: 1300 }),
        providerFixture({ active: true, id: 'zero', name: 'E Partner', price: 1500 }),
        providerFixture({ active: true, id: 'bookable', name: 'F Partner', price: 1000 }),
      ],
    });

    const impact = providerPriceImpact({
      activeTaxPolicy: undefined,
      actualCompanyCommission: (_service, rule) => (rule.id === zeroCommissionRule.id ? 0 : 100),
      service,
    });

    expect(impact.rows.map((row) => row.id)).toEqual([
      'below',
      'blocked',
      'bookable',
      'missing',
      'zero',
      'inactive',
    ]);
    expect(impact.unsupportedCount).toBe(2);
    expect(impact.belowMinimumCount).toBe(1);
    expect(impact.inactiveOrBlockedCount).toBe(2);
    expect(impact.visibleCount).toBe(1);
    expect(impact.hiddenCount).toBe(5);
    expect(Object.fromEntries(impact.rows.map((row) => [row.id, row.state]))).toEqual({
      below: 'below_minimum',
      blocked: 'inactive',
      bookable: 'bookable',
      inactive: 'inactive',
      missing: 'missing_payout',
      zero: 'missing_payout',
    });
    expect(Object.fromEntries(impact.rows.map((row) => [row.id, row.reason]))).toMatchObject({
      blocked: 'Partner account is blocked.',
      bookable: 'Customer can book this partner price.',
      inactive: 'Partner price row is inactive.',
      missing: 'No active payout rule exists for this exact customer price, so booking stays hidden.',
      zero: 'Payout rule exists, but projected company commission is not positive.',
    });
  });
});

function serviceFixture({
  basePrice,
  payoutRules,
  providers,
}: {
  readonly basePrice: number;
  readonly payoutRules: readonly AdminServicePayoutRule[];
  readonly providers: NonNullable<AdminServiceCatalogItem['providers']>;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice,
    displayOrder: 0,
    durationMin: 60,
    id: 'service-1',
    name: 'Foot massage',
    payoutRules: [...payoutRules],
    priceStep: 100,
    providers: [...providers],
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

function providerFixture({
  active,
  blockedAt,
  id,
  name,
  price,
}: {
  readonly active: boolean;
  readonly blockedAt?: string;
  readonly id: string;
  readonly name: string;
  readonly price: number;
}): NonNullable<AdminServiceCatalogItem['providers']>[number] {
  return {
    active,
    id,
    price,
    providerProfile: {
      blockedAt,
      displayName: name,
      id: `${id}-profile`,
      status: 'APPROVED',
    },
    providerProfileId: `${id}-profile`,
    serviceId: 'service-1',
  };
}
