import type { AdminServiceCatalogItem } from './admin-api';
import { formatMoney } from './admin-format';

export function formatDurationList(items: readonly AdminServiceCatalogItem[]) {
  return items
    .map((item) => item.durationMin)
    .sort((left, right) => left - right)
    .map((duration) => `${duration} min`)
    .join(', ');
}

export function missingStandardDurations(items: readonly AdminServiceCatalogItem[]) {
  const configured = new Set(items.filter((item) => item.active).map((item) => item.durationMin));
  return [60, 90, 120].filter((duration) => !configured.has(duration));
}

export function formatGroupPriceRange(items: readonly AdminServiceCatalogItem[]) {
  const prices = items.filter((item) => item.active).map((item) => item.basePrice);
  if (prices.length === 0) {
    return 'no active price';
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min, 'VND') : `${formatMoney(min, 'VND')} - ${formatMoney(max, 'VND')}`;
}
