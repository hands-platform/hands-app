'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AdminDataTable } from '../../components/admin-data-table';
import type { AdminMarketingTrendPoint } from '../../lib/admin-api';

const compactMoney = new Intl.NumberFormat('en-US', {
  currency: 'VND',
  maximumFractionDigits: 0,
  notation: 'compact',
  style: 'currency',
});

function dayLabel(value: string) {
  const [, month = '', day = ''] = value.split('-');
  return `${month}/${day}`;
}

export function MarketingAnalyticsTrendChart({
  points,
}: {
  readonly points: readonly AdminMarketingTrendPoint[];
}) {
  if (points.length === 0) {
    return (
      <div className="marketing-trend-empty" role="status">
        <strong>No attributed activity in this period</strong>
        <span>Customer app activity and recorded ad spend will appear here by Vietnam date.</span>
      </div>
    );
  }

  const data = points.map((point) => ({
    ...point,
    label: dayLabel(point.date),
  }));
  const hasAdSpend = points.some((point) => point.adSpend > 0);

  return (
    <>
      <div
        aria-label="Daily customer acquisition, booking activity, and ad spend"
        className="marketing-trend-chart"
        role="img"
      >
        <ResponsiveContainer height={320} width="100%">
          <ComposedChart data={data} margin={{ bottom: 4, left: -18, right: 12, top: 10 }}>
            <CartesianGrid
              stroke="var(--admin-border-subtle)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis axisLine={false} dataKey="label" minTickGap={22} tickLine={false} />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={44}
              yAxisId="activity"
            />
            {hasAdSpend ? (
              <YAxis
                axisLine={false}
                orientation="right"
                tickFormatter={(value) => compactMoney.format(Number(value)).replace('₫', 'VND ')}
                tickLine={false}
                width={72}
                yAxisId="spend"
              />
            ) : null}
            <Tooltip
              contentStyle={{
                background: 'var(--admin-surface-elevated)',
                border: '1px solid var(--admin-border-subtle)',
                borderRadius: 6,
              }}
              formatter={(value, name) => [
                name === 'Ad spend'
                  ? compactMoney.format(Number(value)).replace('₫', 'VND ')
                  : Number(value).toLocaleString('en-US'),
                name,
              ]}
              labelFormatter={(label) => `Vietnam date ${label}`}
            />
            <Legend iconType="circle" />
            {hasAdSpend ? (
              <Bar
                dataKey="adSpend"
                fill="var(--admin-chart-created)"
                fillOpacity={0.22}
                name="Ad spend"
                radius={[3, 3, 0, 0]}
                yAxisId="spend"
              />
            ) : null}
            <Line
              dataKey="firstOpens"
              dot={false}
              name="Tracked entrants"
              stroke="var(--admin-chart-acquisition)"
              strokeWidth={2}
              type="monotone"
              yAxisId="activity"
            />
            <Line
              dataKey="signups"
              dot={false}
              name="New signups"
              stroke="var(--admin-chart-signups)"
              strokeWidth={2}
              type="monotone"
              yAxisId="activity"
            />
            <Line
              dataKey="bookingCreated"
              dot={false}
              name="First booking created"
              stroke="var(--admin-chart-created)"
              strokeWidth={2}
              type="monotone"
              yAxisId="activity"
            />
            <Line
              dataKey="bookingCompleted"
              dot={false}
              name="First booking completed"
              stroke="var(--admin-chart-completed)"
              strokeWidth={2}
              type="monotone"
              yAxisId="activity"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <AdminDataTable
          emptyMessage={null}
          headers={[
            'Vietnam date',
            'Tracked entrants',
            'New signups',
            'First booking created',
            'First booking completed',
            'Ad spend',
          ]}
          rowCount={points.length}
        >
          {points.map((point) => (
            <tr key={point.date}>
              <th>{point.date}</th>
              <td>{point.firstOpens}</td>
              <td>{point.signups}</td>
              <td>{point.bookingCreated}</td>
              <td>{point.bookingCompleted}</td>
              <td>{point.adSpend}</td>
            </tr>
          ))}
        </AdminDataTable>
      </div>
    </>
  );
}
