'use client';

import dynamic from 'next/dynamic';

import { AdminDeferredRender } from '../../components/admin-deferred-render';
import type { AdminUsageOverviewTrendRow } from '../../lib/admin-api';

const DeferredUsageOverviewTrendChart = dynamic(
  () => import('./usage-overview-trend-chart').then((module) => module.UsageOverviewTrendChart),
  { loading: () => <ChartPlaceholder />, ssr: false },
);

export function UsageOverviewTrendChartDeferred({
  rows,
  usageAvailable = true,
}: {
  readonly rows: readonly AdminUsageOverviewTrendRow[];
  readonly usageAvailable?: boolean;
}) {
  return (
    <AdminDeferredRender fallback={<ChartPlaceholder />}>
      <DeferredUsageOverviewTrendChart rows={rows} usageAvailable={usageAvailable} />
    </AdminDeferredRender>
  );
}

function ChartPlaceholder() {
  return (
    <div className="admin-deferred-chart-placeholder is-usage">
      <span className="sr-only">
        Customer activity. Booking activity. Bookings created. Preferred Partner requests. Completed during period.
      </span>
    </div>
  );
}
