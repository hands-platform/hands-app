'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function refundPayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/refund`, {}, null);
  revalidatePath('/payments');
}

export async function syncPayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/sync`, {}, null);
  revalidatePath('/payments');
}

export async function capturePayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/capture`, {}, null);
  revalidatePath('/payments');
}

export async function releasePayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/release`, {}, null);
  revalidatePath('/payments');
}

export async function settleCashDebt(formData: FormData) {
  const earningId = String(formData.get('earningId') ?? '');
  if (!earningId) {
    return;
  }

  await adminPost(
    `/admin/earnings/${earningId}/mark-paid`,
    {
      settlementRef: String(formData.get('settlementRef') ?? '') || undefined,
      settlementNotes:
        String(formData.get('settlementNotes') ?? '') || 'Cash fee debt settled from Payments operations.',
    },
    null,
  );
  revalidatePath('/payments');
  revalidatePath('/earnings');
  revalidatePath('/bookings');
  revalidatePath('/partner-risk');
  revalidatePath('/provider-risk');
  revalidatePath('/partners');
  revalidatePath('/providers');
  revalidatePath('/audit-log');
}
