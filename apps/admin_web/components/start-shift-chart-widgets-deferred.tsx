'use client';

import dynamic from 'next/dynamic';

import type { AdminStartShiftChartAnalytics } from '../lib/admin-api';
import { AdminDeferredRender } from './admin-deferred-render';
import type { StartShiftLiveMetric } from './start-shift-live-metrics';

const DeferredStartShiftChartWidgets = dynamic(
  () => import('./start-shift-chart-widgets').then((module) => module.StartShiftChartWidgets),
  { loading: () => <ChartPlaceholder />, ssr: false },
);

type StartShiftChartWidgetsDeferredProps = {
  analytics: AdminStartShiftChartAnalytics | null;
  fallbackBusinessTotals?: {
    grossAmount: string;
    partnerNetAmount: string;
    platformFee: string;
  };
  liveMetrics?: readonly StartShiftLiveMetric[];
  rangeLabel: string;
  section: 'all' | 'business' | 'operations';
  state: 'empty' | 'ready' | 'stale' | 'unavailable';
};

export function StartShiftChartWidgetsDeferred(props: StartShiftChartWidgetsDeferredProps) {
  return (
    <AdminDeferredRender fallback={<ChartPlaceholder state={props.state} />}>
      <DeferredStartShiftChartWidgets {...props} />
    </AdminDeferredRender>
  );
}

function ChartPlaceholder({ state }: { readonly state?: StartShiftChartWidgetsDeferredProps['state'] }) {
  return (
    <div className="admin-deferred-chart-placeholder is-dashboard">
      <span className="sr-only">
        Operational events. Period event totals. Money flow. Customer activity. {state === 'unavailable' ? 'Analytics unavailable.' : 'Loading analytics.'}
      </span>
    </div>
  );
}
