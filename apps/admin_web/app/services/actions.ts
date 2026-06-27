'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch, adminPost } from '../../lib/admin-api';
import {
  hasInvalidBulkPayoutRules,
  isValidServicePayout,
  isValidServicePriceStep,
  parseBulkPayoutRules,
  parseServiceInteger,
} from './service-action-input';

type CreatedService = {
  id: string;
};

type SavedPayoutRule = {
  id: string;
};

const STANDARD_SERVICE_DURATIONS = [60, 90, 120] as const;
const SERVICE_NAME_FIELDS = ['nameEn', 'nameVi', 'nameKo', 'nameJa', 'nameZh'] as const;
const SERVICE_NAME_KEYS = ['en', 'vi', 'ko', 'ja', 'zh'] as const;

export async function createService(formData: FormData) {
  const nameTranslations = collectServiceNameTranslations(formData);
  const name = serviceDisplayName(formData, nameTranslations);
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMin = parseServiceInteger(formData.get('durationMin'));
  const basePrice = parseServiceInteger(formData.get('basePrice'));
  const providerPayoutAmount = parseServiceInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseServiceInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseServiceInteger(formData.get('otherCostAmount')) ?? 0;
  const priceStep = parseServiceInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseServiceInteger(formData.get('displayOrder')) ?? 0;

  if (!name || !durationMin || !basePrice) {
    redirectToServices('blocked', 'missing-service-fields');
  }
  if (
    !isValidServicePriceStep(basePrice, priceStep) ||
    !isValidServicePayout(providerPayoutAmount, basePrice)
  ) {
    redirectToServices('blocked', 'invalid-service-pricing');
  }

  const service = await adminPost<CreatedService | null>(
    '/admin/services',
    {
      name,
      nameTranslations,
      serviceGroupKey: serviceGroupKey || undefined,
      description: description || undefined,
      durationMin,
      basePrice,
      priceStep,
      displayOrder,
      active: true,
    },
    null,
  );

  if (!service?.id) {
    redirectToServices('blocked', 'api-rejected');
  }

  if (providerPayoutAmount !== null) {
    const payoutRule = await adminPost<SavedPayoutRule | null>(
      `/admin/services/${service.id}/payout-rules`,
      {
        customerPrice: basePrice,
        providerPayoutAmount,
        vatBps,
        otherCostAmount,
        active: true,
        notes: 'Base payout rule created with the service.',
      },
      null,
    );
    if (!payoutRule?.id) {
      redirectToServices('blocked', 'api-rejected');
    }
  }

  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'service-created');
}

export async function createServiceDurationSet(formData: FormData) {
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const nameTranslations = collectServiceNameTranslations(formData);
  const name = serviceDisplayName(formData, nameTranslations);
  const description = String(formData.get('description') || '').trim();
  const priceStep = parseServiceInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseServiceInteger(formData.get('displayOrder')) ?? 100;
  const vatBps = parseServiceInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseServiceInteger(formData.get('otherCostAmount')) ?? 0;
  const durations = [60, 90, 120];

  if (!name) {
    redirectToServices('blocked', 'missing-service-fields');
  }

  const durationRows = durations
    .map((durationMin) => ({
      durationMin,
      basePrice: parseServiceInteger(formData.get(`basePrice${durationMin}`)),
      providerPayoutAmount: parseServiceInteger(formData.get(`providerPayoutAmount${durationMin}`)),
    }))
    .filter((row) => row.basePrice !== null);

  if (durationRows.length === 0) {
    redirectToServices('blocked', 'missing-duration-prices');
  }

  if (
    durationRows.some(
      (row) =>
        row.basePrice === null ||
        !isValidServicePriceStep(row.basePrice, priceStep) ||
        !isValidServicePayout(row.providerPayoutAmount, row.basePrice),
    )
  ) {
    redirectToServices('blocked', 'invalid-duration-set');
  }

  const createdServices = await adminPost<CreatedService[] | null>(
    '/admin/services/duration-sets',
    {
      name,
      nameTranslations,
      serviceGroupKey: serviceGroupKey || undefined,
      description: description || undefined,
      priceStep,
      displayOrder,
      vatBps,
      otherCostAmount,
      active: true,
      durations: durationRows.map((row) => ({
        durationMin: row.durationMin,
        basePrice: row.basePrice,
        providerPayoutAmount: row.providerPayoutAmount,
      })),
    },
    null,
  );
  if (!createdServices?.length) {
    redirectToServices('blocked', 'api-rejected');
  }

  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'duration-set-created');
}

