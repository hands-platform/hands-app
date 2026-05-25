'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch, adminPost } from '../../lib/admin-api';

type CreatedService = {
  id: string;
};

type SavedPayoutRule = {
  id: string;
};

export async function createService(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMin = parseInteger(formData.get('durationMin'));
  const basePrice = parseInteger(formData.get('basePrice'));
  const providerPayoutAmount = parseInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseInteger(formData.get('otherCostAmount')) ?? 0;
  const priceStep = parseInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseInteger(formData.get('displayOrder')) ?? 0;

  if (!name || !durationMin || !basePrice) {
    redirectToServices('blocked', 'missing-service-fields');
  }
  if (!isValidPriceStep(basePrice, priceStep) || !isValidPayout(providerPayoutAmount, basePrice)) {
    redirectToServices('blocked', 'invalid-service-pricing');
  }

  const service = await adminPost<CreatedService | null>(
    '/admin/services',
    {
      name,
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
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const priceStep = parseInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseInteger(formData.get('displayOrder')) ?? 100;
  const vatBps = parseInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseInteger(formData.get('otherCostAmount')) ?? 0;
  const durations = [60, 90, 120];

  if (!name) {
    redirectToServices('blocked', 'missing-service-fields');
  }

  const durationRows = durations
    .map((durationMin) => ({
      durationMin,
      basePrice: parseInteger(formData.get(`basePrice${durationMin}`)),
      providerPayoutAmount: parseInteger(formData.get(`providerPayoutAmount${durationMin}`)),
    }))
    .filter((row) => row.basePrice !== null);

  if (durationRows.length === 0) {
    redirectToServices('blocked', 'missing-duration-prices');
  }

  if (
    durationRows.some(
      (row) =>
        row.basePrice === null ||
        !isValidPriceStep(row.basePrice, priceStep) ||
        !isValidPayout(row.providerPayoutAmount, row.basePrice),
    )
  ) {
    redirectToServices('blocked', 'invalid-duration-set');
  }

  const createdServices = await adminPost<CreatedService[] | null>(
    '/admin/services/duration-sets',
    {
      name,
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
  const name = String(formData.get('name') || '').trim();
  const serviceGroupKey = String(formData.get('serviceGroupKey') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMin = parseInteger(formData.get('durationMin'));
  const basePrice = parseInteger(formData.get('basePrice'));
  const priceStep = parseInteger(formData.get('priceStep')) ?? 100000;
  const displayOrder = parseInteger(formData.get('displayOrder')) ?? 0;
  const active = formData.get('active') === 'on';

  if (!serviceId || !name || !durationMin || !basePrice) {
    redirectToServices('blocked', 'missing-service-fields');
  }
  if (!isValidPriceStep(basePrice, priceStep)) {
    redirectToServices('blocked', 'invalid-service-pricing');
  }

  const service = await adminPatch<CreatedService | null>(
    `/admin/services/${serviceId}`,
    {
      name,
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

export async function upsertPayoutRule(formData: FormData) {
  const serviceId = String(formData.get('serviceId') || '').trim();
  const customerPrice = parseInteger(formData.get('customerPrice'));
  const providerPayoutAmount = parseInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseInteger(formData.get('otherCostAmount')) ?? 0;
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

export async function updatePayoutRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId') || '').trim();
  const customerPrice = parseInteger(formData.get('customerPrice'));
  const providerPayoutAmount = parseInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseInteger(formData.get('otherCostAmount')) ?? 0;
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

function parseInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const number = Number(raw);
  return Number.isInteger(number) ? number : null;
}

function isValidPriceStep(price: number, priceStep: number) {
  return price > 0 && priceStep >= 100000 && price % priceStep === 0;
}

function isValidPayout(providerPayoutAmount: number | null, customerPrice: number) {
  return providerPayoutAmount === null || (providerPayoutAmount >= 0 && providerPayoutAmount <= customerPrice);
}

function redirectToServices(status: 'saved' | 'blocked', reason: string): never {
  redirect(`/services?status=${status}&reason=${reason}`);
}
