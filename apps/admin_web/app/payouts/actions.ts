'use server';

import { revalidatePath } from 'next/cache';
import { adminPatch } from '../../lib/admin-api';

export async function updatePayoutTransferRef(formData: FormData) {
  const payoutBatchId = String(formData.get('payoutBatchId') ?? '');
  if (!payoutBatchId) {
    return;
  }

  await adminPatch(
    `/admin/payout-batches/${payoutBatchId}`,
    {
      transferRef: String(formData.get('transferRef') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    },
    null,
  );
  revalidatePath('/payouts');
  revalidatePath('/provider-risk');
  revalidatePath('/providers');
}

export async function markPayoutProcessing(formData: FormData) {
  await updatePayoutStatus(formData, 'PROCESSING');
}

export async function markPayoutPaid(formData: FormData) {
  await updatePayoutStatus(formData, 'PAID');
}

export async function markPayoutFailed(formData: FormData) {
  await updatePayoutStatus(formData, 'FAILED');
}

async function updatePayoutStatus(formData: FormData, status: 'PROCESSING' | 'PAID' | 'FAILED') {
  const payoutBatchId = String(formData.get('payoutBatchId') ?? '');
  if (!payoutBatchId) {
    return;
  }

  await adminPatch(
    `/admin/payout-batches/${payoutBatchId}`,
    {
      status,
      transferRef: String(formData.get('transferRef') ?? '') || undefined,
    },
    null,
  );
  revalidatePath('/payouts');
  revalidatePath('/earnings');
  revalidatePath('/provider-risk');
  revalidatePath('/providers');
  revalidatePath('/audit-log');
}
