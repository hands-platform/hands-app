import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { AdminFormControlButton, AdminFormInput } from '../../../components/admin-form-controls';
import { MetricCard } from '../../../components/metric-card';
import {
  compactValue,
  formatDateTime as formatDate,
  formatMoney as money,
  readPlainRecord,
  shortId,
} from '../../../lib/admin-format';
import {
  AdminAuditLog,
  AdminChatMessage,
  AdminPaymentCallbackAttempt,
  AdminPaymentDetail,
  adminGet,
} from '../../../lib/admin-api';
import { readSearchParam } from '../../../lib/date-range';
import { capturePayment, refundPayment, releasePayment, settleCashDebt, syncPayment } from '../actions';
import {
  type PaymentConfirmationAction,
  buildPaymentActionConfirmation,
  paymentActionConfirmHref,
  readPaymentConfirmationAction,
} from '../payment-action-confirmation';
import { paymentActionExecutionMap as buildPaymentActionExecutionMap } from '../payment-action-execution-map';
import { PaymentDetailActionMapSection } from './payment-detail-action-map-section';
import {
  PaymentDetailCallbackTimelineSection,
  type PaymentDetailCallbackTimelineRow,
} from './payment-detail-callback-timeline-section';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const payment = await adminGet<AdminPaymentDetail | null>(`/admin/payments/${id}`, null);

  if (!payment) {
    notFound();
  }

  const booking = payment.booking;
  const earning = booking?.earning;
  const callbacks = sortCallbackAttempts(payment.callbackAttempts ?? []);
  const messages = [...(booking?.chatRoom?.messages ?? [])].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
  const actionMap = buildPaymentActionExecutionMap(payment, {
    cashDebtActionLabel: 'Settle cash fee debt',
    cashDebtOperatorRule:
      'Settle with deposit reference or approved admin offset before final acceptance, service start, or payout release.',
    completedCaptureReason: 'Service is completed and authorization hold is active.',
    syncActionLabel: 'Sync gateway',
  });
  const callbackTimelineRows = buildPaymentDetailCallbackTimelineRows(callbacks, payment.currency);
  const callbackReviewCount = callbacks.filter(paymentCallbackAttemptNeedsReview).length;
  const acceptedCallbackCount = callbacks.filter(paymentCallbackAttemptVerified).length;
  const cashDebt = paymentCashDebtNeedsSettlement(payment);
  const serviceLabel = bookingServiceLabel(payment);
  const bookingAddress = bookingAddressLabel(payment);
  const auditRows = payment.auditLogs ?? [];
  const confirmation = buildPaymentActionConfirmation(
    [payment],
    readPaymentConfirmationAction(readSearchParam(query.confirm)),
    payment.id,
    { cancelHref: `/payments/${payment.id}` },
  );

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/payments">
              Back to payments
            </Link>
          </p>
          <h1>Payment operation detail</h1>
          <p className="muted">
            Payment {shortId(payment.id)} - {payment.method} - {payment.status}
          </p>
        </div>
        <div className="actions">
          {booking?.id ? (
            <Link className="text-link" href={`/bookings/${booking.id}`}>
              Open booking
            </Link>
          ) : null}
          {booking?.customerProfile?.id ? (
            <Link className="text-link" href={`/customers/${booking.customerProfile.id}`}>
              Open customer
            </Link>
          ) : null}
          {booking?.selectedProvider?.id ? (
            <Link className="text-link" href={`/partners/${booking.selectedProvider.id}`}>
              Open partner
            </Link>
          ) : null}
          {booking?.chatRoom?.id ? (
            <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
              Open chat archive
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid admin-mb-16">
        <MetricCard label="Payment status" value={payment.status} helper={paymentStatusHint(payment)} />
        <MetricCard label="Method" value={payment.method} helper={gatewayReferenceLabel(payment)} />
        <MetricCard label="Amount" value={money(payment.amount, payment.currency)} helper={serviceLabel} />
        <MetricCard label="Booking" value={booking?.status ?? 'Not linked'} helper={bookingAddress} />
        <MetricCard label="Callbacks" value={`${callbacks.length} attempt(s)`} helper={`${callbackReviewCount} review item(s)`} />
        <MetricCard label="Accepted callbacks" value={`${acceptedCallbackCount}`} helper="Accepted or replayed with verified signature." />
        <MetricCard label="Cash fee gate" value={cashDebt ? 'Blocked' : 'Clear'} helper={cashDebtHint(payment)} />
        <MetricCard label="Audit trail" value={`${auditRows.length} event(s)`} helper="Payment and linked booking operation logs." />
      </section>

      <PaymentDetailActionMapSection
        actionLabel={`Payment detail actions for ${shortId(payment.id)}`}
        actions={paymentDetailActionMenuItems(payment)}
        cashDebtSettlementForm={cashDebt && earning?.id ? <CashDebtSettlementForm payment={payment} /> : null}
        confirmation={
          confirmation ? (
            <ConfirmDialog
              action={paymentConfirmationAction(confirmation.action)}
              cancelHref={confirmation.cancelHref}
              confirmLabel={confirmation.confirmLabel}
              description={confirmation.description}
              disabled={confirmation.disabled}
              hiddenInputs={[{ name: 'paymentId', value: confirmation.paymentId }]}
              id={`payment-detail-${confirmation.action}-${confirmation.paymentId}`}
              textInputs={
                confirmation.action === 'refund'
                  ? [
                      {
                        label: 'Approving admin id',
                        name: 'approvalAdminId',
                        placeholder: 'Different admin user id',
                        required: true,
                      },
                    ]
                  : []
              }
              title={confirmation.title}
              tone={confirmation.tone}
            />
          ) : null
        }
        hasBlockingReview={cashDebt || callbackReviewCount > 0}
        rows={actionMap}
      />

      <PaymentDetailCallbackTimelineSection reviewCount={callbackReviewCount} rows={callbackTimelineRows} />

      <section className="grid admin-mb-16">
        <section className="card" id="booking-evidence">
          <h2>Linked booking evidence</h2>
          <div className="setup-stage-list">
            <EvidenceRow label="Booking" value={booking?.id ?? 'Not linked'} helper={booking?.status ?? 'No booking status'} />
            <EvidenceRow label="Customer" value={customerLabel(payment)} helper={booking?.customerProfile?.user?.phone ?? 'No customer phone'} />
            <EvidenceRow label="Partner" value={partnerLabel(payment)} helper={booking?.selectedProvider?.user?.phone ?? 'No selected partner phone'} />
            <EvidenceRow label="Address" value={bookingAddress} helper={bookingCoordinateLabel(payment)} />
            <EvidenceRow label="Service" value={serviceLabel} helper={bookingServicePriceLabel(payment)} />
            <EvidenceRow label="Chat" value={booking?.chatRoom ? `${messages.length} message(s)` : 'No room'} helper="Admin keeps chat evidence after service completion." />
          </div>
        </section>

        <section className="card" id="money-ledger">
          <h2>Money ledger</h2>
          <div className="setup-stage-list">
            <EvidenceRow label="Gross" value={money(earning?.grossAmount ?? payment.amount, payment.currency)} helper="Customer payment amount or earning gross amount." />
            <EvidenceRow label="HANDS fee" value={money(earning?.platformFee, earning?.currency ?? payment.currency)} helper="Configured service fee snapshot." />
            <EvidenceRow label="Withholding" value={money(earning?.withholdingAmount, earning?.currency ?? payment.currency)} helper="Tax withholding saved by current policy." />
            <EvidenceRow label="Partner net" value={money(earning?.netAmount, earning?.currency ?? payment.currency)} helper={cashDebt ? 'Negative wallet debt must be cleared before final acceptance, service start, or payout release.' : 'Net amount is not blocking final acceptance, service start, or payout release.'} />
            <EvidenceRow label="Earning state" value={earning?.status ?? 'No earning'} helper={earning?.settlementRef ?? 'No settlement reference'} />
            <EvidenceRow label="Refund rows" value={`${payment.refunds?.length ?? 0}`} helper={refundSummary(payment)} />
          </div>
        </section>
      </section>

      <section className="card admin-mb-16" id="chat-payment-evidence">
        <div className="ops-section-header">
          <div>
            <h2>Chat and operation evidence</h2>
            <p className="muted">
              Matched bookings should have chat evidence. Operators use this before cancellation, no-show, refund,
              or payout decisions.
            </p>
          </div>
          <span className={`pill ${messages.length ? 'pill-success' : 'pill-warn'}`}>
            {messages.length ? 'Chat retained' : 'No chat messages'}
          </span>
        </div>
        <div className="setup-stage-list">
          {messages.slice(-8).map((message) => (
            <ChatEvidenceRow message={message} key={message.id} />
          ))}
          {messages.length === 0 ? (
            <div className="setup-stage-item">
              <span className="pill pill-warn">Chat</span>
              <div>
                <strong>No retained messages</strong>
                <p className="muted">Check booking stage before money or outcome decisions.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card" id="payment-audit-log">
        <div className="ops-section-header">
          <div>
            <h2>Payment audit trail</h2>
            <p className="muted">Admin actions tied to this payment or linked booking.</p>
          </div>
          <span className="pill pill-info">{auditRows.length} event(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <AuditRow row={row} key={row.id} />
            ))}
            {auditRows.length === 0 ? (
              <tr>
                <td colSpan={5}>No admin audit event has been captured for this payment yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

function EvidenceRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="setup-stage-item">
      <span className="pill pill-info">{label}</span>
      <div>
        <strong>{value}</strong>
        <p className="muted">{helper}</p>
      </div>
    </div>
  );
}

function paymentDetailActionMenuItems(payment: AdminPaymentDetail) {
  const terminalPayment = paymentStatusIsTerminal(payment.status);
  return [
    {
      kind: 'link' as const,
      href: paymentDetailActionConfirmHref(payment.id, 'sync'),
      label: 'Sync gateway',
      disabled: !payment.providerRef,
      description: payment.providerRef ? 'Confirm gateway sync before running it.' : 'Gateway reference is missing.',
      tone: 'info' as const,
    },
    {
      kind: 'link' as const,
      href: paymentDetailActionConfirmHref(payment.id, 'capture'),
      label: 'Capture',
      disabled: terminalPayment,
      description: terminalPayment ? 'Terminal payments cannot be captured again.' : 'Review before capturing funds.',
      tone: 'warning' as const,
    },
    {
      kind: 'link' as const,
      href: paymentDetailActionConfirmHref(payment.id, 'release'),
      label: 'Release',
      disabled: terminalPayment,
      description: terminalPayment ? 'Terminal payments cannot be released again.' : 'Review before releasing the hold.',
      tone: 'warning' as const,
    },
    {
      kind: 'link' as const,
      href: paymentDetailActionConfirmHref(payment.id, 'refund'),
      label: 'Refund',
      disabled: payment.status === 'REFUNDED' || payment.status === 'RELEASED',
      description:
        payment.status === 'REFUNDED' || payment.status === 'RELEASED'
          ? 'This payment cannot enter a new refund action.'
          : 'Review evidence before starting a refund.',
      tone: 'danger' as const,
    },
  ];
}

function paymentDetailActionConfirmHref(paymentId: string, action: PaymentConfirmationAction) {
  const query = paymentActionConfirmHref(paymentId, action).split('?')[1] ?? '';
  return `/payments/${encodeURIComponent(paymentId)}?${query}`;
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

function paymentStatusIsTerminal(status: string) {
  return status === 'CAPTURED' || status === 'REFUNDED' || status === 'RELEASED';
}

function CashDebtSettlementForm({ payment }: { payment: AdminPaymentDetail }) {
  const earning = payment.booking?.earning;
  if (!earning) {
    return null;
  }

  const debtAmount = Math.abs(earning.netAmount);
  const settlementRef = `HANDS-CASH-${shortId(payment.bookingId).toUpperCase()}`;
  return (
    <form action={settleCashDebt} className="inline-form admin-mt-16">
      <input type="hidden" name="earningId" value={earning.id} />
      <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
      <AdminFormInput
        label="Cash fee settlement reference"
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
      />
      <AdminFormInput
        label="Cash fee settlement notes"
        name="settlementNotes"
        defaultValue={`Partner deposited ${money(debtAmount, earning.currency)} with ${settlementRef}`}
        placeholder={`Partner deposited ${money(debtAmount, earning.currency)}`}
      />
      <AdminFormControlButton className="button button-primary" type="submit">
        Settle cash fee debt
      </AdminFormControlButton>
    </form>
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
  return payment.providerRef ? `Gateway ref ${payment.providerRef}` : 'No gateway reference saved.';
}

function cashDebtHint(payment: AdminPaymentDetail) {
  if (!paymentCashDebtNeedsSettlement(payment)) {
    return 'No negative partner wallet gate from this payment.';
  }
  const amount = Math.abs(payment.booking?.earning?.netAmount ?? 0);
  return `Partner owes ${money(amount, payment.currency)} before final acceptance, service start, or payout release.`;
}

function buildPaymentDetailCallbackTimelineRows(
  callbacks: readonly AdminPaymentCallbackAttempt[],
  currency: string,
): PaymentDetailCallbackTimelineRow[] {
  return callbacks.map((attempt) => ({
    amountLabel:
      attempt.callbackAmount !== null && attempt.callbackAmount !== undefined
        ? money(attempt.callbackAmount, currency)
        : 'unknown',
    createdAtLabel: formatDate(attempt.createdAt),
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
    return <span className="muted">No payload saved.</span>;
  }
  const keys = Object.keys(record).sort();
  return (
    <details>
      <summary>{keys.length} key(s)</summary>
      <div className="setup-stage-list">
        {keys.slice(0, 12).map((key) => (
          <div className="setup-stage-item" key={key}>
            <span className="pill pill-neutral">{key}</span>
            <div>
              <strong>{redactPaymentPayloadValue(record[key], key)}</strong>
            </div>
          </div>
        ))}
      </div>
    </details>
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
    <div className="setup-stage-item">
      <span className="pill pill-info">{formatDate(message.createdAt)}</span>
      <div>
        <strong>{sender}</strong>
        <p className="muted">{message.body}</p>
      </div>
    </div>
  );
}

function AuditRow({ row }: { row: AdminAuditLog }) {
  return (
    <tr>
      <td>{formatDate(row.createdAt)}</td>
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
  return [
    `Booked ${money(item?.price, payment.currency)}`,
    service?.basePrice ? `admin minimum ${money(service.basePrice, payment.currency)}` : null,
    service?.priceStep ? `step ${money(service.priceStep, payment.currency)}` : null,
  ]
    .filter(Boolean)
    .join(' / ');
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
    return 'Service address snapshot saved';
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
  return refunds
    .slice(0, 3)
    .map((refund) => `${refund.status} ${money(refund.amount, payment.currency)} ${formatDate(refund.createdAt)}`)
    .join(' / ');
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
