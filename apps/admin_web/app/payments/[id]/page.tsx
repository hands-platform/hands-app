import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { AdminDataTable } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminMetricGrid, AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminStageItem, AdminStageList } from '../../../components/admin-stage-item';
import { AdminDetailGrid, AdminDisclosure, AdminErrorState } from '../../../components/admin-surface';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge } from '../../../components/status-badge';
import {
  compactValue,
  readPlainRecord,
  shortId,
} from '../../../lib/admin-format';
import {
  AdminAuditLog,
  AdminChatMessage,
  AdminPaymentCallbackAttempt,
  AdminPaymentDetail,
  adminGetResult,
} from '../../../lib/admin-api';
import { readSearchParam } from '../../../lib/date-range';
import { capturePayment, refundPayment, releasePayment, syncPayment } from '../actions';
import {
  type PaymentConfirmationAction,
  buildPaymentActionConfirmation,
  paymentReturnTo,
  readPaymentConfirmationAction,
} from '../payment-action-confirmation';
import { PaymentActionConfirmationSummary } from '../payment-action-confirmation-summary';
import { paymentProviderReferenceCopy } from '../payment-method-copy';
import { PaymentDetailActionMapSection } from './payment-detail-action-map-section';
import {
  PaymentDetailCallbackTimelineSection,
  type PaymentDetailCallbackTimelineRow,
} from './payment-detail-callback-timeline-section';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { id } = await params;
  return {
    title: { absolute: `Payment ${shortId(id)} | HANDS Admin` },
  };
}

