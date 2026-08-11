'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminOperationalPolicySetting, adminPatch } from '../../lib/admin-api';

export async function updateOperationalPolicy(formData: FormData) {
  const key = String(formData.get('key') || '').trim();
  const rawValue = String(formData.get('value') || '').trim();
  const expectedRawValue = String(formData.get('expectedValue') || '').trim();
  const valueType = String(formData.get('valueType') || 'string');
  const reason = String(formData.get('reason') || '').replace(/\s+/g, ' ').trim();
  const confirmed = formData.get('confirmed') === 'yes';

  if (!key || !rawValue || !expectedRawValue) {
    redirectToPolicy('blocked', 'missing-value', key);
  }

  if (reason.length < 12) {
    redirectToPolicy('blocked', 'missing-reason', key);
  }

  if (!confirmed) {
    redirectToPolicy('blocked', 'missing-confirmation', key);
  }

  const value = parsePolicyValue(rawValue, valueType);
  const expectedValue = parsePolicyValue(expectedRawValue, valueType);
  if (value === null || expectedValue === null) {
    redirectToPolicy('blocked', 'invalid-value', key);
  }

  const saved = await adminPatch<AdminOperationalPolicySetting | null>(
    `/admin/operational-policy/${encodeURIComponent(key)}`,
    { expectedValue, reason, value },
    null,
  );

  if (!saved?.key) {
    redirectToPolicy('blocked', 'api-rejected', key);
  }

  revalidatePath('/operations-policy');
  revalidatePath('/audit-log');
  redirectToPolicy('saved', key);
}

function parsePolicyValue(rawValue: string, valueType: string) {
  if (valueType === 'number') {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
  }
  if (valueType === 'boolean') return rawValue === 'true';
  return rawValue;
}

function redirectToPolicy(status: 'saved' | 'blocked', reason: string, editKey?: string): never {
  const search = new URLSearchParams({ reason, status });
  if (status === 'blocked' && editKey) search.set('edit', editKey);
  redirect(`/operations-policy?${search.toString()}`);
}
