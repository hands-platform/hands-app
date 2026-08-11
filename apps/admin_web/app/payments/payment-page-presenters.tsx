import type { ReactNode } from 'react';

import { AdminTextLink } from '../../components/admin-text-link';
import type { StatusBadgeTone } from '../../components/status-badge';
import type {
  AdminPayment,
  AdminPaymentActionDecision,
  AdminPaymentEvidenceSummary,
} from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { capturePayment, refundPayment, releasePayment, syncPayment } from './actions';
import {
  paymentActionConfirmHref,
  type PaymentConfirmationAction,
} from './payment-action-confirmation';
import type { PaymentOperationsTableRow } from './payment-operations-table-section';

export function buildPaymentOperationsTableRows(
  payments: readonly AdminPayment[],
  returnTo = '/payments',
): PaymentOperationsTableRow[] {
  return payments.map((payment) => {
    const primaryDecision = payment.primaryAction ?? payment.actionDecisions?.find(
      (decision) => decision.recommended && decision.state !== 'BLOCKED',
    ) ?? null;
    const history = payment.primaryQueue?.startsWith('history-') ?? false;
    const primaryAction = primaryDecision
      ? decisionLink(payment.id, primaryDecision, returnTo)
      : payment.primaryQueue === 'cash-debt' && payment.booking?.earning?.id
        ? <AdminTextLink href={cashSettlementHref(payment.booking.earning.id)}>Review cash evidence</AdminTextLink>
        : history
          ? <span className="muted">No action</span>
          : <AdminTextLink href={paymentDetailHref(payment.id, returnTo)}>Review evidence</AdminTextLink>;
    const evidence = paymentEvidenceDisplay(payment, history);

    return {
      amount: payment.amount,
      bookingCreatedAt: payment.booking?.createdAt ?? null,
      bookingHref: `/bookings/${payment.bookingId}`,
      bookingId: payment.bookingId,
      bookingIdLabel: shortId(payment.bookingId),
      bookingStatus: payment.booking?.status ?? 'UNKNOWN',
      currency: payment.currency,
      customerLabel:
        payment.booking?.customerProfile?.user?.fullName ||
        payment.booking?.customerProfile?.user?.phone ||
        'Unknown customer',
      bookingUpdatedAt: payment.booking?.updatedAt ?? payment.booking?.createdAt ?? null,
      decisionLabel: history
        ? 'No action · History'
        : primaryDecision ? actionLabel(primaryDecision.action) : primaryQueueLabel(payment.primaryQueue),
      decisionReason: primaryDecision?.reason ?? primaryQueueReason(payment.primaryQueue),
      decisionTone: history ? 'neutral' : primaryDecision ? decisionTone(primaryDecision) : queueTone(payment.primaryQueue),
      evidenceLabel: evidence.label,
      evidenceReason: evidence.reason,
      evidenceTone: evidence.tone,
      id: payment.id,
      method: payment.method,
      partnerLabel:
        payment.booking?.selectedProvider?.displayName ||
        'No Partner selected',
      paymentHref: paymentDetailHref(payment.id, returnTo),
      paymentIdLabel: shortId(payment.id),
      primaryAction,
      providerRef: payment.providerRef ?? 'No gateway reference',
      status: payment.status,
    };
  });
}

export function paymentConfirmationAction(action: PaymentConfirmationAction) {
  switch (action) {
    case 'capture': return capturePayment;
    case 'refund': return refundPayment;
    case 'release': return releasePayment;
    case 'sync': return syncPayment;
  }
}

function decisionLink(paymentId: string, decision: AdminPaymentActionDecision, returnTo: string): ReactNode {
  const action = decisionAction(decision.action);
  return (
    <AdminTextLink href={paymentActionConfirmHref(paymentId, action, returnTo)}>
      {actionLabel(decision.action)}
    </AdminTextLink>
  );
}

function decisionAction(action: AdminPaymentActionDecision['action']): PaymentConfirmationAction {
  if (action === 'CAPTURE') return 'capture';
  if (action === 'RELEASE') return 'release';
  if (action === 'REQUEST_REFUND') return 'refund';
  return 'sync';
}

function actionLabel(action: AdminPaymentActionDecision['action']) {
  if (action === 'CAPTURE') return 'Capture payment';
  if (action === 'RELEASE') return 'Release authorization';
  if (action === 'REQUEST_REFUND') return 'Request refund review';
  return 'Sync gateway status';
}

function decisionTone(decision: AdminPaymentActionDecision): StatusBadgeTone {
  if (decision.action === 'REQUEST_REFUND') return 'danger';
  if (decision.action === 'SYNC') return 'info';
  return decision.recommended ? 'warning' : 'neutral';
}

function evidenceTone(state: AdminPaymentEvidenceSummary['state'] | undefined): StatusBadgeTone {
  if (state === 'VERIFIED') return 'success';
  if (state === 'CONFLICT') return 'danger';
  if (state === 'MISSING') return 'warning';
  return 'neutral';
}

function paymentEvidenceDisplay(payment: AdminPayment, history: boolean) {
  if (history && (!payment.evidence || ['MISSING', 'NOT_APPLICABLE'].includes(payment.evidence.state))) {
    return {
      label: 'Not recorded',
      reason: 'No current money action depends on this historical evidence field.',
      tone: 'neutral' as const,
    };
  }
  return {
    label: payment.evidence?.label ?? 'Unavailable',
    reason: payment.evidence?.reason ?? 'Payment evidence was not returned by the API.',
    tone: evidenceTone(payment.evidence?.state),
  };
}

function primaryQueueLabel(queue: AdminPayment['primaryQueue']) {
  if (queue === 'evidence-conflict') return 'Review evidence conflict';
  if (queue === 'missing-gateway-evidence') return 'Gateway evidence required';
  if (queue === 'terminal-cash-cleanup') return 'Review terminal cash record';
  if (queue === 'completed-authorization-blocked') return 'Capture blocked';
  if (queue === 'failed-active') return 'Review failed active payment';
  if (queue === 'cash-debt') return 'Review cash debt evidence';
  if (queue === 'active-cash') return 'Monitor active cash';
  return 'Review payment';
}

function primaryQueueReason(queue: AdminPayment['primaryQueue']) {
  if (queue === 'evidence-conflict') return 'Gateway signature, outcome, or amount evidence conflicts.';
  if (queue === 'terminal-cash-cleanup') return 'The booking is terminal but the cash payment record is still pending.';
  if (queue === 'completed-authorization-blocked') return 'The booking completed, but retained evidence does not permit capture.';
  if (queue === 'cash-debt') return 'Use Cash Settlements and retained bank deposit evidence; Payments cannot mark debt paid.';
  return 'Open the payment detail to review the current server decision.';
}

function queueTone(queue: AdminPayment['primaryQueue']): StatusBadgeTone {
  if (queue === 'evidence-conflict' || queue === 'failed-active') return 'danger';
  if (queue === 'missing-gateway-evidence' || queue === 'terminal-cash-cleanup' || queue === 'completed-authorization-blocked' || queue === 'cash-debt') return 'warning';
  if (queue === 'active-cash') return 'info';
  return 'neutral';
}

function cashSettlementHref(earningId: string) {
  const encoded = encodeURIComponent(earningId);
  return `/cash-settlements?review=${encoded}&q=${encoded}`;
}

function paymentDetailHref(paymentId: string, returnTo: string) {
  return `/payments/${encodeURIComponent(paymentId)}?returnTo=${encodeURIComponent(returnTo)}`;
}