export default async function PaymentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const paymentResult = await adminGetResult<AdminPaymentDetail | null>(`/admin/payments/${id}`, null);

  if (!paymentResult.ok && paymentResult.status === 404) {
    notFound();
  }
  if (!paymentResult.ok || !paymentResult.data) {
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href="/payments">Back to payments</AdminFormControlLink>}
        description={`Payment ${shortId(id)}`}
        title="Payment operation detail"
      >
        <AdminErrorState
          action={<AdminTextLink href={`/payments/${encodeURIComponent(id)}`}>Retry payment detail</AdminTextLink>}
          message="Payment evidence and action decisions could not be loaded. No payment action is available from fallback data."
          title="Payment detail unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const payment = paymentResult.data;

  const booking = payment.booking;
  const earning = booking?.earning;
  const callbacks = sortCallbackAttempts(payment.callbackAttempts ?? []);
  const messages = [...(booking?.chatRoom?.messages ?? [])].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
  const callbackTimelineRows = buildPaymentDetailCallbackTimelineRows(callbacks, payment.currency);
  const callbackReviewCount = callbacks.filter(paymentCallbackAttemptNeedsReview).length;
  const acceptedCallbackCount = callbacks.filter(paymentCallbackAttemptVerified).length;
  const cashDebt = paymentCashDebtNeedsSettlement(payment);
  const serviceLabel = bookingServiceLabel(payment);
  const bookingAddress = bookingAddressLabel(payment);
  const auditRows = payment.auditLogs ?? [];
  const activeRefund = paymentActiveRefund(payment);
  const visibleDecisions = (payment.actionDecisions ?? []).filter(
    (decision) => !(activeRefund && decision.action === 'REQUEST_REFUND'),
  );
  const listReturnTo = paymentReturnTo(readSearchParam(query.returnTo));
  const detailReturnTo = paymentDetailHref(payment.id, listReturnTo);
  const requestedAction = readPaymentConfirmationAction(readSearchParam(query.confirm));
  const confirmation = buildPaymentActionConfirmation(
    [payment],
    activeRefund && requestedAction === 'refund' ? null : requestedAction,
    payment.id,
    { returnTo: detailReturnTo },
  );

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href={listReturnTo}>
            Back to payments
          </AdminFormControlLink>
          {booking?.id ? (
            <AdminTextLink href={`/bookings/${booking.id}`}>
              Open booking
            </AdminTextLink>
          ) : null}
          {booking?.customerProfile?.id ? (
            <AdminTextLink href={`/customers/${booking.customerProfile.id}`}>
              Open customer
            </AdminTextLink>
          ) : null}
          {booking?.selectedProvider?.id ? (
            <AdminTextLink href={`/partners/${booking.selectedProvider.id}`}>
              Open partner
            </AdminTextLink>
          ) : null}
          {booking?.chatRoom?.id ? (
            <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
              Open chat archive
            </AdminTextLink>
          ) : null}
        </>
      }
      description={`Payment ${shortId(payment.id)} - ${payment.method} - ${payment.status}`}
      title="Payment operation detail"
    >
      <PaymentDetailActionMapSection
        actionLabel={`Payment detail actions for ${shortId(payment.id)}`}
        actions={paymentDetailActionMenuItems(payment, detailReturnTo, activeRefund)}
        activeRefund={activeRefund ? {
          href: activeRefundHref(activeRefund.id),
          id: activeRefund.id,
          status: activeRefund.status,
        } : null}
        bookingStatus={booking?.status ?? 'NOT_LINKED'}
        cashDebtSettlementForm={cashDebt && earning?.id ? <CashDebtEvidenceLinks payment={payment} /> : null}
        confirmation={
          confirmation ? (
            <ConfirmDialog
              action={paymentConfirmationAction(confirmation.action)}
              cancelHref={confirmation.cancelHref}
              confirmLabel={confirmation.confirmLabel}
              description={<PaymentActionConfirmationSummary confirmation={confirmation} />}
              disabled={confirmation.disabled}
              hiddenInputs={[
                { name: 'paymentId', value: confirmation.paymentId },
                { name: 'idempotencyKey', value: confirmation.idempotencyKey },
                { name: 'returnTo', value: confirmation.returnTo },
                { name: 'policyVersion', value: confirmation.policyVersion },
              ]}
              id={`payment-detail-${confirmation.action}-${confirmation.paymentId}`}
              textInputs={confirmation.reasonRequired ? [{
                label: 'Operator reason',
                maxLength: 500,
                minLength: 12,
                name: 'reason',
                placeholder: 'Describe the booking and payment evidence reviewed',
                required: true,
              }] : undefined}
              title={confirmation.title}
              tone={confirmation.tone}
            />
          ) : null
        }
        decisions={visibleDecisions}
        evidence={payment.evidence}
        evaluatedAt={payment.evaluatedAt}
        paymentStatus={payment.status}
      />

      <AdminMetricGrid
        className="admin-mb-16"
        metrics={[
          {
            helper: paymentStatusHint(payment),
            kind: 'record',
            label: 'Payment status',
            scope: 'Payment record',
            value: payment.status,
          },
          {
            helper: gatewayReferenceLabel(payment),
            kind: 'record',
            label: 'Method',
            scope: 'Payment record',
            value: payment.method,
          },
          {
            helper: serviceLabel,
            kind: 'record',
            label: 'Amount',
            scope: 'Payment record',
            value: paymentMoney(payment.amount, payment.currency),
          },
          {
            helper: bookingAddress,
            kind: 'record',
            label: 'Booking',
            scope: 'Payment record',
            value: booking?.status ?? 'Not linked',
          },
          {
            label: 'Callbacks',
            value: `${callbacks.length} attempt(s)`,
            kind: callbackReviewCount ? 'risk' : 'record',
            scope: callbackReviewCount ? 'Needs action' : 'Gateway records',
            helper: `${callbackReviewCount} review item(s)`,
          },
          {
            label: 'Accepted callbacks',
            value: `${acceptedCallbackCount}`,
            kind: 'record',
            scope: 'Gateway records',
            helper: 'Accepted or replayed with verified signature.',
          },
          cashFeeMetric(payment, cashDebt),
          {
            label: 'Audit trail',
            value: `${auditRows.length} event(s)`,
            kind: 'record',
            scope: 'Audit records',
            helper: 'Payment and linked booking operation logs.',
          },
        ]}
      />

      <PaymentDetailCallbackTimelineSection reviewCount={callbackReviewCount} rows={callbackTimelineRows} />

      <AdminDetailGrid className="admin-mb-16">
        <AdminTablePanel
          description="Booking, customer, partner, address, service, and chat evidence attached to this payment."
          id="booking-evidence"
          resultLabel={booking ? 'Linked booking' : 'No booking'}
          resultTone={booking ? 'info' : 'warning'}
          title="Linked booking evidence"
        >
          <AdminStageList>
            <EvidenceRow label="Booking" value={booking?.id ?? 'Not linked'} helper={booking?.status ?? 'No booking status'} />
            <EvidenceRow label="Customer" value={customerLabel(payment)} helper={booking?.customerProfile?.user?.phone ?? 'No customer phone'} />
            <EvidenceRow label="Partner" value={partnerLabel(payment)} helper={booking?.selectedProvider?.user?.phone ?? 'No selected partner phone'} />
            <EvidenceRow label="Address" value={bookingAddress} helper={bookingCoordinateLabel(payment)} />
            <EvidenceRow label="Service" value={serviceLabel} helper={bookingServicePriceLabel(payment)} />
            <EvidenceRow label="Chat" value={booking?.chatRoom ? `${messages.length} message(s)` : 'No room'} helper="Admin keeps chat evidence after service completion." />
          </AdminStageList>
        </AdminTablePanel>

        <AdminTablePanel
          description="Money movement facts for gross, HANDS fee, withholding, partner net, earning state, and refund rows."
          id="money-ledger"
          resultLabel={paymentMoney(payment.amount, payment.currency)}
          resultTone={cashDebt ? 'warning' : 'info'}
          title="Money ledger"
        >
          <AdminStageList>
            <EvidenceRow label="Gross" value={paymentMoney(earning?.grossAmount ?? payment.amount, payment.currency)} helper="Customer payment amount or earning gross amount." />
            <EvidenceRow label="HANDS fee" value={paymentMoney(earning?.platformFee, earning?.currency ?? payment.currency)} helper="Configured service fee snapshot." />
            <EvidenceRow label="Withholding" value={paymentMoney(earning?.withholdingAmount, earning?.currency ?? payment.currency)} helper="Tax withholding saved by current policy." />
            <EvidenceRow label="Partner net" value={paymentMoney(earning?.netAmount, earning?.currency ?? payment.currency)} helper={cashDebt ? 'Negative wallet debt must be cleared before final acceptance, service start, or payout release.' : 'Net amount is not blocking final acceptance, service start, or payout release.'} />
            <EvidenceRow label="Earning state" value={earning?.status ?? 'No earning'} helper={earning?.settlementRef ?? 'No settlement reference'} />
            <EvidenceRow label="Refund rows" value={`${payment.refunds?.length ?? 0}`} helper={refundSummary(payment)} />
          </AdminStageList>
        </AdminTablePanel>
      </AdminDetailGrid>

      <AdminTablePanel
        description="Matched bookings should have chat evidence. Operators use this before cancellation, no-show, refund, or payout decisions."
        id="chat-payment-evidence"
        resultLabel={messages.length ? 'Chat retained' : 'No chat messages'}
        resultTone={messages.length ? 'success' : 'warning'}
        title="Chat and operation evidence"
      >
        <AdminStageList>
          {messages.slice(-8).map((message) => (
            <ChatEvidenceRow message={message} key={message.id} />
          ))}
          {messages.length === 0 ? (
            <AdminStageItem>
              <StatusBadge tone="warning">Chat</StatusBadge>
              <div>
                <AdminEmptyState
                  message="Check booking stage before money or outcome decisions."
                  title="No retained messages"
                />
              </div>
            </AdminStageItem>
          ) : null}
        </AdminStageList>
      </AdminTablePanel>

      <AdminTablePanel
        description="Admin actions tied to this payment or linked booking."
        id="payment-audit-log"
        resultLabel={`${auditRows.length} event(s)`}
        resultTone={auditRows.length ? 'info' : 'warning'}
        title="Payment audit trail"
      >
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No admin audit event has been captured for this payment yet."
          headers={['Time', 'Action', 'Actor', 'Target', 'Evidence']}
          rowCount={auditRows.length}
        >
          {auditRows.map((row) => (
            <AuditRow row={row} key={row.id} />
          ))}
        </AdminDataTable>
      </AdminTablePanel>
    </AdminPageTemplate>
  );
}

