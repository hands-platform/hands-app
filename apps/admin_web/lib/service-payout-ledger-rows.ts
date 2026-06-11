import type { AdminServiceCatalogItem } from './admin-api';
import { servicePayoutLedgerAction } from './service-payout-ledger-action';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServicePayoutFinance = {
  readonly actualCompanyCommission: number;
  readonly fee: number;
  readonly taxRuleLabel: string | null;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
};

type ProviderPriceImpact = {
  readonly rows: readonly {
    readonly state: string;
  }[];
};

type ServicePayoutLedgerRowsInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly basePayoutRule: (service: AdminServiceCatalogItem) => ServicePayoutRule | null;
  readonly providerPriceImpact: (
    service: AdminServiceCatalogItem,
    activeTaxPolicy: TPolicy,
  ) => ProviderPriceImpact;
  readonly servicePayoutFinance: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => ServicePayoutFinance;
  readonly services: readonly AdminServiceCatalogItem[];
};

export type ServicePayoutLedgerRow = {
  readonly action: ReturnType<typeof servicePayoutLedgerAction>['action'];
  readonly actionTone: ReturnType<typeof servicePayoutLedgerAction>['actionTone'];
  readonly baseRule: ServicePayoutRule | null;
  readonly commissionTone: ReturnType<typeof servicePayoutLedgerAction>['commissionTone'];
  readonly currency: string;
  readonly finance: ServicePayoutFinance;
  readonly hiddenProviders: number;
  readonly service: AdminServiceCatalogItem;
  readonly totalProviderRows: number;
  readonly visibleProviders: number;
};

export function servicePayoutLedgerRows<TPolicy>({
  activeTaxPolicy,
  basePayoutRule,
  providerPriceImpact,
  servicePayoutFinance,
  services,
}: ServicePayoutLedgerRowsInput<TPolicy>): ServicePayoutLedgerRow[] {
  return services
    .slice()
    .sort(
      (left, right) =>
        (left.serviceGroupKey ?? left.name).localeCompare(right.serviceGroupKey ?? right.name) ||
        left.durationMin - right.durationMin,
    )
    .map((service) => {
      const baseRule = basePayoutRule(service);
      const finance = baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : emptyPayoutFinance();
      const impact = providerPriceImpact(service, activeTaxPolicy);
      const providerVisibility = summarizeProviderVisibility(impact);
      const ledgerAction = servicePayoutLedgerAction({
        actualCompanyCommission: finance.actualCompanyCommission,
        hasBaseRule: Boolean(baseRule),
        hiddenProviders: providerVisibility.hiddenProviders,
      });

      return {
        service,
        baseRule,
        finance,
        currency: baseRule?.currency ?? 'VND',
        visibleProviders: providerVisibility.visibleProviders,
        hiddenProviders: providerVisibility.hiddenProviders,
        totalProviderRows: providerVisibility.totalProviderRows,
        commissionTone: ledgerAction.commissionTone,
        action: ledgerAction.action,
        actionTone: ledgerAction.actionTone,
      };
    });
}

function emptyPayoutFinance(): ServicePayoutFinance {
  return {
    actualCompanyCommission: 0,
    fee: 0,
    taxRuleLabel: null,
    vatAmount: 0,
    withholdingAmount: 0,
  };
}

function summarizeProviderVisibility(impact: ProviderPriceImpact) {
  const visibleProviders = impact.rows.filter((row) => row.state === 'bookable').length;
  return {
    hiddenProviders: impact.rows.length - visibleProviders,
    totalProviderRows: impact.rows.length,
    visibleProviders,
  };
}
