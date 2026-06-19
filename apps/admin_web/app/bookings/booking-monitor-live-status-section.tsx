import type { BookingMonitorSummaryRow } from './booking-monitor-summary';

type BookingMonitorLiveStatusSectionProps = {
  readonly autoRefresh: boolean;
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly refreshIntervalSeconds: number;
  readonly summary: readonly BookingMonitorSummaryRow[];
};

export function BookingMonitorLiveStatusSection({
  autoRefresh,
  hasMounted,
  isPending,
  lastRefreshLabel,
  refreshIntervalSeconds,
  summary,
}: BookingMonitorLiveStatusSectionProps) {
  return (
    <>
      <section className="grid">
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <strong className="admin-summary-card-value">{value}</strong>
          </div>
        ))}
      </section>

      <div className="monitor-meta">
        <span>{isPending ? 'Refreshing...' : 'Ready'}</span>
        <span>{autoRefresh ? `Live updates every ${refreshIntervalSeconds}s` : 'Live updates paused'}</span>
        <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
      </div>
    </>
  );
}