function EvidenceRow({ label, value, helper }: { label: string; value: ReactNode; helper: ReactNode }) {
  return (
    <AdminStageItem>
      <StatusBadge tone="info">{label}</StatusBadge>
      <div>
        <strong>{value}</strong>
        <p className="muted">{helper}</p>
      </div>
    </AdminStageItem>
  );
}

function paymentDetailActionMenuItems(
  payment: AdminPaymentDetail,
  returnTo: string,
  activeRefund: NonNullable<AdminPaymentDetail['refunds']>[number] | null,
) {
  const actions = (payment.actionDecisions ?? [])
    .filter((decision) => !(activeRefund && decision.action === 'REQUEST_REFUND'))
    .map((decision) => {
    const action = paymentDecisionAction(decision.action);
    return {
      kind: 'link' as const,
      href: paymentDetailActionConfirmHref(payment.id, action, returnTo),
      label: paymentDecisionLabel(decision.action),
      disabled: decision.state === 'BLOCKED',
      description: decision.reason,
      tone: action === 'refund' ? 'danger' as const : action === 'sync' ? 'info' as const : 'warning' as const,
    };
    });

  return activeRefund
    ? [{
        kind: 'link' as const,
        href: activeRefundHref(activeRefund.id),
        label: 'Open active refund',
        description: `Refund ${activeRefund.id} · ${activeRefund.status}`,
        tone: 'info' as const,
      }, ...actions]
    : actions;
}

