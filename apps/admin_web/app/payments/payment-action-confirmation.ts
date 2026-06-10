import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PaymentConfirmationAction = 'capture' | 'refund' | 'release' | 'sync';

export type PaymentActionConfirmation = {
  readonly action: PaymentConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly paymentId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PaymentActionConfirmationOptions = {
  readonly cancelHref?: string;
};

type PaymentActionRecord = {
  readonly amount: number;
  readonly bookingId: string;
  readonly currency: string;
  readonly id: string;
  readonly providerRef?: string | null;
  readonly status: string;
};

type PaymentActionMetadata = {
  readonly confirmLabel: string;
  readonly disabledReason: (payment: PaymentActionRecord) => string | null;
  readonly enabledDescription: (payment: PaymentActionRecord) => string;
  readonly title: (payment: PaymentActionRecord) => string;
  readonly tone: StatusBadgeTone;
};

const paymentActionMetadata: Record<PaymentConfirmationAction, PaymentActionMetadata> = {
  capture: {
    confirmLabel: 'Capture payment',
    disabledReason: (payment) =>
      terminalPaymentStatus(payment.status)
        ? `Payment is already ${payment.status}; capture is not available.`
        : null,
    enabledDescription: (payment) =>
      `Capture ${formatPaymentAmount(payment)} for booking ${shortId(payment.bookingId)} after service evidence is reviewed.`,
    title: (payment) => `Capture payment ${shortId(payment.id)}?`,
    tone: 'warning',
  },
  refund: {
    confirmLabel: 'Refund payment',
    disabledReason: (payment) =>
      payment.status === 'REFUNDED' || payment.status === 'RELEASED'
        ? `Payment is already ${payment.status}; refund is not available.`
        : null,
    enabledDescription: (payment) =>
      `Start the refund path for ${formatPaymentAmount(payment)} on booking ${shortId(
        payment.bookingId,
      )}. Keep customer, booking, payment, and Partner evidence aligned.`,
    title: (payment) => `Refund payment ${shortId(payment.id)}?`,
    tone: 'danger',
  },
  release: {
    confirmLabel: 'Release hold',
    disabledReason: (payment) =>
      terminalPaymentStatus(payment.status)
        ? `Payment is already ${payment.status}; release is not available.`
        : null,
    enabledDescription: (payment) =>
      `Release the authorization hold for ${formatPaymentAmount(payment)} on booking ${shortId(payment.bookingId)}.`,
    title: (payment) => `Release payment ${shortId(payment.id)}?`,
    tone: 'warning',
  },
  sync: {
    confirmLabel: 'Sync payment',
    disabledReason: (payment) => (!payment.providerRef ? 'Gateway reference is missing; sync is not available.' : null),
    enabledDescription: (payment) =>
      `Sync gateway reference ${payment.providerRef} before manual money actions on booking ${shortId(
        payment.bookingId,
      )}.`,
    title: (payment) => `Sync payment ${shortId(payment.id)}?`,
    tone: 'info',
  },
};

export function paymentActionConfirmHref(paymentId: string, action: PaymentConfirmationAction) {
  return `/payments?confirm=${action}&paymentId=${encodeURIComponent(paymentId)}`;
}

export function readPaymentConfirmationAction(value: string): PaymentConfirmationAction | null {
  if (value === 'capture' || value === 'refund' || value === 'release' || value === 'sync') {
    return value;
  }
  return null;
}

export function buildPaymentActionConfirmation(
  payments: readonly PaymentActionRecord[],
  action: PaymentConfirmationAction | null,
  paymentId: string,
  options: PaymentActionConfirmationOptions = {},
): PaymentActionConfirmation | null {
  if (!action) {
    return null;
  }

  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) {
    return null;
  }

  const metadata = paymentActionMetadata[action];
  const disabledReason = metadata.disabledReason(payment);

  return {
    action,
    cancelHref: options.cancelHref ?? '/payments',
    confirmLabel: metadata.confirmLabel,
    description: disabledReason ?? metadata.enabledDescription(payment),
    disabled: Boolean(disabledReason),
    paymentId: payment.id,
    title: metadata.title(payment),
    tone: disabledReason ? 'neutral' : metadata.tone,
  };
}

function terminalPaymentStatus(status: string) {
  return status === 'CAPTURED' || status === 'REFUNDED' || status === 'RELEASED';
}

function formatPaymentAmount(payment: PaymentActionRecord) {
  return `${payment.amount} ${payment.currency}`;
}
