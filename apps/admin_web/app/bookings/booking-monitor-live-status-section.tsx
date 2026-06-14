import type { BookingMonitorSummaryRow } from './booking-monitor-summary';

type BookingMonitorLiveStatusSectionProps = {
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly summary: readonly BookingMonitorSummaryRow[];
};

export function BookingMonitorLiveStatusSection({
  hasMounted,
  isPending,
  lastRefreshLabel,
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
        <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
      </div>
    </>
  );
}
