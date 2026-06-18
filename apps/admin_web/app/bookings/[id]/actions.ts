'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../../lib/admin-api';
import {
  BOOKING_CLOSEOUT_IMPACT_PATHS,
  BOOKING_PAYMENT_IMPACT_PATHS,
  BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS,
  BOOKING_SETTLEMENT_IMPACT_PATHS,
  BOOKING_STATUS_FAILURE_IMPACT_PATHS,
  bookingActionRevalidatePaths,
} from './booking-action-paths';

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
      settlementMethod: String(formData.get('settlementMethod') ?? '') || 'PARTNER_DEPOSIT',
    },
    null,
  );
  revalidateBookingAction(bookingId, BOOKING_SETTLEMENT_IMPACT_PATHS);
}

export async function addBookingOpsNote(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const note = String(formData.get('note') ?? '');
  const preset = String(formData.get('preset') ?? '');
  if (!bookingId || (!note.trim() && !preset.trim())) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/ops-note`, { note, preset }, null);
  revalidateBookingAction(bookingId);
}

export async function repairBookingChatRoom(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/repair-chat-room`, {}, null);
  revalidateBookingAction(bookingId, ['/chat-archive']);
}

export async function markBookingNoShow(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/no-show`, { reason }, null);
  revalidateBookingAction(bookingId, BOOKING_STATUS_FAILURE_IMPACT_PATHS);
}

export async function expireBooking(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/expire`, { reason }, null);
  revalidateBookingAction(bookingId, BOOKING_STATUS_FAILURE_IMPACT_PATHS);
}

export async function closeoutCompletedBooking(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const note = String(formData.get('note') ?? '');
  if (!bookingId) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/closeout`, { note }, null);
  revalidateBookingAction(bookingId, BOOKING_CLOSEOUT_IMPACT_PATHS);
}

export async function approvePostMatchCancellationFromDetail(formData: FormData) {
  await runPostMatchCancellationDecision(formData, 'approve');
}

export async function holdPostMatchCancellationFromDetail(formData: FormData) {
  await runPostMatchCancellationDecision(formData, 'hold');
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
  revalidateBookingAction(bookingId);
}

async function runPaymentAction(formData: FormData, action: 'sync' | 'capture' | 'release' | 'refund') {
  const bookingId = String(formData.get('bookingId'));
  const paymentId = String(formData.get('paymentId'));
  if (!bookingId || !paymentId) {
    return;
  }

  await adminPost(`/admin/payments/${paymentId}/${action}`, {}, null);
  revalidateBookingAction(bookingId, BOOKING_PAYMENT_IMPACT_PATHS);
}

async function runPostMatchCancellationDecision(formData: FormData, action: 'approve' | 'hold') {
  const bookingId = String(formData.get('bookingId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!bookingId) {
    return;
  }

  await adminPost(
    `/admin/bookings/${bookingId}/post-match-cancellation/${action}`,
    { note: note || undefined },
    null,
  );
  revalidateBookingAction(bookingId, BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS);
}

function revalidateBookingAction(bookingId: string, extraPaths: readonly string[] = []) {
  for (const path of bookingActionRevalidatePaths(bookingId, extraPaths)) {
    revalidatePath(path);
  }
}
