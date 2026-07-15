'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPost, adminPostOrThrow } from '../../lib/admin-api';
import { notificationActionReturnHref, sanitizeNotificationReturnHref } from './notification-action-return-href';

export async function retryNotification(formData: FormData) {
  const notificationId = readRequiredFormString(formData, 'notificationId');
  await adminPost(`/admin/notifications/${notificationId}/retry`, {}, null);
  revalidateNotificationActionPaths();
  redirect(notificationActionReturnHref(formData));
}

export async function enablePushDevice(formData: FormData) {
  const pushDeviceId = readRequiredFormString(formData, 'pushDeviceId');
  await adminPost(`/admin/push-devices/${pushDeviceId}/enable`, {}, null);
  revalidateNotificationActionPaths();
  redirect(notificationActionReturnHref(formData));
}

export async function reviewLegacyNotification(formData: FormData) {
  const notificationId = readRequiredFormString(formData, 'notificationId');
  const reason = readRequiredFormString(formData, 'reason');
  await adminPost(`/admin/notifications/${notificationId}/review-legacy`, { reason }, null);
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
