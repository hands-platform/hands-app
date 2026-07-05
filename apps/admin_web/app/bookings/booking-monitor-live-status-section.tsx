import type { BookingMonitorSummaryRow } from './booking-monitor-summary';
import { AdminMetricGrid } from '../../components/admin-page-template';
import {
  bookingMonitorRealtimeLabel,
  type BookingMonitorRealtimeState,
} from './booking-monitor-realtime';

type BookingMonitorLiveStatusSectionProps = {
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly realtimeState: BookingMonitorRealtimeState;
  readonly summary: readonly BookingMonitorSummaryRow[];
};

export function BookingMonitorLiveStatusSection({
  hasMounted,
  isPending,
  lastRefreshLabel,
  realtimeState,
  summary,
}: BookingMonitorLiveStatusSectionProps) {
  const realtimeLabel = bookingMonitorRealtimeLabel(realtimeState);
  const realtimeDetail = bookingMonitorRealtimeDetail(realtimeState);

  return (
    <>
      <AdminMetricGrid
        metrics={summary.map(([label, value]) => ({
          helper: 'Booking monitor summary',
          label,
          value,
        }))}
      />

      <div className="monitor-meta">
        <span>{isPending ? 'Syncing...' : realtimeLabel}</span>
        <span>{realtimeDetail}</span>
        <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
      </div>
    </>
  );
}

function bookingMonitorRealtimeDetail(state: BookingMonitorRealtimeState) {
  if (state === 'live') {
    return 'Socket push updates active';
  }

  if (state === 'paused') {
    return 'Socket push updates paused';
  }

  if (state === 'error') {
    return 'Waiting for realtime connection';
  }

  return 'Opening realtime socket';
}
