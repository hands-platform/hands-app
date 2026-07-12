import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminDashboardSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminExternalReadiness,
  AdminNotificationBoardSummary,
  AdminPaymentSummary,
  AdminPayoutBatchSummary,
  AdminRefundSummary,
} from '../lib/admin-api';
import { adminGet, apiGet } from '../lib/admin-api';
import DashboardPage from './page';

vi.mock('../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/admin-api')>('../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    apiGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedApiGet = vi.mocked(apiGet);
const dashboardSource = readFileSync('app/page.tsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedApiGet.mockReset();
  });

  it('uses the shared Vuexy trace summary atom for dashboard metric groups', () => {
    expect(dashboardSource).toContain('AdminTraceSummary');
    expect(dashboardSource).not.toMatch(/<div className="service-trace-summary(?: [^"]*)?">/);
  });

  it('uses the shared DateTimeText atom for dashboard booking evidence sample dates', () => {
    expect(dashboardSource).toContain('DateTimeText');
    expect(dashboardSource).toContain('<DateTimeText fallback="unknown" value={bookingRequestOpenedAt(booking)} />');
    expect(dashboardSource).not.toContain('function dashboardDateLabel');
    expect(dashboardSource).not.toContain('return formatDateTime(value, \'unknown\');');
    expect(dashboardSource).not.toContain('opened ${dashboardDateLabel(');
  });

  it('renders server-scoped dashboard finance rows without applying a second local date filter', async () => {
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
    const oldServerScopedEarning = {
      bookingId: 'server-dashboard-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 300000,
      id: 'server-dashboard-earning',
      netAmount: 120000,
      platformFee: 150000,
      providerProfileId: 'server-provider-row',
      status: 'AVAILABLE',
      withholdingAmount: 30000,
    } as AdminEarning;

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/earnings/summary?range=today') {
        return earningSummary;
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return cashSettlementSummary;
      }
      if (href === '/admin/refunds/summary?range=today') {
        return refundSummary;
      }
      if (typeof href === 'string' && href.startsWith('/admin/earnings?')) {
        return [oldServerScopedEarning];
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({ details: 'all', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<span>Range earnings</span><strong>1</strong>');
    expect(markup).toContain('<span>Refund evidence</span><strong>42</strong>');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/earnings/summary?range=today', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/refunds/summary?range=today', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/cash-settlement-summary?range=today',
      expect.any(Object),
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
    const markup = renderToStaticMarkup(page);

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('toolbar admin-page-header');
    expect(hrefs).toContain('/admin/dashboard/summary');
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).not.toContain('/admin/partners?view=list');
    expect(hrefs).not.toContain('/admin/app-sessions?role=PROVIDER&take=5');
    expect(hrefs.some((href) => String(href).startsWith('/admin/notifications?'))).toBe(false);
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
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches/summary?range=today') {
        return payoutSummary;
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h3>Finance closeout</h3><strong>7 item(s)</strong>');
    expect(markup).toContain('<span class="pill pill-neutral">7 payout batch(es)</span>');
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
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/dashboard/summary') {
        return dashboardSummary;
      }
      if (typeof href === 'string' && href.startsWith('/admin/notifications/summary?')) {
        return notificationSummary;
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/admin\/notifications\/summary\?/),
      null,
    );
    expect(markup).toContain('<h3>Notifications</h3><strong>19 failed</strong>');
    expect(markup).toContain('<span class="pill pill-warn">1 lane needs action</span>');
    expect(markup).toMatch(/href="\/notifications\?review=failed"[^>]*>[\s\S]*?Open top priority/);
  });

  it('routes unavailable Partner supply to the Partner Overview availability queue', async () => {
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
        approvedVerification: 3,
        bankApproved: 3,
        blocked: 0,
        cashDebtPartners: 0,
        firstRevenue: 1,
        kycApproved: 3,
        level2Active: 3,
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
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/dashboard/summary') {
        return dashboardSummary;
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner supply');
    expect(markup).toContain(
      'href="/partners/overview?range=7d&amp;selectionIssue=availability&amp;selectionSort=response"',
    );
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
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/dashboard/summary') {
        return dashboardSummary;
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h3>Partner supply</h3>');
    expect(markup).toContain('<span class="pill pill-warn">Refresh</span>');
    expect(markup).toContain('3 location pin(s) need refresh before dispatch.');
    expect(markup).toContain('href="/partners?review=location"');
  });

  it('uses payment summary for default dashboard payment hold counters', async () => {
    const paymentSummary: AdminPaymentSummary = {
      authorized: 13,
      callbackReview: 0,
      callbackVerified: 0,
      captured: 0,
      cashDebt: 0,
      linkedRefunds: 0,
      needsAction: 13,
      pendingCash: 0,
      refunded: 0,
      totalCount: 30,
    };

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments/summary?range=today') {
        return paymentSummary;
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/payments/summary?range=today', null);
    expect(markup).toContain('<span>Payment holds</span><strong>13</strong>');
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
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h1>Start Shift</h1>');
    expect(markup).toContain('Live start-of-shift workspace');
    expect(markup).toContain('Work red/yellow lanes first.');
    expect(markup).toContain('Live counters for bookings, app presence, supply, payments, and cash debt.');
    expect(markup).toContain('Current live queues stay visible; dated totals follow the selected window.');
    expect(markup).toContain('Open only when you need detailed radar, queues, policy, and finance panels.');
    expect(markup).not.toContain('<h1>HANDS Operations</h1>');
    expect(markup).not.toContain('Daily command center');
    expect(markup).toContain('href="/notifications"');
    expect(markup).not.toContain('href="/partner-controls"');
    expect(markup).not.toContain('href="/tax-policy"');
    expect(markup).not.toContain('href="/audit-log"');
    expect(markup).toContain('Operations History');
    expect(markup).toContain('href="/operations-handoff"');
    expect(markup.indexOf('Operations History')).toBeLessThan(
      markup.indexOf('id="dashboard-operations-command-board"'),
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-core-operating-counters"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-core-operating-counters-title">Core operating counters</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-operations-command-board"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-operations-command-board-title">Operations command board</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-current-action-order"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-current-action-order-title">Current action order</h2>',
    );
    expect(markup).toContain('Follow this order now. Older shift context stays in Operations Handoff.');
    expect(markup).toContain('Past review order');
    expect(markup).toContain('href="/operations-handoff#operations-handoff-review-order"');
    expect(markup).toContain('Now');
    expect(markup).toContain('Next');
    expect(markup).toContain('Watch');
    expect(markup).toContain('href="/operations-handoff"');
    expect(markup.indexOf('id="dashboard-operations-command-board"')).toBeLessThan(
      markup.indexOf('id="dashboard-current-action-order"'),
    );
    expect(markup.indexOf('id="dashboard-current-action-order"')).toBeLessThan(
      markup.indexOf('id="dashboard-core-operating-counters"'),
    );
    expect(markup).not.toContain('id="dashboard-booking-participant-flow"');
    expect(markup).not.toContain('id="dashboard-evidence-drilldown"');
    expect(markup).not.toContain('id="dashboard-booking-evidence-command-queue"');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-date-range"',
    );
    expect(markup).toContain('<h2 id="dashboard-date-range-title">Start Shift window</h2>');
    expect(markup).not.toContain('Dashboard date range');
    expect(markup).not.toContain('operating handoff');
    expect(markup).not.toContain('finance handoff');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-on-demand-detail"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-on-demand-detail-title">More operating detail</h2>',
    );
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
    expect(markup).toContain('href="/bookings?view=chat"');
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
    expect(dashboardSource).not.toContain('<p className="muted">No open matching booking is waiting right now.</p>');
    expect(dashboardSource).not.toContain('<p className="muted">No policy setting was changed in the last 7 days.</p>');
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
    expect(dashboardSource).toContain('AdminSectionHeader');
    expect(dashboardSource).toContain('StatusBadge');
    expect(dashboardSource).toContain('StatusBadgeFromPillClass');
    expect(dashboardSource).toContain('StatusBadgeLinkFromPillClass');
    expect(dashboardSource).not.toContain('statusBadgeToneFromPillClass');
    expect(dashboardSource).not.toContain('PillClassBadge');
    expect(dashboardSource).not.toContain('function DashboardStatusBadge');
    expect(dashboardSource).not.toContain('function DashboardStatusBadgeLink');
    expect(dashboardSource).toContain('AdminSignal');
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
    expect(dashboardSource).toContain('AdminTaskBreakdown');
    expect(dashboardSource).toContain('AdminTaskCard');
    expect(dashboardSource).toContain('AdminTaskGrid');
    expect(dashboardSource).toContain('AdminNotePanel');
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

  it('uses the shared detail grid surface for dashboard multi-panel groups', () => {
    expect(dashboardSource).toContain('AdminDetailGrid');
    expect(dashboardSource).not.toContain('<section className="detail-grid');
    expect(dashboardSource).not.toContain('<div className="detail-grid');
  });

  it('renders full dashboard briefing panels with the shared Vuexy admin section shell', async () => {
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await DashboardPage({
      searchParams: Promise.resolve({ details: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-booking-participant-flow"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-booking-participant-flow-title">Dispatch evidence map</h2>',
    );
    expect(markup).toContain('Read this as one dispatch evidence group');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-evidence-drilldown"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-evidence-drilldown-title">Retained evidence signals</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-booking-evidence-command-queue"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-booking-evidence-command-queue-title">Evidence queue shortcuts</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-full-detail-review-order"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-full-detail-review-order-title">Full detail review order</h2>',
    );
    expect(markup).toContain('Use this order when the full dashboard is open.');
    expect(markup).toContain('Live radar');
    expect(markup).toContain('Dispatch evidence');
    expect(markup).toContain('href="#dashboard-booking-participant-flow"');
    expect(markup).toContain('Partner supply');
    expect(markup).toContain('Finance closeout');
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-live-operations-radar"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-live-operations-radar-title">Live operations radar</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-policy-outcome-pulse"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-policy-outcome-pulse-title">Policy outcome pulse</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-shift-command-briefing"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-shift-command-briefing-title">Shift command briefing</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-opening-shift-checklist"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-opening-shift-checklist-title">Opening shift checklist</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 dashboard-card-scroll dashboard-matching-card" id="dashboard-matching-control-room"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-matching-control-room-title">Matching control room</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 dashboard-card-scroll dashboard-policy-card" id="dashboard-operations-policy-status"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-operations-policy-status-title">Operations policy status</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 dashboard-card-scroll dashboard-partner-dispatch-card" id="dashboard-partner-dispatch-control"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-partner-dispatch-control-title">Partner dispatch control</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20" id="dashboard-marketplace-unblock-quick-order"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-marketplace-unblock-quick-order-title">Marketplace unblock quick order</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section admin-mt-20 dashboard-card-scroll dashboard-command-lanes-card" id="dashboard-today-command-lanes"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-today-command-lanes-title">Today command lanes</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-booking-attention-cockpit"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-booking-attention-cockpit-title">Booking attention cockpit</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-service-payment-mix"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-service-payment-mix-title">Service and payment mix</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-booking-status-control"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-booking-status-control-title">Booking status control</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-customer-app-presence"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-customer-app-presence-title">Customer app presence</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-hourly-booking-demand"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-hourly-booking-demand-title">Hourly booking demand</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-regional-booking-demand"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-regional-booking-demand-title">Regional booking demand</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-partner-supply-status"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-partner-supply-status-title">Partner supply status</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-partner-approval-funnel"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-partner-approval-funnel-title">Partner approval funnel</h2>',
    );
    expect(markup).toContain(
      'class="card admin-section dashboard-card-scroll dashboard-checklist-card" id="dashboard-operations-checklist-queue"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-operations-checklist-queue-title">Operations checklist queue</h2>',
    );
    expect(markup).not.toContain('dashboard-external-setup-readiness');
    expect(markup).not.toContain('External setup readiness');
    expect(markup).not.toContain('dashboard-realtime-flow-health');
    expect(markup).not.toContain('Realtime flow health');
    expect(markup).not.toContain('Generated from the latest admin API snapshot');
    expect(markup).not.toContain('API source:');
    expect(markup).not.toContain('Operations policy snapshot');
    expect(markup).not.toContain('Partner supply snapshot');
    expect(markup).not.toContain('Finance snapshot');
    expect(markup).not.toContain('earnings snapshot');
    expect(markup).not.toContain('current snapshot');
    expect(markup).not.toContain('source of truth');
    expect(markup).not.toContain('app sessions');
    expect(markup).not.toContain('Partner readiness funnel');
    expect(markup).not.toContain('location readiness');
    expect(markup).not.toContain('payout readiness');
    expect(markup).not.toContain('onboarding readiness');
    expect(markup).toContain(
      'class="card admin-section" id="dashboard-finance-closeout-status"',
    );
    expect(markup).toContain(
      '<h2 id="dashboard-finance-closeout-status-title">Finance closeout status</h2>',
    );
    expect(markup.indexOf('id="dashboard-full-detail-review-order"')).toBeLessThan(
      markup.indexOf('id="dashboard-live-operations-radar"'),
    );
  });
});
