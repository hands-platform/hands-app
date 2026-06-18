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
  const bookingId = readFormText(formData, 'bookingId');
  if (!bookingId) {
    return;
  }

  await adminPost(
    `/admin/bookings/${bookingId}/post-match-cancellation/${action}`,
    {
      note: readFormText(formData, 'note') || undefined,
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

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
