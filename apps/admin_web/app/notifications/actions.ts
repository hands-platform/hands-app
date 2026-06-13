'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPost } from '../../lib/admin-api';
import { notificationActionReturnHref } from './notification-action-return-href';

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
