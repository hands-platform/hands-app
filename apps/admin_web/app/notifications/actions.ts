'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function retryNotification(formData: FormData) {
  const notificationId = readRequiredFormString(formData, 'notificationId');
  await adminPost(`/admin/notifications/${notificationId}/retry`, {}, null);
  revalidatePath('/notifications');
  revalidatePath('/audit-log');
}

export async function enablePushDevice(formData: FormData) {
  const pushDeviceId = readRequiredFormString(formData, 'pushDeviceId');
  await adminPost(`/admin/push-devices/${pushDeviceId}/enable`, {}, null);
  revalidatePath('/notifications');
  revalidatePath('/partners');
  revalidatePath('/providers');
  revalidatePath('/audit-log');
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}
