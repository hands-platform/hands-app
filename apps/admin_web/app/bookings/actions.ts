'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function approvePostMatchCancellation(formData: FormData) {
  await runPostMatchCancellationAction(formData, 'approve');
}

export async function holdPostMatchCancellation(formData: FormData) {
  await runPostMatchCancellationAction(formData, 'hold');
}

async function runPostMatchCancellationAction(formData: FormData, action: 'approve' | 'hold') {
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(
    `/admin/bookings/${bookingId}/post-match-cancellation/${action}`,
    {
      note: String(formData.get('note') ?? '') || undefined,
    },
    null,
  );

  for (const path of [
    '/bookings',
    `/bookings/${bookingId}`,
    '/earnings',
    '/cash-settlements',
    '/operations-handoff',
  ]) {
    revalidatePath(path);
  }
}
