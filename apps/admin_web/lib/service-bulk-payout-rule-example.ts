import type { AdminServiceCatalogItem } from './admin-api';

export function serviceBulkPayoutRuleExample(service: AdminServiceCatalogItem) {
  const priceStep = Math.max(100000, service.priceStep || 100000);
  const existingRows = (service.payoutRules ?? [])
    .filter((rule) => rule.active)
    .sort((left, right) => left.customerPrice - right.customerPrice)
    .slice(0, 4)
    .map((rule) => `${rule.customerPrice},${rule.providerPayoutAmount}`);
  if (existingRows.length > 0) {
    return existingRows.join('\n');
  }
  return [0, 1, 2]
    .map((index) => {
      const customerPrice = service.basePrice + priceStep * index;
      const providerPayout = Math.max(0, customerPrice - Math.round(customerPrice * 0.2));
      return `${customerPrice},${providerPayout}`;
    })
    .join('\n');
}
