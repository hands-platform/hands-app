import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';

import { adminGet, type AdminPartnerOverview } from '../../../lib/admin-api';
import PartnerOverviewPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

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

  it('renders compact action queue summaries with descriptive open controls and forwards filters', async () => {
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
      '/admin/partners/overview?range=7d&includeActionRows=false&previewLimit=5&riskStatus=high&walletStatus=negative&selectionIssue=availability&selectionSort=response',
      null,
    );
    expect(markup).toContain('Detailed action queues');
    expect(markup).toContain('<h1>Overview</h1>');
    expect(markup).toContain('Risk analysis: latest 500');
    expect(markup).toContain('Data stale · as of');
    expect(markup).toContain(
      'href="/partners/overview?range=7d&amp;riskStatus=high&amp;walletStatus=negative&amp;selectionIssue=availability&amp;selectionSort=response">Refresh now</a>',
    );
    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('class="partner-overview-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-filter-panel partner-overview-filter-panel admin-section');
    expect(markup).toContain('booking-date-filter-buttons partner-overview-range-buttons');
    expect(markup).not.toContain('usage-overview-filter-panel');
    expect(markup).not.toContain('usage-overview-range-buttons');
    expect(markup).not.toContain('card admin-section partner-overview-filter-panel');
    expect(markup).not.toContain('class="admin-form-control"');
    expect(markup).toContain('class="admin-form-input admin-form-control-labeled"');
    expect(markup).toContain('class="admin-form-select admin-form-control-labeled"');
    expect(markup).toContain('<option value="service-1">Deep Tissue Massage · 90 min</option>');
    expect(markup).not.toContain('placeholder="service id"');
    expect(markup).toContain('class="admin-form-control-button button button-primary"');
    expect(markup).toContain('class="metric-card-scope is-live"');
    expect(markup).toContain('Live');
    expect(pageSource).toContain('AdminFormGrid');
    expect(pageSource).not.toContain('<form className="partner-overview-filter-grid"');
    expect(pageSource).not.toContain(
      '<form action="/partners/overview" className="partner-overview-selection-sort-form">',
    );
    expect(markup).toContain(
      'card admin-section partner-overview-section-card partner-overview-operating-board',
    );
    expect(markup).toContain('admin-section-body partner-overview-operating-grid');
    expect(markup).toContain('card admin-card partner-overview-command-card partner-overview-operating-card');
    expect(pageSource).not.toContain('className={`card admin-card partner-overview-operating-card');
    expect(pageSource).toContain(
      'baseClassName="partner-overview-command-card partner-overview-operating-card"',
    );
    expect(pageSource).not.toContain('AdminLinkCard');
    expect(markup).toContain(
      'card admin-section partner-overview-section-card partner-overview-priority-board',
    );
    expect(markup).not.toContain('usage-overview-funnel-card');
    expect(markup).toContain('admin-section-body partner-overview-priority-grid');
    expect(markup).toContain('card admin-card partner-overview-command-card partner-overview-priority-card');
    expect(markup).toContain('partner-overview-command-icon');
    expect(markup).not.toContain('usage-overview-command-card');
    expect(markup).not.toContain('usage-overview-command-icon');
    expect(markup).not.toContain('<article class="card admin-card partner-overview-command-card');
    expect(markup).toContain('partner-overview-action-table');
    expect(markup).not.toContain('partner-overview-action-card');
    expect(pageSource).not.toContain('AdminCardHeader');
    expect(pageSource).not.toContain('AdminCardGrid');
    expect(pageSource).not.toContain('function ActionRow');
    expect(markup).toContain('admin-section-body partner-overview-funnel-steps');
    expect(markup).toContain('admin-section-body partner-overview-action-table-body');
    expect(markup).toContain('card admin-section partner-overview-table-card');
    expect(markup).toContain('admin-table-scroll partner-overview-table-wrap');
    expect(markup).toContain(
      'table vuexy-data-table vuexy-booking-table admin-data-table partner-overview-table',
    );
    expect(markup).not.toContain('usage-overview-table-card');
    expect(markup).not.toContain('usage-overview-table-wrap');
    expect(markup).not.toContain('usage-overview-table');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('AdminRowLink');
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
    expect(pageSource).not.toContain('Supply health');
    expect(pageSource).toContain('Current readiness snapshot');
    expect(pageSource).not.toContain('Area supply health');
    expect(pageSource).not.toContain('Service supply health');
    expect(pageSource).not.toContain('<a\n      aria-label={`${row.partnerName}');
    expect(pageSource).not.toContain('<a aria-label={`${row.recommendedAction} for ${row.partnerName}`}');
    expect(pageSource).not.toContain(
      '<a aria-label={`Open ${list.title}`} className="button button-secondary"',
    );
    expect(markup).toContain('admin-section-body partner-overview-risk-card-body');
    expect(markup).toContain('admin-section-body partner-overview-selection-body');
    expect(pageSource).toContain('AdminOverviewCommandCard');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${tone}`}');
    expect(pageSource).not.toContain(
      '<AdminCard className={`usage-overview-command-card is-${segment.tone}`}',
    );
    expect(pageSource).toContain('baseClassName="partner-overview-command-card"');
    expect(pageSource).toContain('iconClassName="partner-overview-command-icon"');
    expect(markup).toContain('aria-label="Remove Risk filter High"');
    expect(markup).toContain('aria-label="Remove Wallet filter Negative"');
    expect(markup).toContain('aria-label="Remove Selection issue filter Availability"');
    expect(markup).toContain('aria-label="Remove Selection sort filter Response time"');
    expect(markup).toContain('aria-label="Open full queue for Pending Verification"');
    expect(markup).toContain('Fresh location');
    expect(markup).toContain('Online available');
    expect(markup).toContain('Bookable now');
    expect(markup).toContain('Response');
    expect(markup).toContain('1m 35s');
    expect(markup).toContain('Ho Chi Minh City');
    expect(markup).toContain('Completion rate');
    expect(markup).toContain('Non-completed rate');
    expect(markup).toContain('<th scope="col">Service</th><th scope="col">Status</th>');
    expect(markup).toContain('Lifetime Partner rating');
    expect(markup).toContain('87%');
    expect(markup).toContain('4.70');
    expect(markup).toContain('aria-label="Review reports for Quality Partner"');
    expect(markup).toContain('href="/partners/quality-partner?section=full"');
    expect(markup).toContain('Available soon · Review follow-up');
    expect(markup).toContain('date-time-text');
    expect(markup).toContain('Open Partners');
    expect(markup).toContain('Open full queue');
    expect(markup).toContain('Current supply');
    expect(markup).toContain('Fresh location · last 90 min');
    expect(markup).toContain('Bookable now');
    expect(markup).toContain('Approved, online, fresh location, active services, and wallet eligible');
    expect(markup).toContain(
      'aria-label="Bookable now, 0 Partners. Open full queue; bounded Risk filter is not applied"',
    );
    expect(markup).toContain('Available but blocked');
    expect(markup).toContain('href="/partners?review=available-blocked&amp;walletStatus=negative"');
    expect(markup).toContain('aria-label="Customer App Partner visibility"');
    expect(markup).toContain('Visible in customer app: 4');
    expect(markup).toContain('href="/partners?review=customer-visible-now&amp;walletStatus=negative"');
    expect(markup).toContain('Approved public profiles with active services · blocker counts can overlap');
    expect(markup).not.toContain('Bank approval missing');
    expect(markup).toContain('Payout bank not approved');
    expect(markup).toContain('Blocking signals');
    expect(markup).toContain('Signals can overlap');
    expect(markup).toContain('Stale location');
    expect(markup).toContain(
      'href="/partners?review=customer-visibility-documents&amp;walletStatus=negative"',
    );
    expect(markup).toContain('No active service');
    expect(markup).toContain('href="/partners?review=customer-visibility-service&amp;walletStatus=negative"');
    expect(markup).toContain('Negative wallet');
    expect(markup).toContain('href="/partners?review=available-blocked-wallet&amp;walletStatus=negative"');
    expect(markup).toContain('Account blocked');
    expect(markup).toContain('href="/partners?review=available-blocked-account&amp;walletStatus=negative"');
    expect(markup).toContain('Available soon');
    expect(markup).toContain('Auto-offline follow-up queue for approved partners');
    expect(markup).toContain('Action required');
    expect(markup).toContain('Top 1 of 1 active queue');
    expect(markup).toContain('Ordered by operating risk, affected Partners, then stable queue key');
    expect(markup).toContain('Partners may appear in more than one queue');
    expect(markup).toContain('current snapshot, not cohort conversion');
    expect(markup).toContain('Telemetry covers 1% of approved Partners');
    expect(markup).toContain(
      'Period usage includes tracked activity only and is not a complete Partner total',
    );
    expect(markup).toContain('Approved / registered: 76%');
    expect(markup).toContain('Bookable / approved: 50%');
    expect(markup).toContain('bounded Risk filter is not applied to these counts');
    expect(markup).not.toContain('Ready supply');
    expect(markup).toContain('card admin-card partner-overview-funnel-step');
    expect(markup).not.toContain('partner-overview-funnel-bar');
    expect(markup).not.toContain('usage-overview-funnel-step');
    expect(markup).not.toContain('usage-overview-funnel-bar');
    expect(pageSource).not.toContain('usage-overview-funnel-step');
    expect(pageSource).not.toContain('usage-overview-funnel-bar');
    expect(markup).toContain('Pending verification');
    expect(markup).not.toContain('Wallet risk');
    expect(markup).toContain('1 partner');
    expect(markup).toContain(
      'aria-label="Pending verification, 1 partner. Open full queue; bounded Risk filter is not applied"',
    );
    expect(markup).not.toContain('Review wallet');
    expect(markup).not.toContain('href="/partners?review=unsettled"');
    expect(markup).toContain('Selection friction');
    expect(markup).toContain('Selection issue');
    expect(markup).toContain('Availability (1)');
    expect(markup).toContain('Profile (2)');
    expect(markup).toContain('Service (0)');
    expect(markup).toContain(
      'href="/partners/overview?range=7d&amp;riskStatus=high&amp;walletStatus=negative&amp;selectionIssue=price&amp;selectionSort=response"',
    );
    expect(markup).toContain('<option value="response" selected="">Response time</option>');
    expect(markup).toContain('Viewed Not Booked');
    expect(markup).toContain('Ho Chi Minh City · Online available');
    expect(markup).toContain('18 views');
    expect(markup).toContain('3 favorites');
    expect(markup).toContain('0% selected');
    expect(markup).toContain('money-text money-text-positive');
    expect(markup).toContain('550.000 VND');
    expect(markup).toContain('3m');
    expect(markup).toContain('Available soon');
    expect(markup).toContain('Profile and service details');
    expect(markup).toContain('No approved profile image');
    expect(markup).toContain('High partner price');
    expect(markup).toContain('Review profile pricing and photos');
    expect(markup).toContain('aria-label="Area supply table"');
    expect(markup).toContain('aria-label="Service supply table"');
    expect(markup).toContain('aria-label="Booking quality risk table"');
    expect(markup).toContain('aria-label="Finance wallet risk table"');
    expect(markup).toContain('aria-label="Selection friction table"');
    expect(markup).toContain('Bookable status and blockers');
    expect(markup).toContain('Recommended action');
    expect(markup).not.toContain('Partner segments');
    expect(markup).not.toContain('Data notes');
    expect(markup).not.toMatch(/>ONLINE_AVAILABLE(?:_SOON)?</);
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('StatusBadgeFromPillClass');
    expect(pageSource).not.toContain('statusBadgeToneFromPillClass');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain('formatDateTime,');
    expect(pageSource).not.toContain('const generatedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('<small>Next {formatDateTime(row.nextAvailableAt)}</small>');
    expect(pageSource).not.toContain('{partnerStatus} · Last activity {lastActivity}');
    expect(pageSource).not.toContain('function formatDateTime(value?: string | null)');
    expect(pageSource).toContain('formatWholeNumber as formatNumber');
    expect(pageSource).not.toContain('function formatNumber(value: number)');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).not.toContain('<span className="pill pill-success">Vietnam supply</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain(
      '<span className="pill pill-info">{formatDurationSeconds(row.averageResponseSeconds)}</span>',
    );
    expect(pageSource).not.toContain(
      '<span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.status}</span>',
    );
    expect(pageSource).not.toContain(
      '<span className={`pill ${riskPillClass(row.riskLevel)}`}>{row.mainReason}</span>',
    );
  });

  it('omits empty aggregate grids while keeping actionable empty-state sections', async () => {
    mockedAdminGet.mockResolvedValue({
      ...partnerOverviewFixture,
      activityRetention: { cards: [] },
      appActivity: { inactivePartners: [], kpis: [], mostActive: [] },
      actionLists: [
        {
          ...partnerOverviewFixture.actionLists[0],
          rows: [],
          totalCount: 0,
        },
      ],
      operatingStatus: { availableBlockedReasons: [], cards: [], locationFreshnessMinutes: 90 },
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
    expect(markup).not.toContain('Partner app activity');
    expect(markup).not.toContain('aria-label="Partner segments"');
    expect(markup).toContain('Action required');
    expect(markup).toContain('Current supply');
    expect(markup).toContain('Detailed action queues');
    expect(markup).toContain('No operating status data is available yet.');
    expect(markup).toContain('class="empty-state');
  });

  it('requests count-only action queues for the initial overview payload', async () => {
    mockedAdminGet.mockResolvedValue({
      ...partnerOverviewFixture,
      actionLists: partnerOverviewFixture.actionLists.map((list) => ({
        ...list,
        rows: [],
      })),
    });

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({ range: '30d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/overview?range=30d&includeActionRows=false&previewLimit=5',
      null,
    );
    expect(markup).toContain('Pending Verification');
    expect(markup).toContain('1 Partners');
    expect(markup).not.toContain('Smoke Partner');
    expect(markup).not.toContain('No Partners need this action right now.');
  });

  it('derives stable Top N of M priority cards from 0, 1, 2, and 8 active action queues', async () => {
    const baseList = partnerOverviewFixture.actionLists[0]!;
    const queueDefinitions = [
      {
        key: 'pending-verification',
        title: 'Pending Verification',
        totalCount: 185,
        viewAllHref: '/partners?review=unapproved',
      },
      {
        key: 'negative-wallet',
        title: 'Negative Wallet',
        totalCount: 124,
        viewAllHref: '/partners?review=unsettled',
      },
      {
        key: 'payout-blocked',
        title: 'Payout Blocked',
        totalCount: 124,
        viewAllHref: '/partners?review=payout-blocked',
      },
      {
        key: 'tax-info-missing',
        title: 'Tax Info Missing',
        totalCount: 999,
        viewAllHref: '/partners?review=tax-info-missing',
      },
      {
        key: 'inactive-7d',
        title: 'Inactive 7D',
        totalCount: 500,
        viewAllHref: '/partners?review=inactive-7d',
      },
      {
        key: 'approved-never-online',
        title: 'Approved Never Online',
        totalCount: 400,
        viewAllHref: '/partners?review=approved-never-online',
      },
      {
        key: 'no-show-risk',
        title: 'No-show Risk',
        totalCount: 5,
        viewAllHref: '/partners?review=no-show-risk',
      },
      { key: 'low-rating', title: 'Low Rating', totalCount: 4, viewAllHref: '/partners?review=low-rating' },
    ];

    for (const activeCount of [0, 1, 2, 8]) {
      mockedAdminGet.mockResolvedValueOnce({
        ...partnerOverviewFixture,
        actionLists:
          activeCount === 0
            ? [{ ...baseList, rows: [], totalCount: 0 }]
            : queueDefinitions.slice(0, activeCount).map((definition) => ({
                ...baseList,
                ...definition,
                rows: [],
              })),
      });
      const page = await PartnerOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
      const markup = renderToStaticMarkup(page);

      if (activeCount === 0) {
        expect(markup).toContain('No action');
      } else {
        expect(markup).toContain(
          `Top ${Math.min(2, activeCount)} of ${activeCount} active ${activeCount === 1 ? 'queue' : 'queues'}`,
        );
      }
      if (activeCount === 8) {
        expect(markup.indexOf('Wallet risk')).toBeLessThan(markup.indexOf('Pending verification'));
        expect(markup).toContain('Wallet risk, 124 partners');
        expect(markup).toContain('Pending verification, 185 partners');
        expect(markup).toContain('Partners may appear in more than one queue');
      }
    }
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
    expect(markup).toContain('+10% vs previous');
    expect(markup).not.toContain(
      'aria-label="Partner supply summary"><div class="card admin-card partner-overview-command-card',
    );
    expect(markup).not.toContain(
      'aria-label="Partner activity and retention"><div class="card admin-card partner-overview-command-card',
    );
  });

  it('renders actual Partner App activity separately from booking performance', async () => {
    mockedAdminGet.mockResolvedValue(partnerOverviewFixture);

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner app activity');
    expect(markup).toContain('Actual Partner App opens and authenticated session starts');
    expect(markup).toContain('Most active');
    expect(markup).toContain('App telemetry inactive 7D+ / untracked');
    expect(markup).toContain('Active Partner');
    expect(markup).toContain('Inactive Partner');
    expect(markup).toContain('App opens');
    expect(markup).toContain('Usage');
    expect(markup).toContain('4 sessions');
    expect(markup).toContain('href="/partners?activity=app-inactive-7d"');
    expect(markup).toContain('href="/partners?activity=app-not-tracked"');
    expect(markup).toContain('App telemetry inactive 7D+');
    expect(markup).toContain(
      'Period usage includes tracked activity only and is not a complete Partner total',
    );
  });

  it('labels the negative wallet preview ordering and full unique queue count', async () => {
    const previewRow = partnerOverviewFixture.bookingQuality.riskPartners[0];
    mockedAdminGet.mockResolvedValue({
      ...partnerOverviewFixture,
      financeWalletRisk: {
        kpis: [
          {
            deltaPercent: null,
            detail: 'Receivable partners',
            key: 'partnersWithNegativeWallet',
            label: 'Partners With Negative Wallet',
            unit: 'count',
            value: 124,
          },
          {
            deltaPercent: null,
            detail: 'Unique Partner count; wallet, bank, and tax block reasons can overlap',
            key: 'payoutBlockedPartners',
            label: 'Payout Blocked Partners',
            unit: 'count',
            value: 20,
          },
        ],
        negativeWalletPartners: Array.from({ length: 5 }, (_, index) => ({
          ...previewRow,
          partnerId: `wallet-${index}`,
          partnerName: `Wallet Partner ${index}`,
          walletBalance: -500_000 + index * 10_000,
        })),
        policyNote:
          'Payout outstanding, receivable, and wallet scopes can overlap and must not be added together.',
      },
    });

    const page = await PartnerOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Largest 5 receivables · sorted by balance (most negative first)');
    expect(markup).toContain('View all 124');
    expect(markup).toContain('Unique Partner count; wallet, bank, and tax block reasons can overlap');
    expect(markup).toContain('scopes can overlap and must not be added together');
  });

  it('labels offline supply as a current state instead of a queue', async () => {
    mockedAdminGet.mockResolvedValue({
      ...partnerOverviewFixture,
      operatingStatus: {
        ...partnerOverviewFixture.operatingStatus,
        cards: [
          ...partnerOverviewFixture.operatingStatus.cards,
          {
            key: 'offline',
            label: 'Offline',
            count: 5,
            detail: 'Approved Partners currently offline',
            href: '/partners?providerStatus=OFFLINE',
            tone: 'neutral',
          },
        ],
      },
    });

    const page = await PartnerOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toMatch(/metric-card-scope is-record">Current status[\s\S]*Offline/);
  });

  it('labels partner operating and priority cards by operating scope', async () => {
    mockedAdminGet.mockResolvedValue(partnerOverviewFixture);

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toMatch(
      /partner-overview-operating-card[\s\S]*metric-card-scope is-record">No action[\s\S]*Bookable now/,
    );
    expect(markup).toMatch(
      /partner-overview-operating-card[\s\S]*metric-card-scope is-record">No action[\s\S]*No operational activity in 7D/,
    );
    expect(markup).toMatch(
      /partner-overview-operating-card[\s\S]*metric-card-scope is-risk">Needs action[\s\S]*Available but blocked/,
    );
    expect(markup).toMatch(
      /partner-overview-priority-card[\s\S]*metric-card-scope is-action">Pending[\s\S]*Pending verification/,
    );
  });

  it('shows an explicit unavailable state instead of rendering fallback zero metrics', async () => {
    mockedAdminGet.mockResolvedValue(null);

    const page = await PartnerOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner data unavailable');
    expect(markup).toContain('Source unavailable');
    expect(markup).toContain('Retry Partner Overview');
    expect(markup).not.toContain('Action required');
    expect(markup).not.toContain('Ready supply');
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

    expect(css).toContain('.partner-overview-operating-card > div > span:not(.metric-card-scope)');
    expect(css).toContain('.partner-overview-command-card > div > span:not(.metric-card-scope)');
    expect(css).toContain('.partner-overview-operating-card > div > strong');
    expect(css).toContain('.partner-overview-operating-card > div > small');
    expect(css).toContain('.partner-overview-operating-card > div > em');
    expect(css).toContain('.partner-overview-priority-card > div > em');
    expect(css).toMatch(/\.partner-overview-priority-card > div > strong\s*\{[\s\S]*?white-space:\s*normal/);
    expect(css).toContain('.partner-overview-selection-toolbar > div > strong');
    expect(css).not.toContain('.partner-overview-operating-card span {');
    expect(css).not.toContain('.partner-overview-operating-card strong {');
    expect(css).not.toContain('.partner-overview-operating-card small {');
    expect(css).not.toContain('.partner-overview-operating-card em {');
    expect(css).not.toContain('.partner-overview-priority-card em {');
    expect(css).not.toContain('.partner-overview-selection-toolbar strong {');
  });

  it('keeps Partner operations tables full-width and the 720px app tables in one column', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toMatch(
      /\.partner-overview-supply-grid,\s*\.partner-overview-quality-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.partner-overview-priority-grid,[\s\S]*?grid-template-columns:\s*1fr/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1150px\)[\s\S]*?\.partner-overview-filter-panel > \.admin-filter-panel-header\s*\{[\s\S]*?flex-direction:\s*column/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1180px\)[\s\S]*?\.usage-overview-insight-grid\.partner-overview-app-activity-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toContain('.partner-overview-page .partner-overview-table > thead > tr > th:first-child');
    expect(css).toContain(
      '.partner-overview-page .partner-overview-table.partner-overview-service-table > thead > tr > th:nth-child(2)',
    );
    expect(css).toContain('left: 180px;');
    expect(css).toMatch(
      /\.partner-overview-page \.partner-overview-service-table\s*\{[\s\S]*?overflow:\s*visible/,
    );
    expect(css).toContain('position: sticky;');
  });

  it('scopes partner overview typography to direct Vuexy card slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.partner-overview-funnel-step-header > span');
    expect(css).toContain('.partner-overview-funnel-step-header > strong');
    expect(css).toContain('.partner-overview-funnel-step > small');
    expect(css).toContain('.partner-overview-mini-kpis > div > span');
    expect(css).toContain('.partner-overview-mini-kpis > div > strong');
    expect(css).toContain('.partner-overview-action-card > .admin-card-header');
    expect(css).toContain('.partner-overview-action-card > .admin-card-header > div > h3');
    expect(css).toContain('.partner-overview-action-card > .admin-card-header > div > .muted');
    expect(css).toContain('.partner-overview-action-identity > strong');
    expect(css).toContain('.partner-overview-action-identity > small');
    expect(css).toContain('.partner-overview-action-reason > small');

    expect(css).not.toContain('.partner-overview-funnel-step-header span {');
    expect(css).not.toContain('.partner-overview-funnel-step-header strong {');
    expect(css).not.toContain('.partner-overview-funnel-step small {');
    expect(css).not.toContain('.partner-overview-mini-kpis span {');
    expect(css).not.toContain('.partner-overview-mini-kpis strong {');
    expect(css).not.toContain('.partner-overview-action-card .admin-card-header {');
    expect(css).not.toContain('.partner-overview-action-card .admin-card-header h3 {');
    expect(css).not.toContain('.partner-overview-action-card .admin-card-header .muted,');
    expect(css).not.toContain('.partner-overview-action-row strong {');
    expect(css).not.toContain('.partner-overview-action-row small {');
  });

  it('does not render period-style conversion meters in the current readiness snapshot', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(pageSource).not.toContain('partner-overview-funnel-bar');
    expect(css).not.toContain('.partner-overview-funnel-bar > i');
  });
});

const partnerOverviewFixture: AdminPartnerOverview = {
  generatedAt: '2026-07-02T03:29:00.000Z',
  refreshSeconds: 60,
  source: 'live-summary-backed-partner-operational-query',
  timeZone: 'Asia/Ho_Chi_Minh',
  range: '7d',
  rangeLabel: 'Last 7 days',
  windowStartAt: '2026-06-26T00:00:00.000Z',
  windowEndAt: '2026-07-02T00:00:00.000Z',
  comparison: {
    rangeLabel: 'Previous last 7 days',
    windowStartAt: '2026-06-19T00:00:00.000Z',
    windowEndAt: '2026-06-26T00:00:00.000Z',
    totals: {
      appOpenCount: 8,
      cancellationCount: 1,
      completedBookingCount: 10,
      sessionStartCount: 3,
    },
  },
  queryScope: {
    actionListCountScope: 'full-population',
    appActivityCountScope: 'full-population',
    operatingStatusCountScope: 'full-population',
    providerScanLimit: 500,
    supplyHealthCountScope: 'full-population-excluding-risk-filter',
    walletBalancePartnerCount: 2,
    walletBalanceScopeTruncated: true,
    walletStatusFilterBounded: false,
  },
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
  filterOptions: {
    services: [
      {
        durationMin: 90,
        id: 'service-1',
        name: 'Deep Tissue Massage',
      },
    ],
  },
  summaryKpis: [
    {
      key: 'averageResponseTime',
      label: 'Average Response Time',
      value: 95,
      detail: 'Filtered participant responses',
      unit: 'seconds',
      deltaPercent: null,
    },
    {
      key: 'averageRating',
      label: 'Average Rating',
      value: 4.7,
      detail: 'Published reviews in range',
      unit: 'rating',
      deltaPercent: null,
    },
  ],
  operatingStatus: {
    locationFreshnessMinutes: 90,
    customerDiscovery: {
      visibleNow: 4,
      visibleHref: '/partners?review=customer-visible-now',
      blockers: [
        {
          key: 'documents',
          label: 'Public documents missing',
          count: 2,
          detail: 'Required public profile documents are incomplete',
          href: '/partners?review=customer-visibility-documents',
          tone: 'warning',
        },
        {
          key: 'service',
          label: 'No bookable service',
          count: 1,
          detail: 'Profile can be approved but cannot take a reservation',
          href: '/partners?review=customer-visibility-service',
          tone: 'danger',
        },
      ],
    },
    availableBlockedReasons: [
      {
        key: 'location',
        label: 'Stale location',
        count: 2,
        detail: 'No location update in the last 90 minutes',
        href: '/partners?review=available-blocked-location',
        tone: 'warning',
      },
      {
        key: 'service',
        label: 'No active service',
        count: 1,
        detail: 'No active service can be offered to customers',
        href: '/partners?review=available-blocked-service',
        tone: 'warning',
      },
      {
        key: 'wallet',
        label: 'Negative wallet',
        count: 1,
        detail: 'Partner receivable requires Finance review before dispatch',
        href: '/partners?review=available-blocked-wallet',
        tone: 'danger',
      },
      {
        key: 'account',
        label: 'Account blocked',
        count: 0,
        detail: 'An active account block prevents dispatch',
        href: '/partners?review=available-blocked-account',
        tone: 'danger',
      },
    ],
    cards: [
      {
        key: 'ready-now',
        label: 'Bookable now',
        count: 0,
        detail: 'Approved, online, fresh location, active services, and wallet eligible',
        href: '/partners?review=ready-now',
        tone: 'success',
      },
      {
        key: 'available-blocked',
        label: 'Available but blocked',
        count: 2,
        detail: 'Online available, but location, service, account, or wallet gates prevent booking',
        href: '/partners?review=available-blocked',
        tone: 'warning',
      },
      {
        key: 'available-soon',
        label: 'Available soon',
        count: 1,
        detail: 'Partner marked available soon instead of ready now',
        href: '/partners?verification=APPROVED&kyc=APPROVED&providerStatus=ONLINE_AVAILABLE_SOON',
        tone: 'info',
      },
      {
        key: 'inactive-7d',
        label: 'No operational activity in 7D',
        count: 0,
        detail: 'Auto-offline follow-up queue for approved partners',
        href: '/partners?review=ready-now&activity=inactive-7d',
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
        nonCompletedOutcomes: 1,
        nonCompletedShare: 25,
        averageResponseSeconds: 95,
        status: 'High non-completed share',
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
        key: 'registered',
        label: 'Registered',
        count: 21,
        conversionRate: 100,
        dropoffRate: 0,
        dataStatus: 'available',
      },
      {
        key: 'approved',
        label: 'Approved',
        count: 16,
        conversionRate: 76,
        dropoffRate: 24,
        dataStatus: 'available',
      },
      {
        key: 'ready-now',
        label: 'Bookable now',
        count: 8,
        conversionRate: 38,
        dropoffRate: 50,
        dataStatus: 'available',
      },
    ],
  },
  activityRetention: {
    cards: [],
  },
  appActivity: {
    kpis: [
      {
        deltaPercent: 10,
        detail: 'Last 7 days',
        key: 'partnerAppOpens',
        label: 'App Opens',
        unit: 'count',
        value: 12,
      },
      {
        deltaPercent: null,
        detail: 'Approved Partners with old app activity',
        key: 'partnerAppInactive7d',
        label: 'App telemetry inactive 7D+',
        unit: 'count',
        value: 1,
      },
      {
        deltaPercent: null,
        detail: '12 / 1,235 approved Partners',
        key: 'partnerAppTelemetryCoverage',
        label: 'Telemetry coverage',
        unit: 'percent',
        value: 1,
      },
    ],
    mostActive: [
      {
        activeRecordCount: 12,
        activityStatus: 'active',
        appOpenCount: 8,
        area: 'Ho Chi Minh City',
        href: '/partners/active-partner',
        inactivityDays: 0,
        lastActiveAt: '2026-07-02T03:20:00.000Z',
        partnerId: 'active-partner',
        partnerName: 'Active Partner',
        sessionStartCount: 4,
        status: 'ONLINE_AVAILABLE',
      },
    ],
    inactivePartners: [
      {
        activeRecordCount: 0,
        activityStatus: 'inactive_7d',
        appOpenCount: 0,
        area: 'Ha Noi',
        href: '/partners/inactive-partner',
        inactivityDays: 12,
        lastActiveAt: '2026-06-20T03:20:00.000Z',
        partnerId: 'inactive-partner',
        partnerName: 'Inactive Partner',
        sessionStartCount: 0,
        status: 'OFFLINE',
      },
    ],
  },
  bookingQuality: {
    kpis: [
      {
        deltaPercent: 10,
        detail: 'Completed Partner cohort',
        key: 'completionRate',
        label: 'Completion Rate',
        unit: 'percent',
        value: 87,
      },
      {
        deltaPercent: null,
        detail: 'Cancelled + no-show + expired / completed + non-completed',
        key: 'nonCompletedBookingRate',
        label: 'Non-completed booking rate',
        unit: 'percent',
        value: 13,
      },
    ],
    riskPartnerCount: 1,
    riskPartners: [
      {
        partnerId: 'quality-partner',
        partnerName: 'Quality Partner',
        phone: '+84900002222',
        area: 'Ho Chi Minh City',
        status: 'ONLINE_AVAILABLE_SOON',
        lastActivityAt: '2026-06-26T20:39:00.000Z',
        mainReason: 'Review follow-up',
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
    kpis: [
      {
        deltaPercent: null,
        detail: 'Current withdrawal bank review',
        key: 'payoutBankNotApprovedPartners',
        label: 'Payout bank not approved',
        unit: 'count',
        value: 1,
      },
    ],
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
