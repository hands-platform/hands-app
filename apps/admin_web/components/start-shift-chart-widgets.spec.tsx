import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminStartShiftAnalytics } from '../lib/admin-api';
import {
  StartShiftChartWidgets,
  StartShiftLiveMetrics,
} from './start-shift-chart-widgets';

const analytics: AdminStartShiftAnalytics = {
  buckets: [
    {
      bookingRequests: 10,
      cashFeeDebtAmount: 40_000,
      cancelled: 1,
      companyOutputVat: 20_000,
      completed: 7,
      customerPaymentAmount: 1_000_000,
      failedPaymentAmount: 0,
      grossAmount: 1_000_000,
      isFuture: false,
      key: '2026-07-18',
      label: '18 Jul',
      matchRate: 80,
      matched: 8,
      medianMatchMinutes: 4,
      noShow: 1,
      partnerNetAmount: 700_000,
      partnerPayoutAmount: 700_000,
      partnerWithholdingTotal: 50_000,
      paymentProcessingFee: 20_000,
      platformFee: 200_000,
      platformNetRevenue: 180_000,
      previousRequests: null,
      refundAmount: 100_000,
      serviceStarted: 7,
    },
  ],
  comparison: null,
  customerPulse: {
    activeCustomerRecords: 5,
    appOpenEvents: 2,
    bookingCustomers: 6,
    completedBookings: 7,
    failedPaymentCustomers: 1,
    firstBookingCustomers: 2,
    highIntentNoBookingCustomers: 3,
    matchingFailureCustomers: 1,
    openMatchAverageWaitMinutes: 4,
    preferredRequests: 3,
    providerProfileViews: 8,
    recentActiveCustomers: 4,
    repeatCustomers: 2,
    sessionStartEvents: 1,
  },
  customerRankings: {
    highestValue: [],
    mostActive: [],
    mostCompleted: [],
    needsAttention: [],
  },
  demandSupply: { failureRegions: [], services: [] },
  generatedAt: '2026-07-18T02:00:00.000Z',
  granularity: 'day',
  needsAction: [],
  partnerRankings: {
    fastestResponse: [],
    highestRated: [],
    mostActive: [],
    mostCompleted: [],
    needsAttention: [],
  },
  range: '7d',
  timezone: 'Asia/Ho_Chi_Minh',
};

describe('StartShiftChartWidgets', () => {
  it('renders current live metrics without attaching a selected-period chart', () => {
    const markup = renderToStaticMarkup(
      <StartShiftLiveMetrics
        metrics={[
          { href: '/bookings?view=matching', label: 'Matching now', value: 3 },
          { href: '/customers?activity=recent', label: 'Active customers 15m', value: 7 },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="Current live operations"');
    expect(markup).toContain('href="/bookings?view=matching"');
    expect(markup).toContain('<span>Active customers 15m</span><strong>7</strong>');
    expect(markup).not.toContain('Booking flow');
  });

  it('renders accessible operational summaries without sample data', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={analytics}
        liveMetrics={[{ label: 'In service', value: 2 }]}
        rangeLabel="Today"
        section="operations"
        state="ready"
      />,
    );

    expect(markup).toContain('Operational events');
    expect(markup).toContain('Period event totals');
    expect(markup).toContain('<span>Operational events, Today</span>');
    expect(markup).toContain('Independent event counts');
    expect(markup).not.toContain('Request-to-completion');
    expect(markup).not.toContain('Match rate');
    expect(markup).not.toContain('Sample');
  });

  it('isolates an unavailable analytics source from the rest of the dashboard', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={null}
        rangeLabel="Last 7 days"
        section="business"
        state="unavailable"
      />,
    );

    expect(markup).toContain('Analytics unavailable');
    expect(markup).toContain('failed without blocking the operational queues');
    expect(markup).not.toContain('Money flow, Last 7 days');
  });

  it('labels customer usage with actual app and profile events', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={analytics}
        rangeLabel="Last 7 days"
        section="business"
        state="ready"
      />,
    );

    expect(markup).toContain('Tracked customer activity');
    expect(markup).toContain('2 app opens');
    expect(markup).toContain('1 sessions');
    expect(markup).toContain('8 profile views');
  });

  it('keeps all selected-period outcomes under one shared range', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={analytics}
        rangeLabel="Last 7 days"
        section="all"
        state="ready"
      />,
    );

    expect(markup).toContain('Operational events');
    expect(markup).toContain('Period event totals');
    expect(markup).toContain('Money flow');
    expect(markup).toContain('Customer activity');
    expect(markup).toContain('class="start-shift-chart-grid is-all"');
  });

  it('collapses an empty Today result into one compact state', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets analytics={analytics} rangeLabel="Today" section="all" state="empty" />,
    );

    expect(markup).toContain('No bookings or customer activity today.');
    expect(markup).toContain('/?range=7d#dashboard-today-result');
    expect(markup).not.toContain('Operational events');
    expect(markup).not.toContain('Money flow');
  });

  it('states Today comparisons as facts instead of signed shorthand', () => {
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={{
          ...analytics,
          comparison: {
            completedByNow: 0,
            completedPreviousDay: 7,
            grossByNow: 0,
            grossPreviousDay: 1_000_000,
            matchedByNow: 0,
            matchedPreviousDay: 8,
            requestsByNow: 0,
            requestsPreviousDay: 13,
          },
          granularity: 'hour',
          range: 'today',
        }}
        rangeLabel="Today"
        section="operations"
        state="ready"
      />,
    );

    expect(markup).toContain('0 requests today; 13 fewer than yesterday by now');
    expect(markup).not.toContain('-13 requests');
  });

  it('distinguishes past buckets without data from future buckets', () => {
    const pastBucket = {
      ...analytics.buckets[0],
      key: '2026-07-19T03:00',
      label: '03:00',
      medianMatchMinutes: null,
    };
    const futureBucket = {
      ...analytics.buckets[0],
      bookingRequests: null,
      isFuture: true,
      key: '2026-07-19T05:00',
      label: '05:00',
      medianMatchMinutes: null,
    };
    const markup = renderToStaticMarkup(
      <StartShiftChartWidgets
        analytics={{ ...analytics, buckets: [pastBucket, futureBucket], granularity: 'hour', range: 'today' }}
        rangeLabel="Today (Vietnam)"
        section="operations"
        state="ready"
      />,
    );

    expect(markup).toMatch(/<th>03:00<\/th>[\s\S]*?<td>No data<\/td>/);
    expect(markup).toMatch(/<th>05:00<\/th>[\s\S]*?<td>Future<\/td>/);
  });
});
