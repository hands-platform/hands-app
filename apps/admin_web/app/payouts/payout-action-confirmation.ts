import type { AdminPayoutBatch } from '../../lib/admin-api';
import { formatMoney, shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PayoutConfirmationAction = 'failed' | 'paid' | 'processing' | 'reverse';

export type PayoutActionAvailability = {
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly transferRef?: string | null;
};

export type PayoutActionConfirmation = {
  readonly action: PayoutConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly payoutBatchId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
  readonly transferRef: string;
};

type PayoutActionMetadata = {
  readonly confirmLabel: string;
  readonly description: (batch: AdminPayoutBatch) => string;
  readonly title: (batch: AdminPayoutBatch) => string;
  readonly tone: StatusBadgeTone;
};

const payoutActionMetadata: Record<PayoutConfirmationAction, PayoutActionMetadata> = {
  failed: {
    confirmLabel: 'Record transfer failure',
    description: (batch) =>
      `${payoutTargetContext(batch)} Record the transfer failure before retry or rebuild. Accounting boundary: no bank/cash or wallet liability movement is recorded; Partner wallet liability remains for retry or rebuild.`,
    title: (batch) => `Mark payout ${shortId(batch.id)} failed?`,
    tone: 'danger',
  },
  paid: {
    confirmLabel: 'Approve paid closeout',
    description: (batch) => {
      const amount = formatMoney(batch.totalNetAmount, batch.currency);
      return `${payoutTargetContext(batch)} Approve paid closeout only after transfer reference, tax, linked earnings, wallet ledger, and Partner checks are clean. Accounting preview: Dr Partner wallet liability ${amount} / Cr Bank ${amount}.`;
    },
    title: (batch) => `Mark payout ${shortId(batch.id)} paid?`,
    tone: 'warning',
  },
  processing: {
    confirmLabel: 'Start transfer preparation',
    description: (batch) =>
      `${payoutTargetContext(batch)} Start transfer preparation after finance review is complete. Accounting boundary: preparation can begin, but bank/cash and Partner wallet liability move only when the batch is marked PAID.`,
    title: (batch) => `Start payout ${shortId(batch.id)} processing?`,
    tone: 'info',
  },
  reverse: {
    confirmLabel: 'Post reversal',
    description: (batch) => {
      const amount = formatMoney(batch.totalNetAmount, batch.currency);
      return `${payoutTargetContext(batch)} Restore ${amount} to the Partner wallet only after the bank confirms the paid payout was returned or rejected. The original payout remains immutable. A current-period journal posts Dr Bank ${amount} / Cr Partner wallet liability ${amount}.`;
    },
    title: (batch) => `Reverse paid payout ${shortId(batch.id)}?`,
    tone: 'danger',
  },
};

export function payoutActionConfirmHref(
  payoutBatchId: string,
  action: PayoutConfirmationAction,
  currentViewHref = '/payouts',
) {
  const url = new URL(currentViewHref, 'http://admin.local');
  url.searchParams.set('confirm', action);
  url.searchParams.set('payoutBatchId', payoutBatchId);
  return `${url.pathname}?${url.searchParams.toString().replace(/\+/g, '%20')}${url.hash}`;
}

export function readPayoutConfirmationAction(value: string): PayoutConfirmationAction | null {
  if (value === 'failed' || value === 'paid' || value === 'processing' || value === 'reverse') {
    return value;
  }
  return null;
}

export function buildPayoutActionConfirmation(
  batches: readonly AdminPayoutBatch[],
  action: PayoutConfirmationAction | null,
  payoutBatchId: string | null,
  availability: PayoutActionAvailability = {},
  cancelHref = '/payouts',
): PayoutActionConfirmation | null {
  if (!action || !payoutBatchId) {
    return null;
  }

  const batch = batches.find((item) => item.id === payoutBatchId);
  if (!batch) {
    return null;
  }

  const metadata = payoutActionMetadata[action];
  const disabled = Boolean(availability.disabled || availability.disabledReason);

  return {
    action,
    cancelHref,
    confirmLabel: metadata.confirmLabel,
    description: availability.disabledReason
      ? `${metadata.description(batch)} Blocked by server preflight: ${availability.disabledReason}`
      : metadata.description(batch),
    disabled,
    payoutBatchId: batch.id,
    title: metadata.title(batch),
    tone: disabled ? 'neutral' : metadata.tone,
    transferRef: availability.transferRef ?? batch.transferRef ?? '',
  };
}

function payoutTargetContext(batch: AdminPayoutBatch) {
  const partner =
    batch.providerProfile?.displayName ??
    batch.providerProfile?.user?.fullName ??
    'Unknown Partner';
  const phone = batch.providerProfile?.user?.phone ?? 'phone unavailable';
  const bankAccount =
    batch.providerProfile?.bankAccounts?.find(
      (account) => account.id === batch.preflight?.approvedBankAccountId,
    ) ??
    batch.providerProfile?.bankAccounts?.find(
      (account) => account.isPrimary && account.status === 'APPROVED' && !account.deletedAt,
    ) ??
    batch.providerProfile?.bankAccounts?.find((account) => !account.deletedAt);
  const bankLabel = bankAccount
    ? `${bankAccount.bankName} ${bankAccount.accountNumberMasked ?? `ending ${bankAccount.accountNumberLast4 ?? 'unknown'}`}`
    : 'bank account unavailable';
  const maker = operatorLabel(batch.paidCloseoutRequestedBy ?? batch.createdBy) ?? 'not recorded';
  const approver = operatorLabel(batch.approvalAdmin) ?? 'not recorded';

  return `Partner ${partner} (${phone}). Amount ${formatMoney(batch.totalNetAmount, batch.currency)}. Bank ${bankLabel}. Full batch ID ${batch.id}. Current stage ${batch.status}. Transfer reference ${batch.transferRef || 'not recorded'}. Maker ${maker}; approver ${approver}.`;
}

function operatorLabel(operator: AdminPayoutBatch['createdBy']) {
  if (!operator) return null;
  return operator.fullName ?? operator.email ?? operator.id;
}
