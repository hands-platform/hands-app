'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPostOrThrow, type AdminPushCampaign } from '../../../lib/admin-api';

export async function addCustomerOpsNote(formData: FormData) {
  const customerId = String(formData.get('customerId') ?? '');
  const note = String(formData.get('note') ?? '');
  const preset = String(formData.get('preset') ?? '');
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!customerId) {
    throw new Error('customerId is required');
  }
  if (!note.trim() && !preset.trim()) {
    return redirect(
      `/customers/${encodeURIComponent(customerId)}?action=note&noteNotice=failed#customer-operator-notes`,
    );
  }

  try {
    await adminPostOrThrow(`/admin/customers/${customerId}/ops-note`, {
      note,
      preset,
      bookingId: bookingId || null,
    });
  } catch {
    return redirect(
      `/customers/${encodeURIComponent(customerId)}?noteNotice=failed#customer-operator-notes`,
    );
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  revalidatePath('/audit-log');
  return redirect(
    `/customers/${encodeURIComponent(customerId)}?noteNotice=saved#customer-operator-notes`,
  );
}

export async function sendCustomerPushMessage(formData: FormData) {
  const customerId = readRequiredFormString(formData, 'customerId');
  const targetUserId = readRequiredFormString(formData, 'targetUserId');
  const title = readRequiredFormString(formData, 'title');
  const body = readRequiredFormString(formData, 'body');

  try {
    await adminPostOrThrow<AdminPushCampaign>('/admin/notifications/push-campaigns', {
      appDestination: 'notificationCenter',
      body,
      targetRole: 'CUSTOMER',
      targetUserId,
      title,
    });
    revalidatePath(`/customers/${customerId}`);
    revalidatePath('/notifications');
    revalidatePath('/notifications/push-send');
  } catch {
    return redirect(
      `/customers/${encodeURIComponent(customerId)}?notificationNotice=failed#customer-app-notifications`,
    );
  }

  return redirect(
    `/customers/${encodeURIComponent(customerId)}?notificationNotice=sent#customer-app-notifications`,
  );
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}
