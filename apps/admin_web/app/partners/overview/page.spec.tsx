import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet, type AdminPartnerOverview } from '../../../lib/admin-api';
import PartnerOverviewPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('PartnerOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders operator action rows with descriptive open controls and forwards filters', async () => {
    mockedAdminGet.mockResolvedValue(partnerOverviewFixture);

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({
        range: '7d',
        riskStatus: 'high',
        selectionIssue: 'availability',
        selectionSort: 'response',
        walletStatus: 'negative',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/overview?range=7d&riskStatus=high&walletStatus=negative&selectionIssue=availability&selectionSort=response',
      expect.any(Object),
    );
    expect(markup).toContain('Risk and action queues');
    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('class="partner-overview-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-section partner-overview-filter-panel');
    expect(markup).toContain('booking-date-filter-buttons partner-overview-range-buttons');
    expect(markup).not.toContain('usage-overview-filter-panel');
    expect(markup).not.toContain('usage-overview-range-buttons');
    expect(markup).not.toContain('card admin-filter-panel partner-overview-filter-panel');
    expect(markup).not.toContain('class="admin-form-control"');
    expect(markup).toContain('class="admin-form-input admin-form-control-labeled"');
    expect(markup).toContain('class="admin-form-select admin-form-control-labeled"');
    expect(markup).toContain('class="admin-form-control-button button button-primary"');
    expect(pageSource).toContain('AdminFormGrid');
    expect(pageSource).not.toContain('<form className="partner-overview-filter-grid"');
    expect(pageSource).not.toContain('<form action="/partners/overview" className="partner-overview-selection-sort-form">');
    expect(markup).toContain('card admin-section partner-overview-section-card partner-overview-operating-board');
    expect(markup).toContain('admin-section-body partner-overview-operating-grid');
    expect(markup).toContain('card admin-card partner-overview-operating-card');
    expect(pageSource).not.toContain('className={`card admin-card partner-overview-operating-card');
    expect(pageSource).toContain('baseClassName="partner-overview-operating-card"');
    expect(pageSource).not.toContain('AdminLinkCard');
    expect(markup).toContain('card admin-section partner-overview-section-card partner-overview-priority-board');
    expect(markup).not.toContain('usage-overview-funnel-card');
    expect(markup).toContain('admin-section-body partner-overview-priority-grid');
    expect(markup).toContain('card admin-card partner-overview-command-card partner-overview-priority-card');
    expect(markup).toContain('partner-overview-command-icon');
    expect(markup).not.toContain('usage-overview-command-card');
    expect(markup).not.toContain('usage-overview-command-icon');
    expect(markup).not.toContain('<article class="card admin-card partner-overview-command-card');
    expect(markup).toContain('card admin-card partner-overview-action-card');
    expect(markup).not.toContain('<article class="card admin-card partner-overview-action-card');
    expect(markup).toContain('ops-section-header admin-section-header admin-card-header');
    expect(pageSource).toContain('AdminCardHeader');
    expect(pageSource).toContain('AdminCardGrid');
    expect(pageSource).not.toContain('<div className="partner-overview-action-card-header">');
    expect(pageSource).not.toContain('<div className="partner-overview-action-rows">');
    expect(markup).toContain('admin-section-body partner-overview-funnel-steps');
    expect(markup).toContain('admin-section-body partner-overview-action-grid');
    expect(markup).toContain('card admin-section partner-overview-table-card');
    expect(markup).toContain('admin-table-scroll partner-overview-table-wrap');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table partner-overview-table');
    expect(markup).not.toContain('usage-overview-table-card');
    expect(markup).not.toContain('usage-overview-table-wrap');
    expect(markup).not.toContain('usage-overview-table');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).toContain('AdminRowLink');
    expect(pageSource).toContain('AdminOverviewCommandGrid');
    expect(pageSource).toContain('AdminOverviewGrid');
    expect(pageSource).toContain('AdminMiniMetricStrip');
    expect(pageSource).toContain('AdminTextLink');
    expect(pageSource).not.toContain('<a href={row.href}>{row.partnerName}</a>');
    expect(pageSource).not.toContain('<a href={segment.href}>{segment.recommendedAction}</a>');
    expect(pageSource).not.toContain('<div className="partner-overview-mini-kpis"');
    expect(pageSource).not.toContain('<section className="usage-overview-command-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-segment-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-insight-grid');
    expect(pageSource).not.toContain('contentClassName="usage-overview-page partner-overview-page"');
    expect(pageSource).not.toContain('className="usage-overview-filter-panel partner-overview-filter-panel"');
    expect(pageSource).not.toContain('className="usage-overview-range-buttons"');
    expect(pageSource).not.toContain('className="usage-overview-funnel-card"');
    expect(pageSource).not.toContain(
      '<table className="table vuexy-data-table vuexy-booking-table admin-data-table usage-overview-table">',
    );
    expect(pageSource).not.toContain('className="usage-overview-table-card"');
    expect(pageSource).not.toContain('className="usage-overview-table-wrap"');
    expect(pageSource).not.toContain('className="usage-overview-table"');
    expect(pageSource).not.toContain('<a\n      aria-label={`${row.partnerName}');
    expect(pageSource).not.toContain('<a aria-label={`${row.recommendedAction} for ${row.partnerName}`}');
    expect(pageSource).not.toContain('<a aria-label={`Open ${list.title}`} className="button button-secondary"');
    expect(markup).toContain('admin-section-body partner-overview-risk-card-body');
    expect(markup).toContain('admin-section-body partner-overview-selection-body');
    expect(pageSource).toContain('AdminOverviewCommandCard');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${tone}`}');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${segment.tone}`}');
    expect(pageSource).toContain('baseClassName="partner-overview-command-card"');
    expect(pageSource).toContain('iconClassName="partner-overview-command-icon"');
    expect(markup).toContain('aria-label="Remove Risk filter High"');
    expect(markup).toContain('aria-label="Remove Wallet filter Negative"');
    expect(markup).toContain('aria-label="Remove Selection issue filter Availability"');
    expect(markup).toContain('aria-label="Remove Selection sort filter Response time"');
    expect(markup).toContain('aria-label="Open Pending Verification"');
    expect(markup).toContain('Fresh location');
    expect(markup).toContain('Response');
    expect(markup).toContain('1m 35s');
    expect(markup).toContain('Ho Chi Minh City');
    expect(markup).toContain('Completion');
    expect(markup).toContain('Avg rating');
    expect(markup).toContain('87%');
    expect(markup).toContain('4.70');
    expect(markup).toContain('aria-label="Review reports for Quality Partner"');
    expect(markup).toContain('href="/partners/quality-partner?section=full"');
    expect(markup).toContain('Available soon · Low rating reviews');
    expect(markup).toContain('Smoke Partner');
    expect(markup).toContain('+84900001111 · Ho Chi Minh City');
    expect(markup).toContain('Online available · Last activity');
    expect(markup).toContain('date-time-text');
    expect(markup).toContain(
      'aria-label="Smoke Partner, +84900001111, Ho Chi Minh City, Online available, last activity 27 Jun 2026, 03:39, Verification incomplete, Finish KYC approval"',
    );
    expect(markup).toContain('Finish KYC approval');
    expect(markup).toContain('Partner operating status');
    expect(markup).toContain('Ready now');
    expect(markup).toContain('Approved, online, fresh location, active services, and wallet eligible');
    expect(markup).toContain('aria-label="Ready now, 0 Partners. Open filtered Partners list"');
    expect(markup).toContain('Open filtered list');
    expect(markup).toContain('Available soon');
    expect(markup).toContain('Auto-offline follow-up queue for approved partners');
    expect(markup).toContain('Partner operations priority');
    expect(markup).toContain('Ready supply');
    expect(markup).toContain('card admin-card partner-overview-funnel-step');
    expect(markup).toContain('partner-overview-funnel-bar');
    expect(markup).not.toContain('usage-overview-funnel-step');
    expect(markup).not.toContain('usage-overview-funnel-bar');
    expect(pageSource).not.toContain('usage-overview-funnel-step');
    expect(pageSource).not.toContain('usage-overview-funnel-bar');
    expect(markup).toContain('Selection drop-off');
    expect(markup).toContain('2 issues');
    expect(markup).toContain('Wallet risk');
    expect(markup).toContain('0 partners');
    expect(markup).toContain('Quality risk');
    expect(markup).toContain('1 partner');
    expect(markup).toContain('Review friction');
    expect(markup).toContain('Review wallet');
    expect(markup).toContain('Review quality');
    expect(markup).toContain('href="/partners?review=unsettled"');
    expect(markup).toContain('Selection friction');
    expect(markup).toContain('Selection issue');
    expect(markup).toContain('Availability (1)');
    expect(markup).toContain('Profile (2)');
    expect(markup).toContain('Service (0)');
    expect(markup).toContain('href="/partners/overview?range=7d&amp;riskStatus=high&amp;walletStatus=negative&amp;selectionIssue=price&amp;selectionSort=response"');
    expect(markup).toContain('<option value="response" selected="">Response time</option>');
    expect(markup).toContain('Viewed Not Booked');
    expect(markup).toContain('<small>Online available</small>');
    expect(markup).toContain('18 views');
    expect(markup).toContain('3 favorites');
    expect(markup).toContain('0% selected');
    expect(markup).toContain('money-text money-text-positive');
    expect(markup).toContain('550.000 VND');
    expect(markup).toContain('3m');
    expect(markup).toContain('Available soon');
    expect(markup).toContain('27 Jun 2026, 13:30');
    expect(markup).toContain('No approved profile image');
    expect(markup).toContain('High partner price');
    expect(markup).toContain('Review profile pricing and photos');
    expect(markup).toContain('Partner segments');
    expect(markup).not.toContain('ONLINE_AVAILABLE');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('StatusBadgeFromPillClass');
    expect(pageSource).not.toContain('statusBadgeToneFromPillClass');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).toContain('formatDateTime,');
    expect(pageSource).not.toContain('const generatedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('<small>Next {formatDateTime(row.nextAvailableAt)}</small>');
    expect(pageSource).not.toContain('{partnerStatus} · Last activity {lastActivity}');
    expect(pageSource).not.toContain('function formatDateTime(value?: string | null)');
    expect(pageSource).toContain('formatWholeNumber as formatNumber');
    expect(pageSource).not.toContain('function formatNumber(value: number)');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).not.toContain('<span className="pill pill-success">Vietnam supply</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{formatDurationSeconds(row.averageResponseSeconds)}</span>');
    expect(pageSource).not.toContain('<span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.status}</span>');
    expect(pageSource).not.toContain('<span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.mainReason}</span>');
  });

  it('omits empty aggregate grids while keeping actionable empty-state sections', async () => {
    mockedAdminGet.mockResolvedValue({
      ...partnerOverviewFixture,
      activityRetention: { cards: [] },
      actionLists: [
        {
          ...partnerOverviewFixture.actionLists[0],
          rows: [],
          totalCount: 0,
        },
      ],
      operatingStatus: { cards: [] },
      segments: [],
      summaryKpis: [],
    });

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({
        range: 'today',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('aria-label="Partner supply summary"');
    expect(markup).not.toContain('aria-label="Partner activity and retention"');
    expect(markup).not.toContain('aria-label="Partner segments"');
    expect(markup).toContain('Partner operations priority');
    expect(markup).toContain('Partner operating status');
    expect(markup).toContain('Risk and action queues');
    expect(markup).toContain('No operating status data is available yet.');
    expect(markup).toContain('No Partners need this action right now.');
    expect(markup).toContain('class="empty-state');
  });

  it('uses the shared money atom for partner overview money values', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain("if (kpi.unit === 'money') return formatMoney(kpi.value);");
    expect(pageSource).not.toContain('{showWallet ? <td>{formatMoney(row.walletBalance)}</td> : null}');
    expect(pageSource).not.toContain('<td>{formatPriceRange(row.minServicePrice, row.maxServicePrice)}</td>');
    expect(pageSource).not.toContain('function formatMoney(value: number)');
    expect(pageSource).not.toContain('function formatPlainVnd(value: number)');
  });

  it('renders partner summary and activity KPIs through the shared AdminKpiCard surface', async () => {
    mockedAdminGet.mockResolvedValue(partnerOverviewFixture);

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(pageSource).toContain('AdminKpiCard');
    expect(pageSource).toContain('<AdminKpiCard');
    expect(markup).toContain('card admin-kpi-card partner-overview-kpi-card');
    expect(markup).not.toContain('aria-label="Partner supply summary"><div class="card admin-card partner-overview-command-card');
    expect(markup).not.toContain('aria-label="Partner activity and retention"><div class="card admin-card partner-overview-command-card');
  });

  it('scopes partner KPI icon tones to direct MetricCard icon slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    for (const tone of ['primary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(css).toContain(`.partner-overview-kpi-card.is-${tone} > .metric-card > .metric-card-icon`);
      expect(css).not.toContain(`.partner-overview-kpi-card.is-${tone} .metric-card-icon`);
    }
  });

  it('scopes partner command icon tones to direct command-card icon slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    for (const tone of ['primary', 'info', 'success', 'warning', 'danger']) {
      expect(css).toContain(`.partner-overview-command-card.is-${tone} > .partner-overview-command-icon`);
      expect(css).not.toContain(`.partner-overview-command-card.is-${tone} .partner-overview-command-icon`);
    }
  });

  it('scopes operating status typography to direct command-card children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.partner-overview-operating-card > div > span');
    expect(css).toContain('.partner-overview-operating-card > div > strong');
    expect(css).toContain('.partner-overview-operating-card > div > small');
    expect(css).toContain('.partner-overview-operating-card > div > em');
    expect(css).toContain('.partner-overview-priority-card > div > em');
    expect(css).toContain('.partner-overview-selection-toolbar > div > strong');
    expect(css).not.toContain('.partner-overview-operating-card span {');
    expect(css).not.toContain('.partner-overview-operating-card strong {');
    expect(css).not.toContain('.partner-overview-operating-card small {');
    expect(css).not.toContain('.partner-overview-operating-card em {');
    expect(css).not.toContain('.partner-overview-priority-card em {');
    expect(css).not.toContain('.partner-overview-selection-toolbar strong {');
  });

  it('scopes partner overview typography to direct Vuexy card slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.partner-overview-funnel-step-header > span');
    expect(css).toContain('.partner-overview-funnel-step-header > strong');
    expect(css).toContain('.partner-overview-funnel-step > small');
    expect(css).toContain('.partner-overview-mini-kpis > div > span');
    expect(css).toContain('.partner-overview-mini-kpis > div > strong');
    expect(css).toContain('.partner-overview-action-identity > strong');
    expect(css).toContain('.partner-overview-action-identity > small');
    expect(css).toContain('.partner-overview-action-reason > small');

    expect(css).not.toContain('.partner-overview-funnel-step-header span {');
    expect(css).not.toContain('.partner-overview-funnel-step-header strong {');
    expect(css).not.toContain('.partner-overview-funnel-step small {');
    expect(css).not.toContain('.partner-overview-mini-kpis span {');
    expect(css).not.toContain('.partner-overview-mini-kpis strong {');
    expect(css).not.toContain('.partner-overview-action-row strong {');
    expect(css).not.toContain('.partner-overview-action-row small {');
  });
});

