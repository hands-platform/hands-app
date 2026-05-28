'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../../lib/admin-api';

export async function addCustomerOpsNote(formData: FormData) {
  const customerId = String(formData.get('customerId') ?? '');
  const note = String(formData.get('note') ?? '');
  const preset = String(formData.get('preset') ?? '');
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!customerId || (!note.trim() && !preset.trim())) {
    return;
  }

  await adminPost(`/admin/customers/${customerId}/ops-note`, { note, preset, bookingId: bookingId || null }, null);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  revalidatePath('/audit-log');
}
