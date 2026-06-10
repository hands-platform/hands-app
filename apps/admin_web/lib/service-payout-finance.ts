import type { AdminServiceCatalogItem, AdminServicePayoutRule, AdminTaxPolicyVersion } from './admin-api';

type AdminTaxRule = NonNullable<AdminTaxPolicyVersion['rules']>[number];

export type ServicePayoutFinance = {
  readonly fee: number;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
  readonly taxRuleLabel: string | null;
  readonly actualCompanyCommission: number;
};

export type EstimatedWithholding = {
  readonly withholdingAmount: number;
  readonly ruleLabel: string | null;
};

export function estimateWithholding(
  policy: AdminTaxPolicyVersion | undefined,
  service: AdminServiceCatalogItem,
  grossAmount: number,
): EstimatedWithholding {
  const rule = selectTaxRule(policy?.rules ?? [], {
    grossAmount,
    serviceTypes: [service.serviceGroupKey, service.name].filter(Boolean).map(String),
  });
  if (!policy || !rule) {
    return { ruleLabel: null, withholdingAmount: 0 };
  }
  const withholdingAmount = Math.max(
    0,
    Math.min(grossAmount, Math.round((grossAmount * rule.rateBps) / 10000) + rule.fixedAmount),
  );
  return {
    ruleLabel: `${rule.scope}${rule.serviceType ? `:${rule.serviceType}` : ''} ${formatBps(rule.rateBps)}`,
    withholdingAmount,
  };
}

export function actualCompanyCommission(
  service: AdminServiceCatalogItem,
  rule: AdminServicePayoutRule,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return servicePayoutFinance(service, rule, activeTaxPolicy).actualCompanyCommission;
}

export function servicePayoutFinance(
  service: AdminServiceCatalogItem,
  rule: AdminServicePayoutRule,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
): ServicePayoutFinance {
  const fee = rule.customerPrice - rule.providerPayoutAmount;
  const taxableFee = Math.max(0, fee);
  const vatAmount = Math.round((taxableFee * rule.vatBps) / 10000);
  const tax = estimateWithholding(activeTaxPolicy, service, rule.customerPrice);
  return {
    actualCompanyCommission: fee - vatAmount - tax.withholdingAmount - rule.otherCostAmount,
    fee,
    taxRuleLabel: tax.ruleLabel,
    vatAmount,
    withholdingAmount: tax.withholdingAmount,
  };
}

function selectTaxRule(
  rules: readonly AdminTaxRule[],
  input: { readonly grossAmount: number; readonly serviceTypes: readonly string[] },
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const prioritized = [...rules]
    .filter((rule) => rule.active)
    .sort(
      (left, right) =>
        taxRulePriority(right, serviceTypes, input.grossAmount) -
        taxRulePriority(left, serviceTypes, input.grossAmount),
    );
  return prioritized.find((rule) => taxRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null;
}

function taxRulePriority(rule: AdminTaxRule, serviceTypes: Set<string>, grossAmount: number) {
  if (rule.scope === 'SERVICE_TYPE') {
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase()) ? 30 : 0;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    const aboveMin = rule.minGrossAmount == null || grossAmount >= rule.minGrossAmount;
    const belowMax = rule.maxGrossAmount == null || grossAmount <= rule.maxGrossAmount;
    return aboveMin && belowMax ? 20 : 0;
  }
  if (rule.scope === 'DEFAULT') {
    return 10;
  }
  return 0;
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}
