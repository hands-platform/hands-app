import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';

export type ServicePricePolicyFinance = {
  readonly actualCompanyCommission: number;
  readonly fee: number;
  readonly taxRuleLabel: string | null;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
};

export type ServicePricePolicyScenario = {
  readonly label: string;
  readonly customerPrice: number;
  readonly providerPayoutAmount: number;
  readonly currency: string;
  readonly finance: ServicePricePolicyFinance;
  readonly tone: string;
  readonly status: string;
};

export type ServicePricePolicyPreviewRow = {
  readonly service: AdminServiceCatalogItem;
  readonly baseRule: AdminServicePayoutRule | null;
  readonly priceStep: number;
  readonly currency: string;
  readonly currentFinance: ServicePricePolicyFinance;
  readonly customerStepScenario: ServicePricePolicyScenario | null;
  readonly providerStepScenario: ServicePricePolicyScenario | null;
  readonly balancedStepScenario: ServicePricePolicyScenario | null;
  readonly checkLabel: string;
  readonly checkTone: string;
  readonly nextAction: string;
};

export type ServicePricePolicyPreviewRowsInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly servicePayoutFinance: (
    service: AdminServiceCatalogItem,
    rule: AdminServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => ServicePricePolicyFinance;
  readonly services: readonly AdminServiceCatalogItem[];
};

type PricePolicyScenarioInput = {
  readonly label: string;
  readonly customerPrice: number;
  readonly providerPayoutAmount: number;
};

export function servicePricePolicyPreviewRows<TPolicy>({
  activeTaxPolicy,
  servicePayoutFinance,
  services,
}: ServicePricePolicyPreviewRowsInput<TPolicy>): readonly ServicePricePolicyPreviewRow[] {
  return services
    .slice()
    .sort(
      (left, right) =>
        (left.serviceGroupKey ?? left.name).localeCompare(right.serviceGroupKey ?? right.name) ||
        left.durationMin - right.durationMin,
    )
    .map((service) => {
      const baseRule = basePayoutRule(service);
      const priceStep = Math.max(100000, service.priceStep || 100000);
      const currentFinance = baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : emptyFinancePreview();
      const customerStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, servicePayoutFinance, {
            customerPrice: baseRule.customerPrice + priceStep,
            label: 'Customer price + step',
            providerPayoutAmount: baseRule.providerPayoutAmount,
          })
        : null;
      const providerStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, servicePayoutFinance, {
            customerPrice: baseRule.customerPrice,
            label: 'Partner payout + step',
            providerPayoutAmount: baseRule.providerPayoutAmount + priceStep,
          })
        : null;
      const balancedStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, servicePayoutFinance, {
            customerPrice: baseRule.customerPrice + priceStep,
            label: 'Customer and partner + step',
            providerPayoutAmount: baseRule.providerPayoutAmount + priceStep,
          })
        : null;
      const scenarios = [customerStepScenario, providerStepScenario, balancedStepScenario].filter(isScenario);
      const flaggedScenarios = scenarios.filter(
        (scenario) =>
          scenario.providerPayoutAmount > scenario.customerPrice ||
          scenario.finance.actualCompanyCommission <= 0,
      );
      const checkLabel = !baseRule
        ? 'Missing base rule'
        : flaggedScenarios.length
          ? `${flaggedScenarios.length} check(s)`
          : 'Positive preview';
      const checkTone = !baseRule ? 'pill-danger' : flaggedScenarios.length ? 'pill-warn' : 'pill-success';
      const nextAction = !baseRule
        ? 'Add the base payout rule first.'
        : flaggedScenarios.length
          ? 'Review partner payout or tax/cost assumptions before saving a price change.'
          : 'These one-step scenarios keep a positive projected company commission.';

      return {
        balancedStepScenario,
        baseRule,
        checkLabel,
        checkTone,
        currency: baseRule?.currency ?? 'VND',
        currentFinance,
        customerStepScenario,
        nextAction,
        priceStep,
        providerStepScenario,
        service,
      };
    });
}

function buildPricePolicyScenario<TPolicy>(
  service: AdminServiceCatalogItem,
  baseRule: AdminServicePayoutRule,
  activeTaxPolicy: TPolicy,
  servicePayoutFinance: ServicePricePolicyPreviewRowsInput<TPolicy>['servicePayoutFinance'],
  input: PricePolicyScenarioInput,
): ServicePricePolicyScenario {
  const scenarioRule = {
    ...baseRule,
    customerPrice: input.customerPrice,
    providerPayoutAmount: input.providerPayoutAmount,
  };
  const finance = servicePayoutFinance(service, scenarioRule, activeTaxPolicy);
  const overpaysProvider = input.providerPayoutAmount > input.customerPrice;
  const hasPositiveCommission = finance.actualCompanyCommission > 0;
  return {
    currency: baseRule.currency,
    customerPrice: input.customerPrice,
    finance,
    label: input.label,
    providerPayoutAmount: input.providerPayoutAmount,
    status: overpaysProvider ? 'Overpays' : hasPositiveCommission ? 'Positive' : 'Check margin',
    tone: overpaysProvider ? 'pill-danger' : hasPositiveCommission ? 'pill-success' : 'pill-warn',
  };
}

function emptyFinancePreview(): ServicePricePolicyFinance {
  return {
    actualCompanyCommission: 0,
    fee: 0,
    taxRuleLabel: null,
    vatAmount: 0,
    withholdingAmount: 0,
  };
}

function basePayoutRule(service: AdminServiceCatalogItem) {
  return (
    (service.payoutRules ?? []).find((rule) => rule.active && rule.customerPrice === service.basePrice) ??
    null
  );
}

function isScenario(
  scenario: ServicePricePolicyScenario | null,
): scenario is ServicePricePolicyScenario {
  return scenario !== null;
}
