import { AdminPayment, adminGet } from '../../lib/admin-api';
import { AdminDateRange, dateRangeLabel, isInDateRange, normalizeDateRange, readSearchParam } from '../../lib/date-range';
import Link from 'next/link';
import { capturePayment, refundPayment, releasePayment, settleCashDebt, syncPayment } from './actions';

type PaymentsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PaymentsPage({ searchParams }: { searchParams?: PaymentsPageSearchParams }) {
  const filters = buildPaymentFilters(searchParams ? await searchParams : {});
  const allPayments = sortPayments(await adminGet<AdminPayment[]>('/admin/payments', []));
  const payments = filterPayments(allPayments, filters);
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
            {
              payments.filter((payment) => payment.method === 'CASH' && payment.status === 'PENDING')
                .length
            }
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
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
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
                </td>
                <td>{payment.providerRef ?? 'NONE'}</td>
                <td>
                  <div className="actions">
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
  return value ? `Record date ${new Date(value).toLocaleString()}` : 'No payment record date';
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
  if (paymentCashDebtNeedsSettlement(payment)) {
    const debt = Math.abs(payment.booking?.earning?.netAmount ?? 0);
    return `Cash was collected by the partner. Settle ${money(
      debt,
      payment.currency,
    )} HANDS fee/tax debt from Earnings before they can keep accepting bookings.`;
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

function paymentCashDebtNeedsSettlement(payment: AdminPayment) {
  const earning = payment.booking?.earning;
  return (
    payment.method === 'CASH' &&
    Boolean(earning) &&
    (earning?.netAmount ?? 0) < 0 &&
    earning?.status !== 'PAID'
  );
}

function money(amount: number, currency = 'VND') {
  return `${amount.toLocaleString()} ${currency}`;
}

function shortId(value: string) {
  return value.slice(0, 8);
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
