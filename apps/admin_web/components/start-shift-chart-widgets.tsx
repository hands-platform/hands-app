'use client';

import Link from 'next/link';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import type { AdminStartShiftChartAnalytics } from '../lib/admin-api';
import { AdminDataTable } from './admin-data-table';
import { AdminCard, AdminCardHeader } from './admin-surface';
import { StartShiftLiveMetrics, type StartShiftLiveMetric } from './start-shift-live-metrics';
import { StatusBadge } from './status-badge';

export { StartShiftLiveMetrics };

type StartShiftChartState = 'empty' | 'ready' | 'stale' | 'unavailable';
type StartShiftBucket = AdminStartShiftChartAnalytics['buckets'][number];

type StartShiftChartWidgetsProps = {
  analytics: AdminStartShiftChartAnalytics | null;
  fallbackBusinessTotals?: {
    grossAmount: string;
    partnerNetAmount: string;
    platformFee: string;
  };
  liveMetrics?: readonly StartShiftLiveMetric[];
  rangeLabel: string;
  section: 'all' | 'business' | 'operations';
  state: StartShiftChartState;
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'VND',
  maximumFractionDigits: 0,
  notation: 'compact',
  style: 'currency',
});

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function compactMoney(value: number) {
  return moneyFormatter.format(value).replace('₫', 'VND ');
}

function sumBuckets(
  analytics: AdminStartShiftChartAnalytics,
  key: keyof Pick<
    StartShiftBucket,
    | 'bookingRequests'
    | 'cashFeeDebtAmount'
    | 'cancelled'
    | 'companyOutputVat'
    | 'completed'
    | 'customerPaymentAmount'
    | 'failedPaymentAmount'
    | 'grossAmount'
    | 'matched'
    | 'noShow'
    | 'partnerNetAmount'
    | 'partnerPayoutAmount'
    | 'partnerWithholdingTotal'
    | 'paymentProcessingFee'
    | 'platformFee'
    | 'platformNetRevenue'
    | 'refundAmount'
    | 'serviceStarted'
  >,
) {
  return analytics.buckets.reduce((sum, bucket) => sum + (bucket[key] ?? 0), 0);
}

function generatedLabel(analytics: AdminStartShiftChartAnalytics | null) {
  if (!analytics) {
    return 'Not generated';
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: analytics.timezone,
  }).format(new Date(analytics.generatedAt));
}

function latestCompletedBucket(analytics: AdminStartShiftChartAnalytics) {
  for (let index = analytics.buckets.length - 1; index >= 0; index -= 1) {
    const bucket = analytics.buckets[index];
    if (bucket && !bucket.isFuture) {
      return bucket;
    }
  }
  return null;
}

function ChartState({ state }: { state: Exclude<StartShiftChartState, 'ready'> }) {
  const copy = {
    empty: ['No activity', 'No activity in this period.'],
    stale: ['Refresh required', 'The latest analytics snapshot is older than five minutes.'],
    unavailable: ['Analytics unavailable', 'The chart source failed without blocking the operational queues.'],
  }[state];

  return (
    <div className="start-shift-chart-state" role={state === 'unavailable' ? 'alert' : 'status'}>
      <strong>{copy[0]}</strong>
      <span>{copy[1]}</span>
    </div>
  );
}

