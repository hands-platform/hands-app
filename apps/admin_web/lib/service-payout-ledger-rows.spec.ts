import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { servicePayoutLedgerRows } from './service-payout-ledger-rows';

describe('service payout ledger rows', () => {
  it('builds sorted payout ledger rows with injected finance and provider impact checks', () => {
    const baseRule = payoutRuleFixture({ id: 'rule-ready', providerPayoutAmount: 700 });
    const services = [
      serviceFixture({ durationMin: 90, name: 'Thai massage' }),
      serviceFixture({ durationMin: 60, name: 'Foot massage', payoutRules: [baseRule] }),
    ];

    const rows = servicePayoutLedgerRows({
      activeTaxPolicy: undefined,
      basePayoutRule: (service) => service.payoutRules?.[0] ?? null,
      providerPriceImpact: (service) => ({
        rows:
          service.name === 'Foot massage'
            ? [{ state: 'bookable' }, { state: 'missing_payout' }]
            : [],
      }),
      servicePayoutFinance: (_service, rule) => ({
        actualCompanyCommission: rule.customerPrice - rule.providerPayoutAmount,
        fee: rule.customerPrice - rule.providerPayoutAmount,
        taxRuleLabel: null,
        vatAmount: 0,
        withholdingAmount: 0,
      }),
      services,
    });

    expect(
      rows.map((row) => ({
        action: row.action,
        actionTone: row.actionTone,
        commissionTone: row.commissionTone,
        currency: row.currency,
        hiddenProviders: row.hiddenProviders,
        serviceName: row.service.name,
        totalProviderRows: row.totalProviderRows,
        visibleProviders: row.visibleProviders,
      })),
    ).toEqual([
      {
        action: 'Fix hidden prices',
        actionTone: 'pill-danger',
        commissionTone: 'pill-success',
        currency: 'VND',
        hiddenProviders: 1,
        serviceName: 'Foot massage',
        totalProviderRows: 2,
        visibleProviders: 1,
      },
      {
        action: 'Add payout rule',
        actionTone: 'pill-danger',
        commissionTone: 'pill-danger',
        currency: 'VND',
        hiddenProviders: 0,
        serviceName: 'Thai massage',
        totalProviderRows: 0,
        visibleProviders: 0,
      },
    ]);
  });
});

function serviceFixture({
  durationMin,
  name,
  payoutRules = [],
}: {
  readonly durationMin: number;
  readonly name: string;
  readonly payoutRules?: readonly AdminServicePayoutRule[];
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
    serviceGroupKey: 'massage',
  };
}

function payoutRuleFixture({
  id,
  providerPayoutAmount,
}: {
  readonly id: string;
  readonly providerPayoutAmount: number;
}): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 1000,
    id,
    otherCostAmount: 0,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps: 0,
  };
}
