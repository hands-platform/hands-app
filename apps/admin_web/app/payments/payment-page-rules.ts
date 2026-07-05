import type { AdminPayment, AdminPaymentCallbackAttempt } from '../../lib/admin-api';
import { formatMoney as money } from '../../lib/admin-format';

type PaymentCashDebtCandidate = {
  readonly method: string;
  readonly booking?: {
    readonly earning?: {
      readonly netAmount?: number;
      readonly status?: string;
    } | null;
  } | null;
};

export type PaymentCallbackMeta = {
  readonly callbackAmount: number | null;
  readonly gatewayTransactionId: string | null;
  readonly mode: string | null;
  readonly providerStatus: string | null;
  readonly rawKeys: readonly string[];
  readonly receivedAt: string | null;
  readonly verified: boolean | null;
};

export function paymentRecordDate(payment: AdminPayment): string | null {
  return payment.booking?.createdAt ?? null;
}

export function paymentStatusIsTerminal(status: string): boolean {
  return status === 'CAPTURED' || status === 'REFUNDED' || status === 'RELEASED';
}

export function paymentPriority(payment: AdminPayment): number {
  if (paymentCallbackNeedsReview(payment)) {
    return 7;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 6;
  }
  if (payment.status === 'AUTHORIZED') {
    return 5;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 4;
  }
  if (payment.status === 'REFUNDED') {
    return 2;
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
    return 1;
  }
  return 3;
}

export function paymentOpsState(payment: AdminPayment): string {
  if (paymentCallbackNeedsReview(payment)) {
    return 'callback-review';
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 'cash-debt';
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED' || payment.status === 'REFUNDED') {
    return 'settled';
  }
  if (payment.status === 'AUTHORIZED') {
    return 'capture';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'collect-cash';
  }
  return 'monitor';
}

export function paymentStateLabel(payment: AdminPayment): string {
  if (paymentCashDebtNeedsSettlement(payment)) {
    return 'Cash collected, partner wallet debt is still unsettled.';
  }
  if (payment.status === 'AUTHORIZED') {
    return 'Hold placed, waiting for service completion.';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'Collect cash when the service starts or completes.';
  }
  if (payment.status === 'CAPTURED') {
    return 'Funds captured successfully.';
  }
  if (payment.status === 'RELEASED') {
    return 'Hold released without capture.';
  }
  if (payment.status === 'REFUNDED') {
    return 'Refund path already started.';
  }
  return 'Monitor payment progression.';
}

export function paymentOpsHint(payment: AdminPayment): string {
  if (paymentCallbackNeedsReview(payment)) {
    const meta = paymentCallbackMeta(payment);
    return `A ${payment.method} callback was received but signature evidence is not verified${
      meta.mode ? ` (${meta.mode})` : ''
    }. Compare gateway reference, amount, and callback status before manual money actions.`;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    const debt = Math.abs(payment.booking?.earning?.netAmount ?? 0);
    return `Cash was collected by the partner. Settle ${money(
      debt,
      payment.currency,
    )} HANDS fee/tax debt from Earnings before final acceptance, service start, or payout release proceeds.`;
  }
  if (payment.status === 'AUTHORIZED') {
    return 'Keep this on hold until the partner completes the service, then capture or refund.';
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return 'Cash booking. Confirm partner arrival and mark the booking complete after payment is collected.';
  }
  if (payment.status === 'REFUNDED') {
    return 'Check the linked refund record and customer communication.';
  }
  if (payment.status === 'RELEASED') {
    return 'Booking did not convert. Confirm the customer sees the hold release.';
  }
  return 'No urgent action required.';
}

export function paymentCashDebtNeedsSettlement(payment: PaymentCashDebtCandidate): boolean {
  const earning = payment.booking?.earning;
  return (
    payment.method === 'CASH' &&
    Boolean(earning) &&
    (earning?.netAmount ?? 0) < 0 &&
    earning?.status !== 'PAID'
  );
}

export function paymentCallbackMeta(payment: AdminPayment): PaymentCallbackMeta {
  const meta = paymentRawMeta(payment);
  const vnpAmount = numberFromUnknown(meta.vnp_Amount);

  return {
    callbackAmount: numberFromUnknown(meta.amount) ?? (vnpAmount ? Math.round(vnpAmount / 100) : null),
    gatewayTransactionId:
      stringFromUnknown(meta.transId) ??
      stringFromUnknown(meta.transactionId) ??
      stringFromUnknown(meta.vnp_TransactionNo) ??
      stringFromUnknown(meta.vnp_TxnRef),
    mode: stringFromUnknown(meta.callbackVerificationMode),
    providerStatus:
      stringFromUnknown(meta.status) ??
      stringFromUnknown(meta.resultCode) ??
      stringFromUnknown(meta.vnp_ResponseCode) ??
      stringFromUnknown(meta.message),
    rawKeys: Object.keys(meta).sort(),
    receivedAt: stringFromUnknown(meta.callbackReceivedAt),
    verified: booleanFromUnknown(meta.callbackSignatureVerified),
  };
}

export function paymentCallbackVerified(payment: AdminPayment): boolean {
  return paymentCallbackMeta(payment).verified === true;
}

export function paymentCallbackNeedsReview(payment: AdminPayment): boolean {
  if (payment.method === 'CASH') {
    return false;
  }
  const callback = paymentCallbackMeta(payment);
  return Boolean(callback.receivedAt) && callback.verified !== true;
}

export function paymentCallbackAttemptNeedsReview(attempt: AdminPaymentCallbackAttempt): boolean {
  if (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') {
    return attempt.signatureVerified !== true;
  }
  return true;
}

export function paymentCallbackAttemptVerified(attempt: AdminPaymentCallbackAttempt): boolean {
  return (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') && attempt.signatureVerified === true;
}

export function paymentCallbackAttemptPill(attempt: AdminPaymentCallbackAttempt): string {
  if (attempt.outcome === 'ACCEPTED' && paymentCallbackAttemptVerified(attempt)) {
    return 'pill-success';
  }
  if (attempt.outcome === 'REPLAY' && paymentCallbackAttemptVerified(attempt)) {
    return 'pill-info';
  }
  if (attempt.outcome === 'CONFLICT') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function paymentRawMeta(payment: AdminPayment): Record<string, unknown> {
  if (!payment.rawMeta || typeof payment.rawMeta !== 'object' || Array.isArray(payment.rawMeta)) {
    return {};
  }
  return Object.fromEntries(Object.entries(payment.rawMeta));
}

function stringFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function booleanFromUnknown(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