const partnerOverviewFixture: AdminPartnerOverview = {
  generatedAt: '2026-07-02T03:29:00.000Z',
  refreshSeconds: 60,
  source: 'stored-partner-supply-aggregates',
  range: '7d',
  rangeLabel: 'Last 7 days',
  windowStartAt: '2026-06-26T00:00:00.000Z',
  windowEndAt: '2026-07-02T00:00:00.000Z',
  filters: {
    city: null,
    onlineStatus: null,
    riskStatus: 'high',
    selectionIssue: 'availability',
    selectionSort: 'response',
    serviceId: null,
    verificationStatus: null,
    walletStatus: null,
  },
  summaryKpis: [
    {
      key: 'eligibleToAccept',
      label: 'Eligible To Accept',
      value: 12,
      detail: 'Can accept a booking now',
      unit: 'count',
      deltaPercent: null,
    },
  ],
  operatingStatus: {
    cards: [
      {
        key: 'ready-now',
        label: 'Ready now',
        count: 0,
        detail: 'Approved, online, fresh location, active services, and wallet eligible',
        href: '/partners?review=marketplace-ready&onlineStatus=available',
        tone: 'success',
      },
      {
        key: 'available-soon',
        label: 'Available soon',
        count: 1,
        detail: 'Partner marked available soon instead of ready now',
        href: '/partners?review=marketplace-ready&onlineStatus=soon',
        tone: 'info',
      },
      {
        key: 'inactive-7d',
        label: 'Inactive 7D',
        count: 0,
        detail: 'Auto-offline follow-up queue for approved partners',
        href: '/partners?review=marketplace-ready&activity=inactive-7d',
        tone: 'danger',
      },
    ],
  },
  supplyHealth: {
    areas: [
      {
        areaCode: 'hcm',
        area: 'Ho Chi Minh City',
        totalPartners: 20,
        onlinePartners: 8,
        locationFreshPartners: 6,
        eligiblePartners: 4,
        openRequests: 3,
        failedRequests: 1,
        matchingFailureRate: 25,
        averageResponseSeconds: 95,
        status: 'High Failure',
        riskLevel: 'high',
      },
    ],
    services: [
      {
        serviceId: 'service-1',
        serviceName: 'Deep Tissue Massage · 90 min',
        partnersOffering: 8,
        onlinePartners: 4,
        eligiblePartners: 3,
        openRequests: 2,
        completedBookings: 13,
        completionRate: 87,
        avgRating: 4.7,
        status: 'Healthy',
        riskLevel: 'low',
      },
    ],
  },
  funnel: {
    steps: [
      {
        key: 'signed-up',
        label: 'Signed Up',
        count: 21,
        conversionRate: 100,
        dropoffRate: 0,
        dataStatus: 'available',
      },
    ],
  },
  activityRetention: {
    cards: [],
  },
  bookingQuality: {
    kpis: [],
    riskPartners: [
      {
        partnerId: 'quality-partner',
        partnerName: 'Quality Partner',
        phone: '+84900002222',
        area: 'Ho Chi Minh City',
        status: 'ONLINE_AVAILABLE_SOON',
        lastActivityAt: '2026-06-26T20:39:00.000Z',
        mainReason: 'Low rating reviews',
        recommendedAction: 'Review reports',
        href: '/partners/quality-partner?section=full',
        riskLevel: 'high',
        lastOnlineAt: '2026-06-26T20:39:00.000Z',
        lastBookingAt: '2026-06-26T20:39:00.000Z',
        completedBookings: 4,
        cancelledBookings: 2,
        cancellationRate: 33,
        noShowReports: 1,
        lowReviewCount: 2,
        rating: 3.2,
        reviewCount: 4,
        walletBalance: 0,
      },
    ],
  },
  financeWalletRisk: {
    kpis: [],
    negativeWalletPartners: [],
    policyNote: 'Ledger-backed Partner wallet exposure.',
  },
  selectionFriction: {
    issueCounts: [
      { key: 'all', label: 'All', count: 2 },
      { key: 'availability', label: 'Availability', count: 1 },
      { key: 'profile', label: 'Profile', count: 2 },
      { key: 'price', label: 'Price', count: 2 },
      { key: 'response', label: 'Response', count: 1 },
      { key: 'service', label: 'Service', count: 0 },
    ],
    rows: [
      {
        partnerId: 'provider-viewed-not-booked',
        partnerName: 'Viewed Not Booked',
        phone: '+84900003333',
        area: 'Ho Chi Minh City',
        status: 'ONLINE_AVAILABLE',
        lastActivityAt: '2026-06-26T20:39:00.000Z',
        mainReason: 'High views, no completed booking',
        recommendedAction: 'Review profile pricing and photos',
        href: '/partners/provider-viewed-not-booked?section=full',
        riskLevel: 'medium',
        activeServiceCount: 1,
        availabilityStatus: 'Available soon',
        averageResponseSeconds: 180,
        completedBookings: 0,
        favoriteCount: 3,
        galleryImageCount: 0,
        hasProfileImage: false,
        lastIntentAt: '2026-06-26T20:39:00.000Z',
        maxServicePrice: 550_000,
        minServicePrice: 550_000,
        nextAvailableAt: '2026-06-27T06:30:00.000Z',
        profileViewCustomers: 4,
        profileViews: 18,
        rating: 4.7,
        readinessFlags: ['No approved profile image', 'High partner price'],
        reviewCount: 12,
        selectionRate: 0,
      },
    ],
  },
  actionLists: [
    {
      key: 'pending-verification',
      title: 'Pending Verification',
      totalCount: 1,
      viewAllHref: '/partners?review=unapproved',
      rows: [
        {
          partnerId: 'partner-1',
          partnerName: 'Smoke Partner',
          phone: '+84900001111',
          area: 'Ho Chi Minh City',
          status: 'ONLINE_AVAILABLE',
          lastActivityAt: '2026-06-26T20:39:00.000Z',
          mainReason: 'Verification incomplete',
          recommendedAction: 'Finish KYC approval',
          href: '/partners/partner-1?section=full',
          riskLevel: 'high',
        },
      ],
    },
  ],
  segments: [
    {
      key: 'pending',
      label: 'New Pending',
      count: 1,
      explanation: 'Needs admin review before marketplace exposure.',
      recommendedAction: 'Review KYC and profile documents.',
      href: '/partners?review=unapproved',
      tone: 'warning',
    },
  ],
  dataNotes: [],
};