function paymentActiveRefund(payment: AdminPaymentDetail) {
  const activeStatuses = new Set(['REQUESTED', 'PROVIDER_PROCESSING', 'GATEWAY_CONFIRMED']);
  return [...(payment.refunds ?? [])]
    .filter((refund) => activeStatuses.has(refund.status.toUpperCase()))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function activeRefundHref(refundId: string) {
  const search = new URLSearchParams({ q: refundId, range: 'all', review: 'open', sort: 'oldest' });
  return `/refunds?${search.toString()}#refund-${encodeURIComponent(refundId)}`;
}

function paymentMoney(amount?: number | null, currency = 'VND') {
  return <MoneyText amount={amount} currency={currency} />;
}

function paymentDetailActionConfirmHref(paymentId: string, action: PaymentConfirmationAction, returnTo: string) {
  const url = new URL(paymentDetailHref(paymentId, paymentReturnTo(readDetailListReturnTo(returnTo))), 'http://admin.local');
  url.searchParams.set('confirm', action);
  url.searchParams.set('paymentId', paymentId);
  return `${url.pathname}${url.search}`;
}

function paymentConfirmationAction(action: PaymentConfirmationAction) {
  switch (action) {
    case 'capture':
      return capturePayment;
    case 'refund':
      return refundPayment;
    case 'release':
      return releasePayment;
    case 'sync':
      return syncPayment;
  }
}

function paymentDetailHref(paymentId: string, returnTo: string) {
  const params = new URLSearchParams({ returnTo });
  return `/payments/${encodeURIComponent(paymentId)}?${params.toString()}`;
}

function readDetailListReturnTo(returnTo: string) {
  try {
    const url = new URL(returnTo, 'http://admin.local');
    return url.searchParams.get('returnTo') ?? '/payments';
  } catch {
    return '/payments';
  }
}

function paymentDecisionAction(action: NonNullable<AdminPaymentDetail['actionDecisions']>[number]['action']): PaymentConfirmationAction {
  if (action === 'CAPTURE') return 'capture';
  if (action === 'RELEASE') return 'release';
  if (action === 'REQUEST_REFUND') return 'refund';
  return 'sync';
}

function paymentDecisionLabel(action: NonNullable<AdminPaymentDetail['actionDecisions']>[number]['action']) {
  if (action === 'CAPTURE') return 'Capture payment';
  if (action === 'RELEASE') return 'Release authorization';
  if (action === 'REQUEST_REFUND') return 'Request refund review';
  return 'Sync gateway status';
}

function CashDebtEvidenceLinks({ payment }: { payment: AdminPaymentDetail }) {
  const earning = payment.booking?.earning;
  if (!earning) {
    return null;
  }
  const earningId = encodeURIComponent(earning.id);
  const partnerId = payment.booking?.selectedProvider?.id;
  return (
    <div className="payment-cash-evidence-links admin-mt-16">
      <strong>Cash debt must be cleared from retained bank evidence.</strong>
      <span>Payments does not mark Partner cash debt paid directly.</span>
      <div>
        <AdminTextLink href={`/cash-settlements?review=${earningId}&q=${earningId}`}>
          Review exact earning in Cash Settlements
        </AdminTextLink>
        {partnerId ? (
          <AdminTextLink href={`/finance-tax/partner-bank-deposits?q=${encodeURIComponent(partnerId)}`}>
            Search Partner deposit evidence
          </AdminTextLink>
        ) : null}
      </div>
    </div>
  );
}

function sortCallbackAttempts(attempts: AdminPaymentCallbackAttempt[]) {
  return [...attempts].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function paymentCallbackAttemptNeedsReview(attempt: AdminPaymentCallbackAttempt) {
  if (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') {
    return attempt.signatureVerified !== true;
  }
  return true;
}

function paymentCallbackAttemptVerified(attempt: AdminPaymentCallbackAttempt) {
  return (attempt.outcome === 'ACCEPTED' || attempt.outcome === 'REPLAY') && attempt.signatureVerified === true;
}

function paymentCallbackAttemptPill(attempt: AdminPaymentCallbackAttempt) {
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

function paymentCashDebtNeedsSettlement(payment: AdminPaymentDetail) {
  const earning = payment.booking?.earning;
  return payment.method === 'CASH' && Boolean(earning) && (earning?.netAmount ?? 0) < 0 && earning?.status !== 'PAID';
}

function paymentStatusHint(payment: AdminPaymentDetail) {
  if (payment.status === 'AUTHORIZED') {
    return 'Hold active. Capture only after completed service evidence.';
  }
  if (payment.status === 'CAPTURED') {
    return 'Funds captured. Refund decisions need admin evidence.';
  }
  if (payment.status === 'RELEASED') {
    return 'Authorization released without capture.';
  }
  if (payment.status === 'REFUNDED') {
    return 'Refund path already started.';
  }
  if (payment.method === 'CASH') {
    return 'Cash is collected outside gateway. Check partner fee debt.';
  }
  return 'Monitor gateway and booking state.';
}

function gatewayReferenceLabel(payment: AdminPaymentDetail) {
  const reference = paymentProviderReferenceCopy(payment.method, payment.providerRef);
  return payment.providerRef ? `Gateway ref ${reference}` : reference;
}

function cashFeeMetric(payment: AdminPaymentDetail, cashDebt: boolean) {
  if (payment.method !== 'CASH') {
    return {
      helper: 'Cash collection and Partner fee settlement do not apply to this payment method.',
      kind: 'record' as const,
      label: 'Cash fee gate',
      scope: 'Not applicable',
      value: 'N/A',
    };
  }
  return {
    helper: cashDebtHint(payment),
    kind: cashDebt ? 'risk' as const : 'record' as const,
    label: 'Cash fee gate',
    scope: cashDebt ? 'Needs action' : 'Payment record',
    value: cashDebt ? 'Blocked' : 'Clear',
  };
}

function cashDebtHint(payment: AdminPaymentDetail) {
  if (!paymentCashDebtNeedsSettlement(payment)) {
    return 'No negative partner wallet gate from this payment.';
  }
  const amount = Math.abs(payment.booking?.earning?.netAmount ?? 0);
  return <>Partner owes <MoneyText amount={amount} currency={payment.currency} /> before final acceptance, service start, or payout release.</>;
}

function buildPaymentDetailCallbackTimelineRows(
  callbacks: readonly AdminPaymentCallbackAttempt[],
  currency: string,
): PaymentDetailCallbackTimelineRow[] {
  return callbacks.map((attempt) => ({
    amount: attempt.callbackAmount ?? null,
    createdAt: attempt.createdAt ?? null,
    currency,
    errorCodeLabel: attempt.errorCode ?? 'No error',
    errorMessage: attempt.errorMessage ?? 'Callback did not record a processing error.',
    id: attempt.id,
    outcome: attempt.outcome,
    payloadDetails: <PayloadDetails value={attempt.rawPayload} />,
    pillClass: paymentCallbackAttemptPill(attempt),
    providerRef: attempt.providerRef ?? 'No gateway ref',
    providerStatus: attempt.providerStatus ?? 'none',
    signatureLabel: attempt.signatureVerified === true ? 'verified' : 'not verified',
    verificationMode: attempt.verificationMode ?? 'unknown',
  }));
}

function PayloadDetails({ value }: { value: unknown }) {
  const record = readPlainRecord(value);
  if (!record) {
    return <AdminInlineFallback>No payload saved.</AdminInlineFallback>;
  }
  const keys = Object.keys(record).sort();
  return (
    <AdminDisclosure>
      <summary>{keys.length} key(s)</summary>
      <AdminStageList>
        {keys.slice(0, 12).map((key) => (
          <AdminStageItem key={key}>
            <StatusBadge tone="neutral">{key}</StatusBadge>
            <div>
              <strong>{redactPaymentPayloadValue(record[key], key)}</strong>
            </div>
          </AdminStageItem>
        ))}
      </AdminStageList>
    </AdminDisclosure>
  );
}

const PAYMENT_PAYLOAD_SECRET_KEY_PATTERN =
  /(authorization|credential|private[_-]?key|secret|service[_-]?role|signature|secure[_-]?hash|token|access[_-]?key|checksum|password|jwt)/i;

function redactPaymentPayloadValue(value: unknown, key?: string): string {
  if (key && PAYMENT_PAYLOAD_SECRET_KEY_PATTERN.test(key)) {
    return '[redacted]';
  }
  if (!value || typeof value !== 'object') {
    return compactValue(value);
  }
  return compactValue(redactPaymentPayloadObject(value));
}

function redactPaymentPayloadObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactPaymentPayloadObject(item));
  }
  const record = readPlainRecord(value);
  if (!record) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(record).map(([entryKey, entryValue]) => [
      entryKey,
      PAYMENT_PAYLOAD_SECRET_KEY_PATTERN.test(entryKey) ? '[redacted]' : redactPaymentPayloadObject(entryValue),
    ]),
  );
}

