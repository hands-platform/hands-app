'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminOperationalPolicySetting, adminPatch } from '../../lib/admin-api';

export async function updateOperationalPolicy(formData: FormData) {
  const key = String(formData.get('key') || '').trim();
  const rawValue = String(formData.get('value') || '').trim();
  const valueType = String(formData.get('valueType') || 'string');

  if (!key || !rawValue) {
    redirectToPolicy('blocked', 'missing-value');
  }

  const value = valueType === 'number' ? Number(rawValue) : valueType === 'boolean' ? rawValue === 'true' : rawValue;
  const saved = await adminPatch<AdminOperationalPolicySetting | null>(
    `/admin/operational-policy/${encodeURIComponent(key)}`,
    { value },
    null,
  );

  if (!saved?.key) {
    redirectToPolicy('blocked', 'api-rejected');
  }

  revalidatePath('/operations-policy');
  revalidatePath('/audit-log');
  redirectToPolicy('saved', key);
}

function redirectToPolicy(status: 'saved' | 'blocked', reason: string): never {
  redirect(`/operations-policy?status=${status}&reason=${encodeURIComponent(reason)}`);
}
