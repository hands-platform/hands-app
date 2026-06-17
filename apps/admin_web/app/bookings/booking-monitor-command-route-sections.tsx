import Link from 'next/link';
import { shortId } from '../../lib/admin-format';
import type { BookingCommandRouteCard } from '../../lib/booking-command-route-cards';
import type { BookingPrimaryCommandSummaryItem } from '../../lib/booking-primary-command-summary';

type BookingMonitorCommandRouteSectionsProps = {
  readonly autoRefresh: boolean;
  readonly commandSummaryCards: readonly BookingCommandRouteCard[];
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly primaryCommandQueue: readonly BookingPrimaryCommandSummaryItem[];
};

export function BookingMonitorCommandRouteSections({
  autoRefresh,
  commandSummaryCards,
  hasMounted,
  isPending,
  lastRefreshLabel,
  primaryCommandQueue,
}: BookingMonitorCommandRouteSectionsProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking operations command summary</h2>
          <p className="muted">
            Start here before drilling into booking records: lane size, first-pick and 10km marketplace
            pressure, customer protection, payment closeout, and handoff quality.
          </p>
        </div>
        <span className="pill pill-info">
          {autoRefresh ? 'Auto refresh on' : 'Auto refresh paused'} /{' '}
          {isPending ? 'refreshing' : `last ${hasMounted ? lastRefreshLabel : 'pending'}`}
        </span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {commandSummaryCards.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.label}>
            <span className="signal signal-info">{item.label}</span>
            <strong className="ops-task-card-value">{item.value}</strong>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className="pill">{item.owner}</span>
              <span className="pill">{item.action}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="ops-section-header admin-mt-16">
        <div>
          <h3>Primary command queue</h3>
          <p className="muted">
            Grouped by the same booking command decision used in each detail page: address, matching,
            chat, and finance.
          </p>
        </div>
        <span className="pill pill-info">
          {primaryCommandQueue.reduce((total, item) => total + item.count, 0)} booking(s)
        </span>
      </div>
      <div className="ops-task-grid admin-mt-12">
        {primaryCommandQueue.map((item) => (
          <Link className="ops-task-card" href={item.href} key={`${item.status}-${item.primaryAction}`}>
            <span className={`pill ${item.tone}`}>{item.status}</span>
            <strong className="ops-task-card-value">{item.count} booking(s)</strong>
            <p>{item.primaryAction}</p>
            <p className="muted">{item.detail}</p>
            <div className="participant-list">
              {item.sampleBookingIds.map((bookingId) => (
                <span className="pill" key={bookingId}>
                  {shortId(bookingId)}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
