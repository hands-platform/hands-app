'use client';

import { Pause, Play } from 'lucide-react';

import { AdminFormControlButton } from '../../components/admin-form-controls';

type BookingMonitorToolbarSectionProps = {
  readonly liveUpdates: boolean;
  readonly onToggleLiveUpdates: () => void;
};

export function BookingMonitorToolbarSection({
  liveUpdates,
  onToggleLiveUpdates,
}: BookingMonitorToolbarSectionProps) {
  const LiveUpdatesIcon = liveUpdates ? Pause : Play;

  return (
    <AdminFormControlButton className="button-secondary" type="button" onClick={onToggleLiveUpdates}>
      <LiveUpdatesIcon aria-hidden="true" size={16} />
      {liveUpdates ? 'Pause live' : 'Resume live'}
    </AdminFormControlButton>
  );
}
