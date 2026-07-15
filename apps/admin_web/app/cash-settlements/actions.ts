'use server';

import { revalidatePath } from 'next/cache';
import { adminPost, adminPostOrThrow } from '../../lib/admin-api';

export async function settleCashFeeDebt(formData: FormData) {
  const earningId = String(formData.get('earningId') ?? '').trim();
  if (!earningId) {
    return;
  }

  const settlementRef = String(formData.get('settlementRef') ?? '').trim();
  const settlementNotes = String(formData.get('settlementNotes') ?? '').trim();
  const settlementMethod = String(formData.get('settlementMethod') ?? '').trim();

  if (settlementMethod && settlementMethod !== 'ADMIN_OFFSET') {
    throw new Error('Approved Partner deposits must be allocated from the deposit detail');
  }

  await adminPost(
    `/admin/earnings/${earningId}/mark-paid`,
    {
      settlementRef: settlementRef || undefined,
      settlementNotes: settlementNotes || undefined,
      settlementMethod: 'ADMIN_OFFSET',
    },
    null,
  );

  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payments');
  revalidatePath('/bookings');
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}

export async function recordPartnerBankDeposit(formData: FormData) {
  const providerProfileId = String(formData.get('providerProfileId') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const bankTransactionId = String(formData.get('bankTransactionId') ?? '').trim();
  const depositDate = String(formData.get('depositDate') ?? '').trim();
  const bankAccount = String(formData.get('bankAccount') ?? '').trim();
  const attachmentFileId = String(formData.get('attachmentFileId') ?? '').trim();
  const attachmentUrl = String(formData.get('attachmentUrl') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!providerProfileId || !Number.isFinite(amount) || amount <= 0 || !bankTransactionId || !depositDate) {
    throw new Error('Partner bank deposit requires partner, amount, transaction id, and deposit date');
  }
  if (!attachmentFileId && !attachmentUrl) {
    throw new Error('Partner bank deposit requires attachment evidence');
  }

  await adminPostOrThrow('/admin/provider-wallet/deposit-requests', {
    providerProfileId,
    amount,
    bankTransactionId,
    depositDate,
    bankAccount: bankAccount || undefined,
    attachmentFileId: attachmentFileId || undefined,
    attachmentUrl: attachmentUrl || undefined,
    notes: notes || undefined,
  });

  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payments');
  revalidatePath('/bookings');
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
  revalidatePath('/finance-tax/approval-queue');
}
