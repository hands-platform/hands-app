import type { AdminServiceCatalogItem } from './admin-api';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ProviderPriceImpact = {
  readonly rows: readonly {
    readonly currency: string;
    readonly price: number;
    readonly providerName: string;
    readonly reason: string;
    readonly state: string;
  }[];
};

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
      const items: ServiceBookingReadinessItem[] = [];
      const basePayoutRule = (service.payoutRules ?? []).find(
        (rule) => rule.active && rule.customerPrice === service.basePrice,
      );
      const invalidRules = (service.payoutRules ?? []).filter(
        (rule) =>
          rule.customerPrice < service.basePrice ||
          rule.customerPrice % service.priceStep !== 0 ||
          rule.providerPayoutAmount > rule.customerPrice,
      );
      const lowCommissionRules = (service.payoutRules ?? []).filter(
        (rule) => rule.active && actualCompanyCommission(service, rule, activeTaxPolicy) <= 0,
      );
      const providerPriceRows = providerPriceImpact(service, activeTaxPolicy).rows.filter(
        (row) => row.state !== 'bookable',
      );

      if (!basePayoutRule) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'BLOCKED',
          detail: `Base price ${formatMoney(service.basePrice, 'VND')} has no active payout rule.`,
          action: 'Add an active payout rule at the minimum customer price before customers can book.',
          tone: 'blocked',
        });
      }

      for (const row of providerPriceRows) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: row.state === 'below_minimum' ? 'BLOCKED' : 'HIDDEN',
          detail: `${row.providerName} price ${formatMoney(row.price, row.currency)}: ${row.reason}`,
          action:
            row.state === 'missing_payout'
              ? 'Add an active payout rule for this exact partner customer price.'
              : row.state === 'below_minimum'
                ? 'Ask the partner to raise the price or lower the admin minimum price intentionally.'
                : 'No customer action needed unless this partner should be visible.',
          tone: row.state === 'below_minimum' ? 'blocked' : 'warning',
        });
      }

      for (const rule of invalidRules) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'INVALID',
          detail: `Customer ${formatMoney(rule.customerPrice, rule.currency)} / partner ${formatMoney(
            rule.providerPayoutAmount,
            rule.currency,
          )}`,
          action:
            'Customer price must respect the minimum and step, and partner payout cannot exceed customer price.',
          tone: 'blocked',
        });
      }

      for (const rule of lowCommissionRules) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'LOW FEE',
          detail: `Projected company commission is ${formatMoney(
            actualCompanyCommission(service, rule, activeTaxPolicy),
            rule.currency,
          )} for customer price ${formatMoney(rule.customerPrice, rule.currency)}.`,
          action: 'Adjust partner payout, VAT/cost assumptions, or tax policy before scaling this price.',
          tone: 'warning',
        });
      }

      return items;
    })
    .sort((left, right) => {
      const leftPriority = left.tone === 'blocked' ? 0 : 1;
      const rightPriority = right.tone === 'blocked' ? 0 : 1;
      return leftPriority - rightPriority || left.title.localeCompare(right.title);
    });
}
