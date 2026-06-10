import type { AdminServiceCatalogItem, AdminServicePayoutRule, AdminTaxPolicyVersion, AdminTaxRule } from './admin-api';
import { actualCompanyCommission, estimateWithholding, servicePayoutFinance } from './service-payout-finance';

describe('service payout finance', () => {
  it('prioritizes matching service type tax rules over amount band and default rules', () => {
    const service = serviceFixture({ name: 'Foot massage', serviceGroupKey: 'foot' });
    const policy = taxPolicyFixture([
      taxRuleFixture({ fixedAmount: 0, id: 'default', rateBps: 100, scope: 'DEFAULT' }),
      taxRuleFixture({
        fixedAmount: 500,
        id: 'amount-band',
        maxGrossAmount: 200000,
        minGrossAmount: 100000,
        rateBps: 200,
        scope: 'AMOUNT_BAND',
      }),
      taxRuleFixture({
        fixedAmount: 1000,
        id: 'service-type',
        rateBps: 300,
        scope: 'SERVICE_TYPE',
        serviceType: 'foot',
      }),
    ]);

    expect(estimateWithholding(policy, service, 150000)).toEqual({
      ruleLabel: 'SERVICE_TYPE:foot 3.00%',
      withholdingAmount: 5500,
    });
  });

  it('uses amount band rules when service type does not match and caps withholding to gross amount', () => {
    const service = serviceFixture({ name: 'Body massage', serviceGroupKey: 'body' });
    const policy = taxPolicyFixture([
      taxRuleFixture({ fixedAmount: 0, id: 'default', rateBps: 100, scope: 'DEFAULT' }),
      taxRuleFixture({
        fixedAmount: 500,
        id: 'amount-band',
        maxGrossAmount: 200000,
        minGrossAmount: 100000,
        rateBps: 200,
        scope: 'AMOUNT_BAND',
      }),
      taxRuleFixture({
        fixedAmount: 1000,
        id: 'service-type',
        rateBps: 300,
        scope: 'SERVICE_TYPE',
        serviceType: 'foot',
      }),
    ]);

    expect(estimateWithholding(policy, service, 150000)).toEqual({
      ruleLabel: 'AMOUNT_BAND 2.00%',
      withholdingAmount: 3500,
    });
    expect(
      estimateWithholding(taxPolicyFixture([taxRuleFixture({ fixedAmount: 5000, id: 'cap', rateBps: 10000 })]), service, 4000),
    ).toEqual({
      ruleLabel: 'DEFAULT 100.00%',
      withholdingAmount: 4000,
    });
  });

  it('returns zero withholding when no active policy or rule is available', () => {
    const service = serviceFixture({ name: 'Foot massage' });

    expect(estimateWithholding(undefined, service, 100000)).toEqual({
      ruleLabel: null,
      withholdingAmount: 0,
    });
    expect(
      estimateWithholding(
        taxPolicyFixture([taxRuleFixture({ active: false, id: 'inactive', rateBps: 1000 })]),
        service,
        100000,
      ),
    ).toEqual({
      ruleLabel: null,
      withholdingAmount: 0,
    });
  });

  it('calculates fee, VAT, withholding, other cost, and actual company commission', () => {
    const service = serviceFixture({ name: 'Foot massage', serviceGroupKey: 'foot' });
    const rule = payoutRuleFixture({
      customerPrice: 100000,
      otherCostAmount: 2000,
      providerPayoutAmount: 70000,
      vatBps: 1000,
    });
    const policy = taxPolicyFixture([
      taxRuleFixture({ fixedAmount: 500, id: 'default', rateBps: 1000, scope: 'DEFAULT' }),
    ]);

    expect(servicePayoutFinance(service, rule, policy)).toEqual({
      actualCompanyCommission: 14500,
      fee: 30000,
      taxRuleLabel: 'DEFAULT 10.00%',
      vatAmount: 3000,
      withholdingAmount: 10500,
    });
    expect(actualCompanyCommission(service, rule, policy)).toBe(14500);
  });
});

function serviceFixture({
  name,
  serviceGroupKey,
}: {
  readonly name: string;
  readonly serviceGroupKey?: string;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 100000,
    displayOrder: 0,
    durationMin: 60,
    id: `${name}-service`,
    name,
    priceStep: 100000,
    serviceGroupKey,
  };
}

function payoutRuleFixture({
  customerPrice,
  otherCostAmount,
  providerPayoutAmount,
  vatBps,
}: {
  readonly customerPrice: number;
  readonly otherCostAmount: number;
  readonly providerPayoutAmount: number;
  readonly vatBps: number;
}): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice,
    id: 'rule-1',
    otherCostAmount,
    providerPayoutAmount,
    serviceId: 'service-1',
    vatBps,
  };
}

function taxPolicyFixture(rules: readonly AdminTaxRule[]): AdminTaxPolicyVersion {
  return {
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    id: 'policy-1',
    name: 'Vietnam tax policy',
    rules: [...rules],
    status: 'ACTIVE',
  };
}

function taxRuleFixture({
  active = true,
  fixedAmount = 0,
  id,
  maxGrossAmount,
  minGrossAmount,
  rateBps,
  scope = 'DEFAULT',
  serviceType,
}: {
  readonly active?: boolean;
  readonly fixedAmount?: number;
  readonly id: string;
  readonly maxGrossAmount?: number;
  readonly minGrossAmount?: number;
  readonly rateBps: number;
  readonly scope?: string;
  readonly serviceType?: string;
}): AdminTaxRule {
  return {
    active,
    fixedAmount,
    id,
    maxGrossAmount,
    minGrossAmount,
    policyVersionId: 'policy-1',
    rateBps,
    scope,
    serviceType,
  };
}
