import { AdminPayment, AdminPaymentCallbackAttempt, adminGet } from '../../lib/admin-api';
import { formatDateTime, formatMoney as money, shortId } from '../../lib/admin-format';
import {
  AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import Link from 'next/link';
import { capturePayment, refundPayment, releasePayment, settleCashDebt, syncPayment } from './actions';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { searchParams?: PaymentsPageSearchParams }) {
  const filters = buildPaymentFilters(searchParams ? await searchParams : {});
  const allPayments = sortPayments(await adminGet<AdminPayment[]>('/admin/payments', []));
  const callbackAttempts = sortPaymentCallbackAttempts(
    await adminGet<AdminPaymentCallbackAttempt[]>('/admin/payment-callback-attempts', []),
  );
  const payments = filterPayments(allPayments, filters);
  const visibleCallbackAttempts = filterPaymentCallbackAttempts(callbackAttempts, filters);
  const activeFilter = paymentFilterLinks().find((item) => item.review === filters.review);

  return (
    <>
      <h1>Payments</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Authorized</p>
          <h2>{payments.filter((payment) => payment.status === 'AUTHORIZED').length}</h2>
        </div>
        <div className="card">
          <p>Pending cash</p>
          <h2>
            {payments.filter((payment) => payment.method === 'CASH' && payment.status === 'PENDING').length}
          </h2>
        </div>
        <div className="card">
          <p>Cash debt</p>
          <h2>{payments.filter(paymentCashDebtNeedsSettlement).length}</h2>
        </div>
        <div className="card">
          <p>Captured</p>
          <h2>{payments.filter((payment) => payment.status === 'CAPTURED').length}</h2>
        </div>
        <div className="card">
          <p>Refunded</p>
          <h2>{payments.filter((payment) => payment.status === 'REFUNDED').length}</h2>
        </div>
        <div className="card">
          <p>Needs action</p>
          <h2>{payments.filter((payment) => paymentOpsState(payment) !== 'settled').length}</h2>
        </div>
        <div className="card">
          <p>Linked refunds</p>
          <h2>{payments.reduce((total, payment) => total + (payment.refunds?.length ?? 0), 0)}</h2>
        </div>
        <div className="card">
          <p>Callback review</p>
          <h2>{visibleCallbackAttempts.filter(paymentCallbackAttemptNeedsReview).length}</h2>
        </div>
        <div className="card">
          <p>Callback verified</p>
          <h2>{visibleCallbackAttempts.filter(paymentCallbackAttemptVerified).length}</h2>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Payment operation filters</h2>
            <p className="muted">
              Jump straight from the dashboard lane into the payment subset that needs operator review.
            </p>
            <p className="muted">
              Payment date range: {dateRangeLabel(filters.range)}. Until the payment table stores its own
              timestamp, this uses the linked booking record date.
            </p>
            {activeFilter?.review ? (
              <p className="muted">
                Active queue: <strong>{activeFilter.label}</strong> -{' '}
                {paymentFilterDescription(activeFilter.review)}
              </p>
            ) : null}
          </div>
          <span className={`pill ${filters.review ? 'pill-warn' : 'pill-success'}`}>
            Showing {payments.length} of {allPayments.length}
          </span>
        </div>
        <div className="participant-list" style={{ marginBottom: 12 }}>
          {paymentRangeLinks(filters.review).map((item) => (
            <Link
              className={`pill ${filters.range === item.range ? 'pill-info' : 'pill-neutral'}`}
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="participant-list">
          {filters.review || filters.range !== 'all' ? (
            <Link className="pill pill-success" href="/payments">
              Clear filters
            </Link>
          ) : null}
          {paymentFilterLinks().map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={withPaymentRange(item.href, filters.range)}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Payment callback attempt ledger</h2>
            <p className="muted">
              Accepted, replayed, rejected, and conflicting gateway callbacks. Unknown gateway references remain
              visible here even when they cannot attach to a payment row.
            </p>
          </div>
          <span className="pill pill-info">{visibleCallbackAttempts.length} attempt(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Method</th>
              <th>Outcome</th>
              <th>Gateway ref</th>
              <th>Payment</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {visibleCallbackAttempts.slice(0, 10).map((attempt) => (
              <tr id={`callback-attempt-${attempt.id}`} key={attempt.id}>
                <td>{formatDateTime(attempt.createdAt)}</td>
                <td>{attempt.method}</td>
                <td>
                  <span className={`pill ${paymentCallbackAttemptPill(attempt)}`}>{attempt.outcome}</span>
                  <div className="muted">{attempt.errorMessage ?? 'No processing error recorded.'}</div>
                </td>
                <td>
                  {attempt.providerRef ?? 'NONE'}
                  <div className="muted">{attempt.gatewayTransactionId ?? 'No gateway transaction id'}</div>
                </td>
                <td>
                  {attempt.paymentId ? (
                    <>
                      {shortId(attempt.paymentId)}
                      <div className="muted">{attempt.payment?.status ?? 'UNKNOWN'}</div>
                      {attempt.payment?.bookingId ? (
                        <Link className="text-link" href={`/bookings/${attempt.payment.bookingId}`}>
                          Open booking
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Not linked
                      <div className="muted">Gateway reference did not match a saved payment.</div>
                    </>
                  )}
                </td>
                <td>
                  <div className="setup-stage-list">
                    <div className="setup-stage-item">
                      <span className="pill pill-info">Signature</span>
                      <div>
                        <strong>{attempt.signatureVerified === true ? 'Verified' : 'Not verified'}</strong>
                        <p className="muted">Mode: {attempt.verificationMode ?? 'unknown'}</p>
                      </div>
                    </div>
                    <div className="setup-stage-item">
                      <span className="pill pill-neutral">Gateway</span>
                      <div>
                        <strong>{attempt.providerStatus ?? 'No status code'}</strong>
                        <p className="muted">
                          Amount:{' '}
                          {attempt.callbackAmount !== null && attempt.callbackAmount !== undefined
                            ? money(attempt.callbackAmount)
                            : 'unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {visibleCallbackAttempts.length === 0 && (
              <tr>
                <td colSpan={6}>No callback attempts match this queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Method</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Booking</th>
              <th>Ops hint</th>
              <th>Gateway ref</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr id={`payment-${payment.id}`} key={payment.id}>
                <td>{payment.id}</td>
                <td>{payment.method}</td>
                <td>
                  {payment.status}
                  <div className="muted">{paymentStateLabel(payment)}</div>
                </td>
                <td>
                  {payment.amount} {payment.currency}
                </td>
                <td>
                  {shortId(payment.bookingId)}
                  <div className="muted">{payment.booking?.status ?? 'UNKNOWN'}</div>
                  <div className="muted">{paymentRecordDateLabel(payment)}</div>
                  <div className="muted">
                    {payment.booking?.customerProfile?.user?.phone ?? 'No customer phone'}
                  </div>
                  {paymentCashDebtNeedsSettlement(payment) && (
                    <div className="muted">
                      Cash fee debt{' '}
                      {money(Math.abs(payment.booking?.earning?.netAmount ?? 0), payment.currency)}
                    </div>
                  )}
                  <div className="actions" style={{ marginTop: 8 }}>
                    <Link className="text-link" href={`/bookings/${payment.bookingId}`}>
                      Open booking
                    </Link>
                    {payment.booking?.earning?.id && (
                      <Link className="text-link" href={`/earnings#earning-${payment.booking.earning.id}`}>
                        Open earning
                      </Link>
                    )}
                    {payment.refunds?.at(0)?.id && (
                      <Link className="text-link" href={`/refunds#refund-${payment.refunds[0].id}`}>
                        Open refund
                      </Link>
                    )}
                  </div>
                </td>
                <td>
                  <div>{paymentOpsSignal(payment)}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {paymentOpsHint(payment)}
                  </div>
                  <div className="ops-task-note" style={{ marginTop: 10 }}>
                    <strong>Payment action execution map</strong>
                    <div className="setup-stage-list" style={{ marginTop: 8 }}>
                      {paymentActionExecutionMap(payment).map((row) => (
                        <div className="setup-stage-item" key={`${payment.id}-${row.action}`}>
                          <span className={`pill ${row.pillClass}`}>{row.status}</span>
                          <div>
                            <strong>{row.action}</strong>
                            <p className="muted">{row.reason}</p>
                            <small>{row.operatorRule}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
                <td>
                  <div>{payment.providerRef ?? 'NONE'}</div>
                  <PaymentCallbackEvidence payment={payment} />
                </td>
                <td>
                  <div className="actions">
                    <Link className="text-link" href={`/payments/${payment.id}`}>
                      Open detail
                    </Link>
                    <PaymentAction
                      action={syncPayment}
                      paymentId={payment.id}
                      label="Sync"
                      disabled={!payment.providerRef}
                    />
                    <PaymentAction
                      action={capturePayment}
                      paymentId={payment.id}
                      label="Capture"
                      disabled={
                        payment.status === 'CAPTURED' ||
                        payment.status === 'REFUNDED' ||
                        payment.status === 'RELEASED'
                      }
                    />
                    <PaymentAction
                      action={releasePayment}
                      paymentId={payment.id}
                      label="Release"
                      disabled={
                        payment.status === 'CAPTURED' ||
                        payment.status === 'REFUNDED' ||
                        payment.status === 'RELEASED'
                      }
                    />
                    <PaymentAction
                      action={refundPayment}
                      paymentId={payment.id}
                      label="Refund"
                      disabled={payment.status === 'REFUNDED' || payment.status === 'RELEASED'}
                    />
                  </div>
                  {paymentCashDebtNeedsSettlement(payment) && payment.booking?.earning?.id && (
                    <CashDebtSettlementForm payment={payment} />
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8}>{emptyPaymentMessage(filters.review)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortPayments(payments: AdminPayment[]) {
  return [...payments].sort((left, right) => {
    const leftPriority = paymentPriority(left);
    const rightPriority = paymentPriority(right);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (right.id || '').localeCompare(left.id || '');
  });
}

function sortPaymentCallbackAttempts(attempts: AdminPaymentCallbackAttempt[]) {
  return [...attempts].sort((left, right) => {
    const leftDate = Date.parse(left.createdAt || '');
    const rightDate = Date.parse(right.createdAt || '');
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

function buildPaymentFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readSearchParam(params.review),
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

function filterPayments(payments: AdminPayment[], filters: ReturnType<typeof buildPaymentFilters>) {
  return payments.filter(
    (payment) =>
      isInDateRange(paymentRecordDate(payment), filters.range) &&
      (!filters.review || paymentMatchesReview(payment, filters.review)),
  );
}

function filterPaymentCallbackAttempts(
  attempts: AdminPaymentCallbackAttempt[],
  filters: ReturnType<typeof buildPaymentFilters>,
) {
  return attempts.filter(
    (attempt) =>
      isInDateRange(attempt.createdAt, filters.range) &&
      (!filters.review ||
        (filters.review === 'callback-review'
          ? paymentCallbackAttemptNeedsReview(attempt)
          : filters.review === 'callback-verified'
            ? paymentCallbackAttemptVerified(attempt)
            : true)),
  );
}

function paymentMatchesReview(payment: AdminPayment, review: string) {
  if (review === 'capture') {
    return payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED';
  }
  if (review === 'missing-ref') {
    return payment.status === 'AUTHORIZED' && !payment.providerRef;
  }
  if (review === 'authorized') {
    return payment.status === 'AUTHORIZED';
  }
  if (review === 'cash') {
    return payment.method === 'CASH' && payment.status === 'PENDING';
  }
  if (review === 'cash-debt') {
    return paymentCashDebtNeedsSettlement(payment);
  }
  if (review === 'needs-action') {
    return paymentOpsState(payment) !== 'settled';
  }
  if (review === 'callback-review') {
    return (payment.callbackAttempts?.some(paymentCallbackAttemptNeedsReview) ?? false) || paymentCallbackNeedsReview(payment);
  }
  if (review === 'callback-verified') {
    return (payment.callbackAttempts?.some(paymentCallbackAttemptVerified) ?? false) || paymentCallbackVerified(payment);
  }
  if (review === 'refunded') {
    return payment.status === 'REFUNDED';
  }
  return true;
}

function paymentFilterLinks() {
  return [
    { label: 'All payments', href: '/payments', review: '' },
    { label: 'Capture review', href: '/payments?review=capture', review: 'capture' },
    { label: 'Missing refs', href: '/payments?review=missing-ref', review: 'missing-ref' },
    { label: 'Authorized holds', href: '/payments?review=authorized', review: 'authorized' },
    { label: 'Cash collection', href: '/payments?review=cash', review: 'cash' },
    { label: 'Cash fee debt', href: '/payments?review=cash-debt', review: 'cash-debt' },
    { label: 'Needs action', href: '/payments?review=needs-action', review: 'needs-action' },
    { label: 'Callback review', href: '/payments?review=callback-review', review: 'callback-review' },
    { label: 'Callback verified', href: '/payments?review=callback-verified', review: 'callback-verified' },
    { label: 'Refunded', href: '/payments?review=refunded', review: 'refunded' },
  ];
}

function paymentRangeLinks(review: string) {
  return [
    { label: 'All dates', href: withPaymentReview('/payments', review), range: 'all' as const },
    { label: 'Today', href: withPaymentReview('/payments?range=today', review), range: 'today' as const },
    { label: 'Last 7 days', href: withPaymentReview('/payments?range=7d', review), range: '7d' as const },
    { label: 'Last 30 days', href: withPaymentReview('/payments?range=30d', review), range: '30d' as const },
  ];
}

function withPaymentRange(href: string, range: AdminDateRange) {
  if (range === 'all') {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}range=${range}`;
}

function withPaymentReview(href: string, review: string) {
  if (!review) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}review=${review}`;
}

function paymentRecordDate(payment: AdminPayment) {
  return payment.booking?.createdAt ?? null;
}

function paymentRecordDateLabel(payment: AdminPayment) {
  const value = paymentRecordDate(payment);
  return value ? `Record date ${formatDateTime(value)}` : 'No payment record date';
}

function paymentFilterDescription(review: string) {
  if (review === 'capture') {
    return 'authorized payments tied to completed services, ready for capture review.';
  }
  if (review === 'missing-ref') {
    return 'authorized payments that do not yet have a gateway reference.';
  }
  if (review === 'authorized') {
    return 'active authorization holds that still need service or payment resolution.';
  }
  if (review === 'cash') {
    return 'cash bookings waiting for collection confirmation.';
  }
  if (review === 'cash-debt') {
    return 'completed cash bookings where the partner still owes HANDS fee or tax wallet debt.';
  }
  if (review === 'needs-action') {
    return 'payments that are not settled, released, or refunded yet.';
  }
  if (review === 'callback-review') {
    return 'MoMo or VNPay callbacks that were received without a verified gateway signature.';
  }
  if (review === 'callback-verified') {
    return 'MoMo or VNPay callbacks already accepted with gateway signature evidence.';
  }
  if (review === 'refunded') {
    return 'payments already moved into the refund path.';
  }
  return 'all payment records.';
}

function emptyPaymentMessage(review: string) {
  if (!review) {
    return 'No payments loaded.';
  }
  return `No payments currently match this queue. ${paymentFilterDescription(review)}`;
}

function paymentPriority(payment: AdminPayment) {
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

function paymentOpsState(payment: AdminPayment) {
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

function paymentStateLabel(payment: AdminPayment) {
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

function paymentOpsSignal(payment: AdminPayment) {
  if (paymentCallbackNeedsReview(payment)) {
    return <span className="signal signal-warn">Callback check</span>;
  }
  if (paymentCashDebtNeedsSettlement(payment)) {
    return <span className="signal signal-warn">Cash fee debt</span>;
  }
  if (payment.status === 'AUTHORIZED') {
    return <span className="signal signal-warn">Capture after service</span>;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return <span className="signal signal-info">Cash collection</span>;
  }
  if (payment.status === 'REFUNDED') {
    return <span className="signal signal-warn">Refund in motion</span>;
  }
  if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
    return <span className="signal signal-ok">Settled</span>;
  }
  return <span className="signal signal-info">Monitor payment</span>;
}

function paymentOpsHint(payment: AdminPayment) {
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
    )} HANDS fee/tax debt from Earnings before marketplace join or payout release proceeds.`;
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

type PaymentActionExecutionRow = {
  action: string;
  status: string;
  reason: string;
  operatorRule: string;
  pillClass: string;
};

function paymentActionExecutionMap(payment: AdminPayment): PaymentActionExecutionRow[] {
  const bookingStatus = payment.booking?.status ?? 'UNKNOWN';
  const hasGatewayReference = Boolean(payment.providerRef);
  const terminalPayment = ['CAPTURED', 'REFUNDED', 'RELEASED'].includes(payment.status);
  const completedService = bookingStatus === 'COMPLETED';
  const closedWithoutCapture = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(bookingStatus);
  const cashDebt = paymentCashDebtNeedsSettlement(payment);

  return [
    {
      action: 'Sync',
      status: hasGatewayReference ? 'Available' : 'No gateway ref',
      reason: hasGatewayReference
        ? `Gateway reference ${payment.providerRef} is saved on this payment.`
        : 'No gateway reference is saved yet.',
      operatorRule:
        'Use sync before manual money actions when a gateway reference exists. Sync should not decide service outcome.',
      pillClass: hasGatewayReference ? 'pill-success' : 'pill-neutral',
    },
    {
      action: 'Capture',
      status:
        payment.status === 'AUTHORIZED' && completedService
          ? 'Review capture'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Wait for completion'
              : 'Not authorized',
      reason:
        payment.status === 'AUTHORIZED' && completedService
          ? 'The service is completed and the authorization hold is still active.'
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? `Booking is ${bookingStatus}; service completion evidence is not final yet.`
              : `Payment status is ${payment.status}.`,
      operatorRule: 'Capture only after completed service evidence and payment ledger review.',
      pillClass: payment.status === 'AUTHORIZED' && completedService ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Release',
      status:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? 'Review release'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Hold active'
              : 'Not authorized',
      reason:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? `Booking is ${bookingStatus}; release can close the authorization without capture.`
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? 'The hold is still active; check booking evidence before release.'
              : `Payment status is ${payment.status}.`,
      operatorRule: 'Release only when the booking outcome should not capture customer funds.',
      pillClass: payment.status === 'AUTHORIZED' && closedWithoutCapture ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Refund',
      status:
        payment.status === 'CAPTURED'
          ? 'Evidence required'
          : payment.status === 'REFUNDED'
            ? 'Already refunded'
            : payment.status === 'RELEASED'
              ? 'Released'
              : 'Not captured',
      reason:
        payment.status === 'CAPTURED'
          ? 'Captured money can be refunded only after admin decision evidence is recorded.'
          : payment.status === 'REFUNDED'
            ? 'Refund path has already started.'
            : payment.status === 'RELEASED'
              ? 'The authorization was released, so no captured money remains here.'
              : 'There is no captured payment to refund from this row.',
      operatorRule: 'Refunds must preserve customer, partner, booking, payment, and chat evidence.',
      pillClass: payment.status === 'CAPTURED' ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Settle cash debt',
      status: cashDebt ? 'Evidence required' : payment.method === 'CASH' ? 'Clear' : 'Not cash',
      reason: cashDebt
        ? 'Cash was collected by the partner and the HANDS fee/tax debt is still open.'
        : payment.method === 'CASH'
          ? 'This cash payment has no open partner wallet debt on the linked earning.'
          : 'This payment is not a cash collection case.',
      operatorRule:
        'Settle with a deposit reference or approved admin offset before marketplace join or payout release.',
      pillClass: cashDebt ? 'pill-danger' : payment.method === 'CASH' ? 'pill-success' : 'pill-neutral',
    },
  ];
}

function paymentCashDebtNeedsSettlement(payment: AdminPayment) {
  const earning = payment.booking?.earning;
  return (
    payment.method === 'CASH' &&
    Boolean(earning) &&
    (earning?.netAmount ?? 0) < 0 &&
    earning?.status !== 'PAID'
  );
}

type PaymentCallbackMeta = {
  receivedAt: string | null;
  verified: boolean | null;
  mode: string | null;
  providerStatus: string | null;
  gatewayTransactionId: string | null;
  callbackAmount: number | null;
  rawKeys: string[];
};

function paymentCallbackMeta(payment: AdminPayment): PaymentCallbackMeta {
  const meta = paymentRawMeta(payment);
  const vnpAmount = numberFromUnknown(meta.vnp_Amount);

  return {
    receivedAt: stringFromUnknown(meta.callbackReceivedAt),
    verified: booleanFromUnknown(meta.callbackSignatureVerified),
    mode: stringFromUnknown(meta.callbackVerificationMode),
    providerStatus:
      stringFromUnknown(meta.status) ??
      stringFromUnknown(meta.resultCode) ??
      stringFromUnknown(meta.vnp_ResponseCode) ??
      stringFromUnknown(meta.message),
    gatewayTransactionId:
      stringFromUnknown(meta.transId) ??
      stringFromUnknown(meta.transactionId) ??
      stringFromUnknown(meta.vnp_TransactionNo) ??
      stringFromUnknown(meta.vnp_TxnRef),
    callbackAmount: numberFromUnknown(meta.amount) ?? (vnpAmount ? Math.round(vnpAmount / 100) : null),
    rawKeys: Object.keys(meta).sort(),
  };
}

function paymentRawMeta(payment: AdminPayment): Record<string, unknown> {
  if (!payment.rawMeta || typeof payment.rawMeta !== 'object' || Array.isArray(payment.rawMeta)) {
    return {};
  }
  return payment.rawMeta as Record<string, unknown>;
}

function paymentCallbackVerified(payment: AdminPayment) {
  return paymentCallbackMeta(payment).verified === true;
}

function paymentCallbackNeedsReview(payment: AdminPayment) {
  if (payment.method === 'CASH') {
    return false;
  }
  const callback = paymentCallbackMeta(payment);
  return Boolean(callback.receivedAt) && callback.verified !== true;
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

function stringFromUnknown(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function booleanFromUnknown(value: unknown) {
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

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function PaymentCallbackEvidence({ payment }: { payment: AdminPayment }) {
  const callback = paymentCallbackMeta(payment);
  if (!callback.receivedAt) {
    return (
      <div className="ops-task-note" style={{ marginTop: 8 }}>
        <span className="pill pill-neutral">No callback</span>
        <p className="muted" style={{ marginTop: 6 }}>
          No gateway callback has been stored yet.
        </p>
      </div>
    );
  }

  const callbackPill = callback.verified ? 'pill-success' : 'pill-warn';
  const callbackLabel = callback.verified ? 'Verified callback' : 'Review callback';

  return (
    <div className="ops-task-note" style={{ marginTop: 8 }}>
      <span className={`pill ${callbackPill}`}>{callbackLabel}</span>
      <div className="setup-stage-list" style={{ marginTop: 8 }}>
        <div className="setup-stage-item">
          <span className="pill pill-info">Received</span>
          <div>
            <strong>{formatDateTime(callback.receivedAt)}</strong>
            <p className="muted">Verification mode: {callback.mode ?? 'unknown'}</p>
          </div>
        </div>
        <div className="setup-stage-item">
          <span className="pill pill-neutral">Gateway</span>
          <div>
            <strong>{callback.providerStatus ?? 'No status code'}</strong>
            <p className="muted">
              Transaction: {callback.gatewayTransactionId ?? 'none'} · Amount:{' '}
              {callback.callbackAmount !== null ? money(callback.callbackAmount, payment.currency) : 'unknown'}
            </p>
          </div>
        </div>
      </div>
      {callback.rawKeys.length ? (
        <details style={{ marginTop: 8 }}>
          <summary>Callback payload keys</summary>
          <p className="muted">{callback.rawKeys.join(', ')}</p>
        </details>
      ) : null}
    </div>
  );
}

function PaymentAction({
  action,
  paymentId,
  label,
  disabled,
}: {
  action: (...args: [FormData]) => Promise<void>;
  paymentId: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <button type="submit" disabled={disabled}>
        {label}
      </button>
    </form>
  );
}

function CashDebtSettlementForm({ payment }: { payment: AdminPayment }) {
  const earning = payment.booking?.earning;
  if (!earning) {
    return null;
  }

  const debtAmount = Math.abs(earning.netAmount);
  const settlementRef = `HANDS-CASH-${shortId(payment.bookingId).toUpperCase()}`;
  return (
    <form action={settleCashDebt} className="inline-form" style={{ marginTop: 8 }}>
      <input type="hidden" name="earningId" value={earning.id} />
      <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
      <input
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
        aria-label="Cash debt settlement reference"
      />
      <input
        name="settlementNotes"
        defaultValue={`Partner deposited ${money(debtAmount, earning.currency)} with ${settlementRef}`}
        placeholder={`Partner deposited ${money(debtAmount, earning.currency)}`}
        aria-label="Cash debt settlement notes"
      />
      <button type="submit">Settle cash debt</button>
    </form>
  );
}
