export const SERVICE_CATALOG_DURATIONS = [60, 90, 120] as const;

export type ServiceCatalogEditorDuration = {
  readonly basePrice: string;
  readonly enabled: boolean;
  readonly providerPayoutAmount: string;
};

export type ServiceCatalogPublishBlocker = {
  readonly field: string;
  readonly label: string;
};

export function serviceCatalogPublishBlockers(input: {
  readonly impactAvailable: boolean;
  readonly nameTranslations: Readonly<Record<string, string>>;
  readonly reason: string;
  readonly durations: Readonly<Record<number, ServiceCatalogEditorDuration>>;
}) {
  const blockers: ServiceCatalogPublishBlocker[] = [];
  if (!input.nameTranslations.en.trim()) {
    blockers.push({ field: 'nameEn', label: 'Add the English app name.' });
  }
  if (!input.nameTranslations.vi.trim()) {
    blockers.push({ field: 'nameVi', label: 'Add the Vietnamese app name.' });
  }
  const enabled = SERVICE_CATALOG_DURATIONS.filter((duration) => input.durations[duration]?.enabled);
  if (!enabled.length) {
    blockers.push({ field: 'active60', label: 'Offer at least one duration in the apps.' });
  }
  for (const duration of enabled) {
    const row = input.durations[duration];
    const customerPrice = readVndEditorValue(row.basePrice);
    const payout = readVndEditorValue(row.providerPayoutAmount);
    if (!customerPrice || customerPrice % 100000 !== 0) {
      blockers.push({
        field: `basePrice${duration}`,
        label: `Set a valid ${duration}-minute customer price in 100,000 VND steps.`,
      });
    }
    if (payout === null || (customerPrice !== null && payout > customerPrice)) {
      blockers.push({
        field: `providerPayoutAmount${duration}`,
        label: `Set a ${duration}-minute Partner payout no higher than customer price.`,
      });
    }
  }
  if (input.reason.trim().length < 12) {
    blockers.push({ field: 'reason', label: 'Explain the operational impact in 12 or more characters.' });
  }
  if (!input.impactAvailable) {
    blockers.push({ field: 'impact', label: 'Reload the bounded Partner and booking impact.' });
  }
  return blockers;
}

export function slugifyServiceGroupKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized) return normalized.slice(0, 80);
  const codepoints = Array.from(value.trim())
    .map((character) => character.codePointAt(0)?.toString(16) ?? '')
    .join('_')
    .slice(0, 68);
  return codepoints ? `service_${codepoints}` : 'service_new';
}

export function readVndEditorValue(value: string) {
  if (!/^\d+$/u.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}
