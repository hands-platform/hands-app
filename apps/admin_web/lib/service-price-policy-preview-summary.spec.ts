import { servicePricePolicyPreviewSummary } from './service-price-policy-preview-summary';

describe('service price policy preview summary', () => {
  it('sums current and scenario commissions with policy check count', () => {
    const summary = servicePricePolicyPreviewSummary([
      {
        baseRule: { id: 'rule-1' },
        balancedStepScenario: {
          customerPrice: 1200,
          finance: { actualCompanyCommission: 260 },
          providerPayoutAmount: 850,
        },
        currency: 'VND',
        currentFinance: { actualCompanyCommission: 220 },
        customerStepScenario: {
          customerPrice: 1300,
          finance: { actualCompanyCommission: 300 },
          providerPayoutAmount: 900,
        },
        providerStepScenario: {
          customerPrice: 1200,
          finance: { actualCompanyCommission: -10 },
          providerPayoutAmount: 1100,
        },
      },
      {
        baseRule: null,
        balancedStepScenario: null,
        currency: 'VND',
        currentFinance: { actualCompanyCommission: 0 },
        customerStepScenario: null,
        providerStepScenario: {
          customerPrice: 1000,
          finance: { actualCompanyCommission: 100 },
          providerPayoutAmount: 700,
        },
      },
    ]);

    expect(summary).toEqual({
      balancedStepCommission: 260,
      currency: 'VND',
      currentCommission: 220,
      customerStepCommission: 300,
      missingBaseRuleCount: 1,
      policyCheckCount: 1,
      providerStepCommission: 90,
    });
  });

  it('returns empty VND totals when there are no preview rows', () => {
    expect(servicePricePolicyPreviewSummary([])).toEqual({
      balancedStepCommission: 0,
      currency: 'VND',
      currentCommission: 0,
      customerStepCommission: 0,
      missingBaseRuleCount: 0,
      policyCheckCount: 0,
      providerStepCommission: 0,
    });
  });
});
