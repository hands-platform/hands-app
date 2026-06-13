import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { serviceTypeCoverageRows } from './service-type-coverage-rows';

describe('service type coverage rows', () => {
  it('builds sorted service type coverage rows with injected pricing checks', () => {
    const baseRule = payoutRuleFixture({ providerPayoutAmount: 700 });
    const groups = [
      {
        key: 'thai',
        label: 'Thai massage',
        items: [serviceFixture({ durationMin: 60, name: 'Thai massage', payoutRules: [] })],
      },
      {
        key: 'foot',
        label: 'Foot massage',
        items: [serviceFixture({ durationMin: 60, name: 'Foot massage', payoutRules: [baseRule] })],
      },
    ];

    const rows = serviceTypeCoverageRows({
      activeTaxPolicy: undefined,
      basePayoutRule: (service) => service.payoutRules?.[0] ?? null,
      formatDurationList: (items) => items.map((item) => `${item.durationMin} min`).join(', '),
      groups,
      missingStandardDurations: (items) =>
        [60, 90, 120].filter((duration) => !items.some((item) => item.active && item.durationMin === duration)),
      providerPriceImpact: (service) => ({
        belowMinimumCount: 0,
        hiddenCount: service.name === 'Foot massage' ? 1 : 0,
        inactiveOrBlockedCount: 0,
        rows: [],
        unsupportedCount: service.name === 'Foot massage' ? 1 : 0,
        visibleCount: service.name === 'Foot massage' ? 1 : 0,
      }),
      servicePayoutFinance: (_service, rule) => ({
        actualCompanyCommission: rule.customerPrice - rule.providerPayoutAmount,
        fee: rule.customerPrice - rule.providerPayoutAmount,
        taxRuleLabel: null,
        vatAmount: 0,
        withholdingAmount: 0,
      }),
    });

    expect(
      rows.map((row) => ({
        activeDurationLabels: row.activeDurationLabels,
        hiddenPartnerPriceCount: row.hiddenPartnerPriceCount,
        key: row.key,
        missingBasePayoutCount: row.missingBasePayoutCount,
        statusLabel: row.statusLabel,
        tone: row.tone,
      })),
    ).toEqual([
      {
        activeDurationLabels: '60 min',
        hiddenPartnerPriceCount: 0,
        key: 'thai',
        missingBasePayoutCount: 1,
        statusLabel: 'Base payout missing',
        tone: 'pill-danger',
      },
      {
        activeDurationLabels: '60 min',
        hiddenPartnerPriceCount: 1,
        key: 'foot',
        missingBasePayoutCount: 0,
        statusLabel: 'Partner price hidden',
        tone: 'pill-warn',
      },
    ]);
  });
});

function serviceFixture({
  durationMin,
  name,
  payoutRules,
}: {
  readonly durationMin: number;
  readonly name: string;
  readonly payoutRules: readonly AdminServicePayoutRule[];
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 1000,
    displayOrder: 0,
    durationMin,
    id: `${name}-service`,
    name,
    payoutRules: [...payoutRules],
    priceStep: 100,
  };
}

function payoutRuleFixture({
  providerPayoutAmount,
}: {
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 1000,
    id: 'rule-1',
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
