import type { AdminEarning } from '../../lib/admin-api';
import { formatMoney, shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type CashSettlementConfirmationRow = {
  readonly debtAmount: number;
  readonly earning: Pick<AdminEarning, 'currency' | 'id' | 'settlementMethod'>;
  readonly paymentMethod: string;
  readonly providerName: string;
  readonly settlementReference: string;
};

export type CashSettlementConfirmationInput = {
  readonly earningId: string;
  readonly settlementMethod: string;
  readonly settlementNotes: string;
  readonly settlementRef: string;
};

export type CashSettlementConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly earningId: string;
  readonly settlementMethod: string;
  readonly settlementNotes: string;
  readonly settlementRef: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export function cashSettlementConfirmHref(input: CashSettlementConfirmationInput) {
  const params = new URLSearchParams({
    confirm: 'settle',
    earningId: input.earningId,
    settlementMethod: input.settlementMethod,
    settlementNotes: input.settlementNotes,
    settlementRef: input.settlementRef,
  });

  return `/cash-settlements?${params.toString()}`;
}

export function buildCashSettlementConfirmation(
  rows: readonly CashSettlementConfirmationRow[],
  input: CashSettlementConfirmationInput,
): CashSettlementConfirmation | null {
  const row = rows.find((item) => item.earning.id === input.earningId);
  if (!row) {
    return null;
  }

  const settlementMethod = 'ADMIN_OFFSET';
  const settlementRef = input.settlementRef || row.settlementReference;
  const settlementNotes =
    input.settlementNotes ||
    `Approved admin offset for ${formatMoney(row.debtAmount, row.earning.currency)} using ${settlementRef}`;

  return {
    cancelHref: '/cash-settlements',
    confirmLabel: 'Confirm settlement',
    description: `${row.providerName} will settle ${formatMoney(
      row.debtAmount,
      row.earning.currency,
    )} by admin offset. Payment method: ${row.paymentMethod}. Reference: ${settlementRef}.`,
    earningId: row.earning.id,
    settlementMethod,
    settlementNotes,
    settlementRef,
    title: `Confirm cash settlement ${shortId(row.earning.id)}?`,
    tone: 'warning',
  };
}
