import type { BookingMonitorSummaryRow } from './booking-monitor-summary';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { bookingMonitorRealtimeLabel, type BookingMonitorRealtimeState } from './booking-monitor-realtime';
import {
  DashboardDataScopeStatus,
  type DashboardDataScope,
  type DashboardSourceState,
} from '../dashboard-trace-summary';

type BookingMonitorLiveStatusSectionProps = {
  readonly auditFixtureVisible?: boolean;
  readonly dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  readonly dataGeneratedAt?: string;
  readonly dataPartialSourceCount: number;
  readonly dataScope: DashboardDataScope;
  readonly dataScopeEnd?: string | null;
  readonly dataScopeStart?: string | null;
  readonly dataSourceState: DashboardSourceState;
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly realtimeState: BookingMonitorRealtimeState;
  readonly summary: readonly BookingMonitorSummaryRow[];
};

export function BookingMonitorLiveStatusSection({
  auditFixtureVisible = false,
  dataClass,
  dataGeneratedAt,
  dataPartialSourceCount,
  dataScope,
  dataScopeEnd,
  dataScopeStart,
  dataSourceState,
  hasMounted,
  isPending,
  lastRefreshLabel,
  realtimeState,
  summary,
}: BookingMonitorLiveStatusSectionProps) {
  if (dataScope === 'historical') {
    return (
      <>
        <div className="monitor-meta" role="status">
          <span suppressHydrationWarning>
            Historical snapshot · refreshed {hasMounted ? lastRefreshLabel : 'pending'}
          </span>
          <span>
            {auditFixtureVisible
              ? 'Audit fixtures visible'
              : process.env.NODE_ENV === 'production'
                ? 'Historical operations data'
                : 'Local data'}
          </span>
        </div>
        {summary.length > 0 && (
          <AdminFilterSummary
            ariaLabel="Closeout queue summary"
            className="admin-mb-16"
            labels={summary.map(([label, value]) => `${label}: ${value}`)}
          />
        )}
      </>
    );
  }

  const realtimeLabel = bookingMonitorRealtimeLabel(realtimeState);
  const realtimeDetail = bookingMonitorRealtimeDetail(realtimeState);
  const warnings = summary.filter(
    ([label, value]) => ['Data anomaly', 'Blocked today'].includes(label) && Number(value) > 0,
  );

  return (
    <>
      <div aria-label="Booking data status" className="admin-filter-chip-group">
        <DashboardDataScopeStatus
          dataClass={dataClass}
          generatedAt={dataGeneratedAt}
          partialSourceCount={dataPartialSourceCount}
          scope={dataScope}
          scopeLabel={dataScope === 'all-open' ? 'Scope: All open bookings' : undefined}
          scopeEnd={dataScopeEnd}
          scopeStart={dataScopeStart}
          sourceState={dataSourceState}
          testDataLabel={
            auditFixtureVisible
              ? 'Audit fixtures visible'
              : process.env.NODE_ENV === 'production'
                ? 'Production data · Test data excluded'
                : 'Audit fixtures may be visible'
          }
        />
      </div>
      {warnings.length > 0 ? (
        <AdminFilterSummary
          ariaLabel="Booking data warnings"
          className="admin-mb-16"
          labels={warnings.map(([label, value]) => `${label}: ${value}`)}
          tone="warning"
        />
      ) : null}

      {(isPending || realtimeState !== 'live') && (
        <div className="monitor-meta" role={realtimeState === 'error' ? 'alert' : 'status'}>
          <span>{isPending ? 'Syncing...' : realtimeLabel}</span>
          <span>{realtimeDetail}</span>
          <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
        </div>
      )}
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
    return 'REST fallback refresh active while the socket reconnects';
  }

  return 'Opening realtime socket';
}
