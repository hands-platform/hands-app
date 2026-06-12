'use client';

type BookingMonitorToolbarSectionProps = {
  readonly autoRefresh: boolean;
  readonly onRefreshNow: () => void;
  readonly onToggleAutoRefresh: () => void;
};

export function BookingMonitorToolbarSection({
  autoRefresh,
  onRefreshNow,
  onToggleAutoRefresh,
}: BookingMonitorToolbarSectionProps) {
  return (
    <section className="toolbar">
      <div>
        <h1>Booking Monitor</h1>
        <p className="muted">
          Live operational view for matching, partner selection, chat, and payment readiness.
        </p>
      </div>
      <div className="actions">
        <button type="button" onClick={onToggleAutoRefresh}>
          {autoRefresh ? 'Pause refresh' : 'Resume refresh'}
        </button>
        <button type="button" onClick={onRefreshNow}>
          Refresh now
        </button>
      </div>
    </section>
  );
}
