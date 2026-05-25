'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function markEarningPaid(formData: FormData) {
  const earningId = String(formData.get('earningId') ?? '');
  if (!earningId) {
    return;
  }

  await adminPost(`/admin/earnings/${earningId}/mark-paid`, {
    settlementRef: String(formData.get('settlementRef') ?? '') || undefined,
    settlementNotes: String(formData.get('settlementNotes') ?? '') || undefined,
  }, null);
  revalidatePath('/earnings');
}

export async function createProviderPayout(formData: FormData) {
  const providerProfileId = String(formData.get('providerProfileId') ?? '');
  if (!providerProfileId) {
    return;
  }

  await adminPost('/admin/payout-batches', {
    providerProfileId,
    transferRef: String(formData.get('transferRef') ?? '') || undefined,
    notes: 'Created from earnings dashboard',
  }, null);
  revalidatePath('/earnings');
  revalidatePath('/payouts');
}
