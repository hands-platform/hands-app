import type { AdminServiceCatalogItem, AdminServicePayoutRule } from './admin-api';

export function serviceBasePayoutRule(service: AdminServiceCatalogItem): AdminServicePayoutRule | null {
  return (
    (service.payoutRules ?? []).find((rule) => rule.active && rule.customerPrice === service.basePrice) ??
    null
  );
}
