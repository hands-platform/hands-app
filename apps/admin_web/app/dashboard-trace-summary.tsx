import type { ReactNode } from 'react';
import { AdminTraceSummary } from '../components/admin-overview-card';

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
