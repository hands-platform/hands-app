'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function refundPayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/refund`, {}, null);
  revalidatePaymentOperationPaths();
}

export async function syncPayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/sync`, {}, null);
  revalidatePaymentOperationPaths();
}

export async function capturePayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/capture`, {}, null);
  revalidatePaymentOperationPaths();
}

export async function releasePayment(formData: FormData) {
  const paymentId = String(formData.get('paymentId'));
  await adminPost(`/admin/payments/${paymentId}/release`, {}, null);
  revalidatePaymentOperationPaths();
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
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

function revalidatePaymentOperationPaths() {
  revalidatePath('/payments');
  revalidatePath('/refunds');
  revalidatePath('/earnings');
  revalidatePath('/bookings');
  revalidatePath('/partner-risk');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