function ChatEvidenceRow({ message }: { message: AdminChatMessage }) {
  const sender = message.sender?.fullName ?? message.sender?.phone ?? 'App user';
  return (
    <AdminStageItem>
      <StatusBadge tone="info">
        <DateTimeText value={message.createdAt} />
      </StatusBadge>
      <div>
        <strong>{sender}</strong>
        <p className="muted">{message.body}</p>
      </div>
    </AdminStageItem>
  );
}

function AuditRow({ row }: { row: AdminAuditLog }) {
  return (
    <tr>
      <td>
        <DateTimeText value={row.createdAt} />
      </td>
      <td>{row.action}</td>
      <td>{row.actor?.fullName ?? row.actor?.phone ?? 'Admin'}</td>
      <td>{row.target}</td>
      <td>{auditEvidence(row.metadata)}</td>
    </tr>
  );
}

function auditEvidence(value: unknown) {
  const record = readPlainRecord(value);
  if (!record) {
    return 'No metadata';
  }

  return Object.entries(record)
    .slice(0, 6)
    .map(([key, item]) => `${key}: ${compactValue(item)}`)
    .join(' / ');
}

function bookingServiceLabel(payment: AdminPaymentDetail) {
  const item = payment.booking?.services?.[0];
  const service = item?.service;
  if (!service?.name) {
    return 'Service pending';
  }
  return `${service.name} / ${service.durationMin ?? '?'} min`;
}

