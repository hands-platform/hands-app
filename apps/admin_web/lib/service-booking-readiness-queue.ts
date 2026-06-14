import type { AdminServiceCatalogItem } from './admin-api';
import type { ProviderPriceImpact, ProviderPriceImpactRow } from './provider-price-impact';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServiceBookingReadinessQueueInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly actualCompanyCommission: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => number;
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly providerPriceImpact: (
    service: AdminServiceCatalogItem,
    activeTaxPolicy: TPolicy,
  ) => ProviderPriceImpact;
  readonly services: readonly AdminServiceCatalogItem[];
};

export type ServiceBookingReadinessItem = {
  readonly action: string;
  readonly detail: string;
  readonly serviceId: string;
  readonly status: string;
  readonly title: string;
  readonly tone: 'blocked' | 'warning';
};

export function serviceBookingReadinessQueue<TPolicy>({
  activeTaxPolicy,
  actualCompanyCommission,
  formatMoney,
  providerPriceImpact,
  services,
}: ServiceBookingReadinessQueueInput<TPolicy>): ServiceBookingReadinessItem[] {
  return services
    .filter((service) => service.active)
    .flatMap((service) => {
      const ruleContext = {
        activeTaxPolicy,
        actualCompanyCommission,
        formatMoney,
        service,
        title: serviceReadinessTitle(service),
      };
      const providerRows = providerPriceImpact(service, activeTaxPolicy).rows.filter(
        (row) => row.state !== 'bookable',
      );

      return [
        ...basePayoutRuleItems(ruleContext),
        ...providerPriceItems({
          formatMoney,
          rows: providerRows,
          service,
          title: ruleContext.title,
        }),
        ...invalidPayoutRuleItems(ruleContext),
        ...lowCommissionRuleItems(ruleContext),
      ];
    })
    .sort((left, right) => {
      const leftPriority = left.tone === 'blocked' ? 0 : 1;
      const rightPriority = right.tone === 'blocked' ? 0 : 1;
      return leftPriority - rightPriority || left.title.localeCompare(right.title);
    });
}

type ServiceReadinessRuleContext<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly actualCompanyCommission: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => number;
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly service: AdminServiceCatalogItem;
  readonly title: string;
};

function basePayoutRuleItems<TPolicy>({
  formatMoney,
  service,
  title,
}: ServiceReadinessRuleContext<TPolicy>): ServiceBookingReadinessItem[] {
  if (findBasePayoutRule(service)) {
    return [];
  }

  return [
    {
      serviceId: service.id,
      title,
      status: 'BLOCKED',
      detail: `Base price ${formatMoney(service.basePrice, 'VND')} has no active payout rule.`,
      action: 'Add an active payout rule at the minimum customer price before customers can book.',
      tone: 'blocked',
    },
  ];
}

function providerPriceItems({
  formatMoney,
  rows,
  service,
  title,
}: {
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly rows: readonly ProviderPriceImpactRow[];
  readonly service: AdminServiceCatalogItem;
  readonly title: string;
}): ServiceBookingReadinessItem[] {
  return rows.map((row) => ({
    serviceId: service.id,
    title,
    status: row.state === 'below_minimum' ? 'BLOCKED' : 'HIDDEN',
    detail: `${row.providerName} price ${formatMoney(row.price, row.currency)}: ${row.reason}`,
    action: providerPriceAction(row.state),
    tone: row.state === 'below_minimum' ? 'blocked' : 'warning',
  }));
}

function invalidPayoutRuleItems<TPolicy>({
  formatMoney,
  service,
  title,
}: ServiceReadinessRuleContext<TPolicy>): ServiceBookingReadinessItem[] {
  return (service.payoutRules ?? []).filter(isInvalidPayoutRuleFor(service)).map((rule) => ({
    serviceId: service.id,
    title,
    status: 'INVALID',
    detail: `Customer ${formatMoney(rule.customerPrice, rule.currency)} / Partner ${formatMoney(
      rule.providerPayoutAmount,
      rule.currency,
    )}`,
    action:
      'Customer price must respect the minimum and step, and Partner payout cannot exceed customer price.',
    tone: 'blocked',
  }));
}

function lowCommissionRuleItems<TPolicy>({
  activeTaxPolicy,
  actualCompanyCommission,
  formatMoney,
  service,
  title,
}: ServiceReadinessRuleContext<TPolicy>): ServiceBookingReadinessItem[] {
  return (service.payoutRules ?? [])
    .filter((rule) => rule.active)
    .map((rule) => ({
      commission: actualCompanyCommission(service, rule, activeTaxPolicy),
      rule,
    }))
    .filter(({ commission }) => commission <= 0)
    .map(({ commission, rule }) => ({
      serviceId: service.id,
      title,
      status: 'LOW FEE',
      detail: `Projected company commission is ${formatMoney(
        commission,
        rule.currency,
      )} for customer price ${formatMoney(rule.customerPrice, rule.currency)}.`,
      action: 'Adjust Partner payout, VAT/cost assumptions, or tax policy before scaling this price.',
      tone: 'warning',
    }));
}

function findBasePayoutRule(service: AdminServiceCatalogItem) {
  return (service.payoutRules ?? []).find(
    (rule) => rule.active && rule.customerPrice === service.basePrice,
  );
}

function isInvalidPayoutRuleFor(service: AdminServiceCatalogItem) {
  return (rule: ServicePayoutRule) =>
    rule.customerPrice < service.basePrice ||
    rule.customerPrice % service.priceStep !== 0 ||
    rule.providerPayoutAmount > rule.customerPrice;
}

function providerPriceAction(rowState: ProviderPriceImpactRow['state']) {
  if (rowState === 'missing_payout') {
    return 'Add an active payout rule for this exact Partner customer price.';
  }

  if (rowState === 'below_minimum') {
    return 'Ask the Partner to raise the price or lower the admin minimum price intentionally.';
  }

  return 'No customer action needed unless this Partner should be visible.';
}

function serviceReadinessTitle(service: AdminServiceCatalogItem) {
  return `${service.name} / ${service.durationMin} min`;
}
