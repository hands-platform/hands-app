import type { AdminServiceCatalogItem } from './admin-api';
import { serviceTypeCoverageStatus } from './service-type-coverage-status';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServicePayoutFinance = {
  readonly actualCompanyCommission: number;
};

type ProviderPriceImpact = {
  readonly rows: readonly {
    readonly state: string;
  }[];
};

type ServiceTypeCoverageGroup = {
  readonly items: readonly AdminServiceCatalogItem[];
  readonly key: string;
  readonly label: string;
};

type ServiceTypeCoverageRowsInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly basePayoutRule: (service: AdminServiceCatalogItem) => ServicePayoutRule | null;
  readonly formatDurationList: (items: readonly AdminServiceCatalogItem[]) => string;
  readonly groups: readonly ServiceTypeCoverageGroup[];
  readonly missingStandardDurations: (items: readonly AdminServiceCatalogItem[]) => readonly number[];
  readonly providerPriceImpact: (
    service: AdminServiceCatalogItem,
    activeTaxPolicy: TPolicy,
  ) => ProviderPriceImpact;
  readonly servicePayoutFinance: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => ServicePayoutFinance;
};

export type ServiceTypeCoverageRow = {
  readonly activeDurationLabels: string;
  readonly activeOptionCount: number;
  readonly belowMinimumCount: number;
  readonly currency: string;
  readonly customerMinimumTotal: number;
  readonly hiddenPartnerPriceCount: number;
  readonly inactivePartnerPriceCount: number;
  readonly key: string;
  readonly label: string;
  readonly lowCommissionCount: number;
  readonly missingBasePayoutCount: number;
  readonly missingDurations: readonly number[];
  readonly missingPayoutPriceCount: number;
  readonly netCompanyFee: number;
  readonly nextAction: string;
  readonly partnerPayoutTotal: number;
  readonly payoutRuleCount: number;
  readonly statusLabel: string;
  readonly tone: ReturnType<typeof serviceTypeCoverageStatus>['tone'];
  readonly visiblePartnerPriceCount: number;
};

export function serviceTypeCoverageRows<TPolicy>({
  activeTaxPolicy,
  basePayoutRule,
  formatDurationList,
  groups,
  missingStandardDurations,
  providerPriceImpact,
  servicePayoutFinance,
}: ServiceTypeCoverageRowsInput<TPolicy>): ServiceTypeCoverageRow[] {
  return groups
    .map((group) => {
      const activeItems = group.items.filter((item) => item.active);
      const missingDurations = missingStandardDurations(group.items);
      const missingBasePayoutCount = activeItems.filter((service) => !basePayoutRule(service)).length;
      const payoutRuleCount = group.items.reduce((sum, service) => sum + (service.payoutRules?.length ?? 0), 0);
      const providerImpactRows = activeItems.flatMap((service) => providerPriceImpact(service, activeTaxPolicy).rows);
      const visiblePartnerPriceCount = providerImpactRows.filter((row) => row.state === 'bookable').length;
      const belowMinimumCount = providerImpactRows.filter((row) => row.state === 'below_minimum').length;
      const missingPayoutPriceCount = providerImpactRows.filter((row) => row.state === 'missing_payout').length;
      const inactivePartnerPriceCount = providerImpactRows.filter((row) => row.state === 'inactive').length;
      const hiddenPartnerPriceCount = belowMinimumCount + missingPayoutPriceCount + inactivePartnerPriceCount;
      const financeRows = activeItems
        .map((service) => {
          const rule = basePayoutRule(service);
          if (!rule) {
            return null;
          }

          return {
            service,
            rule,
            finance: servicePayoutFinance(service, rule, activeTaxPolicy),
          };
        })
        .filter(
          (
            row,
          ): row is {
            readonly finance: ServicePayoutFinance;
            readonly rule: ServicePayoutRule;
            readonly service: AdminServiceCatalogItem;
          } => row !== null,
        );
      const lowCommissionCount = financeRows.filter((row) => row.finance.actualCompanyCommission <= 0).length;
      const currency = financeRows[0]?.rule.currency ?? 'VND';
      const totals = financeRows.reduce(
        (summary, row) => ({
          customerMinimumTotal: summary.customerMinimumTotal + row.service.basePrice,
          partnerPayoutTotal: summary.partnerPayoutTotal + row.rule.providerPayoutAmount,
          netCompanyFee: summary.netCompanyFee + row.finance.actualCompanyCommission,
        }),
        { customerMinimumTotal: 0, partnerPayoutTotal: 0, netCompanyFee: 0 },
      );
      const coverageStatus = serviceTypeCoverageStatus({
        belowMinimumCount,
        lowCommissionCount,
        missingBasePayoutCount,
        missingDurations,
        missingPayoutPriceCount,
      });

      return {
        key: group.key,
        label: group.label,
        activeOptionCount: activeItems.length,
        activeDurationLabels: formatDurationList(activeItems),
        missingDurations,
        missingBasePayoutCount,
        payoutRuleCount,
        visiblePartnerPriceCount,
        hiddenPartnerPriceCount,
        belowMinimumCount,
        missingPayoutPriceCount,
        inactivePartnerPriceCount,
        lowCommissionCount,
        customerMinimumTotal: totals.customerMinimumTotal,
        partnerPayoutTotal: totals.partnerPayoutTotal,
        netCompanyFee: totals.netCompanyFee,
        currency,
        tone: coverageStatus.tone,
        statusLabel: coverageStatus.statusLabel,
        nextAction: coverageStatus.nextAction,
      };
    })
    .sort((left, right) => {
      const priority = (row: { readonly tone: string }) =>
        row.tone === 'pill-danger' ? 0 : row.tone === 'pill-warn' ? 1 : 2;

      return priority(left) - priority(right) || left.label.localeCompare(right.label);
    });
}
