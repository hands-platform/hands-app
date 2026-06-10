type ServicePricePolicyFinance = {
  readonly actualCompanyCommission: number;
};

type ServicePricePolicyScenario = {
  readonly customerPrice: number;
  readonly finance: ServicePricePolicyFinance;
  readonly providerPayoutAmount: number;
};

type ServicePricePolicyPreviewSummaryRow = {
  readonly baseRule: unknown | null;
  readonly balancedStepScenario: ServicePricePolicyScenario | null;
  readonly currency: string;
  readonly currentFinance: ServicePricePolicyFinance;
  readonly customerStepScenario: ServicePricePolicyScenario | null;
  readonly providerStepScenario: ServicePricePolicyScenario | null;
};

export function servicePricePolicyPreviewSummary(
  rows: readonly ServicePricePolicyPreviewSummaryRow[],
) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';
  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      currentCommission: summary.currentCommission + row.currentFinance.actualCompanyCommission,
      customerStepCommission:
        summary.customerStepCommission + (row.customerStepScenario?.finance.actualCompanyCommission ?? 0),
      providerStepCommission:
        summary.providerStepCommission + (row.providerStepScenario?.finance.actualCompanyCommission ?? 0),
      balancedStepCommission:
        summary.balancedStepCommission + (row.balancedStepScenario?.finance.actualCompanyCommission ?? 0),
      missingBaseRuleCount: summary.missingBaseRuleCount + (row.baseRule ? 0 : 1),
      policyCheckCount:
        summary.policyCheckCount +
        [row.customerStepScenario, row.providerStepScenario, row.balancedStepScenario].filter(
          (scenario) =>
            scenario &&
            (scenario.providerPayoutAmount > scenario.customerPrice ||
              scenario.finance.actualCompanyCommission <= 0),
        ).length,
    }),
    {
      currency,
      currentCommission: 0,
      customerStepCommission: 0,
      providerStepCommission: 0,
      balancedStepCommission: 0,
      missingBaseRuleCount: 0,
      policyCheckCount: 0,
    },
  );
}
