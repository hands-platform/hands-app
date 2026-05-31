'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function markEarningPaid(formData: FormData) {
  const earningId = String(formData.get('earningId') ?? '').trim();
  if (!earningId) {
    return;
  }

  const settlementRef = String(formData.get('settlementRef') ?? '').trim();
  const settlementNotes = String(formData.get('settlementNotes') ?? '').trim();

  await adminPost(
    `/admin/earnings/${earningId}/mark-paid`,
    {
      settlementRef: settlementRef || undefined,
      settlementNotes: settlementNotes || undefined,
    },
    null,
  );
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/payments');
  revalidatePath('/bookings');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function createProviderPayout(formData: FormData) {
  const providerProfileId = String(formData.get('providerProfileId') ?? '');
  if (!providerProfileId) {
    return;
  }

  await adminPost(
    '/admin/payout-batches',
    {
      providerProfileId,
      transferRef: String(formData.get('transferRef') ?? '') || undefined,
      notes: 'Created from earnings dashboard',
    },
    null,
  );
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
