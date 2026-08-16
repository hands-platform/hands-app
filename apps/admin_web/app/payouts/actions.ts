'use server';

import { revalidatePath } from 'next/cache';
import { adminPatchOrThrow, adminPostOrThrow } from '../../lib/admin-api';

export async function updatePayoutTransferRef(formData: FormData) {
  const payoutBatchId = requiredFormValue(formData, 'payoutBatchId');
  const confirmationPayoutBatchId = requiredFormValue(formData, 'confirmationPayoutBatchId');
  const reason = requiredFormValue(formData, 'reason');
  if (confirmationPayoutBatchId !== payoutBatchId) {
    throw new Error('Reconfirmed payout batch does not match the selected target');
  }
  if (reason.length < 10) {
    throw new Error('reason must be at least 10 characters');
  }

  await adminPatchOrThrow(
    `/admin/payout-batches/${encodeURIComponent(payoutBatchId)}`,
    {
      transferRef: String(formData.get('transferRef') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      confirmationPayoutBatchId,
      expectedStatus: requiredFormValue(formData, 'expectedStatus'),
      expectedTransferRef: String(formData.get('expectedTransferRef') ?? ''),
      expectedNotes: String(formData.get('expectedNotes') ?? ''),
      reason,
    },
  );
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
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

export async function reversePaidPayout(formData: FormData) {
  const payoutBatchId = requiredFormValue(formData, 'payoutBatchId');
  await reversePaidDisbursement(
    `/admin/payout-batches/${encodeURIComponent(payoutBatchId)}/reversal`,
    formData,
  );
}

export async function reversePaidProviderWalletWithdrawal(formData: FormData) {
  const requestId = requiredFormValue(formData, 'requestId');
  await reversePaidDisbursement(
    `/admin/provider-wallet/withdrawal-requests/${encodeURIComponent(requestId)}/reversal`,
    formData,
  );
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
  if (status === 'BANK_TRANSFER_PENDING' && !transferRef) {
    throw new Error('Partner wallet withdrawal bank transfer request requires a transfer reference');
  }
  if (status === 'BANK_TRANSFER_PENDING' && !bankTransferDate) {
    throw new Error('Partner wallet withdrawal bank transfer request requires a transfer date');
  }
  if (status === 'BANK_TRANSFER_PENDING' && !attachmentFileId && !attachmentUrl) {
    throw new Error('Partner wallet withdrawal bank transfer request requires attached bank evidence');
  }

  await adminPatchOrThrow(
    `/admin/provider-wallet/withdrawal-requests/${requestId}`,
    status === 'PAID'
      ? { status }
      : {
          status,
          transferRef: transferRef || undefined,
          bankTransferDate: bankTransferDate || undefined,
          attachmentFileId: attachmentFileId || undefined,
          attachmentUrl: attachmentUrl || undefined,
          adminNote: adminNote || undefined,
          correctionReason: correctionReason || undefined,
        },
  );

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
  const transferRef = String(formData.get('transferRef') ?? '').trim();

  await adminPatchOrThrow(
    `/admin/payout-batches/${payoutBatchId}`,
    status === 'PAID'
      ? { status }
      : {
          status,
          transferRef: transferRef || undefined,
        },
  );
  revalidatePath('/payouts');
  revalidatePath('/earnings');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

async function reversePaidDisbursement(path: string, formData: FormData) {
  const reason = requiredFormValue(formData, 'reason');
  const reversalReference = requiredFormValue(formData, 'reversalReference');
  const attachmentUrl = String(formData.get('attachmentUrl') ?? '').trim();
  const attachmentFileId = String(formData.get('attachmentFileId') ?? '').trim();
  if (!attachmentUrl && !attachmentFileId) {
    throw new Error('Paid disbursement reversal requires attached bank evidence');
  }

  await adminPostOrThrow(path, {
    reason,
    reversalReference,
    attachmentUrl: attachmentUrl || undefined,
    attachmentFileId: attachmentFileId || undefined,
  });
  revalidatePath('/payouts');
  revalidatePath('/earnings');
  revalidatePath('/finance-tax/general-ledger');
  revalidatePath('/finance-tax/settlement-reversals');
  revalidatePath('/finance-overview');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

function requiredFormValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
