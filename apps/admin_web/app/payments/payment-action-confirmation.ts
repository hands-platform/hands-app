import { randomUUID } from 'node:crypto';

import type { AdminPaymentActionDecision, AdminPaymentEvidenceSummary } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PaymentConfirmationAction = 'capture' | 'refund' | 'release' | 'sync';

export type PaymentActionConfirmation = {
  readonly action: PaymentConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly idempotencyKey: string;
  readonly paymentId: string;
  readonly policyVersion: string;
  readonly reasonRequired: boolean;
  readonly returnTo: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PaymentActionConfirmationOptions = {
  readonly returnTo?: string;
};

type PaymentActionRecord = {
  readonly actionDecisions?: readonly AdminPaymentActionDecision[];
  readonly amount: number;
  readonly bookingId: string;
  readonly currency: string;
  readonly evidence?: AdminPaymentEvidenceSummary;
  readonly evaluatedAt?: string;
  readonly id: string;
  readonly method?: string;
  readonly providerRef?: string | null;
  readonly status?: string;
  readonly booking?: { readonly status?: string | null } | null;
};

const ACTION_METADATA: Record<PaymentConfirmationAction, {
  readonly apiAction: AdminPaymentActionDecision['action'];
  readonly confirmLabel: string;
  readonly tone: StatusBadgeTone;
}> = {
  capture: { apiAction: 'CAPTURE', confirmLabel: 'Capture payment', tone: 'warning' },
  refund: { apiAction: 'REQUEST_REFUND', confirmLabel: 'Request refund review', tone: 'danger' },
  release: { apiAction: 'RELEASE', confirmLabel: 'Release authorization', tone: 'warning' },
  sync: { apiAction: 'SYNC', confirmLabel: 'Sync gateway status', tone: 'info' },
};

export function paymentActionConfirmHref(
  paymentId: string,
  action: PaymentConfirmationAction,
  returnTo = '/payments',
) {
  const params = new URLSearchParams({
    confirm: action,
    paymentId,
    returnTo: paymentReturnTo(returnTo),
  });
  return `/payments?${params.toString()}`;
}

export function readPaymentConfirmationAction(value: string): PaymentConfirmationAction | null {
  return value === 'capture' || value === 'refund' || value === 'release' || value === 'sync'
    ? value
    : null;
}

export function buildPaymentActionConfirmation(
  payments: readonly PaymentActionRecord[],
  action: PaymentConfirmationAction | null,
  paymentId: string,
  options: PaymentActionConfirmationOptions = {},
): PaymentActionConfirmation | null {
  if (!action) return null;
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) return null;

  const metadata = ACTION_METADATA[action];
  const decision = payment.actionDecisions?.find((item) => item.action === metadata.apiAction);
  const disabled = !decision || decision.state === 'BLOCKED';
  const returnTo = paymentReturnTo(options.returnTo);
  const evidenceLabel = payment.evidence
    ? ` Evidence: ${payment.evidence.label}. ${payment.evidence.reason}`
    : '';

  return {
    action,
    cancelHref: returnTo,
    confirmLabel: metadata.confirmLabel,
    description: decision
      ? `${decision.reason}${evidenceLabel} Amount: ${formatPaymentAmount(payment)}. Booking: ${shortId(payment.bookingId)}.`
      : 'The server did not return an action decision. Reload this payment before attempting a money action.',
    disabled,
    facts: paymentConfirmationFacts(payment, decision, action),
    idempotencyKey: `payments:${action}:${payment.id}:${randomUUID()}`,
    paymentId: payment.id,
    policyVersion: decision?.policyVersion ?? 'unavailable',
    reasonRequired: action !== 'sync',
    returnTo,
    title: `${metadata.confirmLabel} for ${shortId(payment.id)}?`,
    tone: disabled ? 'neutral' : metadata.tone,
  };
}

function paymentConfirmationFacts(
  payment: PaymentActionRecord,
  decision: AdminPaymentActionDecision | undefined,
  action: PaymentConfirmationAction,
) {
  const beforePayment = payment.status ?? 'Unknown';
  const bookingStatus = payment.booking?.status ?? 'Unknown';
  return [
    { label: 'Payment ID', value: payment.id },
    { label: 'Booking ID', value: payment.bookingId },
    { label: 'Amount / method', value: `${formatPaymentAmount(payment)} · ${payment.method?.replaceAll('_', ' ') ?? 'Unknown method'}` },
    { label: 'Before', value: `Payment ${beforePayment} · Booking ${bookingStatus}` },
    { label: 'Expected after', value: expectedPaymentActionResult(action, beforePayment, bookingStatus) },
    { label: 'Gateway reference', value: payment.providerRef ?? 'Not recorded' },
    { label: 'Evidence', value: payment.evidence ? `${payment.evidence.label} · ${payment.evidence.reason}` : 'Unavailable' },
    { label: 'Evidence verified', value: payment.evidence?.verifiedAt ?? 'Not recorded' },
    { label: 'Required evidence', value: decision?.requiredEvidence.join(', ') || 'None specified' },
    { label: 'Policy', value: decision?.policyVersion ?? 'Unavailable' },
    { label: 'Policy evaluated', value: payment.evaluatedAt ?? 'Not recorded' },
    { label: 'Actor', value: 'Current signed-in Admin · recorded by the server' },
  ];
}

function expectedPaymentActionResult(
  action: PaymentConfirmationAction,
  paymentStatus: string,
  bookingStatus: string,
) {
  if (action === 'capture') return `Payment CAPTURED · Booking ${bookingStatus}`;
  if (action === 'release') return `Payment RELEASED · Booking ${bookingStatus}`;
  if (action === 'refund') return `Payment ${paymentStatus} · Refund review requested`;
  return `Payment and gateway status rechecked · Booking ${bookingStatus}`;
}

export function paymentReturnTo(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/payments')) return '/payments';
  try {
    const url = new URL(value, 'http://admin.local');
    if (!/^\/payments(?:\/[^/]+)?$/.test(url.pathname)) return '/payments';
    url.searchParams.delete('confirm');
    url.searchParams.delete('paymentId');
    if (url.pathname === '/payments') {
      url.searchParams.delete('returnTo');
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return '/payments';
  }
}

function formatPaymentAmount(payment: PaymentActionRecord) {
  return `${payment.amount.toLocaleString('en-US')} ${payment.currency}`;
}
