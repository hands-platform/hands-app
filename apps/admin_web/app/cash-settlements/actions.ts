'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { AdminApiRequestError, adminPostOrThrow } from '../../lib/admin-api';
import { cashSettlementNoticeHref, safeCashSettlementReturnTo } from './cash-settlement-page-filters';

type CashDebtAllocationResult = {
  allocation: { id: string; amount: number };
  auditLogId: string;
  cashDebtFullyAllocated: boolean;
  earning: { id: string; status: string };
};

const CASH_SETTLEMENT_REASON_CODES = new Set([
  'BANK_DEPOSIT_CONFIRMED',
  'PARTIAL_RECOVERY',
  'FINAL_RECOVERY',
  'OTHER_REVIEWED',
]);

export async function allocateApprovedDepositToCashDebt(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '').trim();
  const earningId = String(formData.get('earningId') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const notes = String(formData.get('notes') ?? '').trim();
  const reasonCode = String(formData.get('reasonCode') ?? '').trim();
  const returnTo = safeCashSettlementReturnTo(String(formData.get('returnTo') ?? ''));

  if (
    !requestId ||
    !earningId ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    notes.length < 12 ||
    !CASH_SETTLEMENT_REASON_CODES.has(reasonCode)
  ) {
    return redirect(cashSettlementNoticeHref(returnTo, { notice: 'error', earningId, code: 'INVALID_INPUT' }));
  }

  let result: CashDebtAllocationResult;
  try {
    result = await adminPostOrThrow<CashDebtAllocationResult>(
      `/admin/cash-settlement-earnings/${encodeURIComponent(earningId)}/allocations`,
      { requestId, amount, notes, reasonCode },
    );
  } catch (error) {
    return redirect(
      cashSettlementNoticeHref(returnTo, {
        notice: 'error',
        earningId,
        code: cashSettlementActionErrorCode(error),
      }),
    );
  }

  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payments');
  revalidatePath('/bookings');
  revalidatePath('/payouts');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');

  redirect(
    cashSettlementNoticeHref(returnTo, {
      notice: 'settled',
      earningId: result.earning.id,
      auditId: result.auditLogId,
      allocationId: result.allocation.id,
      amount: result.allocation.amount,
      evidenceId: requestId,
      method: 'APPROVED_PARTNER_DEPOSIT',
      status: result.earning.status,
    }),
  );
}

function cashSettlementActionErrorCode(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) return 'SERVICE_UNAVAILABLE';
  if (error.status === 400) return 'EVIDENCE_INVALID';
  if (error.status === 401 || error.status === 403) return 'PERMISSION_DENIED';
  if (error.status === 404) return 'TARGET_NOT_FOUND';
  if (error.status === 409) return 'STALE_OR_DUPLICATE';
  return 'SETTLEMENT_FAILED';
}
