import { formatMoney, shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type EarningConfirmationAction = 'create-payout' | 'mark-paid';

export type EarningSettlementConfirmationRow = {
  readonly accountingPreview: readonly string[];
  readonly currency: string;
  readonly debtAmount: number;
  readonly earningId: string;
  readonly paymentMethod: string;
  readonly providerName: string;
  readonly settlementReference: string;
};

export type EarningPayoutConfirmationRow = {
  readonly currency: string;
  readonly providerName: string;
  readonly providerProfileId: string;
  readonly transferRef: string;
  readonly unbatchedCount: number;
  readonly unbatchedNet: number;
};

export type EarningActionConfirmationInput = {
  readonly action: EarningConfirmationAction | null;
  readonly earningId: string;
  readonly providerProfileId: string;
  readonly settlementMethod: string;
  readonly settlementNotes: string;
  readonly settlementRef: string;
  readonly transferRef: string;
};

export type EarningActionConfirmation =
  | {
      readonly action: 'create-payout';
      readonly cancelHref: string;
      readonly confirmLabel: string;
      readonly description: string;
      readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
      readonly title: string;
      readonly tone: StatusBadgeTone;
    }
  | {
      readonly action: 'mark-paid';
      readonly cancelHref: string;
      readonly confirmLabel: string;
      readonly description: string;
      readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
      readonly title: string;
      readonly tone: StatusBadgeTone;
    };

export function earningActionConfirmHref(input: EarningActionConfirmationInput) {
  const params = new URLSearchParams();
  if (input.action) {
    params.set('confirm', input.action);
  }
  if (input.earningId) {
    params.set('earningId', input.earningId);
  }
  if (input.providerProfileId) {
    params.set('providerProfileId', input.providerProfileId);
  }
  if (input.settlementMethod) {
    params.set('settlementMethod', input.settlementMethod);
  }
  if (input.settlementNotes) {
    params.set('settlementNotes', input.settlementNotes);
  }
  if (input.settlementRef) {
    params.set('settlementRef', input.settlementRef);
  }
  if (input.transferRef) {
    params.set('transferRef', input.transferRef);
  }
  return `/earnings?${params.toString()}`;
}

export function readEarningConfirmationAction(value: string): EarningConfirmationAction | null {
  if (value === 'create-payout' || value === 'mark-paid') {
    return value;
  }
  return null;
}

export function buildEarningActionConfirmation(
  settlementRows: readonly EarningSettlementConfirmationRow[],
  payoutRows: readonly EarningPayoutConfirmationRow[],
  input: EarningActionConfirmationInput,
): EarningActionConfirmation | null {
  if (input.action === 'mark-paid') {
    return buildSettlementConfirmation(settlementRows, input);
  }
  if (input.action === 'create-payout') {
    return buildPayoutConfirmation(payoutRows, input);
  }
  return null;
}

function buildSettlementConfirmation(
  rows: readonly EarningSettlementConfirmationRow[],
  input: EarningActionConfirmationInput,
): EarningActionConfirmation | null {
  const row = rows.find((item) => item.earningId === input.earningId);
  if (!row) {
    return null;
  }

  const settlementMethod = input.settlementMethod || 'PARTNER_DEPOSIT';
  const settlementRef = input.settlementRef || row.settlementReference;
  const settlementNotes =
    input.settlementNotes ||
    `Cash fee debt settled from admin earnings queue with reference ${settlementRef}`;
  const accountingPreview = row.accountingPreview.length
    ? ` Accounting preview: ${row.accountingPreview.join(' / ')}.`
    : '';

  return {
    action: 'mark-paid',
    cancelHref: '/earnings',
    confirmLabel: 'Confirm fee settlement',
    description: `${row.providerName} will settle ${formatMoney(
      row.debtAmount,
      row.currency,
    )} cash fee debt by ${settlementMethodLabel(settlementMethod)}. Payment method: ${
      row.paymentMethod
    }. Reference: ${settlementRef}.${accountingPreview}`,
    hiddenInputs: [
      { name: 'earningId', value: row.earningId },
      { name: 'settlementMethod', value: settlementMethod },
      { name: 'settlementRef', value: settlementRef },
      { name: 'settlementNotes', value: settlementNotes },
    ],
    title: `Confirm earning fee settlement ${shortId(row.earningId)}?`,
    tone: settlementMethod === 'ADMIN_OFFSET' ? 'warning' : 'danger',
  };
}

function buildPayoutConfirmation(
  rows: readonly EarningPayoutConfirmationRow[],
  input: EarningActionConfirmationInput,
): EarningActionConfirmation | null {
  const row = rows.find((item) => item.providerProfileId === input.providerProfileId);
  if (!row) {
    return null;
  }

  const transferRef = input.transferRef || row.transferRef;

  return {
    action: 'create-payout',
    cancelHref: '/earnings',
    confirmLabel: 'Create payout batch',
    description: `Create a payout batch for ${row.providerName}: ${row.unbatchedCount} earning(s), net ${formatMoney(
      row.unbatchedNet,
      row.currency,
    )}. Transfer reference: ${transferRef}.`,
    hiddenInputs: [
      { name: 'providerProfileId', value: row.providerProfileId },
      { name: 'transferRef', value: transferRef },
    ],
    title: `Create payout batch for ${row.providerName}?`,
    tone: 'warning',
  };
}

function settlementMethodLabel(value: string) {
  if (value === 'ADMIN_OFFSET') {
    return 'admin offset';
  }
  return 'Partner deposit';
}
