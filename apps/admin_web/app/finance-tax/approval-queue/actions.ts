'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminPostOrThrow } from '../../../lib/admin-api';

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

export async function assignPartnerBankDepositReconciliationReview(formData: FormData) {
  const requestId = requiredRequestId(formData);
  const assigneeAdminId = readString(formData, 'assigneeAdminId');
  const reason = readString(formData, 'reason');
  const redirectTo = approvalQueueReturnTo(formData.get('redirectTo'));
  if (
    readString(formData, 'confirmationRequestId') !== requestId ||
    !assigneeAdminId ||
    reason.length < 12
  ) {
    return redirect(approvalQueueAssignmentNoticeHref(redirectTo, 'failed', requestId));
  }
  try {
    await adminPostOrThrow(
      `/admin/provider-wallet/deposit-requests/${encodeURIComponent(requestId)}/reconciliation-assignment`,
      { assigneeAdminId, reason },
    );
  } catch {
    return redirect(approvalQueueAssignmentNoticeHref(redirectTo, 'failed', requestId));
  }
  revalidateFinanceApprovalPages();
  return redirect(approvalQueueAssignmentNoticeHref(redirectTo, 'assigned', requestId));
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
  revalidatePath('/wallet-adjustments');
  revalidatePath('/finance-tax/general-ledger');
  revalidatePath('/audit-log');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
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
  if (url.searchParams.get('view') === 'reconciliation') search.set('view', 'reconciliation');
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

function approvalQueueAssignmentNoticeHref(baseHref: string, notice: string, requestId: string) {
  const url = new URL(baseHref, 'http://localhost');
  url.searchParams.set('assignmentNotice', notice);
  url.searchParams.set('requestId', requestId);
  return `${url.pathname}${url.search}`;
}