export async function updateService(formData: FormData) {
  const serviceId = String(formData.get('serviceId') || '').trim();
  const nameTranslations = collectServiceNameTranslations(formData);
  const name = serviceDisplayName(formData, nameTranslations);
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMin = parseServiceInteger(formData.get('durationMin'));
  const basePrice = parseServiceInteger(formData.get('basePrice'));
  const priceStep = parseServiceInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseServiceInteger(formData.get('displayOrder')) ?? 0;
  const active = formData.get('active') === 'on';

  if (!serviceId || !name || !durationMin || !basePrice) {
    redirectToServices('blocked', 'missing-service-fields');
  }
  if (!isValidServicePriceStep(basePrice, priceStep)) {
    redirectToServices('blocked', 'invalid-service-pricing');
  }

  const service = await adminPatch<CreatedService | null>(
    `/admin/services/${serviceId}`,
    {
      name,
      nameTranslations,
      serviceGroupKey: serviceGroupKey || null,
      description: description || null,
      durationMin,
      basePrice,
      priceStep,
      displayOrder,
      active,
    },
    null,
  );
  if (!service?.id) {
    redirectToServices('blocked', 'api-rejected');
  }
  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'service-updated');
}

export async function saveServiceDurationMenu(formData: FormData) {
  const nameTranslations = collectServiceNameTranslations(formData);
  const name = serviceDisplayName(formData, nameTranslations);
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const priceStep = 100000;

  if (!name) {
    redirectToServices('blocked', 'missing-service-fields');
  }

  for (const durationMin of STANDARD_SERVICE_DURATIONS) {
    const serviceId = String(formData.get(`serviceId${durationMin}`) || '').trim();
    const ruleId = String(formData.get(`ruleId${durationMin}`) || '').trim();
    const basePrice = parseServiceInteger(formData.get(`basePrice${durationMin}`));
    const providerPayoutAmount = parseServiceInteger(formData.get(`providerPayoutAmount${durationMin}`));
    const displayOrder = parseServiceInteger(formData.get(`displayOrder${durationMin}`)) ?? 100 + durationMin;
    const active = formData.get(`active${durationMin}`) === 'on';

    if (basePrice === null) {
      continue;
    }

    if (
      !isValidServicePriceStep(basePrice, priceStep) ||
      !isValidServicePayout(providerPayoutAmount, basePrice)
    ) {
      redirectToServices('blocked', 'invalid-duration-set');
    }

    const servicePayload = {
      name,
      nameTranslations,
      serviceGroupKey: serviceGroupKey || undefined,
      description: description || null,
      durationMin,
      basePrice,
      priceStep,
      displayOrder,
      active,
    };

    const savedService = serviceId
      ? await adminPatch<CreatedService | null>(`/admin/services/${serviceId}`, servicePayload, null)
      : await adminPost<CreatedService | null>('/admin/services', servicePayload, null);

    if (!savedService?.id) {
      redirectToServices('blocked', 'api-rejected');
    }

    if (providerPayoutAmount !== null) {
      const payoutPayload = {
        customerPrice: basePrice,
        providerPayoutAmount,
        vatBps: 0,
        otherCostAmount: 0,
        active: true,
        notes: 'Base Partner payout managed from service menu dialog.',
      };

      const payoutRule = ruleId
        ? await adminPatch<SavedPayoutRule | null>(
            `/admin/service-payout-rules/${ruleId}`,
            payoutPayload,
            null,
          )
        : await adminPost<SavedPayoutRule | null>(
            `/admin/services/${savedService.id}/payout-rules`,
            payoutPayload,
            null,
          );

      if (!payoutRule?.id) {
        redirectToServices('blocked', 'api-rejected');
      }
    }
  }

  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'service-menu-saved');
}

