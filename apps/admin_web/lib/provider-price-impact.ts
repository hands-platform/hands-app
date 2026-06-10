import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';

type ProviderPriceImpactState = 'below_minimum' | 'bookable' | 'inactive' | 'missing_payout';

export type ProviderPriceImpactInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly actualCompanyCommission: (
    service: AdminServiceCatalogItem,
    rule: AdminServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => number;
  readonly service: AdminServiceCatalogItem;
};

export type ProviderPriceImpactRow = {
  readonly id: string;
  readonly providerName: string;
  readonly providerStatus: string;
  readonly price: number;
  readonly currency: string;
  readonly rule: AdminServicePayoutRule | null;
  readonly state: ProviderPriceImpactState;
  readonly reason: string;
};

export type ProviderPriceImpact = {
  readonly rows: readonly ProviderPriceImpactRow[];
  readonly unsupportedCount: number;
  readonly belowMinimumCount: number;
  readonly inactiveOrBlockedCount: number;
};

export function providerPriceImpact<TPolicy>({
  activeTaxPolicy,
  actualCompanyCommission,
  service,
}: ProviderPriceImpactInput<TPolicy>): ProviderPriceImpact {
  const activeRules = new Map(
    (service.payoutRules ?? [])
      .filter((rule) => rule.active)
      .map((rule) => [rule.customerPrice, rule] as const),
  );
  const rows = (service.providers ?? [])
    .slice()
    .sort((left, right) => {
      const leftName = left.providerProfile?.displayName ?? left.providerProfileId;
      const rightName = right.providerProfile?.displayName ?? right.providerProfileId;
      return (
        Number(right.active) - Number(left.active) ||
        left.price - right.price ||
        leftName.localeCompare(rightName)
      );
    })
    .map((providerService): ProviderPriceImpactRow => {
      const rule = activeRules.get(providerService.price) ?? null;
      const providerName = providerService.providerProfile?.displayName ?? 'Unnamed partner';
      const providerStatus = providerService.providerProfile?.status ?? 'UNKNOWN';
      const providerBlocked = Boolean(providerService.providerProfile?.blockedAt);
      let state: ProviderPriceImpactState = 'bookable';
      let reason = 'Customer can book this partner price.';

      if (!providerService.active || providerBlocked) {
        state = 'inactive';
        reason = providerBlocked ? 'Partner account is blocked.' : 'Partner price row is inactive.';
      } else if (providerService.price < service.basePrice) {
        state = 'below_minimum';
        reason = 'Partner price is below the admin minimum, so it must stay hidden.';
      } else if (!rule) {
        state = 'missing_payout';
        reason = 'No active payout rule exists for this exact customer price, so booking stays hidden.';
      } else if (actualCompanyCommission(service, rule, activeTaxPolicy) <= 0) {
        state = 'missing_payout';
        reason = 'Payout rule exists, but projected company commission is not positive.';
      }

      return {
        currency: rule?.currency ?? 'VND',
        id: providerService.id,
        price: providerService.price,
        providerName,
        providerStatus,
        reason,
        rule,
        state,
      };
    });

  return {
    belowMinimumCount: rows.filter((row) => row.state === 'below_minimum').length,
    inactiveOrBlockedCount: rows.filter((row) => row.state === 'inactive').length,
    rows,
    unsupportedCount: rows.filter((row) => row.state === 'missing_payout').length,
  };
}
