'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function settleCashFeeDebt(formData: FormData) {
  const earningId = String(formData.get('earningId') ?? '').trim();
  if (!earningId) {
    return;
  }

  const settlementRef = String(formData.get('settlementRef') ?? '').trim();
  const settlementNotes = String(formData.get('settlementNotes') ?? '').trim();
  const settlementMethod = String(formData.get('settlementMethod') ?? '').trim();

  await adminPost(
    `/admin/earnings/${earningId}/mark-paid`,
    {
      settlementRef: settlementRef || undefined,
      settlementNotes: settlementNotes || undefined,
      settlementMethod: settlementMethod || 'PARTNER_DEPOSIT',
    },
    null,
  );

  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payments');
  revalidatePath('/bookings');
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
