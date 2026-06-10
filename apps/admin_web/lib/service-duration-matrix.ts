import type { AdminServiceCatalogItem } from './admin-api';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServicePayoutFinance = {
  readonly actualCompanyCommission: number;
  readonly fee: number;
  readonly taxRuleLabel: string | null;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
};

type ServiceDurationMatrixInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly basePayoutRule: (service: AdminServiceCatalogItem) => ServicePayoutRule | null;
  readonly items: readonly AdminServiceCatalogItem[];
  readonly servicePayoutFinance: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => ServicePayoutFinance;
};

type ServiceDurationMatrixCell = {
  readonly baseRule: ServicePayoutRule | null;
  readonly finance: ServicePayoutFinance;
  readonly service: AdminServiceCatalogItem;
};

export function serviceDurationMatrix<TPolicy>({
  activeTaxPolicy,
  basePayoutRule,
  items,
  servicePayoutFinance,
}: ServiceDurationMatrixInput<TPolicy>) {
  const byDuration = new Map<number, ServiceDurationMatrixCell>();

  for (const service of items) {
    const baseRule = basePayoutRule(service);
    byDuration.set(service.durationMin, {
      service,
      baseRule,
      finance: baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : {
            fee: 0,
            vatAmount: 0,
            withholdingAmount: 0,
            taxRuleLabel: null,
            actualCompanyCommission: 0,
          },
    });
  }

  const activeItems = items.filter((item) => item.active);
  const totals = [...byDuration.values()].reduce(
    (summary, cell) => {
      if (!cell.baseRule) {
        return summary;
      }

      return {
        currency: cell.baseRule.currency,
        customerMinimum: summary.customerMinimum + cell.service.basePrice,
        providerPayout: summary.providerPayout + cell.baseRule.providerPayoutAmount,
        grossFee: summary.grossFee + cell.finance.fee,
        taxAndCost:
          summary.taxAndCost +
          cell.finance.vatAmount +
          cell.finance.withholdingAmount +
          cell.baseRule.otherCostAmount,
        netCompanyFee: summary.netCompanyFee + cell.finance.actualCompanyCommission,
      };
    },
    {
      currency: 'VND',
      customerMinimum: 0,
      providerPayout: 0,
      grossFee: 0,
      taxAndCost: 0,
      netCompanyFee: 0,
    },
  );

  return {
    byDuration,
    activeCount: activeItems.length,
    payoutRuleCount: items.reduce((sum, item) => sum + (item.payoutRules?.length ?? 0), 0),
    blockedCount: activeItems.filter(
      (item) =>
        !(item.payoutRules ?? []).some((rule) => rule.active && rule.customerPrice === item.basePrice),
    ).length,
    totals,
  };
}
