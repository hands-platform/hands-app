import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminStartShiftAnalytics } from '../lib/admin-api';
import {
  rankingTabTargetIndex,
  StartShiftDemandSupplyWidgets,
  StartShiftRankingWidgets,
} from './start-shift-ranking-widgets';

const analytics = {
  buckets: [
    {
      bookingRequests: 8,
      cashFeeDebtAmount: 0,
      cancelled: 0,
      companyOutputVat: 0,
      completed: 4,
      customerPaymentAmount: 800_000,
      failedPaymentAmount: 0,
      grossAmount: 800_000,
      isFuture: false,
      key: '2026-07-18T09:00',
      label: '09:00',
      matchRate: 63,
      matched: 5,
      medianMatchMinutes: 4,
      noShow: 0,
      partnerNetAmount: 560_000,
      partnerPayoutAmount: 560_000,
      partnerWithholdingTotal: 40_000,
      paymentProcessingFee: 0,
      platformFee: 160_000,
      platformNetRevenue: 145_000,
      previousRequests: 6,
      refundAmount: 0,
      serviceStarted: 4,
    },
  ],
  comparison: null,
  customerPulse: {
    activeCustomerRecords: 0,
    appOpenEvents: 0,
    bookingCustomers: 0,
    completedBookings: 0,
    failedPaymentCustomers: 0,
    firstBookingCustomers: 0,
    highIntentNoBookingCustomers: 0,
    matchingFailureCustomers: 0,
    openMatchAverageWaitMinutes: 0,
    preferredRequests: 0,
    providerProfileViews: 0,
    recentActiveCustomers: 0,
    repeatCustomers: 0,
    sessionStartEvents: 0,
  },
  customerRankings: {
    highestValue: [],
    mostActive: [
      {
        activeRecords: 12,
        appOpenEvents: 5,
        completedBookings: 4,
        customerProfileId: 'customer-1',
        displayName: 'Customer One',
        href: '/customers/customer-1',
        issueBreakdown: { cancellation: 0, matching: 1, payment: 0, refund: 0 },
        issueCount: 1,
        lastActiveAt: '2026-07-18T02:00:00.000Z',
        rank: 1,
        providerProfileViews: 4,
        sessionStartEvents: 3,
        spendAmount: 900_000,
      },
    ],
    mostCompleted: [],
    needsAttention: [],
  },
  demandSupply: {
    failureRegions: [{ id: 'district-1', label: 'District 1', matchingFailureCount: 3 }],
    services: [{ demandCount: 8, id: 'service-1', label: 'Deep tissue', matchingFailureCount: 2, readyPartnerCount: 3 }],
  },
  partnerRankings: {
    fastestResponse: [],
    highestRated: [],
    mostActive: [
      {
        acceptanceRate: 90,
        activeRecords: 10,
        appOpenEvents: 6,
        completedBookings: 8,
        displayName: 'Partner One',
        earningsAmount: 1_000_000,
        href: '/partners/partner-1',
        issueBreakdown: { blocked: 0, cancellation: 0, inactive: 0 },
        issueCount: 0,
        lastActiveAt: '2026-07-18T03:00:00.000Z',
        medianResponseMinutes: 2.5,
        providerProfileId: 'partner-1',
        rank: 1,
        rating: 4.9,
        sessionStartEvents: 4,
        status: 'ONLINE_AVAILABLE',
      },
    ],
    mostCompleted: [
      {
        acceptanceRate: 90,
        activeRecords: 10,
        appOpenEvents: 6,
        completedBookings: 8,
        displayName: 'Partner One',
        earningsAmount: 1_000_000,
        href: '/partners/partner-1',
        issueBreakdown: { blocked: 0, cancellation: 0, inactive: 0 },
        issueCount: 0,
        lastActiveAt: '2026-07-18T03:00:00.000Z',
        medianResponseMinutes: 2.5,
        providerProfileId: 'partner-1',
        rank: 1,
        rating: 4.9,
        sessionStartEvents: 4,
        status: 'ONLINE_AVAILABLE',
      },
    ],
    needsAttention: [],
  },
  generatedAt: '2026-07-18T02:00:00.000Z',
  granularity: 'hour',
  needsAction: [],
  range: 'today',
  timezone: 'Asia/Ho_Chi_Minh',
} satisfies AdminStartShiftAnalytics;