function bookingServicePriceLabel(payment: AdminPaymentDetail) {
  const item = payment.booking?.services?.[0];
  const service = item?.service;
  const parts: ReactNode[] = [<>Booked <MoneyText amount={item?.price} currency={payment.currency} /></>];
  if (service?.basePrice) {
    parts.push(<>admin minimum <MoneyText amount={service.basePrice} currency={payment.currency} /></>);
  }
  if (service?.priceStep) {
    parts.push(<>step <MoneyText amount={service.priceStep} currency={payment.currency} /></>);
  }
  return joinPaymentEvidenceParts(parts);
}

function bookingAddressLabel(payment: AdminPaymentDetail) {
  const snapshot = payment.booking?.addressSnapshot;
  if (snapshot?.addressText) {
    return snapshot.addressText;
  }
  return addressLabel(payment.booking?.address);
}

function bookingCoordinateLabel(payment: AdminPaymentDetail) {
  const snapshot = payment.booking?.addressSnapshot;
  if (
    snapshot?.latitude !== undefined &&
    snapshot.latitude !== null &&
    snapshot?.longitude !== undefined &&
    snapshot.longitude !== null
  ) {
    return 'Confirmed service address saved';
  }
  if (
    payment.booking?.lat !== undefined &&
    payment.booking.lat !== null &&
    payment.booking?.lng !== undefined &&
    payment.booking.lng !== null
  ) {
    return 'Stored booking location saved';
  }
  return 'No pin';
}

