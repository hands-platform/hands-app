'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useId } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminDisclosure } from '../../components/admin-surface';
import type { AdminUsageOverviewTrendRow } from '../../lib/admin-api';

export function UsageOverviewTrendChart({
  rows,
}: {
  readonly rows: readonly AdminUsageOverviewTrendRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.appOpenCount + row.sessionStartCount +
    row.providerProfileViewCount + row.bookingRequestCount + row.completedBookingCount, 0);
  if (rows.length === 0 || total === 0) {
    return (
      <div className="usage-overview-chart-empty" role="status">
        <strong>No activity in this period</strong>
        <span>No customer usage or booking activity was recorded for the applied dates.</span>
      </div>
    );
  }

  const customerTotal = rows.reduce(
    (sum, row) => sum + row.appOpenCount + row.sessionStartCount + row.providerProfileViewCount,
    0,
  );
  const bookingTotal = rows.reduce(
    (sum, row) => sum + row.bookingRequestCount + row.completedBookingCount,
    0,
  );
  const peak = (keys: Array<keyof AdminUsageOverviewTrendRow>) => rows.reduce((best, row) => {
    const seriesTotal = keys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
    const bestSeriesTotal = keys.reduce((sum, key) => sum + Number(best[key] ?? 0), 0);
    return seriesTotal > bestSeriesTotal ? row : best;
  }, rows[0]!);
  const customerPeak = peak(['appOpenCount', 'sessionStartCount', 'providerProfileViewCount']);
  const bookingPeak = peak(['bookingRequestCount', 'completedBookingCount']);

  return (
    <div className="usage-overview-trend-grid">
      <TrendPanel
        area={{ dataKey: 'appOpenCount', name: 'App opens', color: '#7367f0' }}
        ariaLabel="Customer activity trend"
        lines={[
          { dataKey: 'sessionStartCount', name: 'Sessions', color: '#00bad1' },
          { dataKey: 'providerProfileViewCount', name: 'Partner views', color: '#ff9f43' },
        ]}
        rows={rows}
        summary={`Total signals ${customerTotal.toLocaleString()} · Peak ${customerPeak.label}`}
        title="Customer activity"
      />
      <TrendPanel
        ariaLabel="Booking activity trend"
        lines={[
          { dataKey: 'bookingRequestCount', name: 'Created records', color: '#ff9f43' },
          { dataKey: 'completedBookingCount', name: 'Closed completed', color: '#28c76f' },
        ]}
        rows={rows}
        summary={`Total booking signals ${bookingTotal.toLocaleString()} · Peak ${bookingPeak.label}`}
        title="Booking activity"
      />
    </div>
  );
}

function TrendPanel({
  area,
  ariaLabel,
  lines,
  rows,
  summary,
  title,
}: {
  readonly area?: { dataKey: keyof AdminUsageOverviewTrendRow; name: string; color: string };
  readonly ariaLabel: string;
  readonly lines: ReadonlyArray<{ dataKey: keyof AdminUsageOverviewTrendRow; name: string; color: string }>;
  readonly rows: readonly AdminUsageOverviewTrendRow[];
  readonly summary: string;
  readonly title: string;
}) {
  const summaryId = useId();
  const series = area ? [area, ...lines] : [...lines];

  return (
    <section aria-label={ariaLabel} className="usage-overview-trend-panel">
      <h3>{title}</h3>
      <p className="usage-overview-trend-summary" id={summaryId}>{summary}</p>
      <div
        aria-describedby={summaryId}
        aria-label={ariaLabel}
        className="usage-overview-trend-chart"
        role="img"
      >
        <ResponsiveContainer height={240} width="100%">
          <ComposedChart data={[...rows]} margin={{ bottom: 4, left: -18, right: 10, top: 10 }}>
            <CartesianGrid stroke="var(--admin-border-subtle)" strokeDasharray="4 4" vertical={false} />
            <XAxis axisLine={false} dataKey="label" minTickGap={24} tickLine={false} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              contentStyle={{
                background: 'var(--admin-surface-elevated)',
                border: '1px solid var(--admin-border-subtle)',
                borderRadius: 6,
              }}
            />
            <Legend iconType="circle" />
            {area ? (
              <Area
                dataKey={area.dataKey}
                fill={area.color}
                fillOpacity={0.14}
                name={area.name}
                stroke={area.color}
                strokeWidth={2}
                type="monotone"
              />
            ) : null}
            {lines.map((line, index) => (
              <Line
                dataKey={line.dataKey}
                dot={false}
                key={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeDasharray={index % 2 === 1 ? '6 4' : undefined}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <AdminDisclosure ariaLabel={`${title} exact values`} className="usage-overview-chart-data">
        <summary>View chart data</summary>
        <AdminTableScroll
          ariaLabel={`${title} exact values by reporting interval`}
          className="usage-overview-chart-data-scroll"
        >
          <AdminDataTable
            emptyMessage={null}
            headers={['Interval', ...series.map((item) => item.name)]}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={`${row.periodStart ?? row.label}-${row.label}`}>
                <th scope="row">{row.label}</th>
                {series.map((item) => <td key={item.dataKey}>{Number(row[item.dataKey] ?? 0).toLocaleString()}</td>)}
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminDisclosure>
    </section>
  );
}
