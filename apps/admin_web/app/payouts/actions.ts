'use server';

import { revalidatePath } from 'next/cache';
import { adminPatch, adminPatchOrThrow } from '../../lib/admin-api';

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
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
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

export async function updateProviderWalletWithdrawalRequest(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!requestId || !status) {
    return;
  }

  const transferRef = String(formData.get('transferRef') ?? '').trim();
  const bankTransferDate = String(formData.get('bankTransferDate') ?? '').trim();
  const attachmentFileId = String(formData.get('attachmentFileId') ?? '').trim();
  const attachmentUrl = String(formData.get('attachmentUrl') ?? '').trim();
  const adminNote = String(formData.get('adminNote') ?? '').trim();
  const correctionReason = String(formData.get('correctionReason') ?? '').trim();

  await adminPatchOrThrow(`/admin/provider-wallet/withdrawal-requests/${requestId}`, {
    status,
    transferRef: transferRef || undefined,
    bankTransferDate: bankTransferDate || undefined,
    attachmentFileId: attachmentFileId || undefined,
    attachmentUrl: attachmentUrl || undefined,
    adminNote: adminNote || undefined,
    correctionReason: correctionReason || undefined,
  });

  revalidatePath('/payouts');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/partners');
  revalidatePath('/partner-controls');
  revalidatePath('/audit-log');
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
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
