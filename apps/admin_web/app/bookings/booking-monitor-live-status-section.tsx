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
          helper: bookingMonitorSummaryHelper(label),
          kind: bookingMonitorSummaryKind(label),
          label,
          scope: bookingMonitorSummaryScope(label),
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

function bookingMonitorSummaryScope(label: string) {
  if (
    label === 'Active bookings' ||
    label === 'Open matching' ||
    label === 'Matched' ||
    label === 'Chat live' ||
    label.startsWith('Stage ')
  ) {
    return 'Live';
  }

  if (
    label === 'Follow-up queue' ||
    label.endsWith('checks') ||
    label === 'Chat repair' ||
    label === 'Evidence missing' ||
    label === 'Refund review' ||
    label === 'No Partners yet' ||
    label === 'First-pick pending'
  ) {
    return 'Needs action';
  }

  if (label === 'Blocked create attempts') {
    return 'Today';
  }

  return 'Records';
}

function bookingMonitorSummaryKind(label: string) {
  const scope = bookingMonitorSummaryScope(label);

  if (label === 'Blocked create attempts' || label === 'Payment checks' || label === 'Refund review') {
    return 'risk' as const;
  }

  if (scope === 'Live') return 'live' as const;
  if (scope === 'Needs action') return 'action' as const;

  return 'record' as const;
}

function bookingMonitorSummaryHelper(label: string) {
  if (label === 'Blocked create attempts') {
    return 'Create attempts stopped before payment or matching; open audit evidence.';
  }

  if (label === 'Follow-up queue') {
    return 'Rows with operator checks before the shift can move on.';
  }

  if (label === 'Payment checks') {
    return 'Rows where capture, release, refund, or evidence still needs review.';
  }

  if (label === 'Closeout checks') {
    return 'Completed or ended bookings missing closeout evidence.';
  }

  if (label === 'Refund review') {
    return 'Refund records that still need operator or finance follow-up.';
  }

  if (bookingMonitorSummaryScope(label) === 'Live') {
    return 'Current booking monitor state for live dispatch decisions.';
  }

  return 'Retained booking monitor record for audit or history review.';
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
