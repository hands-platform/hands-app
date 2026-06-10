import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';

export type ServicePriceLadderCoverageItem = {
  readonly price: number;
  readonly rule: AdminServicePayoutRule | null;
};

export function servicePriceLadderCoverage(
  service: AdminServiceCatalogItem,
): readonly ServicePriceLadderCoverageItem[] {
  const activeRules = new Map(
    (service.payoutRules ?? [])
      .filter((rule) => rule.active)
      .map((rule) => [rule.customerPrice, rule] as const),
  );
  const priceStep = Math.max(100000, service.priceStep || 100000);
  const prices = new Set<number>();
  for (let index = 0; index < 4; index += 1) {
    prices.add(service.basePrice + priceStep * index);
  }
  for (const rule of service.payoutRules ?? []) {
    prices.add(rule.customerPrice);
  }

  return [...prices]
    .sort((left, right) => left - right)
    .map((price) => ({
      price,
      rule: activeRules.get(price) ?? null,
    }));
}