export async function upsertPayoutRule(formData: FormData) {
  const serviceId = String(formData.get('serviceId') || '').trim();
  const customerPrice = parseServiceInteger(formData.get('customerPrice'));
  const providerPayoutAmount = parseServiceInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseServiceInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseServiceInteger(formData.get('otherCostAmount')) ?? 0;
  const notes = String(formData.get('notes') || '').trim();

  if (!serviceId || !customerPrice || providerPayoutAmount === null) {
    redirectToServices('blocked', 'missing-payout-fields');
  }
  if (providerPayoutAmount > customerPrice) {
    redirectToServices('blocked', 'invalid-payout');
  }

  const rule = await adminPost<SavedPayoutRule | null>(
    `/admin/services/${serviceId}/payout-rules`,
    {
      customerPrice,
      providerPayoutAmount,
      vatBps,
      otherCostAmount,
      active: true,
      notes: notes || undefined,
    },
    null,
  );
  if (!rule?.id) {
    redirectToServices('blocked', 'api-rejected');
  }
  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'payout-rule-saved');
}

export async function bulkUpsertPayoutRules(formData: FormData) {
  const serviceId = String(formData.get('serviceId') || '').trim();
  const rawRules = String(formData.get('rules') || '').trim();
  const vatBps = parseServiceInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseServiceInteger(formData.get('otherCostAmount')) ?? 0;
  const notes = String(formData.get('notes') || '').trim();

  if (!serviceId || !rawRules) {
    redirectToServices('blocked', 'missing-bulk-payout-fields');
  }

  const rules = parseBulkPayoutRules(rawRules);

  if (hasInvalidBulkPayoutRules(rules)) {
    redirectToServices('blocked', 'invalid-bulk-payout');
  }

  const savedRules = await adminPost<SavedPayoutRule[] | null>(
    `/admin/services/${serviceId}/payout-rules/bulk`,
    {
      rules: rules.map((rule) => ({
        customerPrice: rule.customerPrice,
        providerPayoutAmount: rule.providerPayoutAmount,
        vatBps,
        otherCostAmount,
        active: true,
        notes: notes || 'Bulk payout ladder import from admin services screen.',
      })),
    },
    null,
  );
  if (!savedRules?.length) {
    redirectToServices('blocked', 'api-rejected');
  }
  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'bulk-payout-rules-saved');
}

export async function updatePayoutRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId') || '').trim();
  const customerPrice = parseServiceInteger(formData.get('customerPrice'));
  const providerPayoutAmount = parseServiceInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseServiceInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseServiceInteger(formData.get('otherCostAmount')) ?? 0;
  const active = formData.get('active') === 'on';
  const notes = String(formData.get('notes') || '').trim();

  if (!ruleId || !customerPrice || providerPayoutAmount === null) {
    redirectToServices('blocked', 'missing-payout-fields');
  }
  if (providerPayoutAmount > customerPrice) {
    redirectToServices('blocked', 'invalid-payout');
  }

  const rule = await adminPatch<SavedPayoutRule | null>(
    `/admin/service-payout-rules/${ruleId}`,
    {
      customerPrice,
      providerPayoutAmount,
      vatBps,
      otherCostAmount,
      active,
      notes: notes || null,
    },
    null,
  );
  if (!rule?.id) {
    redirectToServices('blocked', 'api-rejected');
  }
  revalidatePath('/services');
  revalidatePath('/audit-log');
  redirectToServices('saved', 'payout-rule-updated');
}

function redirectToServices(status: 'saved' | 'blocked', reason: string): never {
  redirect(`/services?status=${status}&reason=${reason}`);
}

function collectServiceNameTranslations(formData: FormData) {
  const translations: Record<string, string> = {};
  SERVICE_NAME_FIELDS.forEach((fieldName, index) => {
    const value = String(formData.get(fieldName) || '').trim();
    if (value) {
      translations[SERVICE_NAME_KEYS[index]] = value;
    }
  });
  return Object.keys(translations).length ? translations : undefined;
}

function serviceDisplayName(formData: FormData, translations: Record<string, string> | undefined) {
  const legacyName = String(formData.get('name') || '').trim();
  return (
    legacyName ||
    translations?.en ||
    translations?.vi ||
    translations?.ko ||
    translations?.ja ||
    translations?.zh ||
    ''
  );
}
