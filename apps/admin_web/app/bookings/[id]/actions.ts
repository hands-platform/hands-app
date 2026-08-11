'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  AdminApiRequestError,
  adminPost,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../../lib/admin-api';
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

  try {
    await adminPostOrThrow(`/admin/bookings/${bookingId}/ops-note`, {
      note: note.trim(),
      preset: preset.trim(),
    });
  } catch {
    redirect(bookingActionNoticeHref(bookingId, 'note-failed', 'operator-notes'));
  }
  revalidateBookingAction(bookingId);
  redirect(bookingActionNoticeHref(bookingId, 'note-saved', 'operator-notes'));
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
  const reason = String(formData.get('reason') ?? '').trim();
  if (!bookingId || !reason) {
    return;
  }

  await adminPost(`/admin/bookings/${bookingId}/no-show`, { reason }, null);
  revalidateBookingAction(bookingId, BOOKING_STATUS_FAILURE_IMPACT_PATHS);
}

export async function expireBooking(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!bookingId || !reason) {
    return;
  }

  try {
    await adminPostOrThrow(`/admin/bookings/${bookingId}/expire`, { reason });
  } catch {
    redirect(bookingActionNoticeHref(bookingId, 'expiry-failed', 'matching-expiry'));
  }
  revalidateBookingAction(bookingId, BOOKING_STATUS_FAILURE_IMPACT_PATHS);
  redirect(bookingActionNoticeHref(bookingId, 'expiry-complete', 'booking-command-decision-strip'));
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

export type PostMatchCancellationDecisionActionState = {
  message: string;
  status: 'error' | 'success';
  values: {
    decision: string;
    note: string;
    reason: string;
  };
};

const POST_MATCH_DECISION_REASONS = new Set([
  'CUSTOMER_REQUESTED',
  'CUSTOMER_NOT_FOUND',
  'SAFETY_CONCERN',
  'SERVICE_CANNOT_BE_PROVIDED',
  'OTHER',
]);

export async function resolvePostMatchCancellationFromDetail(
  _previousState: PostMatchCancellationDecisionActionState | null,
  formData: FormData,
): Promise<PostMatchCancellationDecisionActionState> {
  const bookingId = String(formData.get('bookingId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim().toUpperCase();
  const note = String(formData.get('note') ?? '').trim();
  const values = { decision, note, reason };

  if (!bookingId || (decision !== 'approve' && decision !== 'hold')) {
    return { message: 'Choose a valid cancellation outcome.', status: 'error', values };
  }
  if (!POST_MATCH_DECISION_REASONS.has(reason)) {
    return { message: 'Choose a decision reason before continuing.', status: 'error', values };
  }
  if (reason === 'OTHER' && !note) {
    return { message: 'Add an operator note when Other is selected.', status: 'error', values };
  }

  try {
    const result = await adminPostOrThrow<PostMatchCancellationDecisionApiResult>(
      `/admin/bookings/${bookingId}/post-match-cancellation/${decision}`,
      { note: note || undefined, reason },
    );
    revalidateBookingAction(bookingId, BOOKING_POST_MATCH_CANCELLATION_IMPACT_PATHS);
    return {
      message: postMatchCancellationDecisionSuccessMessage(result.postMatchDecisionResult),
      status: 'success',
      values: { decision: '', note: '', reason: '' },
    };
  } catch (error) {
    if (isAdminApiAuthError(error)) throw error;
    return {
      message: postMatchCancellationDecisionFailureMessage(error),
      status: 'error',
      values,
    };
  }
}

export async function updateBookingOpsTask(formData: FormData) {
  const bookingId = String(formData.get('bookingId') ?? '');
  const type = String(formData.get('type') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const nextCheckAt = String(formData.get('nextCheckAt') ?? '').trim();
  if (!bookingId || !type || !status) {
    return;
  }
  if ((status === 'BLOCKED' || status === 'PENDING') && !note) {
    return;
  }
  if (status === 'BLOCKED' && !nextCheckAt) {
    return;
  }

  await adminPost(
    `/admin/bookings/${bookingId}/ops-task`,
    { type, status, note: nextCheckAt ? `${note}\nNext check: ${nextCheckAt}` : note },
    null,
  );
  revalidateBookingAction(bookingId);
}

async function runPaymentAction(formData: FormData, action: 'sync' | 'capture' | 'release' | 'refund') {
  const bookingId = String(formData.get('bookingId'));
  const paymentId = String(formData.get('paymentId'));
  if (!bookingId || !paymentId) {
    return;
  }

  if (action === 'refund') {
    await adminPostOrThrow(
      `/admin/payments/${encodeURIComponent(paymentId)}/refund-request`,
      {},
    );
  } else {
    await adminPost(`/admin/payments/${paymentId}/${action}`, {}, null);
  }
  revalidateBookingAction(bookingId, BOOKING_PAYMENT_IMPACT_PATHS);
  if (action === 'refund') {
    revalidatePath('/finance-tax/approval-queue');
  }
}

function revalidateBookingAction(bookingId: string, extraPaths: readonly string[] = []) {
  for (const path of bookingActionRevalidatePaths(bookingId, extraPaths)) {
    revalidatePath(path);
  }
}

function bookingActionNoticeHref(bookingId: string, notice: string, fragment: string) {
  return `/bookings/${encodeURIComponent(bookingId)}?notice=${encodeURIComponent(notice)}#${fragment}`;
}

type PostMatchCancellationDecisionApiResult = {
  postMatchDecisionResult?: {
    decision?: string;
    earningResult?: { skipped?: boolean };
    paymentResolution?: { refundRequested?: boolean; released?: boolean; skipped?: boolean };
  };
};

function postMatchCancellationDecisionSuccessMessage(
  result: PostMatchCancellationDecisionApiResult['postMatchDecisionResult'],
) {
  const customerResult = result?.paymentResolution?.refundRequested
    ? 'Customer refund requested; Finance approval remains.'
    : result?.paymentResolution?.released
      ? 'Customer payment authorization released.'
      : 'No customer payment movement was required.';
  const partnerResult =
    result?.decision === 'HELD'
      ? 'Partner fee deduction kept.'
      : result?.earningResult?.skipped === false
        ? 'Partner fee deduction waived and wallet impact restored.'
        : 'No Partner fee movement was required.';
  return `Review resolved. ${customerResult} ${partnerResult}`;
}

function postMatchCancellationDecisionFailureMessage(error: unknown) {
  if (error instanceof AdminApiRequestError) {
    if (error.status === 409) {
      return 'Another operator already resolved this review. Refresh to see the result.';
    }
    if (error.status === 400 || error.status === 422) {
      const payload = error.payload as { message?: string | string[] } | undefined;
      const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
      return message || 'Review the decision reason and current money state, then try again.';
    }
  }
  return 'The cancellation decision could not be saved. No success was recorded; refresh and try again.';
}