function customerLabel(payment: AdminPaymentDetail) {
  const user = payment.booking?.customerProfile?.user;
  return user?.fullName ?? user?.phone ?? 'Customer pending';
}

function partnerLabel(payment: AdminPaymentDetail) {
  const partner = payment.booking?.selectedProvider ?? payment.booking?.preferredProvider;
  return partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'Partner pending';
}

function refundSummary(payment: AdminPaymentDetail) {
  const refunds = payment.refunds ?? [];
  if (!refunds.length) {
    return 'No refund record for this payment.';
  }
  return joinPaymentEvidenceParts(
    refunds.slice(0, 3).map((refund) => (
      <span key={refund.id}>
        {refund.status} <MoneyText amount={refund.amount} currency={payment.currency} />{' '}
        <DateTimeText value={refund.createdAt} />
      </span>
    )),
  );
}

function joinPaymentEvidenceParts(parts: ReactNode[]) {
  return (
    <span>
      {parts.map((part, index) => (
        <span key={index}>{index === 0 ? null : ' / '}{part}</span>
      ))}
    </span>
  );
}

function addressLabel(address: unknown) {
  if (typeof address === 'string' && address.trim()) {
    return address.trim();
  }
  const record = readPlainRecord(address);
  if (!record) {
    return 'Address pending';
  }
  const value = record.addressText ?? record.address_text ?? record.address ?? record.label ?? record.name ?? record.line1;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Address pending';
}
