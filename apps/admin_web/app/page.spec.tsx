import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminDashboardSummary,
  AdminEarningSummary,
  AdminExternalReadiness,
  AdminNotificationBoardSummary,
  AdminPaymentSummary,
  AdminPayoutBatchSummary,
  AdminRefundSummary,
  AdminStartShiftSummary,
} from '../lib/admin-api';
import { adminGet, apiGet } from '../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import DashboardPage from './page';

vi.mock('../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/admin-api')>('../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    apiGet: vi.fn(),
  };
});

vi.mock('../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedApiGet = vi.mocked(apiGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const dashboardSource = readFileSync('app/page.tsx', 'utf8');
const dashboardTraceSummarySource = readFileSync('app/dashboard-trace-summary.tsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');
const START_SHIFT_SUMMARY_HREF = '/admin/dashboard/start-shift-summary?dateRange=today';
const START_SHIFT_ANALYTICS_HREF = '/admin/dashboard/start-shift-analytics?dateRange=today';

async function renderDashboardMarkup(page: ReactNode) {
  const stream = await renderToReadableStream(page);
  await stream.allReady;
  return new Response(stream).text();
}

function startShiftAdminResponse(href: string, fallback: unknown, aggregate: AdminStartShiftSummary) {
  if (href === START_SHIFT_SUMMARY_HREF) return aggregate;
  if (href === START_SHIFT_ANALYTICS_HREF) return aggregate.analytics;
  return fallback;
}

function startShiftSummaryFixture(): AdminStartShiftSummary {
  const generatedAt = new Date().toISOString();
  return {
    analytics: {
      buckets: [
        {
          bookingRequests: 5,
          cashFeeDebtAmount: 25000,
          cancelled: 1,
          companyOutputVat: 10000,
          completed: 3,
          customerPaymentAmount: 500000,
          failedPaymentAmount: 0,
          grossAmount: 500000,
          isFuture: false,
          key: '2026-07-18T09:00',
          label: '09:00',
          matchRate: 80,
          matched: 4,
          medianMatchMinutes: 4.2,
          noShow: 0,
          partnerNetAmount: 350000,
          partnerPayoutAmount: 350000,
          partnerWithholdingTotal: 15000,
          paymentProcessingFee: 5000,
          platformFee: 100000,
          platformNetRevenue: 90000,
          previousRequests: 4,
          refundAmount: 50000,
          serviceStarted: 3,
        },
      ],
      comparison: {
        completedByNow: 3,
        completedPreviousDay: 2,
        grossByNow: 500000,
        grossPreviousDay: 400000,
        matchedByNow: 4,
        matchedPreviousDay: 3,
        requestsByNow: 5,
        requestsPreviousDay: 4,
      },
      customerPulse: {
        activeCustomerRecords: 4,
        appOpenEvents: 2,
        bookingCustomers: 4,
        completedBookings: 3,
        failedPaymentCustomers: 0,
        firstBookingCustomers: 2,
        highIntentNoBookingCustomers: 1,
        matchingFailureCustomers: 1,
        openMatchAverageWaitMinutes: 4.2,
        preferredRequests: 2,
        providerProfileViews: 6,
        recentActiveCustomers: 3,
        repeatCustomers: 1,
        sessionStartEvents: 1,
      },
      customerRankings: {
        highestValue: [],
        mostActive: [],
        mostCompleted: [],
        needsAttention: [],
      },
      demandSupply: { failureRegions: [], services: [] },
      generatedAt,
      granularity: 'hour',
      needsAction: [
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 2, underOneHour: 0 },
          amount: 750_000,
          count: 2,
          href: '/payments?range=all&review=authorized&sort=oldest',
          key: 'payment-holds',
          label: 'Payment holds',
          nextCases: {
            current: [],
            legacy: ['booking-payment-hold-1', 'booking-payment-hold-2'],
            overdue: [],
          },
          oldestAt: generatedAt,
          operatorAction: 'Capture completed services or release invalid authorization holds.',
          overdueCount: 2,
          slaMinutes: 60,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 1 },
          amount: 0,
          count: 1,
          href: '/bookings?view=matching-delays&sort=oldest',
          key: 'matching-delays',
          label: 'Matching delays',
          oldestAt: generatedAt,
          operatorAction: 'Re-invite available Partners or contact the waiting customer.',
          slaMinutes: 15,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
          amount: 0,
          count: 0,
          href: '/bookings/post-match-cancellations?view=manual-decision&dateRange=all&sort=oldest',
          key: 'cancellation-review',
          label: 'Cancellation review',
          oldestAt: null,
          operatorAction: 'Decide the fee outcome and close the cancellation evidence.',
          slaMinutes: 120,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
          amount: 0,
          count: 0,
          href: '/refunds?range=all&review=open&sort=oldest',
          key: 'refund-review',
          label: 'Refund review',
          oldestAt: null,
          operatorAction: 'Confirm eligibility and complete the payment reversal or rejection.',
          slaMinutes: 240,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
          amount: 0,
          count: 0,
          href: '/partners?review=approval-pending&sort=oldest',
          key: 'partner-approvals',
          label: 'Partner approvals',
          oldestAt: null,
          operatorAction: 'Approve submitted KYC or return it with a clear reason.',
          slaMinutes: 1_440,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
          amount: 0,
          count: 0,
          href: '/cash-settlements?range=all&sort=oldest',
          key: 'cash-reconciliation',
          label: 'Cash reconciliation',
          oldestAt: null,
          operatorAction: 'Recover open HANDS fee and tax debt from cash bookings.',
          slaMinutes: 1_440,
        },
        {
          ageing: { fourToTwentyFourHours: 0, oneToFourHours: 0, overTwentyFourHours: 0, underOneHour: 0 },
          amount: 0,
          count: 0,
          href: '/notifications?range=all&review=unresolved-failed&sort=oldest',
          key: 'notification-failures',
          label: 'Notification failures',
          oldestAt: null,
          operatorAction: 'Repair the destination device or retry unresolved delivery failures.',
          slaMinutes: 60,
        },
      ],
      partnerRankings: {
        fastestResponse: [],
        highestRated: [],
        mostActive: [],
        mostCompleted: [],
        needsAttention: [],
      },
      range: 'today',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    cashSettlements: {
      cashPaymentRowCount: 0,
      currency: 'VND',
      generatedAt,
      highDebtProviderCount: 0,
      missingPaymentEvidenceCount: 0,
      oldestOpenAgeMinutes: 0,
      oldestOpenAt: null,
      providerCount: 0,
      rowCount: 0,
      staleDebtRowCount: 0,
      topProviderGroups: [],
      totalCompanyCouponOffset: 0,
      totalDebtAmount: 0,
      totalPlatformFee: 0,
      totalTaxAmount: 0,
    },
    earnings: {
      availableNetAmount: 0,
      count: 0,
      currency: 'VND',
      generatedAt,
      grossAmount: 0,
      netAmount: 0,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
    },
    financeReviewWorkload: {
      bankReconciliation: {
        currency: 'VND',
        openAmount: 0,
        openCount: 0,
        owners: [],
        unassigned: {
          oldestOccurredAt: null,
          openAmount: 0,
          openCount: 0,
          over48hAmount: 0,
          over48hCount: 0,
        },
      },
      companyBankAccounts: {
        oldestRequestedAt: null,
        over48hCount: 0,
        pendingCount: 0,
      },
      partnerBankDeposits: {
        currency: 'VND',
        openAmount: 0,
        openCount: 0,
        owners: [],
        unassigned: {
          oldestOccurredAt: null,
          openAmount: 0,
          openCount: 0,
          over48hAmount: 0,
          over48hCount: 0,
        },
      },
      paymentClearing: {
        currency: 'VND',
        openAmount: 0,
        openCount: 0,
        owners: [],
        unassigned: {
          oldestOccurredAt: null,
          openAmount: 0,
          openCount: 0,
          over48hAmount: 0,
          over48hCount: 0,
        },
      },
    },
    generatedAt,
    notifications: { generatedAt, totalCount: 0 },
    operations: {
      appPresence: {
        activeBookingCustomers: 0,
        disabledPushCustomers: 0,
        liveActiveBookingCustomers: 0,
        liveAppCustomers: 0,
        liveAppPartners: 0,
        liveOpenMatchingCustomers: 0,
        reachableCustomers: 0,
        recentCustomerSessions: 0,
        staleCustomerSessions: 0,
        totalCustomers: 0,
      },
      generatedAt,
      partnerSupply: {
        approvedVerification: 0,
        bankApproved: 0,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 0,
        kycApproved: 0,
        level2Active: 0,
        approvalPending: 0,
        liveSessions: 0,
        noLocation: 0,
        offline: 0,
        online: 0,
        onlineAvailable: 0,
        onlineAvailableSoon: 0,
        onlineBusy: 0,
        pendingVerification: 0,
        staleLocation: 0,
        supplyPressureLabel: 'No supply',
        total: 0,
        withdrawalProfileReady: 0,
      },
    },
    payments: {
      activeCashCollection: 0,
      authorized: 0,
      callbackReview: 0,
      callbackVerified: 0,
      captureReady: 0,
      captured: 0,
      cashDebt: 0,
      evidenceConflicts: 0,
      generatedAt,
      linkedRefunds: 0,
      needsAction: 0,
      pendingCash: 0,
      releaseRecommended: 0,
      refunded: 0,
      staleMismatch: 0,
      totalCount: 0,
    },
    payoutBatches: {
      currency: 'VND',
      generatedAt,
      inProgress: 0,
      missingTransferRefs: 0,
      needsReview: 0,
      open: 0,
      payoutHolds: 0,
      settled: 0,
      total: 0,
      totalNetAmount: 0,
      withholdingAmount: 0,
    },
    range: 'today',
    refunds: {
      completedCount: 0,
      generatedAt,
      needsUpdateCount: 0,
      openCount: 0,
      outcomeLinkedCount: 0,
      refundedBookingCount: 0,
      requestedCount: 0,
      totalCount: 0,
    },
    unavailableSources: [],
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedApiGet.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue(null);
  });

  it('uses the shared Vuexy trace summary atom for dashboard metric groups', () => {
    expect(dashboardTraceSummarySource).toContain('AdminTraceSummary');
    expect(dashboardSource).not.toMatch(/<div className="service-trace-summary(?: [^"]*)?">/);
  });

  it('lets dashboard trace summaries declare a default operating scope and card kind', () => {
    expect(dashboardTraceSummarySource).toContain('readonly defaultKind?:');
    expect(dashboardTraceSummarySource).toContain('readonly defaultScope?: ReactNode;');
    expect(dashboardTraceSummarySource).toContain('kind: metric.kind ?? defaultKind');
    expect(dashboardTraceSummarySource).toContain('scope: metric.scope ?? defaultScope');
    expect(dashboardSource).toContain('defaultScope="Pending"');
    expect(dashboardSource).toContain('defaultKind="action"');
  });

  it('keeps dashboard trace summary groups scoped unless metrics carry their own scope', () => {
    const traceSummaryTags = dashboardSource.match(/<DashboardTraceSummary[\s\S]*?\/>/g) ?? [];
    const unscopedTags = traceSummaryTags.filter(
      (tag) => !tag.includes('defaultScope=') && !tag.includes('coreOperatingCounters'),
    );
    const untypedTags = traceSummaryTags.filter(
      (tag) => !tag.includes('defaultKind=') && !tag.includes('coreOperatingCounters'),
    );

    expect(unscopedTags).toEqual([]);
    expect(untypedTags).toEqual([]);
  });

  it('keeps the current Start Shift snapshot visible and refreshable', () => {
    expect(dashboardSource).toContain('StartShiftRefreshButton');
    expect(dashboardSource).toContain('DashboardDataScopeStatus');
    expect(dashboardSource).toContain('generatedAt={startShiftSummaryResponse?.generatedAt}');
    expect(dashboardSource).toContain('refreshSeconds={60}');
    expect(dashboardSource).toContain('scope="current-shift"');
    expect(dashboardSource).toContain('sourceState={startShiftScopeSourceState}');
    expect(dashboardSource).toContain('href="/operations-handoff"');
  });

  it('hides the dashboard handoff entry when the launch gate is off', async () => {
    vi.stubEnv('SHIFT_HANDOFF_LAUNCH_ENABLED', 'false');
    try {
      mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

      const page = await DashboardPage({ searchParams: Promise.resolve({}) });
      const markup = await renderDashboardMarkup(page);

      expect(markup).not.toContain('href="/operations-handoff"');
      expect(markup).not.toContain('Open handoff');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('identifies a proxy-forwarded operator by short ID without another API request', async () => {
    const aggregate = startShiftSummaryFixture();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['BOOKINGS_REALTIME'],
      id: 'admin_cmrj5gbxp000nvy0k4e7vfq3w',
      roles: ['ADMIN'],
    });
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<strong>Operator admin_cm...</strong>');
    expect(markup).not.toContain('Signed-in operator');
    expect(mockedGetCurrentAdminOperatorAccess).toHaveBeenCalledTimes(1);
    expect(mockedAdminGet).toHaveBeenCalledTimes(2);
  });

  it('does not use vague current view copy in operator-facing dashboard messages', () => {
    expect(dashboardSource).not.toContain('current view');
  });

  it('delegates Start Shift timestamp and freshness copy to the shared scope status', () => {
    expect(dashboardSource).toContain('DashboardDataScopeStatus');
    expect(dashboardTraceSummarySource).toContain('DateTimeText');
    expect(dashboardTraceSummarySource).toContain("'Source delayed · updated '");
    expect(dashboardTraceSummarySource).toContain("'Source unavailable'");
  });

  it('renders server-scoped dashboard finance summaries without loading diagnostic lists', async () => {
    const earningSummary: AdminEarningSummary = {
      availableNetAmount: 120000,
      count: 1,
      currency: 'VND',
      grossAmount: 300000,
      netAmount: 120000,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 150000,
      withholdingAmount: 30000,
    };
    const cashSettlementSummary: AdminCashSettlementSummary = {
      cashPaymentRowCount: 0,
      currency: 'VND',
      generatedAt: '2026-06-28T00:00:00.000Z',
      highDebtProviderCount: 0,
      missingPaymentEvidenceCount: 0,
      oldestOpenAgeMinutes: 0,
      oldestOpenAt: null,
      providerCount: 0,
      rowCount: 0,
      staleDebtRowCount: 0,
      topProviderGroups: [],
      totalCompanyCouponOffset: 0,
      totalDebtAmount: 0,
      totalPlatformFee: 0,
      totalTaxAmount: 0,
    };
    const refundSummary: AdminRefundSummary = {
      totalCount: 42,
      requestedCount: 9,
      refundedBookingCount: 4,
      needsUpdateCount: 3,
      completedCount: 21,
      openCount: 11,
      outcomeLinkedCount: 7,
    };
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.earnings = earningSummary;
    aggregate.cashSettlements = cashSettlementSummary;
    aggregate.refunds = refundSummary;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({ details: 'operations', range: 'today' }),
    });
    const markup = await renderDashboardMarkup(page);
    expect(markup).toContain('<h2 id="dashboard-money-status-title">Money status</h2>');
    expect(markup).toContain('Finance work is prioritized in Next action and Remaining queues above.');
    expect(mockedAdminGet).toHaveBeenCalledTimes(2);
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/dashboard/start-shift-summary?dateRange=today',
      null,
      expect.objectContaining({ freshness: 'aggregate' }),
    );
  });

  it('uses dashboard summary instead of full people lists in default mode', async () => {
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('<h3>Dashboard data</h3>');
    expect(markup).toContain('Data unavailable');
    expect(markup).toContain('<span>Customer matching wait</span><strong>Unavailable</strong>');
    expect(markup).toContain('<span>Unassigned</span><strong>Unavailable</strong>');
    expect(markup).not.toContain('Current clear');
    expect(hrefs).toEqual([START_SHIFT_SUMMARY_HREF, START_SHIFT_ANALYTICS_HREF]);
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).not.toContain('/admin/partners?view=list');
    expect(hrefs).not.toContain('/admin/app-sessions?role=PROVIDER&take=5');
    expect(hrefs.some((href) => String(href).startsWith('/admin/bookings?'))).toBe(false);
    expect(hrefs.some((href) => String(href).startsWith('/admin/notifications?'))).toBe(false);
  });

  it('renders the command workspace without waiting for period analytics', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.analytics = null;
    mockedAdminGet.mockImplementation((href, fallback) => {
      if (href === START_SHIFT_SUMMARY_HREF) return Promise.resolve(aggregate);
      if (href === START_SHIFT_ANALYTICS_HREF) return new Promise(() => undefined);
      return Promise.resolve(fallback);
    });

    const page = await Promise.race([
      DashboardPage({ searchParams: Promise.resolve({}) }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dashboard blocked')), 200)),
    ]);
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="dashboard-needs-action-now"');
    expect(markup).toContain('Analytics loading');
  });

  it('keeps Command health current when the section-scoped Analytics source fails', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.analytics = null;
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === START_SHIFT_SUMMARY_HREF) return aggregate;
      if (href === START_SHIFT_ANALYTICS_HREF) return null;
      return fallback;
    });

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('Command data current');
    expect(markup).toContain('<h2 id="dashboard-today-result-title">Today result</h2>');
    expect(markup).toContain('Analytics unavailable');
  });

  it('keeps a successful Analytics section separate when the Command summary fails', async () => {
    const aggregate = startShiftSummaryFixture();
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === START_SHIFT_SUMMARY_HREF) return null;
      if (href === START_SHIFT_ANALYTICS_HREF) return aggregate.analytics;
      return fallback;
    });

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('Shift activity · Today (Vietnam)');
    expect(markup).toContain('Source unavailable');
    expect(markup).toContain('<h2 id="dashboard-today-result-title">Today result</h2>');
    expect(markup).toContain('Operational events');
    expect(markup).not.toContain('Analytics unavailable');
  });

  it('uses one Start Shift aggregate request when every summary source is available', async () => {
    const aggregate = startShiftSummaryFixture();
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: aggregate.generatedAt,
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);
    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('<h2 id="dashboard-needs-action-now-title">Next action</h2>');
    expect(markup).toContain('Command data current');
    const liveSection = markup.slice(
      markup.indexOf('id="dashboard-needs-action-now"'),
      markup.indexOf('id="dashboard-open-queues"'),
    );
    const resultSection = markup.slice(
      markup.indexOf('id="dashboard-today-result"'),
      markup.indexOf('id="dashboard-performance-leaders"'),
    );
    expect(liveSection).toContain('Current live operations');
    expect(liveSection).not.toContain('Operational events');
    expect(resultSection).toContain('Operational events');
    expect(resultSection).toContain('Period event totals');
    expect(markup).toContain('Operational events');
    expect(markup).toContain('Period event totals');
    expect(markup).not.toContain('Request-to-completion');
    expect(markup).toContain('Money flow');
    expect(markup).toContain('Customer activity');
    expect(markup).toContain('Remaining queues');
    expect(markup).not.toContain('Finance review ownership');
    expect(markup).not.toContain('Finance review queues clear');
    expect(markup).toContain('<h3>Payment holds</h3>');
    expect(markup).toContain('<strong class="ops-task-card-value">2 cases</strong>');
    expect(markup).toContain('750.000 VND authorized');
    expect(markup).toContain('<dt>Team</dt><dd>Finance</dd>');
    expect(markup).toContain('<dt>Impact</dt><dd>750.000 VND authorized</dd>');
    expect(markup).toContain('Historical backlog (24h+)');
    expect(markup).toContain('2 cases');
    expect(markup).toContain('Booking booking-...');
    expect(markup).toContain('href="/bookings/booking-payment-hold-1"');
    expect(markup).toContain(
      'href="/payments?range=all&amp;review=authorized&amp;sort=oldest&amp;sla=critical"',
    );
    expect(markup).not.toContain('<h3>Notification failures</h3>');
    expect(markup).not.toContain('operating queues clear');
    expect(markup).toContain('Review payment holds');
    expect(markup).not.toContain('Resolve overdue');
    expect(markup).not.toContain('Open top priority');
    expect(markup).toContain('Oldest');
    expect(hrefs).toEqual([START_SHIFT_SUMMARY_HREF, START_SHIFT_ANALYTICS_HREF]);
  });

  it('opens owner and SLA-filtered Finance review queues from the global command flow', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.financeReviewWorkload.bankReconciliation = {
      currency: 'VND',
      openAmount: 800_000,
      openCount: 2,
      owners: [],
      unassigned: {
        oldestOccurredAt: '2026-07-20T00:00:00.000Z',
        openAmount: 800_000,
        openCount: 2,
        over48hAmount: 800_000,
        over48hCount: 2,
      },
    };
    aggregate.financeReviewWorkload.companyBankAccounts = {
      oldestRequestedAt: '2026-07-19T00:00:00.000Z',
      over48hCount: 1,
      pendingCount: 1,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);
    const commandSection = markup.slice(
      markup.indexOf('id="dashboard-needs-action-now"'),
      markup.indexOf('id="dashboard-money-status"'),
    );
    const nextActionSection = commandSection.slice(0, commandSection.indexOf('id="dashboard-open-queues"'));

    expect(nextActionSection).toContain('<h3>Matching delays</h3>');
    expect(nextActionSection).toContain('Review matching delays');
    expect(nextActionSection).not.toContain('<h3>Bank account approvals</h3>');
    expect(commandSection.match(/Open work · All dates/g)).toHaveLength(2);
    expect(commandSection).toContain('<h3>Bank reconciliation</h3>');
    expect(commandSection).toContain('<h3>Bank account approvals</h3>');
    expect(commandSection).toContain('1 bank account change request await independent Finance approval.');
    expect(commandSection).toContain('<dt>Assignee</dt><dd>Unassigned</dd>');
    expect(commandSection).toContain('Unassigned 2');
    expect(commandSection).toContain('48h+ 2');
    expect(commandSection).toContain(
      'href="/finance-tax/bank-reconciliation?range=all&amp;review=unmatched&amp;age=48h"',
    );
    expect(commandSection).toContain(
      'href="/finance-tax/bank-reconciliation?range=all&amp;review=unmatched&amp;owner=unassigned"',
    );
    expect(commandSection).toContain('href="/finance-tax/approval-queue?view=bank-accounts"');
    expect(markup).toContain(
      '3 open Finance reviews · 3 of 3 over 48h · 2 of 3 unassigned · 2 historical money cases · 800.000 VND under Finance review · 750.000 VND historical exposure',
    );
    expect(markup).not.toContain('3 overdue · 2 unassigned · 2 backlog');
  });

  it('does not sum potentially overlapping historical money cohorts', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.operations!.actionQueue = {
      completedPaymentHolds: 0,
      completedWithoutSettlement: 4,
      completedWithoutSettlementBacklog: 1,
      completedWithoutSettlementRecent: 3,
      customerChoice: 0,
      matchingExpired: 0,
      matchingWithoutParticipants: 0,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('1 settlement backlog case');
    expect(markup).toContain('2 historical money cases');
    expect(markup).not.toContain('3 historical backlog cases');
  });

  it('reserves the live-block priority signal for matching delays', () => {
    expect(dashboardSource).toContain(
      "isLiveBlock: action.key === 'matching-delays' && item.scope !== 'legacy'",
    );
    expect(dashboardSource).not.toContain("isLiveBlock: item.category === 'customer'");
  });

  it('separates zero Today activity from all-date Finance backlog', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.financeReviewWorkload.bankReconciliation = {
      currency: 'VND',
      openAmount: 800_000,
      openCount: 2,
      owners: [],
      unassigned: {
        oldestOccurredAt: '2026-07-20T00:00:00.000Z',
        openAmount: 800_000,
        openCount: 2,
        over48hAmount: 800_000,
        over48hCount: 2,
      },
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('Shift activity · Today (Vietnam)');
    expect(markup).toContain('<h3>Bank reconciliation</h3>');
    expect(markup).toContain('2 cases');
    expect(markup).toContain('Open work · All dates');
    expect(markup).toContain(
      'href="/finance-tax/bank-reconciliation?range=all&amp;review=unmatched&amp;age=48h"',
    );
  });

  it.each(['7d', '30d'] as const)('preserves the %s analytics range switch', async (range) => {
    const aggregate = startShiftSummaryFixture();
    aggregate.analytics = { ...aggregate.analytics!, range };
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === `/admin/dashboard/start-shift-summary?dateRange=${range}`) return aggregate;
      if (href === `/admin/dashboard/start-shift-analytics?dateRange=${range}`) return aggregate.analytics;
      return fallback;
    });

    const page = await DashboardPage({ searchParams: Promise.resolve({ range }) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h2 id="dashboard-today-result-title">Period result</h2>');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      `/admin/dashboard/start-shift-summary?dateRange=${range}`,
      null,
      expect.objectContaining({ freshness: 'aggregate' }),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      `/admin/dashboard/start-shift-analytics?dateRange=${range}`,
      null,
      expect.objectContaining({ freshness: 'aggregate' }),
    );
  });

  it('does not repeat Needs action queues in Additional work', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.analytics!.needsAction = aggregate.analytics!.needsAction.map((item) =>
      item.key === 'partner-approvals'
        ? {
            ...item,
            count: 3,
            nextCases: { current: ['partner-oldest-1'], legacy: [], overdue: [] },
            oldestAt: aggregate.generatedAt,
          }
        : item.key === 'notification-failures'
          ? { ...item, count: 5, oldestAt: aggregate.generatedAt }
          : item,
    );
    aggregate.operations!.partnerSupply.approvalPending = 3;
    aggregate.notifications = { ...aggregate.notifications!, failed: 5 };
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: aggregate.generatedAt,
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);
    const commandSection = markup.slice(
      markup.indexOf('id="dashboard-needs-action-now"'),
      markup.indexOf('id="dashboard-historical-backlog"'),
    );
    const additionalSection = markup.slice(
      markup.indexOf('id="dashboard-today-work"'),
      markup.indexOf('id="dashboard-today-result"'),
    );

    expect(commandSection).toContain('<h3>Partner approvals</h3>');
    expect(commandSection).toContain('<dt>Team</dt><dd>Partner Ops</dd>');
    expect(commandSection).toContain('<dt>Oldest</dt>');
    expect(commandSection).toContain('href="/partners/partner-oldest-1?section=full"');
    expect(commandSection).toContain('<h3>Notification failures</h3>');
    expect(additionalSection).not.toContain('Partner approvals');
    expect(additionalSection).not.toContain('Failed notifications');
  });

  it('uses a compact row for one or two Additional work queues', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.operations!.appPresence.disabledPushCustomers = 1;
    aggregate.operations!.partnerSupply.noLocation = 1;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);
    const additionalSection = markup.slice(
      markup.indexOf('id="dashboard-today-work"'),
      markup.indexOf('id="dashboard-today-result"'),
    );

    expect(additionalSection).toContain('start-shift-metric-strip is-compact');
    expect(additionalSection).toContain('Ready Partner location');
    expect(additionalSection).toContain('Customer push disabled');
    expect(globalCss).toContain('.dashboard-page .start-shift-metric-strip.is-compact {');
    expect(globalCss).toContain('grid-template-columns: repeat(2, minmax(240px, 360px));');
  });

  it('uses the factual Partner approval queue instead of subtracting every non-Level-2 Partner', () => {
    expect(dashboardSource).toContain('partnerSupply.approvalPending');
    expect(dashboardSource).toContain('/partners?review=approval-pending&sort=oldest');
    expect(dashboardSource).not.toContain('partnerSupply.total - partnerSupply.level2Active');
    expect(dashboardSource).not.toContain("label: 'Level 2 review'");
  });

  it('shows one global next action, then the remaining open queues and historical backlog', async () => {
    const aggregate = startShiftSummaryFixture();
    aggregate.analytics!.needsAction = aggregate.analytics!.needsAction.map((item, index) => ({
      ...item,
      count: index + 1,
      oldestAt:
        item.key === 'partner-approvals'
          ? '2026-07-15T00:00:00.000Z'
          : item.key === 'payment-holds'
            ? '2026-07-19T04:30:00.000Z'
            : null,
      overdueCount: item.key === 'partner-approvals' || item.key === 'payment-holds' ? index + 1 : 0,
    }));
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: aggregate.generatedAt,
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('Next action');
    expect(markup).toContain('Remaining queues');
    expect(markup).toContain('Overdue operational');
    expect(markup).toContain('Current operational');
    expect(markup).toContain('Historical backlog');
    expect(markup).toContain('start-shift-action-item ops-task-pending');
    expect(markup).toContain('start-shift-action-item ops-task-blocked');
    expect(markup).toContain(
      'href="/partners?review=approval-pending&amp;sort=oldest&amp;sla=overdue-under-24h"',
    );
    expect(markup).toContain(
      'href="/payments?range=all&amp;review=authorized&amp;sort=oldest&amp;sla=critical"',
    );
    expect(markup).toContain('5 cases');
    expect(markup).toContain('1 case');
    expect(markup).not.toContain('Clear queues');
    expect(markup.indexOf('id="dashboard-needs-action-now"')).toBeLessThan(
      markup.indexOf('id="dashboard-open-queues"'),
    );
    expect(markup.indexOf('id="dashboard-open-queues"')).toBeLessThan(
      markup.indexOf('id="dashboard-historical-backlog"'),
    );
  });

  it('uses payout batch summary for default dashboard payout counters', async () => {
    const payoutSummary: AdminPayoutBatchSummary = {
      currency: 'VND',
      generatedAt: '2026-06-28T00:00:00.000Z',
      inProgress: 3,
      missingTransferRefs: 2,
      needsReview: 4,
      open: 7,
      payoutHolds: 1,
      settled: 5,
      total: 12,
      totalNetAmount: 900000,
      withholdingAmount: 80000,
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.payoutBatches = payoutSummary;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h2 id="dashboard-money-status-title">Money status</h2>');
    expect(markup).toContain('Use the prioritized finance queues');
    expect(mockedAdminGet).toHaveBeenCalledTimes(2);
  });

  it('uses notification summary for default dashboard failed notification counters', async () => {
    const dashboardSummary: AdminDashboardSummary = {
      generatedAt: '2026-06-28T00:00:00.000Z',
      appPresence: {
        activeBookingCustomers: 0,
        disabledPushCustomers: 0,
        liveActiveBookingCustomers: 0,
        liveAppCustomers: 0,
        liveAppPartners: 0,
        liveOpenMatchingCustomers: 0,
        reachableCustomers: 0,
        recentCustomerSessions: 0,
        staleCustomerSessions: 0,
        totalCustomers: 0,
      },
      partnerSupply: {
        approvedVerification: 1,
        bankApproved: 1,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 1,
        kycApproved: 1,
        level2Active: 1,
        approvalPending: 0,
        liveSessions: 1,
        noLocation: 0,
        offline: 0,
        online: 1,
        onlineAvailable: 1,
        onlineAvailableSoon: 0,
        onlineBusy: 0,
        pendingVerification: 0,
        staleLocation: 0,
        supplyPressureLabel: '0.0x',
        total: 1,
        withdrawalProfileReady: 1,
      },
    };
    const notificationSummary: AdminNotificationBoardSummary = {
      failed: 19,
      generatedAt: '2026-06-28T00:00:00.000Z',
      totalCount: 2400,
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.operations = dashboardSummary;
    aggregate.notifications = notificationSummary;
    aggregate.analytics!.needsAction = aggregate.analytics!.needsAction.map((item) =>
      item.key === 'notification-failures' ? { ...item, count: 19 } : item,
    );
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledTimes(2);
    expect(markup).toContain('<h3>Notification failures</h3>');
    expect(markup).toContain('<strong class="ops-task-card-value">19 cases</strong>');
    expect(markup).toContain('Repair the destination device or retry unresolved delivery failures.');
    expect(markup).toContain('href="/notifications?range=all&amp;review=unresolved-failed');
  });

  it('routes unavailable Partner supply to the Partner Overview availability queue', async () => {
    const dashboardSummary: AdminDashboardSummary = {
      generatedAt: '2026-06-28T00:00:00.000Z',
      bookingActivity: {
        live: {
          active: 16,
          arrived: 1,
          customerChoice: 5,
          inService: 3,
          matched: 0,
          onTheWay: 0,
          openMatching: 12,
        },
        period: {
          cancelled: 2,
          completed: 8,
          expired: 1,
          noShow: 0,
          refunded: 1,
          total: 25,
        },
      },
      appPresence: {
        activeBookingCustomers: 0,
        disabledPushCustomers: 0,
        liveActiveBookingCustomers: 0,
        liveAppCustomers: 0,
        liveAppPartners: 0,
        liveOpenMatchingCustomers: 0,
        reachableCustomers: 0,
        recentCustomerSessions: 0,
        staleCustomerSessions: 0,
        totalCustomers: 0,
      },
      partnerSupply: {
        approvedVerification: 3,
        bankApproved: 3,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 1,
        kycApproved: 3,
        level2Active: 3,
        approvalPending: 0,
        liveSessions: 0,
        noLocation: 0,
        offline: 3,
        online: 0,
        onlineAvailable: 0,
        onlineAvailableSoon: 0,
        onlineBusy: 0,
        pendingVerification: 0,
        staleLocation: 0,
        supplyPressureLabel: 'No supply',
        total: 3,
        withdrawalProfileReady: 3,
      },
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.operations = dashboardSummary;
    aggregate.analytics = null;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('Partner supply');
    expect(markup).toContain(
      'href="/partners/overview?range=7d&amp;selectionIssue=availability&amp;selectionSort=response"',
    );
    expect(markup).toContain('<span>Customer matching wait</span><strong>12</strong>');
    expect(markup).toContain('<span>In service</span><strong>3</strong>');
    expect(markup).toContain('Analytics unavailable');
    expect(markup).not.toContain('<span>Booking requests</span><strong>25</strong>');
    expect(markup).toContain('<span class="pill pill-warn">Stale</span>');
  });

  it('marks stale Partner supply as a refresh lane instead of available', async () => {
    const dashboardSummary: AdminDashboardSummary = {
      generatedAt: '2026-06-28T00:00:00.000Z',
      appPresence: {
        activeBookingCustomers: 0,
        disabledPushCustomers: 0,
        liveActiveBookingCustomers: 0,
        liveAppCustomers: 0,
        liveAppPartners: 0,
        liveOpenMatchingCustomers: 0,
        reachableCustomers: 0,
        recentCustomerSessions: 0,
        staleCustomerSessions: 0,
        totalCustomers: 0,
      },
      partnerSupply: {
        approvedVerification: 10,
        bankApproved: 10,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 10,
        kycApproved: 10,
        level2Active: 10,
        approvalPending: 0,
        liveSessions: 10,
        noLocation: 1,
        offline: 0,
        online: 10,
        onlineAvailable: 10,
        onlineAvailableSoon: 0,
        onlineBusy: 0,
        pendingVerification: 0,
        staleLocation: 3,
        supplyPressureLabel: '0.0x',
        total: 10,
        withdrawalProfileReady: 10,
      },
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.operations = dashboardSummary;
    aggregate.analytics = null;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h3>Partner supply</h3>');
    expect(markup).toContain('<span class="pill pill-warn">Refresh</span>');
    expect(markup).toContain('href="/partners?review=available-blocked-location"');
    expect(markup).toContain('3 location pins need refresh before dispatch.');
  });

  it('uses payment summary for default dashboard payment hold counters', async () => {
    const paymentSummary: AdminPaymentSummary = {
      activeCashCollection: 0,
      authorized: 13,
      callbackReview: 0,
      callbackVerified: 0,
      captureReady: 0,
      captured: 0,
      cashDebt: 0,
      evidenceConflicts: 0,
      linkedRefunds: 0,
      needsAction: 13,
      pendingCash: 0,
      releaseRecommended: 0,
      refunded: 0,
      staleMismatch: 0,
      totalCount: 30,
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.payments = paymentSummary;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledTimes(2);
    expect(markup).toContain('Payment holds');
  });

  it('renders exact database action queues when bounded booking samples are empty', async () => {
    const dashboardSummary: AdminDashboardSummary = {
      generatedAt: new Date().toISOString(),
      actionQueue: {
        completedPaymentHolds: 2,
        completedWithoutSettlement: 4,
        completedWithoutSettlementBacklog: 1,
        completedWithoutSettlementRecent: 3,
        customerChoice: 3,
        matchingExpired: 5,
        matchingWithoutParticipants: 7,
      },
      appPresence: {
        activeBookingCustomers: 0,
        disabledPushCustomers: 0,
        liveActiveBookingCustomers: 0,
        liveAppCustomers: 0,
        liveAppPartners: 0,
        liveOpenMatchingCustomers: 0,
        reachableCustomers: 0,
        recentCustomerSessions: 0,
        staleCustomerSessions: 0,
        totalCustomers: 0,
      },
      partnerSupply: {
        approvedVerification: 0,
        bankApproved: 0,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 0,
        kycApproved: 0,
        level2Active: 0,
        approvalPending: 0,
        liveSessions: 0,
        noLocation: 0,
        offline: 0,
        online: 0,
        onlineAvailable: 0,
        onlineAvailableSoon: 0,
        onlineBusy: 0,
        pendingVerification: 0,
        staleLocation: 0,
        supplyPressureLabel: 'No supply',
        total: 0,
        withdrawalProfileReady: 0,
      },
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: new Date().toISOString(),
    } as AdminExternalReadiness);
    const aggregate = startShiftSummaryFixture();
    aggregate.operations = dashboardSummary;
    aggregate.analytics = null;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      startShiftAdminResponse(href, fallback, aggregate),
    );

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h3>Matching exceptions</h3>');
    expect(markup).toContain('<strong class="ops-task-card-value">5 expired / 7 no Partner</strong>');
    expect(markup).toContain('href="/bookings?view=attention"');
    expect(markup).toContain('<h3>Customer choice</h3>');
    expect(markup).toContain('<strong class="ops-task-card-value">3 bookings</strong>');
    expect(markup).toContain('href="/bookings?view=customer-choice"');
    expect(markup).toContain('<h3>Completed closeout</h3>');
    expect(markup).toContain('<strong class="ops-task-card-value">2 hold / 3 recent</strong>');
    expect(markup).toContain('href="/bookings?view=closeout"');
    expect(markup).toContain('<h2 id="dashboard-money-status-title">Money status</h2>');
    const additionalWorkSection = markup.slice(
      markup.indexOf('id="dashboard-today-work"'),
      markup.indexOf('id="dashboard-today-result"'),
    );
    expect(additionalWorkSection).not.toContain('Settlement backlog');
  });

  it('renders primary command panels with the shared Vuexy admin section shell', async () => {
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h1>Shift Command</h1>');
    expect(markup).toContain('aria-label="Shift context"');
    expect(markup).toContain('Shift activity · Today (Vietnam)');
    expect(markup).toContain('Open handoff');
    expect(markup).not.toContain('href="/?range=all"');
    expect(markup).not.toContain('Live start-of-shift workspace');
    expect(markup).not.toContain('Current priorities, live service, money risk');
    expect(markup).not.toContain('<h1>HANDS Operations</h1>');
    expect(markup).not.toContain('Daily command center');
    expect(markup).not.toContain('More actions');
    expect(markup).not.toContain('href="/partner-controls"');
    expect(markup).not.toContain('href="/tax-policy"');
    expect(markup).not.toContain('href="/audit-log"');
    expect(markup).toContain('href="/operations-handoff"');
    expect(markup).toContain('class="card admin-section admin-mt-20" id="dashboard-needs-action-now"');
    expect(markup).toContain('<h2 id="dashboard-needs-action-now-title">Next action</h2>');
    expect(markup).toContain('class="admin-form-control-link button button-primary"');
    expect(markup).toContain('class="card admin-section admin-mt-20" id="dashboard-open-queues"');
    expect(markup).toContain('<h2 id="dashboard-open-queues-title">Remaining queues</h2>');
    expect(markup).toContain('4 more queues');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 start-shift-compact-section" id="dashboard-money-status"',
    );
    expect(markup).toContain('<h2 id="dashboard-money-status-title">Money status</h2>');
    expect(markup).toContain('No money queue needs action.');
    expect(markup).not.toContain('<h3>Available payout</h3>');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 start-shift-compact-section" id="dashboard-today-work"',
    );
    expect(markup).toContain('<h2 id="dashboard-today-work-title">Additional work</h2>');
    expect(markup).toContain('class="card admin-section admin-mt-20" id="dashboard-today-result"');
    expect(markup).toContain('<h2 id="dashboard-today-result-title">Today result</h2>');
    expect(markup).not.toContain('<span class="pill pill-info">Today (Vietnam)</span>');
    expect(markup.indexOf('id="dashboard-needs-action-now"')).toBeLessThan(
      markup.indexOf('id="dashboard-open-queues"'),
    );
    expect(markup.indexOf('id="dashboard-open-queues"')).toBeLessThan(
      markup.indexOf('id="dashboard-money-status"'),
    );
    expect(markup.indexOf('id="dashboard-money-status"')).toBeLessThan(
      markup.indexOf('id="dashboard-today-work"'),
    );
    expect(markup.indexOf('id="dashboard-today-work"')).toBeLessThan(
      markup.indexOf('id="dashboard-today-result"'),
    );
    expect(markup).not.toContain('id="dashboard-operations-command-board"');
    expect(markup).not.toContain('id="dashboard-current-action-order"');
    expect(markup).not.toContain('id="dashboard-core-operating-counters"');
    expect(markup).not.toContain('id="dashboard-booking-participant-flow"');
    expect(markup).not.toContain('id="dashboard-evidence-drilldown"');
    expect(markup).not.toContain('id="dashboard-booking-evidence-command-queue"');
    expect(markup).not.toContain('id="dashboard-booking-diagnostics"');
    expect(markup).not.toContain('id="dashboard-full-diagnostics"');
    expect(markup).not.toContain('id="dashboard-date-range"');
    expect(markup).not.toContain('operating handoff');
    expect(markup).not.toContain('finance handoff');
    expect(markup).not.toContain('id="dashboard-performance-leaders"');
    expect(markup).not.toContain('id="dashboard-demand-supply"');
    expect(markup).not.toContain('id="dashboard-on-demand-detail"');
    expect(markup).not.toContain('href="/?details=booking"');
    expect(markup).not.toContain('href="/?details=operations"');
    expect(markup).not.toContain('Detailed dashboard loaded on demand');
    expect(markup).not.toContain('API source:');
    expect(markup).not.toContain('setup readiness');
    expect(markup).not.toContain('Booking participant snapshot');
    expect(markup).not.toContain('Finance snapshot');
    expect(markup).not.toContain('earnings snapshot');
    expect(markup).not.toContain('current snapshot');
    expect(markup).not.toContain('marketplace alert trace');
    expect(markup).not.toContain('traceable');
    expect(markup).not.toContain('final selection trace');
    expect(markup).not.toContain('Chat archive evidence');
    expect(markup).not.toContain('source of truth');
    expect(markup).not.toContain('app sessions');
    expect(markup).not.toContain('Partner readiness funnel');
    expect(markup).not.toContain('location readiness');
    expect(markup).not.toContain('payout readiness');
    expect(markup).not.toContain('onboarding readiness');
    expect(markup).not.toContain('href="/chat-archive"');
  });

  it('keeps the operator dashboard free of raw Developer/System evidence labels', () => {
    expect(dashboardSource).not.toContain('BookingAddressSnapshot');
    expect(dashboardSource).not.toContain('Message archive');
    expect(dashboardSource).not.toContain('Admin retained');
    expect(dashboardSource).not.toContain('Wallet ledger');
    expect(dashboardSource).not.toContain('Invite trace');
    expect(dashboardSource).not.toContain('Finance trace');
    expect(dashboardSource).not.toContain('Retry log');
    expect(dashboardSource).not.toContain('generated from');
    expect(dashboardSource).not.toContain('latest admin snapshot');
    expect(dashboardSource).not.toContain('marketplace alert trace');
    expect(dashboardSource).not.toContain('Marketplace exposure is traceable');
    expect(dashboardSource).not.toContain('customer final selection trace');
    expect(dashboardSource).not.toContain('Chat archive evidence');
    expect(dashboardSource).not.toContain('after policy setup');
    expect(dashboardSource).not.toContain('Pricing setup');
    expect(dashboardSource).not.toContain('Needs payout setup');
    expect(dashboardSource).not.toContain('Tax setup');
    expect(dashboardSource).not.toContain('Review withdrawal setup');
    expect(dashboardSource).not.toContain('Open payout setup');
    expect(dashboardSource).not.toContain('First revenue setup');
    expect(dashboardSource).not.toContain('Dashboard summary');
    expect(dashboardSource).not.toContain('matchingPolicy metadata');
  });

  it('uses the shared Vuexy empty-state atom for dashboard queue fallbacks', () => {
    expect(dashboardSource).toContain('AdminEmptyState');
    expect(dashboardSource).not.toContain('className="ops-task-note"\n                  framed');
    expect(dashboardSource).not.toContain('<strong>No same-shift queue item is visible.</strong>');
    expect(dashboardSource).not.toContain('<strong>No Partner blocker is currently visible.</strong>');
    expect(dashboardSource).not.toContain(
      '<p className="muted">No open matching booking is waiting right now.</p>',
    );
    expect(dashboardSource).not.toContain(
      '<p className="muted">No policy setting was changed in the last 7 days.</p>',
    );
    expect(dashboardSource).not.toContain('<p className="muted">No service demand loaded yet.</p>');
    expect(dashboardSource).not.toContain('<p className="muted">No payment method data loaded yet.</p>');
    expect(dashboardSource).not.toContain('<p className="muted">No booking address data loaded yet.</p>');
    expect(dashboardSource).not.toContain(
      '<p className="muted">No active operational issues detected from the current local data.</p>',
    );
  });

  it('uses shared Vuexy status badge atoms instead of raw dashboard pill markup', () => {
    expect(dashboardSource).toContain("from '../components/status-badge'");
    expect(dashboardSource).toContain('AdminFilterChipGroup');
    expect(dashboardSource).not.toContain('AdminSectionHeader');
    expect(dashboardSource).toContain('StatusBadge');
    expect(dashboardSource).toContain('StatusBadgeFromPillClass');
    expect(dashboardSource).not.toContain('statusBadgeToneFromPillClass');
    expect(dashboardSource).not.toContain('PillClassBadge');
    expect(dashboardSource).not.toContain('function DashboardStatusBadge');
    expect(dashboardSource).not.toContain('function DashboardStatusBadgeLink');
    expect(dashboardSource).toContain('StatusBadgeLink');
    expect(dashboardSource).not.toContain('<span className="pill');
    expect(dashboardSource).not.toContain('<span className={`pill');
    expect(dashboardSource).not.toContain('<span className={`signal');
    expect(dashboardSource).not.toContain('<Link className="pill');
    expect(dashboardSource).not.toContain('<Link\n                          className={`pill');
    expect(dashboardSource).not.toContain('<div className="participant-list');
    expect(dashboardSource).not.toContain('<div className="ops-section-header">');
  });

  it('uses shared Vuexy form control links for dashboard button-style actions', () => {
    expect(dashboardSource).toContain('AdminFormControlLink');
    expect(dashboardSource).not.toContain('<Link className="button button-secondary"');
    expect(dashboardSource).not.toContain('className="button button-secondary"');
  });

  it('uses the shared Vuexy text link atom for inline dashboard navigation', () => {
    expect(dashboardSource).toContain('AdminTextLink');
    expect(dashboardSource).not.toContain('className="text-link"');
  });

  it('uses shared Vuexy task card surfaces instead of raw dashboard ops task card markup', () => {
    expect(dashboardSource).toContain('AdminActionCard');
    expect(dashboardSource).toContain('AdminTaskGrid');
    expect(dashboardSource).not.toContain('StartShiftClearQueues');
    expect(dashboardSource).toContain('AdminDisclosure');
    expect(dashboardSource).not.toContain('<div className="ops-task-breakdown">');
    expect(dashboardSource).not.toContain('<div className="ops-task-grid">');
    expect(dashboardSource).not.toContain('<div className="ops-task-grid admin-grid-single admin-mt-12">');
    expect(dashboardSource).not.toContain('<div className="ops-task-grid admin-mt-14">');
    expect(dashboardSource).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(dashboardSource).not.toContain('<div className="ops-task-note admin-mt-10">');
    expect(dashboardSource).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(dashboardSource).not.toContain('<div className="ops-task-note">');
    expect(dashboardSource).not.toContain('className={`ops-task-card');
    expect(dashboardSource).not.toContain('className={`ops-task-breakdown-item');
    expect(dashboardSource).not.toContain('className="ops-task-card-action"');
  });

  it('scopes dashboard header overflow rules to card-level section headers', () => {
    expect(globalCss).toContain('.dashboard-page :is(.card, .admin-card) > .ops-section-header > div {');
    expect(globalCss).not.toContain('.dashboard-page .ops-section-header > div');
  });

  it('stacks Start Shift action evidence before the 1024px desktop boundary collapses', () => {
    expect(globalCss).toContain('@media (max-width: 1100px) {');
    expect(globalCss).toContain('.dashboard-page .start-shift-action-item > .admin-queue-meta {');
    expect(globalCss).toContain('grid-column: 1 / -1;');
    expect(globalCss).toContain('.dashboard-page .start-shift-action-item > :is(a, small):last-child {');
  });

  it('does not restore retired diagnostic detail grids to Start Shift', () => {
    expect(dashboardSource).not.toContain('AdminDetailGrid');
    expect(dashboardSource).not.toContain('<section className="detail-grid');
    expect(dashboardSource).not.toContain('<div className="detail-grid');
  });

  it('ignores retired diagnostic query modes and keeps Start Shift on the operator summary', async () => {
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await DashboardPage({
      searchParams: Promise.resolve({ details: 'operations', operations: 'analysis' }),
    });
    const markup = await renderDashboardMarkup(page);

    expect(markup).toContain('<h1>Shift Command</h1>');
    expect(markup).toContain('id="dashboard-needs-action-now"');
    expect(markup).toContain('id="dashboard-open-queues"');
    expect(markup).not.toContain('id="dashboard-booking-diagnostics"');
    expect(markup).not.toContain('id="dashboard-full-diagnostics"');
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/operational-policy'),
      expect.anything(),
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/app-sessions'),
      expect.anything(),
    );
  });
});

vi.mock('../components/start-shift-refresh-button', () => ({
  StartShiftRefreshButton: () => <button type="button">Refresh</button>,
}));
