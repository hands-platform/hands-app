import { AdminRefund, adminGet } from '../../lib/admin-api';
import {
  AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import Link from 'next/link';

type RefundsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RefundsPage({ searchParams }: { searchParams?: RefundsPageSearchParams }) {
  const filters = buildRefundFilters(searchParams ? await searchParams : {});
  const allRefunds = sortRefunds(await adminGet<AdminRefund[]>('/admin/refunds', []));
  const refunds = filterRefunds(allRefunds, filters);
  const activeFilter = refundFilterLinks().find((item) => item.review === filters.review);
  const commandBoard = buildRefundCommandBoard(allRefunds);
  const decisionChecklist = buildRefundDecisionChecklist(allRefunds);

  return (
    <>
      <h1>Refunds</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total refunds</p>
          <h2>{allRefunds.length}</h2>
        </div>
        <div className="card">
          <p>Requested</p>
          <h2>{allRefunds.filter((refund) => refund.status === 'REQUESTED').length}</h2>
        </div>
        <div className="card">
          <p>Refunded bookings</p>
          <h2>{allRefunds.filter((refund) => refund.booking?.status === 'REFUNDED').length}</h2>
        </div>
        <div className="card">
          <p>Needs update</p>
          <h2>
            {
              allRefunds.filter(
                (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
              ).length
            }
          </h2>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Refund command board</h2>
            <p className="muted">
              Keep customer refunds, payment ledger state, booking closeout, and customer messaging in one
              operational view before closing a shift.
            </p>
          </div>
          <span
            className={`pill ${
              commandBoard.some((item) => item.refunds.length > 0 && item.tone !== 'ok')
                ? 'pill-warn'
                : 'pill-success'
            }`}
          >
            {commandBoard.reduce((sum, item) => sum + item.refunds.length, 0)} refund record(s)
          </span>
        </div>
        <div className="ops-task-grid">
          {commandBoard.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.title}>
              <span className={`signal ${refundToneClass(item.tone)}`}>{refundToneLabel(item.tone)}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.status}</span>
                <span className="pill">{item.refunds.length} case(s)</span>
              </div>
              {item.refunds.length > 0 ? (
                <div className="stack">
                  {item.refunds.slice(0, 3).map((refund) => (
                    <span className="muted" key={`${item.title}-${refund.id}`}>
                      {shortId(refund.id)} / {refundCustomerLabel(refund)} / {refund.amount}{' '}
                      {refund.payment?.currency ?? 'VND'}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{item.operatorAction}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Refund operation filters</h2>
            <p className="muted">
              Use these shortcuts from the dashboard to focus on the refund queue state.
            </p>
            <p className="muted">Refund date range: {dateRangeLabel(filters.range)}.</p>
            {activeFilter?.review ? (
              <p className="muted">
                Active queue: <strong>{activeFilter.label}</strong> -{' '}
                {refundFilterDescription(activeFilter.review)}
              </p>
            ) : null}
          </div>
          <span className={`pill ${filters.review ? 'pill-warn' : 'pill-success'}`}>
            Showing {refunds.length} of {allRefunds.length}
          </span>
        </div>
        <div className="participant-list" style={{ marginBottom: 12 }}>
          {refundRangeLinks(filters.review).map((item) => (
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
            <Link className="pill pill-success" href="/refunds">
              Clear filters
            </Link>
          ) : null}
          {refundFilterLinks().map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={withRefundRange(item.href, filters.range)}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Refund decision checklist</h2>
            <p className="muted">
              Evidence-first checklist for operators before a refund is released, rejected, or handed to
              finance closeout.
            </p>
          </div>
          <Link className="text-link" href="/bookings?view=manual-decision">
            Manual decision queue
          </Link>
        </div>
        <div className="ops-task-grid">
          {decisionChecklist.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Refund</th>
              <th>Customer</th>
              <th>Partner</th>
              <th>Payment</th>
              <th>Booking</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Ops hint</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr id={`refund-${refund.id}`} key={refund.id}>
                <td>{shortId(refund.id)}</td>
                <td>
                  {refund.booking?.customerProfile?.user?.fullName ??
                    refund.booking?.customerProfile?.user?.phone ??
                    'Unknown'}
                </td>
                <td>{refund.booking?.selectedProvider?.displayName ?? 'Unmatched'}</td>
                <td>
                  {refund.payment?.method} / {refund.payment?.status}
                </td>
                <td>
                  {refund.booking?.status ?? refund.bookingId}
                  <div className="muted">Booking {shortId(refund.bookingId)}</div>
                  <div className="actions" style={{ marginTop: 8 }}>
                    <Link className="text-link" href={`/bookings/${refund.bookingId}`}>
                      Open booking
                    </Link>
                    <Link className="text-link" href={`/payments#payment-${refund.paymentId}`}>
                      Open payment
                    </Link>
                  </div>
                </td>
                <td>
                  {refund.amount} {refund.payment?.currency ?? 'VND'}
                </td>
                <td>{refund.status}</td>
                <td>
                  <div>{refundOpsSignal(refund)}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {refundOpsHint(refund)}
                  </div>
                  <div className="ops-task-note" style={{ marginTop: 10 }}>
                    <strong>Refund action execution map</strong>
                    <div className="setup-stage-list" style={{ marginTop: 8 }}>
                      {refundActionExecutionMap(refund).map((item) => (
                        <div className="setup-stage-item" key={`${refund.id}-${item.action}`}>
                          <span className={`pill ${item.pillClass}`}>{item.status}</span>
                          <div>
                            <strong>{item.action}</strong>
                            <p className="muted">{item.reason}</p>
                            <small>{item.operatorRule}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={8}>{emptyRefundMessage(filters.review)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

type RefundCommandTone = 'warn' | 'info' | 'ok';

type RefundCommandItem = {
  title: string;
  detail: string;
  status: string;
  operatorAction: string;
  href: string;
  tone: RefundCommandTone;
  refunds: AdminRefund[];
};

type RefundDecisionChecklistItem = {
  title: string;
  detail: string;
  operatorRule: string;
  href: string;
  status: string;
  className: string;
  pillClass: string;
};

type RefundActionExecutionItem = {
  action: string;
  status: string;
  reason: string;
  operatorRule: string;
  pillClass: string;
};

function sortRefunds(refunds: AdminRefund[]) {
  return [...refunds].sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
}

function buildRefundCommandBoard(refunds: AdminRefund[]): RefundCommandItem[] {
  const requested = refunds.filter((refund) => refund.status === 'REQUESTED');
  const paymentMismatch = refunds.filter(
    (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
  );
  const bookingSettled = refunds.filter(
    (refund) => refund.status === 'COMPLETED' || refund.booking?.status === 'REFUNDED',
  );
  const cancelledOrExpired = refunds.filter((refund) =>
    ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(refund.booking?.status ?? ''),
  );

  return [
    {
      title: 'Customer refund requests',
      detail: 'Guests are waiting for a clear refund decision and customer-facing update.',
      status: 'REQUESTED',
      operatorAction: 'Confirm eligibility, payment method, and customer message.',
      href: '/refunds?review=requested',
      tone: requested.length > 0 ? 'warn' : 'ok',
      refunds: requested,
    },
    {
      title: 'Payment ledger mismatch',
      detail: 'Refund record exists but the linked payment is not marked as refunded.',
      status: 'Payment not refunded',
      operatorAction: 'Open payment, confirm reversal, then close the refund case.',
      href: '/refunds?review=needs-update',
      tone: paymentMismatch.length > 0 ? 'warn' : 'ok',
      refunds: paymentMismatch,
    },
    {
      title: 'Closed refund evidence',
      detail: 'Refunds that look settled and should match booking, payment, and audit notes.',
      status: 'Settled',
      operatorAction: 'Sample settled cases and make sure operator notes are complete.',
      href: '/refunds?review=completed',
      tone: bookingSettled.length > 0 ? 'info' : 'ok',
      refunds: bookingSettled,
    },
    {
      title: 'Cancel, expire, no-show context',
      detail: 'Refunds linked to failed service outcomes need consistent customer and wallet handling.',
      status: 'Closeout related',
      operatorAction: 'Check booking closeout, cash debt, and customer protection policy.',
      href: '/bookings?view=closeout',
      tone: cancelledOrExpired.length > 0 ? 'warn' : 'ok',
      refunds: cancelledOrExpired,
    },
  ];
}

function buildRefundDecisionChecklist(refunds: AdminRefund[]): RefundDecisionChecklistItem[] {
  const openRefunds = refunds.filter((refund) => refund.status !== 'COMPLETED');
  const paymentUpdates = refunds.filter(
    (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
  );
  const outcomeLinked = refunds.filter((refund) =>
    ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(refund.booking?.status ?? ''),
  );
  const settled = refunds.filter((refund) => refund.status === 'COMPLETED');

  return [
    {
      title: 'Booking evidence',
      detail:
        'Open the booking, chat, location notes, and operator notes before deciding the refund outcome.',
      operatorRule: 'Decision must be based on saved evidence, not customer or Partner judgement.',
      href: '/bookings?view=manual-decision',
      status: `${outcomeLinked.length} outcome-linked`,
      className: outcomeLinked.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: outcomeLinked.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payment ledger',
      detail: 'Check that payment method, hold, refund, or release state matches the refund record.',
      operatorRule: 'Do not close a refund until payment ledger state and refund status match.',
      href: '/payments',
      status: `${paymentUpdates.length} update(s)`,
      className: paymentUpdates.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: paymentUpdates.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Customer update',
      detail: 'Confirm the customer-facing message is clear after the operator decision is recorded.',
      operatorRule: 'Every open refund should have an operator note or customer update path.',
      href: '/refunds?review=open',
      status: `${openRefunds.length} open`,
      className: openRefunds.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: openRefunds.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Finance handoff',
      detail: 'Settled refunds should align with booking state, payment rows, and audit records.',
      operatorRule: 'Sample settled cases during closeout so finance can finish the shift cleanly.',
      href: '/finance-closeout',
      status: `${settled.length} settled`,
      className: settled.length ? 'ops-task-done' : 'ops-task-pending',
      pillClass: settled.length ? 'pill-success' : 'pill-info',
    },
  ];
}

function refundActionExecutionMap(refund: AdminRefund): RefundActionExecutionItem[] {
  const bookingStatus = refund.booking?.status ?? 'UNKNOWN';
  const paymentStatus = refund.payment?.status ?? 'UNKNOWN';
  const paymentMethod = refund.payment?.method ?? 'UNKNOWN';
  const isOpen = refund.status !== 'COMPLETED';
  const paymentAligned = refund.status === 'COMPLETED' || paymentStatus === 'REFUNDED';
  const outcomeNeedsEvidence = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(bookingStatus);
  const hasBookingRecord = Boolean(refund.booking);

  return [
    {
      action: 'Confirm booking evidence',
      status: hasBookingRecord ? 'Linked' : 'Missing',
      reason: hasBookingRecord
        ? `Booking ${shortId(refund.bookingId)} is linked and currently ${bookingStatus}.`
        : `Booking ${shortId(refund.bookingId)} is not included in the current refund payload.`,
      operatorRule:
        'Open booking detail and keep chat, payment, location, and operator notes attached to the decision.',
      pillClass: hasBookingRecord ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Review outcome context',
      status: outcomeNeedsEvidence ? 'Evidence path' : 'Monitor',
      reason: outcomeNeedsEvidence
        ? `Booking outcome is ${bookingStatus}; admin decision evidence should explain the refund path.`
        : `Booking outcome is ${bookingStatus}; keep the refund aligned with the active booking state.`,
      operatorRule:
        'Cancellation, expiry, no-show, and refund outcomes should be handled from saved records, not personal judgement.',
      pillClass: outcomeNeedsEvidence ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Match payment ledger',
      status: paymentAligned ? 'Aligned' : 'Update needed',
      reason: paymentAligned
        ? `Refund status ${refund.status} and payment status ${paymentStatus} are compatible.`
        : `Refund status is ${refund.status}, but payment status is ${paymentStatus}.`,
      operatorRule: 'Do not close the refund case until payment ledger state and refund status match.',
      pillClass: paymentAligned ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Customer update',
      status: isOpen ? 'Message needed' : 'Closed',
      reason: isOpen
        ? 'This refund is still open, so the customer-facing update path should be clear.'
        : 'This refund is closed; confirm the customer can see the outcome in support history.',
      operatorRule: 'Every open refund should have an operator note or customer communication path.',
      pillClass: isOpen ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Finance handoff',
      status: refund.status === 'COMPLETED' ? 'Ready' : 'Open',
      reason:
        refund.status === 'COMPLETED'
          ? `${paymentMethod} refund can be sampled in finance closeout.`
          : `${paymentMethod} refund still needs payment and booking evidence before closeout.`,
      operatorRule: 'Finance closeout should reconcile booking, payment, refund, and audit records together.',
      pillClass: refund.status === 'COMPLETED' ? 'pill-success' : 'pill-info',
    },
  ];
}

function buildRefundFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readSearchParam(params.review),
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

function filterRefunds(refunds: AdminRefund[], filters: ReturnType<typeof buildRefundFilters>) {
  return refunds.filter(
    (refund) =>
      isInDateRange(refund.createdAt, filters.range) &&
      (!filters.review || refundMatchesReview(refund, filters.review)),
  );
}

function refundMatchesReview(refund: AdminRefund, review: string) {
  if (review === 'open') {
    return refund.status !== 'COMPLETED';
  }
  if (review === 'requested') {
    return refund.status === 'REQUESTED';
  }
  if (review === 'needs-update') {
    return refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED';
  }
  if (review === 'refunded-booking') {
    return refund.booking?.status === 'REFUNDED';
  }
  if (review === 'completed') {
    return refund.status === 'COMPLETED';
  }
  return true;
}

function refundFilterLinks() {
  return [
    { label: 'All refunds', href: '/refunds', review: '' },
    { label: 'Open refunds', href: '/refunds?review=open', review: 'open' },
    { label: 'Requested', href: '/refunds?review=requested', review: 'requested' },
    { label: 'Needs update', href: '/refunds?review=needs-update', review: 'needs-update' },
    { label: 'Refunded bookings', href: '/refunds?review=refunded-booking', review: 'refunded-booking' },
    { label: 'Completed', href: '/refunds?review=completed', review: 'completed' },
  ];
}

function refundRangeLinks(review: string) {
  return [
    { label: 'All dates', href: withRefundReview('/refunds', review), range: 'all' as const },
    { label: 'Today', href: withRefundReview('/refunds?range=today', review), range: 'today' as const },
    { label: 'Last 7 days', href: withRefundReview('/refunds?range=7d', review), range: '7d' as const },
    { label: 'Last 30 days', href: withRefundReview('/refunds?range=30d', review), range: '30d' as const },
  ];
}

function withRefundRange(href: string, range: AdminDateRange) {
  if (range === 'all') {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}range=${range}`;
}

function withRefundReview(href: string, review: string) {
  if (!review) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}review=${review}`;
}

function refundFilterDescription(review: string) {
  if (review === 'open') {
    return 'refund cases that are not completed yet.';
  }
  if (review === 'requested') {
    return 'customer refund requests waiting for operator processing.';
  }
  if (review === 'needs-update') {
    return 'requested refunds whose payment record is not marked refunded yet.';
  }
  if (review === 'refunded-booking') {
    return 'bookings already marked as refunded, ready for ledger confirmation.';
  }
  if (review === 'completed') {
    return 'closed refund cases.';
  }
  return 'all refund records.';
}

function emptyRefundMessage(review: string) {
  if (!review) {
    return 'No refunds loaded.';
  }
  return `No refunds currently match this queue. ${refundFilterDescription(review)}`;
}

function refundOpsSignal(refund: AdminRefund) {
  if (refund.status === 'REQUESTED') {
    return <span className="signal signal-warn">Customer refund requested</span>;
  }
  if (refund.status === 'COMPLETED' || refund.booking?.status === 'REFUNDED') {
    return <span className="signal signal-ok">Refund settled</span>;
  }
  return <span className="signal signal-info">Review refund</span>;
}

function refundOpsHint(refund: AdminRefund) {
  if (refund.status === 'REQUESTED') {
    return 'Confirm the payment reversal path and notify the guest once the refund is complete.';
  }
  if (refund.booking?.status === 'REFUNDED') {
    return 'Booking is already marked as refunded. Check payment ledger and customer notes.';
  }
  return 'Review this refund before closing the case.';
}

function refundCustomerLabel(refund: AdminRefund) {
  return (
    refund.booking?.customerProfile?.user?.fullName ??
    refund.booking?.customerProfile?.user?.phone ??
    'Unknown customer'
  );
}

function refundToneClass(tone: RefundCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

function refundToneLabel(tone: RefundCommandTone) {
  if (tone === 'warn') {
    return 'Needs operator';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}

function shortId(value: string) {
  return value.slice(0, 8);
}
