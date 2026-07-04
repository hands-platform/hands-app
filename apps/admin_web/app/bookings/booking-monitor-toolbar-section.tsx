'use client';

import { Pause, Play } from 'lucide-react';

import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';

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
    <AdminPageTemplate
      actions={
        <AdminFormControlButton className="button-secondary" type="button" onClick={onToggleLiveUpdates}>
          <LiveUpdatesIcon aria-hidden="true" size={16} />
          {liveUpdates ? 'Pause live' : 'Resume live'}
        </AdminFormControlButton>
      }
      description={description}
      title={title}
    >
      {null}
    </AdminPageTemplate>
  );
}
