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
  const visibleCommandSummaryCards = commandSummaryCards.filter(isVisibleCommandSummaryCard);
  const visiblePrimaryCommandQueue = primaryCommandQueue.filter(isVisiblePrimaryCommandQueueItem);
  const visiblePrimaryCommandCount = visiblePrimaryCommandQueue.reduce((total, item) => total + item.count, 0);

  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking operations command summary</h2>
          <p className="muted">
            Live queue health and operator lanes before table review.
          </p>
        </div>
        <span className="pill pill-info">
          {autoRefresh ? 'Auto refresh on' : 'Auto refresh paused'} /{' '}
          {isPending ? 'refreshing' : `last ${hasMounted ? lastRefreshLabel : 'pending'}`}
        </span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {visibleCommandSummaryCards.map((item) => (
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
          <p className="muted">Open the lane that needs action; detailed evidence stays in booking detail.</p>
        </div>
        <span className="pill pill-info">
          {visiblePrimaryCommandCount} booking(s)
        </span>
      </div>
      <div className="ops-task-grid admin-mt-12">
        {visiblePrimaryCommandQueue.map((item) => (
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
        {visiblePrimaryCommandQueue.length === 0 && (
          <div className="ops-task-card">
            <span className="signal signal-ok">Clear</span>
            <strong className="ops-task-card-value">0 booking(s)</strong>
            <p>No primary booking command needs action for the current filters.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function isVisibleCommandSummaryCard(item: BookingCommandRouteCard): boolean {
  if (item.label === 'Current lane') {
    return true;
  }

  return !['0', 'Clear', 'Ready', 'Stable'].includes(item.value);
}

function isVisiblePrimaryCommandQueueItem(item: BookingPrimaryCommandSummaryItem): boolean {
  return item.tone === 'pill-danger' || item.tone === 'pill-info' || item.tone === 'pill-warn';
}
