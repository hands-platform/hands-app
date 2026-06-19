'use client';

import { Pause, Play } from 'lucide-react';

type BookingMonitorToolbarSectionProps = {
  readonly description?: string;
  readonly liveUpdates: boolean;
  readonly onToggleLiveUpdates: () => void;
  readonly title?: string;
};

export function BookingMonitorToolbarSection({
  description = 'Live operational view for matching, Partner selection, chat, and payment readiness.',
  liveUpdates,
  onToggleLiveUpdates,
  title = 'Booking Monitor',
}: BookingMonitorToolbarSectionProps) {
  const LiveUpdatesIcon = liveUpdates ? Pause : Play;

  return (
    <section className="toolbar">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="actions">
        <button className="button button-secondary" type="button" onClick={onToggleLiveUpdates}>
          <LiveUpdatesIcon aria-hidden="true" size={16} />
          {liveUpdates ? 'Pause live' : 'Resume live'}
        </button>
      </div>
    </section>
  );
}
