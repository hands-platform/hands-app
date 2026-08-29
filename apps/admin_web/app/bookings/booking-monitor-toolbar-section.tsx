'use client';

import { Pause, Play } from 'lucide-react';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import type { BookingMonitorRealtimeState } from './booking-monitor-realtime';

type BookingMonitorToolbarSectionProps = {
  readonly isPending: boolean;
  readonly liveUpdates: boolean;
  readonly onRefreshNow: () => void;
  readonly onToggleLiveUpdates: () => void;
  readonly realtimeState: BookingMonitorRealtimeState;
};

export function BookingMonitorToolbarSection({
  isPending,
  liveUpdates,
  onRefreshNow,
  onToggleLiveUpdates,
  realtimeState,
}: BookingMonitorToolbarSectionProps) {
  const LiveUpdatesIcon = liveUpdates ? Pause : Play;

  return (
    <>
      <AdminFormControlButton className="button-secondary" type="button" onClick={onToggleLiveUpdates}>
        <LiveUpdatesIcon aria-hidden="true" size={16} />
        {liveUpdates ? 'Pause live updates' : 'Resume live updates'}
      </AdminFormControlButton>
      {liveUpdates && realtimeState !== 'live' ? (
        <AdminFormControlButton
          className="button-secondary"
          disabled={isPending}
          type="button"
          onClick={onRefreshNow}
        >
          Refresh now
        </AdminFormControlButton>
      ) : null}
    </>
  );
}
