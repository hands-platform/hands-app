'use client';

import { Pause, Play, RefreshCw } from 'lucide-react';

type BookingMonitorToolbarSectionProps = {
  readonly autoRefresh: boolean;
  readonly description?: string;
  readonly onRefreshNow: () => void;
  readonly onToggleAutoRefresh: () => void;
  readonly title?: string;
};

export function BookingMonitorToolbarSection({
  autoRefresh,
  description = 'Live operational view for matching, Partner selection, chat, and payment readiness.',
  onRefreshNow,
  onToggleAutoRefresh,
  title = 'Booking Monitor',
}: BookingMonitorToolbarSectionProps) {
  const AutoRefreshIcon = autoRefresh ? Pause : Play;

  return (
    <section className="toolbar">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
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
