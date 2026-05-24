import { AdminRefund, adminGet } from '../../lib/admin-api';
import Link from 'next/link';

type RefundsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RefundsPage({ searchParams }: { searchParams?: RefundsPageSearchParams }) {
  const filters = buildRefundFilters(searchParams ? await searchParams : {});
  const allRefunds = sortRefunds(await adminGet<AdminRefund[]>('/admin/refunds', []));
  const refunds = filterRefunds(allRefunds, filters);

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
            <h2>Refund operation filters</h2>
            <p className="muted">
              Use these shortcuts from the dashboard to focus on the refund queue state.
            </p>
          </div>
          <span className={`pill ${filters.review ? 'pill-warn' : 'pill-success'}`}>
            Showing {refunds.length} of {allRefunds.length}
          </span>
        </div>
        <div className="participant-list">
          {refundFilterLinks().map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={item.href}
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
              <th>Refund</th>
              <th>Customer</th>
              <th>Provider</th>
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
                </td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={8}>No refunds loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortRefunds(refunds: AdminRefund[]) {
  return [...refunds].sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
}

function buildRefundFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readParam(params.review),
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function filterRefunds(refunds: AdminRefund[], filters: ReturnType<typeof buildRefundFilters>) {
  if (!filters.review) {
    return refunds;
  }

  return refunds.filter((refund) => refundMatchesReview(refund, filters.review));
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

function shortId(value: string) {
  return value.slice(0, 8);
}
