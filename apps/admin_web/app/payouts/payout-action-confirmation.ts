import type { AdminPayoutBatch } from '../../lib/admin-api';
import { formatMoney, shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PayoutConfirmationAction = 'failed' | 'paid' | 'processing';

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
    confirmLabel: 'Mark failed',
    description: (batch) =>
      `Mark payout batch ${shortId(batch.id)} as failed so finance can preserve the transfer failure before retry or rebuild.`,
    title: (batch) => `Mark payout ${shortId(batch.id)} failed?`,
    tone: 'danger',
  },
  paid: {
    confirmLabel: 'Mark paid',
    description: (batch) =>
      `Mark ${formatMoney(batch.totalNetAmount, batch.currency)} payout batch ${shortId(
        batch.id,
      )} as paid after transfer reference, tax, earnings, and Partner checks are clean.`,
    title: (batch) => `Mark payout ${shortId(batch.id)} paid?`,
    tone: 'warning',
  },
  processing: {
    confirmLabel: 'Start processing',
    description: (batch) =>
      `Move payout batch ${shortId(batch.id)} into processing after finance review is complete.`,
    title: (batch) => `Start payout ${shortId(batch.id)} processing?`,
    tone: 'info',
  },
};

export function payoutActionConfirmHref(payoutBatchId: string, action: PayoutConfirmationAction) {
  return `/payouts?confirm=${action}&payoutBatchId=${encodeURIComponent(payoutBatchId)}`;
}

export function readPayoutConfirmationAction(value: string): PayoutConfirmationAction | null {
  if (value === 'failed' || value === 'paid' || value === 'processing') {
    return value;
  }
  return null;
}

export function buildPayoutActionConfirmation(
  batches: readonly AdminPayoutBatch[],
  action: PayoutConfirmationAction | null,
  payoutBatchId: string,
  availability: PayoutActionAvailability = {},
): PayoutActionConfirmation | null {
  if (!action) {
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
    cancelHref: '/payouts',
    confirmLabel: metadata.confirmLabel,
    description: availability.disabledReason ?? metadata.description(batch),
    disabled,
    payoutBatchId: batch.id,
    title: metadata.title(batch),
    tone: disabled ? 'neutral' : metadata.tone,
    transferRef: availability.transferRef ?? batch.transferRef ?? '',
  };
}
