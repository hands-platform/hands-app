'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../../lib/admin-api';

export async function syncBookingPayment(formData: FormData) {
  await runPaymentAction(formData, 'sync');
}

export async function captureBookingPayment(formData: FormData) {
  await runPaymentAction(formData, 'capture');
}

export async function releaseBookingPayment(formData: FormData) {
  await runPaymentAction(formData, 'release');
}

export async function refundBookingPayment(formData: FormData) {
  await runPaymentAction(formData, 'refund');
}

export async function settleBookingCashDebt(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const earningId = String(formData.get('earningId') ?? '');
  if (!bookingId || !earningId) {
    return;
  }

  await adminPost(
    `/admin/earnings/${earningId}/mark-paid`,
    {
      settlementRef: String(formData.get('settlementRef') ?? '') || undefined,
      settlementNotes:
        String(formData.get('settlementNotes') ?? '') || 'Cash fee debt settled from Booking operations.',
    },
    null,
  );
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/payments');
  revalidatePath('/earnings');
  revalidatePath('/partner-risk');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function addBookingOpsNote(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const note = String(formData.get('note') ?? '');
  const preset = String(formData.get('preset') ?? '');
  if (!bookingId || (!note.trim() && !preset.trim())) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/ops-note`, { note, preset }, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/audit-log');
}

export async function markBookingNoShow(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/no-show`, { reason }, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/payments');
  revalidatePath('/refunds');
  revalidatePath('/partner-risk');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function expireBooking(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/expire`, { reason }, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/payments');
  revalidatePath('/refunds');
  revalidatePath('/partner-risk');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function closeoutCompletedBooking(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/closeout`, { note }, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/payments');
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partner-risk');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function updateBookingOpsTask(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const type = String(formData.get('type') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!bookingId || !type || !status) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/ops-task`, { type, status, note }, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/audit-log');
}

async function runPaymentAction(formData: FormData, action: 'sync' | 'capture' | 'release' | 'refund') {
  const bookingId = String(formData.get('bookingId'));
  const paymentId = String(formData.get('paymentId'));
  if (!bookingId || !paymentId) {
    return;
  }

  await adminPost(`/admin/payments/${paymentId}/${action}`, {}, null);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
  revalidatePath('/payments');
  revalidatePath('/refunds');
  revalidatePath('/earnings');
  revalidatePath('/partner-risk');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
