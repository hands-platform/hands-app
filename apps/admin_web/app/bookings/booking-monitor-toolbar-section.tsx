'use client';

import { Pause, Play, RefreshCw } from 'lucide-react';

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
  const AutoRefreshIcon = autoRefresh ? Pause : Play;

  return (
    <section className="toolbar">
      <div>
        <h1>Booking Monitor</h1>
        <p className="muted">
          Live operational view for matching, Partner selection, chat, and payment readiness.
        </p>
      </div>
      <div className="actions">
        <button className="button button-secondary" type="button" onClick={onToggleAutoRefresh}>
          <AutoRefreshIcon aria-hidden="true" size={16} />
          {autoRefresh ? 'Pause refresh' : 'Resume refresh'}
        </button>
        <button className="button button-primary" type="button" onClick={onRefreshNow}>
          <RefreshCw aria-hidden="true" size={16} />
          Refresh now
        </button>
      </div>
    </section>
  );
}
