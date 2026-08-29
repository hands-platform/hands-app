import type { ReactNode } from 'react';
import { AdminTraceSummary } from '../components/admin-overview-card';
import { DateTimeText } from '../components/date-time-text';
import { StatusBadge } from '../components/status-badge';

const DASHBOARD_SUMMARY_STALE_MS = 5 * 60_000;

export type DashboardTraceSummaryMetric = {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly helper?: ReactNode;
  readonly href?: string;
  readonly key?: string;
  readonly kind?: 'action' | 'live' | 'period' | 'record' | 'risk';
  readonly label: ReactNode;
  readonly scope?: ReactNode;
  readonly value: ReactNode;
};

export type DashboardSourceState = 'available' | 'stale' | 'unavailable';
export type DashboardDataScope = 'all-open' | 'current-shift' | 'historical' | 'today';

const DASHBOARD_DATA_SCOPE_LABELS: Record<DashboardDataScope, string> = {
  'all-open': 'All open',
  'current-shift': 'Shift activity · Today (Vietnam)',
  historical: 'Historical',
  today: 'Today',
};

export function dashboardSourceState(
  value: unknown,
  generatedAt?: string | null,
): DashboardSourceState {
  if (value === null || value === undefined) {
    return 'unavailable';
  }
  if (!generatedAt) {
    return 'available';
  }
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) {
    return 'stale';
  }
  return Date.now() - generatedAtMs > DASHBOARD_SUMMARY_STALE_MS ? 'stale' : 'available';
}

export function dashboardMetricWithSourceState(
  metric: DashboardTraceSummaryMetric,
  state: DashboardSourceState,
  refreshHref: string,
): DashboardTraceSummaryMetric {
  if (state === 'available') {
    return metric;
  }
  return {
    ...metric,
    helper: state === 'stale' ? 'Refresh to load current data.' : 'This data source did not respond.',
    href: refreshHref,
    kind: 'risk',
    scope: state === 'stale' ? 'Stale' : 'Data unavailable',
    value: state === 'stale' ? metric.value : 'Unavailable',
  };
}

export function combinedDashboardSourceState(
  states: readonly DashboardSourceState[],
): DashboardSourceState {
  if (states.includes('unavailable')) {
    return 'unavailable';
  }
  return states.includes('stale') ? 'stale' : 'available';
}

export function DashboardDataScopeStatus({
  dataClass,
  generatedAt,
  partialSourceCount = 0,
  refreshSeconds,
  scope,
  scopeLabel,
  scopeEnd,
  scopeStart,
  sourceState,
  testDataLabel,
}: {
  readonly dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  readonly generatedAt?: string | null;
  readonly partialSourceCount?: number;
  readonly refreshSeconds?: number;
  readonly scope: DashboardDataScope;
  readonly scopeLabel?: string;
  readonly scopeEnd?: string | null;
  readonly scopeStart?: string | null;
  readonly sourceState: DashboardSourceState;
  readonly testDataLabel?: string;
}) {
  const isPartial = sourceState !== 'unavailable' && partialSourceCount > 0;
  const tone = sourceState === 'unavailable'
    ? 'danger'
    : isPartial || sourceState === 'stale'
      ? 'warning'
      : 'success';
  const scopeDurationHours =
    scopeStart && scopeEnd ? (Date.parse(scopeEnd) - Date.parse(scopeStart)) / 3_600_000 : Number.NaN;
  const boundedScopeLabel =
    Number.isFinite(scopeDurationHours) && scopeDurationHours >= 23.9 && scopeDurationHours <= 24.1
      ? '24h live window'
      : 'Selected window';

  if (scope === 'current-shift') {
    const healthLabel = sourceState === 'unavailable'
      ? 'Source unavailable'
      : isPartial
        ? `${partialSourceCount} source${partialSourceCount === 1 ? '' : 's'} unavailable`
        : sourceState === 'stale'
          ? 'Source delayed'
          : 'Command data current';

    return (
      <>
        <StatusBadge tone={tone}>
          Shift activity · Today (Vietnam) · {sourceState === 'unavailable' ? null : (
            <>
              Updated <DateTimeText fallback="Unavailable" value={generatedAt} /> ICT ·
              {' '}
            </>
          )}{healthLabel}
        </StatusBadge>
        <small className="start-shift-scope-helper">
          {testDataLabel ?? (dataClass === 'test' ? 'Test data' : 'Test data excluded')}
          {refreshSeconds ? ` · Checks for updates every ${refreshSeconds}s` : ''}
        </small>
      </>
    );
  }

  return (
    <>
      <StatusBadge tone="info">{scopeLabel ?? DASHBOARD_DATA_SCOPE_LABELS[scope]}</StatusBadge>
      {dataClass ? (
        <StatusBadge tone={dataClass === 'anomaly' ? 'warning' : dataClass === 'test' ? 'danger' : 'neutral'}>
          {testDataLabel ??
            (dataClass === 'test'
              ? 'Test data'
              : `${boundedScopeLabel} · Vietnam time · Test data excluded`)}
        </StatusBadge>
      ) : null}
      <StatusBadge tone={tone}>
        {sourceState === 'unavailable' ? (
          'Source unavailable'
        ) : (
          <>
            {isPartial
              ? `Partial data · ${partialSourceCount} source${partialSourceCount === 1 ? '' : 's'} unavailable · updated `
              : sourceState === 'stale'
                ? 'Source delayed · updated '
                : scope === 'historical'
                  ? 'Snapshot · updated '
                  : 'Live · updated '}
            <DateTimeText fallback="Unavailable" value={generatedAt} />
          </>
        )}
      </StatusBadge>
      {refreshSeconds && sourceState === 'available' && !isPartial ? (
        <StatusBadge tone="neutral">Checks for updates every {refreshSeconds}s</StatusBadge>
      ) : null}
    </>
  );
}

export function DashboardTraceSummary({
  className,
  defaultKind,
  defaultScope,
  metrics,
}: {
  readonly className?: string;
  readonly defaultKind?: DashboardTraceSummaryMetric['kind'];
  readonly defaultScope?: ReactNode;
  readonly metrics: readonly DashboardTraceSummaryMetric[];
}) {
  return (
    <AdminTraceSummary
      className={className}
      metrics={metrics.map((metric) => ({
        action: metric.action,
        className: metric.className,
        detail: metric.helper,
        href: metric.href,
        key: metric.key,
        kind: metric.kind ?? defaultKind,
        label: metric.label,
        scope: metric.scope ?? defaultScope,
        value: metric.value,
      }))}
    />
  );
}