describe('Start Shift ranking and demand widgets', () => {
  it('keeps customer and Partner ranking meanings separate', () => {
    const markup = renderToStaticMarkup(<StartShiftRankingWidgets analytics={analytics} rangeLabel="Today" />);

    expect(markup).toContain('Top customers');
    expect(markup).toContain('Partner performance');
    expect(markup).toContain('Customer One');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('App activity');
    expect(markup).toContain('Sessions');
    expect(markup).toContain('Profile views');
    expect(markup).not.toContain('Fastest response <span>0</span>');
    expect(markup).toContain('Ordered by app activity, then Partner profile views');
    expect(markup).toContain('Ordered by app activity, then authenticated sessions');
    expect(markup).toContain('id="start-shift-partner-ranking-tab-mostActive"');
    expect(markup).toContain('aria-controls="start-shift-partner-ranking-panel"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('Most active <span>1</span>');
  });

  it('normalizes legacy Provider seed names in visible Partner rankings', () => {
    const legacyNameAnalytics = {
      ...analytics,
      partnerRankings: {
        ...analytics.partnerRankings,
        mostActive: analytics.partnerRankings.mostActive.map((row) => ({
          ...row,
          displayName: 'Provider 0011',
        })),
      },
    } satisfies AdminStartShiftAnalytics;

    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets analytics={legacyNameAnalytics} rangeLabel="Today" />,
    );

    expect(markup).toContain('Partner 0011');
    expect(markup).not.toContain('Provider 0011');
  });

  it('opens Partner needs-attention first and uses decision-only columns', () => {
    const partner = analytics.partnerRankings.mostActive[0];
    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets
        analytics={{
          ...analytics,
          partnerRankings: {
            ...analytics.partnerRankings,
            needsAttention: [{
              ...partner,
              issueBreakdown: { blocked: 1, cancellation: 0, inactive: 0 },
              issueCount: 1,
            }],
          },
        }}
        rangeLabel="Today"
      />,
    );
    const partnerPanel = markup.slice(markup.indexOf('Partner performance'));

    expect(partnerPanel).toContain('aria-selected="true"');
    expect(partnerPanel).toContain('Needs attention <span>1</span>');
    expect(partnerPanel).toContain('<th scope="col">Issue</th>');
    expect(partnerPanel).toContain('<th scope="col">Last activity</th>');
    expect(partnerPanel).not.toContain('<th scope="col">Earnings</th>');
  });

  it('collapses a needs-attention-only Partner ranking to its operational view', () => {
    const partner = analytics.partnerRankings.mostActive[0];
    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets
        analytics={{
          ...analytics,
          customerRankings: { highestValue: [], mostActive: [], mostCompleted: [], needsAttention: [] },
          partnerRankings: {
            fastestResponse: [],
            highestRated: [],
            mostActive: [],
            mostCompleted: [],
            needsAttention: [{
              ...partner,
              issueBreakdown: { blocked: 1, cancellation: 0, inactive: 0 },
              issueCount: 1,
            }],
          },
        }}
        rangeLabel="Today"
      />,
    );

    expect(markup).toContain('Partner needs attention');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('role="tabpanel"');
    expect(markup).not.toContain('Most active <span>0</span>');
    expect(markup).not.toContain('Fastest response <span>0</span>');
  });

  it('renders Customer attention without a tablist when it is the only mode', () => {
    const customer = analytics.customerRankings.mostActive[0];
    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets
        analytics={{
          ...analytics,
          customerRankings: {
            highestValue: [],
            mostActive: [],
            mostCompleted: [],
            needsAttention: [{ ...customer, issueCount: 1 }],
          },
          partnerRankings: { fastestResponse: [], highestRated: [], mostActive: [], mostCompleted: [], needsAttention: [] },
        }}
        rangeLabel="Today"
      />,
    );

    expect(markup).toContain('Customer needs attention');
    expect(markup).not.toContain('role="tablist"');
  });

  it('renders both attention tables without empty mode tabs', () => {
    const customer = analytics.customerRankings.mostActive[0];
    const partner = analytics.partnerRankings.mostActive[0];
    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets
        analytics={{
          ...analytics,
          customerRankings: {
            highestValue: [],
            mostActive: [],
            mostCompleted: [],
            needsAttention: [{ ...customer, issueCount: 1 }],
          },
          partnerRankings: {
            fastestResponse: [],
            highestRated: [],
            mostActive: [],
            mostCompleted: [],
            needsAttention: [{ ...partner, issueCount: 1 }],
          },
        }}
        rangeLabel="Today"
      />,
    );

    expect(markup).toContain('Customer needs attention');
    expect(markup).toContain('Partner needs attention');
    expect(markup).not.toContain('role="tablist"');
  });

  it('labels exact negative Partner net earnings for Finance review', () => {
    const partner = analytics.partnerRankings.mostActive[0];
    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets
        analytics={{
          ...analytics,
          customerRankings: { highestValue: [], mostActive: [], mostCompleted: [], needsAttention: [] },
          partnerRankings: {
            fastestResponse: [],
            highestRated: [],
            mostActive: [],
            mostCompleted: [{ ...partner, earningsAmount: -125_000 }],
            needsAttention: [],
          },
        }}
        rangeLabel="Last 7 days"
      />,
    );

    expect(markup).toContain('<th scope="col">Net earnings</th>');
    expect(markup).toContain('-125.000 VND');
    expect(markup).toContain('Finance review');
    expect(markup).not.toContain('debt');
  });

  it('supports wrapped arrow, Home, and End tab navigation', () => {
    expect(rankingTabTargetIndex(0, 5, 'ArrowLeft')).toBe(4);
    expect(rankingTabTargetIndex(4, 5, 'ArrowRight')).toBe(0);
    expect(rankingTabTargetIndex(3, 5, 'Home')).toBe(0);
    expect(rankingTabTargetIndex(1, 5, 'End')).toBe(4);
  });

  it('links each open issue badge to its focused operations queue', () => {
    const customer = analytics.customerRankings.mostActive[0];
    const partner = analytics.partnerRankings.mostActive[0];
    const drillDownAnalytics: AdminStartShiftAnalytics = {
      ...analytics,
      customerRankings: {
        ...analytics.customerRankings,
        needsAttention: [
          {
            ...customer,
            issueBreakdown: { cancellation: 2, matching: 1, payment: 3, refund: 4 },
            issueCount: 10,
          },
        ],
      },
      partnerRankings: {
        ...analytics.partnerRankings,
        needsAttention: [
          {
            ...partner,
            issueBreakdown: { blocked: 1, cancellation: 2, inactive: 1 },
            issueCount: 4,
          },
        ],
      },
    };

    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets analytics={drillDownAnalytics} rangeLabel="Today" />,
    );

    expect(markup).toContain('/bookings?view=matching&amp;q=customer-1');
    expect(markup).toContain(
      '/bookings/post-match-cancellations?view=manual-decision&amp;dateRange=all&amp;q=customer-1',
    );
    expect(markup).toContain(
      '/payments?range=all&amp;review=failed-active&amp;customerProfileId=customer-1',
    );
    expect(markup).toContain('/refunds?range=all&amp;review=open&amp;customerProfileId=customer-1');
    expect(markup).toContain(
      '/bookings/post-match-cancellations?view=manual-decision&amp;dateRange=all&amp;q=partner-1',
    );
  });

  it('shows bounded demand, ready supply, hourly gap, and failure areas', () => {
    const markup = renderToStaticMarkup(<StartShiftDemandSupplyWidgets analytics={analytics} readyPartners={4} />);

    expect(markup).toContain('Service demand and supply');
    expect(markup).toContain('Ready now');
    expect(markup).toContain('Unmatched');
    expect(markup).toContain('8');
    expect(markup).toContain('3');
    expect(markup).toContain('Matching pressure');
    expect(markup).toContain('District 1');
    expect(markup).toContain('/vietnam-overview');
  });

  it('collapses empty customer and Partner rankings into one compact period state', () => {
    const emptyAnalytics: AdminStartShiftAnalytics = {
      ...analytics,
      customerRankings: { highestValue: [], mostActive: [], mostCompleted: [], needsAttention: [] },
      partnerRankings: { fastestResponse: [], highestRated: [], mostActive: [], mostCompleted: [], needsAttention: [] },
    };

    const markup = renderToStaticMarkup(
      <StartShiftRankingWidgets analytics={emptyAnalytics} rangeLabel="Today" />,
    );

    expect(markup).toContain('No activity leaders for Today');
    expect(markup).toContain('/?range=7d#dashboard-performance-leaders');
    expect(markup).not.toContain('Top customers');
    expect(markup).not.toContain('Partner performance');
  });
});
