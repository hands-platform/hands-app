import { PartnerTaxLineKind, TaxRuleScope } from '@prisma/client';

export type TaxPolicyRuleForCalculation = {
  readonly id: string;
  readonly scope: TaxRuleScope;
  readonly taxKind: PartnerTaxLineKind;
  readonly serviceType: string | null;
  readonly minGrossAmount: number | null;
  readonly maxGrossAmount: number | null;
  readonly rateBps: number;
  readonly fixedAmount: number;
};

export type TaxPolicyCalculationInput = {
  readonly grossAmount: number;
  readonly serviceTypes: readonly string[];
};

export function calculatePartnerTaxWithholding(
  rules: readonly TaxPolicyRuleForCalculation[],
  input: TaxPolicyCalculationInput,
) {
  const vat = calculatePartnerTaxLine(rules, input, PartnerTaxLineKind.PARTNER_VAT);
  const pit = calculatePartnerTaxLine(rules, input, PartnerTaxLineKind.PARTNER_PIT);
  const splitAmount = vat.amount + pit.amount;
  const combined = splitAmount > 0
    ? null
    : calculatePartnerTaxLine(rules, input, PartnerTaxLineKind.PARTNER_WITHHOLDING_COMBINED);

  return {
    amount: splitAmount > 0 ? splitAmount : (combined?.amount ?? 0),
    combined,
    pit,
    vat,
  };
}

export function calculatePartnerTaxLine(
  rules: readonly TaxPolicyRuleForCalculation[],
  input: TaxPolicyCalculationInput,
  taxKind: PartnerTaxLineKind,
) {
  const rule = selectTaxPolicyRule(rules, input, taxKind);
  const rateBps = rule?.rateBps ?? 0;
  const fixedAmount = rule?.fixedAmount ?? 0;
  const amount = rule ? calculateCappedBpsAmount(input.grossAmount, rateBps, fixedAmount) : 0;
  return { amount, fixedAmount, rateBps, rule };
}

export function calculateCappedBpsAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  return Math.max(0, Math.min(baseAmount, Math.round((baseAmount * rateBps) / 10_000) + fixedAmount));
}

export function selectTaxPolicyRule(
  rules: readonly TaxPolicyRuleForCalculation[],
  input: TaxPolicyCalculationInput,
  taxKind: PartnerTaxLineKind,
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const candidates = rules.filter((rule) => rule.taxKind === taxKind);
  const prioritized = [...candidates].sort(
    (left, right) =>
      taxPolicyRulePriority(right, serviceTypes, input.grossAmount) -
      taxPolicyRulePriority(left, serviceTypes, input.grossAmount),
  );
  return prioritized.find((rule) => taxPolicyRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null;
}

function taxPolicyRulePriority(
  rule: TaxPolicyRuleForCalculation,
  serviceTypes: ReadonlySet<string>,
  grossAmount: number,
) {
  if (rule.scope === TaxRuleScope.SERVICE_TYPE) {
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase()) ? 30 : 0;
  }
  if (rule.scope === TaxRuleScope.AMOUNT_BAND) {
    const aboveMin = rule.minGrossAmount === null || grossAmount >= rule.minGrossAmount;
    const belowMax = rule.maxGrossAmount === null || grossAmount <= rule.maxGrossAmount;
    return aboveMin && belowMax ? 20 : 0;
  }
  return rule.scope === TaxRuleScope.DEFAULT ? 10 : 0;
}
