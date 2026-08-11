'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { AdminApiRequestError, adminPatchOrThrow, adminPostOrThrow } from '../../../lib/admin-api';

export async function approveWalletAdjustmentRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/wallet-adjustment-requests/${encodeURIComponent(requestId)}/approve`, {});
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'approved', requestId));
}

export async function rejectWalletAdjustmentRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const reason = readString(formData, 'reason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  if (reason.length < 12) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'reason-required', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/wallet-adjustment-requests/${encodeURIComponent(requestId)}/reject`, {
      reason,
    });
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'rejected', requestId));
}

export async function cancelStaleWalletAdjustmentRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const reason = readString(formData, 'reason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  if (reason.length < 12) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'reason-required', requestId));
  }
  try {
    await adminPostOrThrow(
      `/admin/wallet-adjustment-requests/${encodeURIComponent(requestId)}/cancel-stale`,
      { reason },
    );
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'cancelled', requestId));
}

export async function approvePartnerBankDepositRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/provider-wallet/deposit-requests/${encodeURIComponent(requestId)}/approve`, {});
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'approved', requestId));
}

export async function rejectPartnerBankDepositRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const reason = readString(formData, 'reason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  if (reason.length < 12) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'reason-required', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/provider-wallet/deposit-requests/${encodeURIComponent(requestId)}/reject`, {
      reason,
    });
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'rejected', requestId));
}

export async function decideCompanyBankAccountRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const bankAccountId = readString(formData, 'bankAccountId');
  const decision = readString(formData, 'decision');
  const operatorReason = readString(formData, 'operatorReason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (
    readString(formData, 'confirmationRequestId') !== requestId ||
    !bankAccountId ||
    (decision !== 'APPROVE' && decision !== 'REJECT') ||
    operatorReason.length < 12
  ) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'reason-required', requestId));
  }
  try {
    await adminPostOrThrow(
      `/admin/company-bank-accounts/${encodeURIComponent(bankAccountId)}/approval-decision`,
      { decision, operatorReason, requestId },
    );
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(
    approvalQueueNoticeHref(
      redirectTo,
      decision === 'APPROVE' ? 'approved' : 'rejected',
      requestId,
    ),
  );
}

export async function approveRefundRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const paymentId = readString(formData, 'paymentId');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId || !paymentId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/payments/${encodeURIComponent(paymentId)}/refund`, {});
  } catch (error) {
    return redirect(approvalQueueNoticeHref(redirectTo, refundFailureNotice(error), requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'approved', requestId));
}

export async function rejectRefundRequest(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const reason = readString(formData, 'reason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId || reason.length < 12) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'reason-required', requestId));
  }
  try {
    await adminPostOrThrow(`/admin/refunds/${encodeURIComponent(requestId)}/reject`, { reason });
  } catch (error) {
    return redirect(approvalQueueNoticeHref(redirectTo, refundFailureNotice(error), requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'rejected', requestId));
}

export async function approveWithdrawalPaidCloseout(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPatchOrThrow(
      `/admin/provider-wallet/withdrawal-requests/${encodeURIComponent(requestId)}`,
      { status: 'PAID' },
    );
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'approved', requestId));
}

export async function approvePayoutBatchPaidCloseout(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (readString(formData, 'confirmationRequestId') !== requestId) {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPatchOrThrow(`/admin/payout-batches/${encodeURIComponent(requestId)}`, {
      status: 'PAID',
    });
  } catch {
    return redirect(approvalQueueNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueNoticeHref(redirectTo, 'approved', requestId));
}

function requiredRequestId(formData: FormData) {
  const requestId = readString(formData, 'requestId');
  if (!requestId) {
    throw new Error('Finance approval request id is required');
  }
  return requestId;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function revalidateFinanceApprovalPages() {
  revalidatePath('/finance-tax/approval-queue');
  revalidatePath('/finance-tax/company-bank-accounts');
  revalidatePath('/wallet-adjustments');
  revalidatePath('/finance-tax/general-ledger');
  revalidatePath('/audit-log');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partners');
}

function approvalQueueReturnTo(value: FormDataEntryValue | null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '/finance-tax/approval-queue';
  const url = new URL(normalized, 'http://localhost');
  if (url.origin !== 'http://localhost' || url.pathname !== '/finance-tax/approval-queue') {
    return '/finance-tax/approval-queue';
  }
  const search = new URLSearchParams();
  const view = url.searchParams.get('view');
  if (
    view === 'deposits' ||
    view === 'bank-accounts' ||
    view === 'payouts' ||
    view === 'policies' ||
    view === 'refunds' ||
    view === 'wallet' ||
    view === 'withdrawals'
  ) {
    search.set('view', view);
  }
  const walletReview = url.searchParams.get('walletReview');
  if (
    view === 'wallet' &&
    (walletReview === 'blocked' || walletReview === 'ready' || walletReview === 'stale')
  ) {
    search.set('walletReview', walletReview);
  }
  if (url.searchParams.get('take') === '25') search.set('take', '25');
  const query = search.toString();
  return query ? `/finance-tax/approval-queue?${query}` : '/finance-tax/approval-queue';
}

function approvalQueueNoticeHref(baseHref: string, notice: string, requestId: string) {
  const url = new URL(baseHref, 'http://localhost');
  url.searchParams.set('approvalNotice', notice);
  url.searchParams.set('requestId', requestId);
  return `${url.pathname}${url.search}`;
}

function refundFailureNotice(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) return 'failed';
  const message = adminApiErrorMessage(error.payload).toLowerCase();
  return /already|captured|current|failed|payment|refunded|released|state|status/.test(message)
    ? 'state-mismatch'
    : 'failed';
}

function adminApiErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as { error?: unknown; message?: unknown };
  if (Array.isArray(value.message)) return value.message.filter((item) => typeof item === 'string').join(' ');
  if (typeof value.message === 'string') return value.message;
  return typeof value.error === 'string' ? value.error : '';
}
