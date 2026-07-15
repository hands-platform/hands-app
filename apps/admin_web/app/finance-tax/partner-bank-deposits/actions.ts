'use server';

import { revalidatePath } from 'next/cache';

import { adminPostOrThrow } from '../../../lib/admin-api';
import { PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT } from './partner-bank-deposit-action-contract';

export async function allocatePartnerBankDepositCashDebt(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '').trim();
  const earningId = String(formData.get('earningId') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const notes = String(formData.get('notes') ?? '').trim();
  const confirmationIntent = String(formData.get('confirmationIntent') ?? '').trim();

  if (
    !requestId ||
    !earningId ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    confirmationIntent !== PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT ||
    notes.length < 12
  ) {
    throw new Error('Deposit allocation requires reviewed evidence, a reason, and explicit confirmation');
  }

  await adminPostOrThrow(
    `/admin/provider-wallet/deposit-requests/${encodeURIComponent(requestId)}/cash-debt-allocations`,
    { earningId, amount, notes },
  );

  revalidatePath(`/finance-tax/partner-bank-deposits/${requestId}`);
  revalidatePath('/finance-tax/partner-bank-deposits');
  revalidatePath('/finance-tax/approval-queue');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
