'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function upsertMarketingSpendDaily(formData: FormData) {
  const spendDate = readFormText(formData, 'spendDate');
  const source = readFormText(formData, 'source');
  const spendAmount = parseInteger(formData.get('spendAmount'));

  if (!spendDate || !source || spendAmount === null) {
    return;
  }

  await adminPost(
    '/admin/marketing/spend-daily',
    {
      spendDate,
      source,
      platform: readFormText(formData, 'platform') || undefined,
      regionCode: readFormText(formData, 'regionCode') || undefined,
      campaignId: readFormText(formData, 'campaignId') || undefined,
      campaignName: readFormText(formData, 'campaignName') || undefined,
      spendAmount,
      currency: readFormText(formData, 'currency') || undefined,
      notes: readFormText(formData, 'notes') || undefined,
    },
    null,
  );

  revalidatePath('/marketing-analytics');
  revalidatePath('/audit-log');
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  const number = Number(raw);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
