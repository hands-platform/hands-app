import { serviceBasePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';

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

export type ServiceCatalogReviewChangeSet = {
  readonly configChanges: readonly ServiceCatalogConfigChange[];
  readonly durationChanges: readonly ServiceCatalogDurationChange[];
  readonly hasMonetaryChange: boolean;
};

type ServiceCatalogConfigChange = {
  readonly after: string;
  readonly before: string;
  readonly label: string;
};

type ServiceCatalogDurationSnapshot = {
  readonly customerPrice: number | null;
  readonly grossHandsFee: number | null;
  readonly offered: boolean;
  readonly partnerPayout: number | null;
};

type ServiceCatalogDurationChange = {
  readonly after: ServiceCatalogDurationSnapshot;
  readonly before: ServiceCatalogDurationSnapshot;
  readonly durationMin: (typeof SERVICE_CATALOG_DURATIONS)[number];
};

export function serviceCatalogReviewChangeSet(input: {
  readonly description: string;
  readonly displayOrder: string;
  readonly durations: Readonly<Record<number, ServiceCatalogEditorDuration>>;
  readonly group?: ServiceCatalogGroup;
  readonly nameTranslations: Readonly<Record<string, string>>;
}): ServiceCatalogReviewChangeSet {
  const durationChanges = SERVICE_CATALOG_DURATIONS.flatMap((durationMin) => {
    const service = input.group?.items.find((item) => item.durationMin === durationMin);
    const payoutRule = service ? serviceBasePayoutRule(service) : null;
    const draft = input.durations[durationMin];
    const before = durationSnapshot(
      Boolean(
        service?.active &&
          service.publicationStatus === 'PUBLISHED' &&
          payoutRule,
      ),
      service?.basePrice ?? null,
      payoutRule?.providerPayoutAmount ?? null,
    );
    const after = durationSnapshot(
      Boolean(draft?.enabled),
      readVndEditorValue(draft?.basePrice ?? ''),
      readVndEditorValue(draft?.providerPayoutAmount ?? ''),
    );
    return durationSnapshotsEqual(before, after)
      ? []
      : [{ after, before, durationMin }];
  });
  const currentTranslations: Record<string, string> = {
    ...(input.group?.nameTranslations ?? {}),
    ...(input.group && !input.group.nameTranslations?.en ? { en: input.group.label } : {}),
  };
  const configChanges: ServiceCatalogConfigChange[] = [];
  for (const [key, label] of [
    ['en', 'English app name'],
    ['vi', 'Vietnamese app name'],
    ['ko', 'Korean app name'],
    ['ja', 'Japanese app name'],
    ['zh', 'Chinese app name'],
  ] as const) {
    addConfigChange(configChanges, label, currentTranslations[key], input.nameTranslations[key]);
  }
  addConfigChange(
    configChanges,
    'Customer-facing description',
    input.group?.items[0]?.description,
    input.description,
  );
  addConfigChange(
    configChanges,
    'Display order',
    input.group ? String(input.group.items[0]?.displayOrder ?? '') : '',
    input.displayOrder,
  );

  return {
    configChanges,
    durationChanges,
    hasMonetaryChange: durationChanges.some(
      ({ after, before }) =>
        after.customerPrice !== before.customerPrice ||
        after.partnerPayout !== before.partnerPayout ||
        after.grossHandsFee !== before.grossHandsFee,
    ),
  };
}

function durationSnapshot(
  offered: boolean,
  customerPrice: number | null,
  partnerPayout: number | null,
): ServiceCatalogDurationSnapshot {
  return {
    customerPrice,
    grossHandsFee:
      customerPrice !== null && partnerPayout !== null && partnerPayout <= customerPrice
        ? customerPrice - partnerPayout
        : null,
    offered,
    partnerPayout,
  };
}

function durationSnapshotsEqual(
  left: ServiceCatalogDurationSnapshot,
  right: ServiceCatalogDurationSnapshot,
) {
  return (
    left.offered === right.offered &&
    left.customerPrice === right.customerPrice &&
    left.partnerPayout === right.partnerPayout &&
    left.grossHandsFee === right.grossHandsFee
  );
}

function addConfigChange(
  changes: ServiceCatalogConfigChange[],
  label: string,
  beforeValue: string | null | undefined,
  afterValue: string | null | undefined,
) {
  const before = beforeValue?.trim() ?? '';
  const after = afterValue?.trim() ?? '';
  if (before === after) return;
  changes.push({
    after: after || 'Not configured',
    before: before || 'Not configured',
    label,
  });
}

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
