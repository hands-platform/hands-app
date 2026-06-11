import type { AdminServiceCatalogItem, AdminServicePayoutRule, AdminTaxPolicyVersion } from './admin-api';

type AdminTaxRule = NonNullable<AdminTaxPolicyVersion['rules']>[number];

const BPS_DENOMINATOR = 10_000;
const TAX_RULE_PRIORITY = {
  amountBand: 20,
  default: 10,
  serviceType: 30,
} as const;

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
    serviceTypes: serviceTaxTypes(service),
  });
  if (!policy || !rule) {
    return { ruleLabel: null, withholdingAmount: 0 };
  }
  return {
    ruleLabel: taxRuleLabel(rule),
    withholdingAmount: withholdingAmountForRule(grossAmount, rule),
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
  const vatAmount = bpsAmount(taxableFee, rule.vatBps);
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
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase())
      ? TAX_RULE_PRIORITY.serviceType
      : 0;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    return amountBandMatches(rule, grossAmount) ? TAX_RULE_PRIORITY.amountBand : 0;
  }
  if (rule.scope === 'DEFAULT') {
    return TAX_RULE_PRIORITY.default;
  }
  return 0;
}

function serviceTaxTypes(service: AdminServiceCatalogItem) {
  return [service.serviceGroupKey, service.name].filter(Boolean).map(String);
}

function withholdingAmountForRule(grossAmount: number, rule: AdminTaxRule) {
  return cappedBpsAmount(grossAmount, rule.rateBps, rule.fixedAmount);
}

function taxRuleLabel(rule: AdminTaxRule) {
  return `${rule.scope}${rule.serviceType ? `:${rule.serviceType}` : ''} ${formatBps(rule.rateBps)}`;
}

function amountBandMatches(rule: AdminTaxRule, grossAmount: number) {
  const aboveMin = rule.minGrossAmount == null || grossAmount >= rule.minGrossAmount;
  const belowMax = rule.maxGrossAmount == null || grossAmount <= rule.maxGrossAmount;
  return aboveMin && belowMax;
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

function bpsAmount(baseAmount: number, rateBps: number) {
  return Math.round((baseAmount * rateBps) / BPS_DENOMINATOR);
}

function cappedBpsAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  return Math.max(0, Math.min(baseAmount, bpsAmount(baseAmount, rateBps) + fixedAmount));
}
