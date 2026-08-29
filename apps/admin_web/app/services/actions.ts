'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import {
  isValidServicePayout,
  isValidServicePriceStep,
  parseServiceInteger,
} from './service-action-input';
import {
  serviceCatalogApiFailure,
} from './service-catalog-action-result';
import type {
  ServiceCatalogActionState,
  ServiceCatalogRefreshState,
} from './service-catalog-action-state';

const STANDARD_SERVICE_DURATIONS = [60, 90, 120] as const;
const SERVICE_NAME_FIELDS = ['nameEn', 'nameVi', 'nameKo', 'nameJa', 'nameZh'] as const;
const SERVICE_NAME_KEYS = ['en', 'vi', 'ko', 'ja', 'zh'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function refreshServiceCatalog(
  _previousState: ServiceCatalogRefreshState,
): Promise<ServiceCatalogRefreshState> {
  void _previousState;
  const access = await getCurrentAdminOperatorAccess();
  if (!hasAdminOperatorCategory(access, 'SYSTEM_SERVICES')) {
    return {
      message: 'Service Catalog access is required to refresh live catalog data.',
      status: 'error',
    };
  }
  updateTag('service-catalog');
  revalidatePath('/services');
  return { message: 'Service Catalog data refreshed.', status: 'refreshed' };
}

export async function saveServiceCatalogGroup(
  _previousState: ServiceCatalogActionState,
  formData: FormData,
): Promise<ServiceCatalogActionState> {
  const nameTranslations = collectServiceNameTranslations(formData) ?? {};
  const serviceGroupKey =
    String(formData.get('serviceGroupKey') || '').trim() ||
    slugifyServiceKey(nameTranslations.en || nameTranslations.vi || '');
  const intentValue = String(formData.get('intent') || 'SAVE_DRAFT');
  const intent =
    intentValue === 'PUBLISH' || intentValue === 'HIDE' || intentValue === 'ARCHIVE'
      ? intentValue
      : 'SAVE_DRAFT';
  const mutationKey = String(formData.get('mutationKey') || '').trim();
  const reason = String(formData.get('reason') || '').trim();
  const priceStep = parseServiceInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseServiceInteger(formData.get('displayOrder')) ?? 100;
  const expectedVersion = parseServiceInteger(formData.get('expectedVersion')) ?? 0;
  const fieldErrors: Record<string, string> = {};
  if (!serviceGroupKey || !/^[a-z0-9_]{2,80}$/u.test(serviceGroupKey)) {
    fieldErrors.serviceGroupKey = 'Use 2-80 lowercase letters, numbers, or underscores.';
  }
  if (!UUID_PATTERN.test(mutationKey)) {
    fieldErrors.mutationKey = 'This change needs a stable submission key. Retry from the editor.';
  }
  const durations = STANDARD_SERVICE_DURATIONS.map((durationMin) => ({
    durationMin,
    enabled: formData.get(`active${durationMin}`) === 'on',
    basePrice: parseServiceInteger(formData.get(`basePrice${durationMin}`)) ?? undefined,
    providerPayoutAmount:
      parseServiceInteger(formData.get(`providerPayoutAmount${durationMin}`)) ?? undefined,
    displayOrder:
      parseServiceInteger(formData.get(`displayOrder${durationMin}`)) ?? displayOrder + durationMin,
  }));
  if (intent !== 'SAVE_DRAFT' && reason.length < 12) {
    fieldErrors.reason = 'Explain the operational impact in at least 12 characters.';
  }
  if (intent === 'PUBLISH') {
    if (!nameTranslations.en) fieldErrors.nameEn = 'English name is required to publish.';
    if (!nameTranslations.vi) fieldErrors.nameVi = 'Vietnamese name is required to publish.';
    if (!durations.some((row) => row.enabled)) {
      fieldErrors.durations = 'Enable at least one duration before publishing.';
    }
    for (const row of durations) {
      if (!row.enabled) continue;
      if (!row.basePrice) {
        fieldErrors[`duration${row.durationMin}.basePrice`] = 'Customer price is required.';
      } else if (!isValidServicePriceStep(row.basePrice, priceStep)) {
        fieldErrors[`duration${row.durationMin}.basePrice`] =
          `Use ${priceStep.toLocaleString('en-US')} VND increments.`;
      }
      if (row.providerPayoutAmount === undefined) {
        fieldErrors[`duration${row.durationMin}.providerPayoutAmount`] =
          'Partner payout must be explicit, including 0 VND.';
      } else if (row.basePrice && !isValidServicePayout(row.providerPayoutAmount, row.basePrice)) {
        fieldErrors[`duration${row.durationMin}.providerPayoutAmount`] =
          'Partner payout cannot exceed customer price.';
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Review the highlighted catalog fields.', fieldErrors };
  }

  try {
    await adminPatchOrThrow(`/admin/services/groups/${encodeURIComponent(serviceGroupKey)}`, {
      requestId: mutationKey,
      expectedVersion,
      intent,
      reason: reason || undefined,
      nameTranslations,
      description: String(formData.get('description') || '').trim() || null,
      priceStep,
      displayOrder,
      durations,
    });
  } catch (error) {
    const apiFailure = serviceCatalogApiFailure(error);
    return {
      status: 'error',
      message: apiFailure.message,
      reauthRequired: apiFailure.reauthRequired,
      fieldErrors: apiFailure.fieldErrors,
    };
  }

  updateTag('service-catalog');
  revalidatePath('/services');
  revalidatePath('/audit-log');
  const reasonCode =
    intent === 'PUBLISH'
      ? 'service-menu-published'
      : intent === 'SAVE_DRAFT'
        ? 'service-draft-saved'
        : intent === 'HIDE'
          ? 'service-menu-hidden'
          : 'service-menu-archived';
  redirectToServices('saved', reasonCode, { group: serviceGroupKey });
}

function redirectToServices(
  status: 'saved' | 'blocked',
  reason: string,
  extras: Readonly<Record<string, string>> = {},
): never {
  const params = new URLSearchParams({ status, reason, ...extras });
  redirect(`/services?${params.toString()}`);
}

function collectServiceNameTranslations(formData: FormData) {
  const translations: Record<string, string> = {};
  SERVICE_NAME_FIELDS.forEach((fieldName, index) => {
    const value = String(formData.get(fieldName) || '').trim();
    if (value) translations[SERVICE_NAME_KEYS[index]] = value;
  });
  return Object.keys(translations).length ? translations : undefined;
}

function slugifyServiceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