function AccessibleBucketTable({
  analytics,
  columns,
  title,
}: {
  analytics: AdminStartShiftChartAnalytics;
  columns: Array<{ key: keyof StartShiftBucket; label: string }>;
  title: string;
}) {
  return (
    <div className="sr-only">
      <span>{title}</span>
      <AdminDataTable
        emptyMessage={null}
        headers={['Period', ...columns.map((column) => column.label)]}
        rowCount={analytics.buckets.length}
      >
        {analytics.buckets.map((bucket) => (
          <tr key={bucket.key}>
            <th>{bucket.label}</th>
            {columns.map((column) => (
              <td key={column.key}>
                {bucket[column.key] ?? (bucket.isFuture ? 'Future' : 'No data')}
              </td>
            ))}
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}

function BookingFlowTooltip({ active, label, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }
  const bucket = payload[0]?.payload as StartShiftBucket | undefined;
  if (!bucket || bucket.isFuture) {
    return null;
  }
  return (
    <div className="start-shift-chart-tooltip">
      <strong>{label}</strong>
      <div className="start-shift-chart-tooltip-values">
        {payload
          .filter((entry) => entry.value !== null && entry.value !== undefined)
          .map((entry) => (
            <span key={String(entry.dataKey)}>
              {entry.name}: {numberFormatter.format(Number(entry.value))}
            </span>
          ))}
      </div>
      <small>
        Median matching {bucket.medianMatchMinutes ?? 0}m · Payment {compactMoney(bucket.customerPaymentAmount ?? 0)}
      </small>
    </div>
  );
}

function BookingFlowCard({
  analytics,
  liveMetrics = [],
  rangeLabel,
  state,
}: Omit<StartShiftChartWidgetsProps, 'section'>) {
  const isReady = analytics && (state === 'ready' || state === 'stale');
  const currentBucket = isReady ? latestCompletedBucket(analytics) : null;
  const currentIndex = currentBucket && analytics ? analytics.buckets.findIndex((bucket) => bucket.key === currentBucket.key) : -1;
  const recentStart = analytics && currentIndex >= 0 ? analytics.buckets[Math.max(0, currentIndex - 2)] : null;
  const isToday = analytics?.granularity === 'hour';
  const comparison = analytics?.comparison;
  const requestDelta = comparison ? comparison.requestsByNow - comparison.requestsPreviousDay : 0;
  const comparisonLabel = comparison
    ? requestDelta === 0
      ? `${comparison.requestsByNow} requests today; the same as yesterday by now`
      : `${comparison.requestsByNow} requests today; ${Math.abs(requestDelta)} ${requestDelta > 0 ? 'more' : 'fewer'} than yesterday by now`
    : null;

  return (
    <AdminCard ariaLabelledBy="start-shift-booking-flow-title" className="start-shift-chart-card is-booking-flow">
      <AdminCardHeader
        actions={isToday ? <StatusBadge tone="info">Live hour</StatusBadge> : undefined}
        description="Independent event counts grouped by when each event occurred; this is not a booking cohort funnel"
        title={<span id="start-shift-booking-flow-title">Operational events</span>}
      />
      <StartShiftLiveMetrics metrics={liveMetrics} />
      {currentBucket && isToday ? (
        <div className="start-shift-current-hour" aria-label={`Current hour ${currentBucket.label}`}>
          <div>
            <span>Events at {currentBucket.label}</span>
            <strong>
              {currentBucket.bookingRequests ?? 0} requests · {currentBucket.matched ?? 0} matched · {currentBucket.completed ?? 0} completed
            </strong>
          </div>
          <div>
            <span>Decision speed</span>
            <strong>
              {currentBucket.medianMatchMinutes ?? 0}m median matching
            </strong>
          </div>
          <div>
            <span>Outcome</span>
            <strong>
              {currentBucket.cancelled ?? 0} cancelled · {currentBucket.noShow ?? 0} no-show
            </strong>
          </div>
        </div>
      ) : null}
      {comparisonLabel ? <p className="start-shift-comparison-copy">{comparisonLabel}</p> : null}
      {isReady ? (
        <>
          <div className="start-shift-chart-canvas is-booking-flow-chart" aria-hidden="true">
            <ResponsiveContainer height={270} initialDimension={{ height: 270, width: 720 }} minWidth={0} width="100%">
              <ComposedChart data={analytics.buckets} margin={{ bottom: 0, left: -18, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="startShiftRequests" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--admin-primary)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--admin-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--admin-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis axisLine={false} dataKey="label" interval={isToday ? 2 : 'preserveStartEnd'} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip content={BookingFlowTooltip} />
                <Legend />
                {isToday && recentStart && currentBucket ? (
                  <ReferenceArea fill="var(--admin-primary-soft)" fillOpacity={0.42} x1={recentStart.label} x2={currentBucket.label} />
                ) : null}
                {isToday && currentBucket ? (
                  <ReferenceLine label={{ fill: 'var(--admin-primary)', position: 'insideTopRight', value: 'Live' }} stroke="var(--admin-primary)" strokeDasharray="4 4" x={currentBucket.label} />
                ) : null}
                <Area connectNulls={false} dataKey="bookingRequests" fill="url(#startShiftRequests)" isAnimationActive={false} name="Requests" stroke="var(--admin-primary)" strokeWidth={2} type="monotone" />
                {isToday ? <Line connectNulls={false} dataKey="previousRequests" dot={false} isAnimationActive={false} name="Yesterday requests" stroke="var(--admin-muted)" strokeDasharray="4 5" strokeWidth={1.5} type="monotone" /> : null}
                <Line connectNulls={false} dataKey="matched" dot={false} isAnimationActive={false} name="Matched" stroke="var(--admin-info)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="serviceStarted" dot={false} isAnimationActive={false} name="Started" stroke="var(--admin-warning)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="completed" dot={false} isAnimationActive={false} name="Completed" stroke="var(--admin-success)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="cancelled" dot={false} isAnimationActive={false} name="Cancelled" stroke="var(--admin-danger)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="noShow" dot={false} isAnimationActive={false} name="No show" stroke="var(--admin-warning-text)" strokeDasharray="5 4" strokeWidth={2} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <AccessibleBucketTable
            analytics={analytics}
            columns={[
              { key: 'bookingRequests', label: 'Requests' },
              { key: 'matched', label: 'Matched' },
              { key: 'serviceStarted', label: 'Started' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' },
              { key: 'noShow', label: 'No show' },
              { key: 'medianMatchMinutes', label: 'Median match minutes' },
            ]}
            title={`Operational events, ${rangeLabel}`}
          />
        </>
      ) : <ChartState state={state === 'ready' ? 'empty' : state} />}
    </AdminCard>
  );
}

function ShiftOutcomeCard({ analytics, state }: Omit<StartShiftChartWidgetsProps, 'liveMetrics' | 'section'>) {
  const isReady = analytics && (state === 'ready' || state === 'stale');
  const requests = isReady ? sumBuckets(analytics, 'bookingRequests') : 0;
  const matched = isReady ? sumBuckets(analytics, 'matched') : 0;
  const outcomeRows = isReady ? [
    ['Requests', requests],
    ['Matched', matched],
    ['Started', sumBuckets(analytics, 'serviceStarted')],
    ['Completed', sumBuckets(analytics, 'completed')],
    ['Cancelled', sumBuckets(analytics, 'cancelled')],
    ['No show', sumBuckets(analytics, 'noShow')],
  ] as const : [];

  return (
    <AdminCard ariaLabelledBy="start-shift-outcome-title" className="start-shift-chart-card is-shift-outcome">
      <AdminCardHeader
        description="Period totals use each event's own timestamp and are not conversion rates"
        title={<span id="start-shift-outcome-title">Period event totals</span>}
      />
      {isReady ? (
        <div className="start-shift-outcome-body">
          <dl className="start-shift-outcome-list">
            {outcomeRows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{numberFormatter.format(value)}</dd></div>
            ))}
          </dl>
        </div>
      ) : <ChartState state={state === 'ready' ? 'empty' : state} />}
    </AdminCard>
  );
}

function BusinessResultCard({
  analytics,
  fallbackBusinessTotals,
  rangeLabel,
  state,
}: Omit<StartShiftChartWidgetsProps, 'liveMetrics' | 'section'>) {
  const isReady = analytics && (state === 'ready' || state === 'stale');
  const totals = isReady
    ? {
        cashFeeDebtAmount: compactMoney(sumBuckets(analytics, 'cashFeeDebtAmount')),
        customerPaymentAmount: compactMoney(sumBuckets(analytics, 'customerPaymentAmount')),
        failedPaymentAmount: compactMoney(sumBuckets(analytics, 'failedPaymentAmount')),
        partnerPayoutAmount: compactMoney(sumBuckets(analytics, 'partnerPayoutAmount')),
        platformNetRevenue: compactMoney(sumBuckets(analytics, 'platformNetRevenue')),
        refundAmount: compactMoney(sumBuckets(analytics, 'refundAmount')),
      }
    : fallbackBusinessTotals
      ? {
          cashFeeDebtAmount: 'Unavailable',
          customerPaymentAmount: fallbackBusinessTotals.grossAmount,
          failedPaymentAmount: 'Unavailable',
          partnerPayoutAmount: fallbackBusinessTotals.partnerNetAmount,
          platformNetRevenue: fallbackBusinessTotals.platformFee,
          refundAmount: 'Unavailable',
        }
      : null;
  const accountingTotals = isReady ? [
    ['Company output VAT', sumBuckets(analytics, 'companyOutputVat')],
    ['Partner withholding', sumBuckets(analytics, 'partnerWithholdingTotal')],
    ['Payment processing fee', sumBuckets(analytics, 'paymentProcessingFee')],
  ] as const : [];

  return (
    <AdminCard ariaLabelledBy="start-shift-business-title" className="start-shift-chart-card is-business-result">
      <AdminCardHeader
        description="Customer money, HANDS revenue, Partner payout, and unresolved money risk"
        title={<span id="start-shift-business-title">Money flow</span>}
      />
      {totals ? (
        <div className="start-shift-money-totals">
          <div><span>Customer payments</span><strong>{totals.customerPaymentAmount}</strong></div>
          <div><span>Platform net revenue</span><strong>{totals.platformNetRevenue}</strong></div>
          <div><span>Partner payout</span><strong>{totals.partnerPayoutAmount}</strong></div>
          <div><span>Refunds</span><strong>{totals.refundAmount}</strong></div>
          <div><span>Cash fee debt</span><strong>{totals.cashFeeDebtAmount}</strong></div>
          <div><span>Failed payments</span><strong>{totals.failedPaymentAmount}</strong></div>
        </div>
      ) : null}
      {isReady ? (
        <>
          <div className="start-shift-chart-canvas" aria-hidden="true">
            <ResponsiveContainer height={230} initialDimension={{ height: 230, width: 640 }} minWidth={0} width="100%">
              <ComposedChart data={analytics.buckets} margin={{ bottom: 0, left: 0, right: 10, top: 8 }}>
                <CartesianGrid stroke="var(--admin-border)" strokeDasharray="3 4" vertical={false} />
                <XAxis axisLine={false} dataKey="label" interval={analytics.granularity === 'hour' ? 2 : 'preserveStartEnd'} tickLine={false} />
                <YAxis axisLine={false} tickFormatter={compactMoney} tickLine={false} width={76} />
                <Tooltip formatter={(value) => compactMoney(Number(value ?? 0))} contentStyle={{ background: 'var(--admin-surface-raised)', border: '1px solid var(--admin-border)' }} />
                <Legend />
                <Area connectNulls={false} dataKey="customerPaymentAmount" fill="var(--admin-primary-soft)" isAnimationActive={false} name="Customer payment" stroke="var(--admin-primary)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="platformNetRevenue" dot={false} isAnimationActive={false} name="Platform net" stroke="var(--admin-info)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="partnerPayoutAmount" dot={false} isAnimationActive={false} name="Partner payout" stroke="var(--admin-success)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="refundAmount" dot={false} isAnimationActive={false} name="Refunds" stroke="var(--admin-danger)" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="cashFeeDebtAmount" dot={false} isAnimationActive={false} name="Cash fee debt" stroke="var(--admin-warning)" strokeDasharray="5 4" strokeWidth={2} type="monotone" />
                <Line connectNulls={false} dataKey="failedPaymentAmount" dot={false} isAnimationActive={false} name="Failed payments" stroke="var(--admin-danger-text)" strokeDasharray="2 4" strokeWidth={2} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="start-shift-accounting-strip" aria-label="Accounting amounts kept outside revenue">
            {accountingTotals.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{compactMoney(value)}</strong></div>
            ))}
          </div>
          <AccessibleBucketTable
            analytics={analytics}
            columns={[
              { key: 'customerPaymentAmount', label: 'Customer payment amount' },
              { key: 'platformNetRevenue', label: 'Platform net revenue' },
              { key: 'partnerPayoutAmount', label: 'Partner payout amount' },
              { key: 'companyOutputVat', label: 'Company output VAT' },
              { key: 'partnerWithholdingTotal', label: 'Partner withholding' },
              { key: 'refundAmount', label: 'Refund amount' },
              { key: 'cashFeeDebtAmount', label: 'Cash fee debt' },
              { key: 'failedPaymentAmount', label: 'Failed payment amount' },
            ]}
            title={`Money flow, ${rangeLabel}`}
          />
        </>
      ) : <ChartState state={state === 'ready' ? 'empty' : state} />}
    </AdminCard>
  );
}

function CustomerActivityCard({ analytics, rangeLabel, state }: Omit<StartShiftChartWidgetsProps, 'liveMetrics' | 'section'>) {
  const isReady = analytics && (state === 'ready' || state === 'stale');
  const data = isReady ? [
    { label: 'Active 15m', value: analytics.customerPulse.recentActiveCustomers },
    { label: 'App opens', value: analytics.customerPulse.appOpenEvents },
    { label: 'Session starts', value: analytics.customerPulse.sessionStartEvents },
    { label: 'Profile views', value: analytics.customerPulse.providerProfileViews },
    { label: 'Booked', value: analytics.customerPulse.bookingCustomers },
    { label: 'First booking', value: analytics.customerPulse.firstBookingCustomers },
    { label: 'Repeat', value: analytics.customerPulse.repeatCustomers },
    { label: 'High intent', value: analytics.customerPulse.highIntentNoBookingCustomers },
    { label: 'Payment failed', value: analytics.customerPulse.failedPaymentCustomers },
    { label: 'Match failed', value: analytics.customerPulse.matchingFailureCustomers },
  ] : [];

  return (
    <AdminCard ariaLabelledBy="start-shift-customer-title" className="start-shift-chart-card is-customer-activity">
      <AdminCardHeader
        description="Active customers, booking intent, repeat use, and failure signals"
        title={<span id="start-shift-customer-title">Customer activity</span>}
      />
      {isReady ? (
        <>
          <div className="start-shift-customer-facts">
            <span>Tracked customer activity</span>
            <strong>{numberFormatter.format(analytics.customerPulse.activeCustomerRecords)}</strong>
            <small>
              {numberFormatter.format(analytics.customerPulse.appOpenEvents)} app opens ·{' '}
              {numberFormatter.format(analytics.customerPulse.sessionStartEvents)} sessions ·{' '}
              {numberFormatter.format(analytics.customerPulse.providerProfileViews)} profile views
            </small>
          </div>
          <div className="start-shift-chart-canvas is-customer-chart" aria-hidden="true">
            <ResponsiveContainer height={255} initialDimension={{ height: 255, width: 420 }} minWidth={0} width="100%">
              <BarChart data={data} layout="vertical" margin={{ bottom: 0, left: 14, right: 16, top: 6 }}>
                <CartesianGrid horizontal={false} stroke="var(--admin-border)" strokeDasharray="3 4" />
                <XAxis allowDecimals={false} axisLine={false} tickLine={false} type="number" />
                <YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={92} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--admin-info)" isAnimationActive={false} name="Customers" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="sr-only">
            <span>Customer activity, {rangeLabel}</span>
            <AdminDataTable emptyMessage={null} headers={['Metric', 'Customers']} rowCount={data.length}>
              {data.map((row) => <tr key={row.label}><th>{row.label}</th><td>{row.value}</td></tr>)}
            </AdminDataTable>
          </div>
        </>
      ) : <ChartState state={state === 'ready' ? 'empty' : state} />}
    </AdminCard>
  );
}

export function StartShiftChartWidgets(props: StartShiftChartWidgetsProps) {
  if (props.state === 'empty' && props.section === 'all') {
    return (
      <div className="start-shift-chart-empty" role="status">
        <strong>No bookings or customer activity today.</strong>
        <Link className="text-link" href="/?range=7d#dashboard-today-result" prefetch={false}>
          View last 7 days
        </Link>
      </div>
    );
  }

  const statusClass = props.state === 'stale' ? ' is-stale' : props.state === 'unavailable' ? ' is-unavailable' : '';
  const showOperations = props.section === 'all' || props.section === 'operations';
  const showBusiness = props.section === 'all' || props.section === 'business';
  return (
    <div className={`start-shift-chart-grid is-${props.section}${statusClass}`}>
      {props.state === 'stale' ? (
        <div className="start-shift-chart-warning" role="status">
          This snapshot is stale. Refresh before making a time-sensitive decision.
        </div>
      ) : null}
      {showOperations ? (
        <>
          <BookingFlowCard {...props} />
          <ShiftOutcomeCard analytics={props.analytics} rangeLabel={props.rangeLabel} state={props.state} />
        </>
      ) : null}
      {showBusiness ? (
        <>
          <BusinessResultCard
            analytics={props.analytics}
            fallbackBusinessTotals={props.fallbackBusinessTotals}
            rangeLabel={props.rangeLabel}
            state={props.state}
          />
          <CustomerActivityCard analytics={props.analytics} rangeLabel={props.rangeLabel} state={props.state} />
        </>
      ) : null}
      <p className="start-shift-chart-generated">
        Generated {generatedLabel(props.analytics)} · Vietnam time
      </p>
    </div>
  );
}
