'use client';

import dynamic from 'next/dynamic';

import { AdminDeferredRender } from '../../components/admin-deferred-render';
import type { AdminMarketingTrendPoint } from '../../lib/admin-api';

const DeferredMarketingAnalyticsTrendChart = dynamic(
  () => import('./marketing-analytics-trend-chart').then((module) => module.MarketingAnalyticsTrendChart),
  { loading: () => <ChartPlaceholder />, ssr: false },
);

export function MarketingAnalyticsTrendChartDeferred({
  points,
}: {
  readonly points: readonly AdminMarketingTrendPoint[];
}) {
  return (
    <AdminDeferredRender fallback={<ChartPlaceholder />}>
      <DeferredMarketingAnalyticsTrendChart points={points} />
    </AdminDeferredRender>
  );
}

function ChartPlaceholder() {
  return (
    <div className="admin-deferred-chart-placeholder is-marketing">
      <span className="sr-only">
        Daily customer acquisition, booking activity, and ad spend. Loading chart.
      </span>
    </div>
  );
}
