'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminApiRequestError, adminPostOrThrow, isAdminApiAuthError } from '../../lib/admin-api';
import { notificationActionReturnHref, sanitizeNotificationReturnHref } from './notification-action-return-href';

export async function retryNotification(formData: FormData) {
  const notificationId = readRequiredFormString(formData, 'notificationId');
  const reason = readRequiredFormString(formData, 'reason');
  const returnHref = notificationActionReturnHref(formData);
  let queuedJobId: string | null | undefined;
  try {
    const result = await adminPostOrThrow<{
      auditStatus?: 'CONFIRMED' | 'PENDING';
      retryJob?: { queuedJobId?: string | null };
    }>(`/admin/notifications/${notificationId}/retry`, { reason });
    queuedJobId = result.retryJob?.queuedJobId;
    if (result.auditStatus === 'PENDING') {
      revalidateNotificationActionPaths();
      return redirect(notificationRetryNoticeHref(returnHref, 'queued-audit-pending', queuedJobId));
    }
  } catch (error) {
    return redirect(notificationRetryNoticeHref(returnHref, notificationRetryFailureNotice(error)));
  }
  revalidateNotificationActionPaths();
  redirect(notificationRetryNoticeHref(returnHref, 'queued', queuedJobId));
}

export async function reviewLegacyNotification(formData: FormData) {
  const notificationId = readRequiredFormString(formData, 'notificationId');
  const reason = readRequiredFormString(formData, 'reason');
  await adminPostOrThrow(`/admin/notifications/${notificationId}/review-legacy`, { reason });
  revalidateNotificationActionPaths();
  redirect(notificationActionReturnHref(formData));
}

export async function assignFinanceReview(formData: FormData) {
  const assigneeAdminId = readRequiredFormString(formData, 'assigneeAdminId');
  const reason = readRequiredFormString(formData, 'reason');
  const sourceId = readRequiredFormString(formData, 'assignmentSourceId');
  const sourceKind = readRequiredFormString(formData, 'assignmentSourceKind');
  const returnHref = sanitizeNotificationReturnHref(readOptionalFormString(formData, 'returnHref'));
  const path = sourceKind === 'bank-transaction'
    ? `/admin/bank-reconciliation/${encodeURIComponent(sourceId)}/review-assignment`
    : sourceKind === 'import-batch'
      ? `/admin/bank-reconciliation/import-batches/${encodeURIComponent(sourceId)}/assignment`
      : null;
  if (!path) {
    redirect(notificationAssignmentNoticeHref(returnHref, 'failed'));
  }

  try {
    await adminPostOrThrow(path, { assigneeAdminId, reason });
  } catch {
    redirect(notificationAssignmentNoticeHref(returnHref, 'failed'));
  }
  revalidateNotificationActionPaths();
  revalidatePath('/finance-tax/bank-reconciliation');
  redirect(notificationAssignmentNoticeHref(returnHref, 'assigned'));
}

function revalidateNotificationActionPaths() {
  revalidatePath('/notifications');
  revalidatePath('/partners');
  revalidatePath('/partner-controls');
  revalidatePath('/audit-log');
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function notificationAssignmentNoticeHref(returnHref: string, notice: 'assigned' | 'failed') {
  const url = new URL(returnHref, 'http://admin.local');
  url.searchParams.set('financeAssignmentNotice', notice);
  return `${url.pathname}${url.search}`;
}

type NotificationRetryNotice =
  | 'no-eligible-path'
  | 'permission-denied'
  | 'queue-unavailable'
  | 'queued'
  | 'queued-audit-pending'
  | 'state-changed'
  | 'unknown-failure';

function notificationRetryFailureNotice(error: unknown): NotificationRetryNotice {
  if (isAdminApiAuthError(error)) return 'permission-denied';
  if (error instanceof AdminApiRequestError) {
    if (error.status === 409) {
      const detail = JSON.stringify(error.payload ?? '').toLowerCase();
      return detail.includes('no eligible') || detail.includes('no enabled')
        ? 'no-eligible-path'
        : 'state-changed';
    }
    if (error.status >= 500) return 'queue-unavailable';
  }
  return 'unknown-failure';
}

function notificationRetryNoticeHref(
  returnHref: string,
  notice: NotificationRetryNotice,
  jobId?: string | null,
) {
  const url = new URL(returnHref, 'http://admin.local');
  url.searchParams.set('retryNotice', notice);
  if (jobId) url.searchParams.set('retryJob', jobId.slice(0, 24));
  return `${url.pathname}${url.search}`;
}
