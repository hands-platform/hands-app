'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import {
  BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS,
  bookingActionRevalidatePaths,
} from './booking-action-paths';

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

  for (const path of bookingActionRevalidatePaths(bookingId, BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS)) {
    revalidatePath(path);
  }
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
