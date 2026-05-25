'use server';

import { revalidatePath } from 'next/cache';
import { adminPatch, adminPost } from '../../lib/admin-api';

type CreatedService = {
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
    return;
  }
  if (!isValidPriceStep(basePrice, priceStep) || !isValidPayout(providerPayoutAmount, basePrice)) {
    return;
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

  if (service?.id && providerPayoutAmount !== null) {
    await adminPost(
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
  }

  revalidatePath('/services');
  revalidatePath('/audit-log');
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
    return;
  }

  for (const durationMin of durations) {
    const basePrice = parseInteger(formData.get(`basePrice${durationMin}`));
    if (!basePrice) {
      continue;
    }
    const providerPayoutAmount = parseInteger(formData.get(`providerPayoutAmount${durationMin}`));
    if (!isValidPriceStep(basePrice, priceStep) || !isValidPayout(providerPayoutAmount, basePrice)) {
      continue;
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
        displayOrder: displayOrder + durationMin,
        active: true,
      },
      null,
    );
    if (service?.id && providerPayoutAmount !== null) {
      await adminPost(
        `/admin/services/${service.id}/payout-rules`,
        {
          customerPrice: basePrice,
          providerPayoutAmount,
          vatBps,
          otherCostAmount,
          active: true,
          notes: 'Base payout rule created with the 60/90/120 service set.',
        },
        null,
      );
    }
  }

  revalidatePath('/services');
  revalidatePath('/audit-log');
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
    return;
  }
  if (!isValidPriceStep(basePrice, priceStep)) {
    return;
  }

  await adminPatch(
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
  revalidatePath('/services');
  revalidatePath('/audit-log');
}

export async function upsertPayoutRule(formData: FormData) {
  const serviceId = String(formData.get('serviceId') || '').trim();
  const customerPrice = parseInteger(formData.get('customerPrice'));
  const providerPayoutAmount = parseInteger(formData.get('providerPayoutAmount'));
  const vatBps = parseInteger(formData.get('vatBps')) ?? 0;
  const otherCostAmount = parseInteger(formData.get('otherCostAmount')) ?? 0;
  const notes = String(formData.get('notes') || '').trim();

  if (!serviceId || !customerPrice || providerPayoutAmount === null) {
    return;
  }
  if (providerPayoutAmount > customerPrice) {
    return;
  }

  await adminPost(
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
  revalidatePath('/services');
  revalidatePath('/audit-log');
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
    return;
  }
  if (providerPayoutAmount > customerPrice) {
    return;
  }

  await adminPatch(
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
  revalidatePath('/services');
  revalidatePath('/audit-log');
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
