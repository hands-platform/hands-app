import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';
import { servicePricePolicyPreviewRows } from './service-price-policy-preview-rows';

describe('service price policy preview rows', () => {
  it('sorts services and builds current plus one-step pricing scenarios', () => {
    const missingRuleService = serviceFixture({
      basePrice: 1000,
      durationMin: 60,
      name: 'A missing rule',
      payoutRules: [],
      serviceGroupKey: 'a',
    });
    const baseRule = payoutRuleFixture({
      customerPrice: 1000,
      id: 'base-rule',
      providerPayoutAmount: 700,
    });
    const configuredService = serviceFixture({
      basePrice: 1000,
      durationMin: 90,
      name: 'B configured',
      payoutRules: [baseRule],
      priceStep: 100000,
      serviceGroupKey: 'b',
    });

    const rows = servicePricePolicyPreviewRows({
      activeTaxPolicy: undefined,
      servicePayoutFinance: (_service, rule) => financeFixture(rule.customerPrice - rule.providerPayoutAmount),
      services: [configuredService, missingRuleService],
    });

    expect(rows.map((row) => row.service.id)).toEqual(['A missing rule-service', 'B configured-service']);
    expect(rows[0]).toMatchObject({
      baseRule: null,
      checkLabel: 'Missing base rule',
      checkTone: 'pill-danger',
      currency: 'VND',
      nextAction: 'Add the base payout rule first.',
      priceStep: 100000,
    });
    expect(rows[0]?.currentFinance.actualCompanyCommission).toBe(0);
    expect(rows[1]).toMatchObject({
      baseRule,
      checkLabel: '1 check(s)',
      checkTone: 'pill-warn',
      currency: 'VND',
      nextAction: 'Review Partner payout or tax/cost assumptions before saving a price change.',
      priceStep: 100000,
    });
    expect(rows[1]?.customerStepScenario).toMatchObject({
      customerPrice: 101000,
      providerPayoutAmount: 700,
      status: 'Positive',
      tone: 'pill-success',
    });
    expect(rows[1]?.providerStepScenario).toMatchObject({
      customerPrice: 1000,
      providerPayoutAmount: 100700,
      status: 'Overpays',
      tone: 'pill-danger',
    });
    expect(rows[1]?.balancedStepScenario).toMatchObject({
      customerPrice: 101000,
      providerPayoutAmount: 100700,
      status: 'Positive',
      tone: 'pill-success',
    });
  });

  it('marks a scenario as check margin when commission is not positive without overpaying', () => {
    const baseRule = payoutRuleFixture({
      customerPrice: 200000,
      id: 'low-commission-rule',
      providerPayoutAmount: 700,
    });
    const service = serviceFixture({
      basePrice: 200000,
      durationMin: 60,
      name: 'Low commission',
      payoutRules: [baseRule],
      priceStep: 100000,
    });

    const rows = servicePricePolicyPreviewRows({
      activeTaxPolicy: undefined,
      servicePayoutFinance: (_service, rule) =>
        financeFixture(rule.customerPrice === 300000 && rule.providerPayoutAmount === 700 ? 0 : 100),
      services: [service],
    });

    expect(rows[0]?.customerStepScenario).toMatchObject({
      status: 'Check margin',
      tone: 'pill-warn',
    });
    expect(rows[0]).toMatchObject({
      checkLabel: '1 check(s)',
      checkTone: 'pill-warn',
    });
  });
});

function serviceFixture({
  basePrice,
  durationMin,
  name,
  payoutRules,
  priceStep = 0,
  serviceGroupKey,
}: {
  readonly basePrice: number;
  readonly durationMin: number;
  readonly name: string;
  readonly payoutRules: readonly AdminServicePayoutRule[];
  readonly priceStep?: number;
  readonly serviceGroupKey?: string;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice,
    displayOrder: 0,
    durationMin,
    id: `${name}-service`,
    name,
    payoutRules: [...payoutRules],
    priceStep,
    serviceGroupKey,
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

function financeFixture(actualCompanyCommission: number) {
  return {
    actualCompanyCommission,
    fee: actualCompanyCommission,
    taxRuleLabel: null,
    vatAmount: 0,
    withholdingAmount: 0,
  };
}
