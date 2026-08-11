import { vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import { adminGetResult } from '../../lib/admin-api';
import MarketingAnalyticsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('MarketingAnalyticsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
  });

  it('allows explicit aggregate fetch revalidation instead of forcing the whole route dynamic', () => {
    expect(pageSource).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it('loads summary only by default', async () => {
    await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });

    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/marketing/summary?range=7d');
    expect(hrefs).toContain('/admin/marketing/coupons/summary?range=7d');
    expect(hrefs.some((href) => String(href).includes('/admin/marketing/dimensions/'))).toBe(false);
    expect(hrefs.some((href) => String(href).startsWith('/admin/marketing/coupons?'))).toBe(false);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/marketing/summary?range=7d', expect.anything(), {
      freshness: 'aggregate',
      revalidateSeconds: 60,
      tags: ['admin-marketing-analytics'],
    });
  });

  it('distinguishes an unavailable headline summary from a valid empty cohort', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).startsWith('/admin/marketing/summary?'),
      status: String(href).startsWith('/admin/marketing/summary?') ? 503 : 200,
    }));

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Marketing data is temporarily unavailable');
    expect(markup).toContain('Open system health');
    expect(markup).not.toContain('No marketing evidence in last 7 days');
    expect(markup).not.toContain('aria-label="Marketing business outcome metrics"');
    expect(markup).toContain('No coupon checkout activity in this range');
  });

  it('keeps coupon results available when the headline summary fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).startsWith('/admin/marketing/summary?')) {
        return { data: fallback, ok: false, status: 500 };
      }
      if (String(href).startsWith('/admin/marketing/coupons/summary?')) {
        return {
          data: {
            ...(fallback as Record<string, unknown>),
            appliedBookingCount: 3,
            completedBookingCount: 2,
            completedBookingValue: 900_000,
            completedConversionRate: 66.67,
            realizedDiscountAmount: 100_000,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Marketing data is temporarily unavailable');
    expect(markup).toContain('marketing-coupon-metric-grid');
    expect(markup).toContain('Coupon checkouts');
    expect(markup).not.toContain('Coupon performance is temporarily unavailable');
  });

  it('keeps headline evidence available when coupon summary fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).startsWith('/admin/marketing/coupons/summary?'),
      status: String(href).startsWith('/admin/marketing/coupons/summary?') ? 503 : 200,
    }));

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No marketing evidence in last 7 days');
    expect(markup).toContain('aria-label="Marketing business outcome metrics"');
    expect(markup).toContain('Coupon performance is temporarily unavailable');
    expect(markup).not.toContain('No coupon checkout activity in this range');
  });

  it('reports one unavailable breakdown without hiding the other dimensions', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).startsWith('/admin/marketing/dimensions/source?'),
      status: String(href).startsWith('/admin/marketing/dimensions/source?') ? 503 : 200,
    }));

    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ breakdowns: '1', range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Source performance is temporarily unavailable');
    expect(markup).toContain('Recent location evidence');
    expect(markup).toContain('Campaign performance');
    expect(markup).toContain('Platform first opens');
    expect(markup).toContain('Retry this breakdown');
    expect(markup).toContain('/marketing-analytics?range=7d&amp;breakdowns=1');
  });

  it('renders compact attribution quality and campaign efficiency from the summary response', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      let data = fallback;
      if (String(href).startsWith('/admin/marketing/summary?')) {
        data = {
          ...(fallback as Record<string, unknown>),
          attributionQuality: {
            attributedFirstOpens: 18,
            unknownFirstOpens: 2,
            firstOpenCoverageRate: 90,
            attributedSignups: 9,
            unknownSignups: 1,
            signupCoverageRate: 90,
          },
          unknownAttributionDiagnostics: {
            totalUnknownSignups: 1,
            rows: [
              {
                appVersion: '0.1.0+1',
                platform: 'android',
                reason: 'NO_MARKETING_METADATA',
                signupCount: 1,
              },
            ],
            recentAccounts: [
              {
                customerUserId: 'customer-user-1',
                customerProfileId: 'customer-profile-1',
                signupAt: '2026-07-23T02:00:00.000Z',
                platform: 'android',
                appVersion: '0.1.0+1',
                reason: 'NO_CUSTOMER_SESSION',
              },
            ],
          },
          campaignEfficiency: [
            {
              ...emptyMarketingRow(),
              key: 'summer',
              campaignId: 'summer',
              campaignName: 'Summer HCM',
              source: 'google',
              platform: 'android',
              bookingCompleted: 4,
              adSpend: 400_000,
              platformFeeRevenue: 600_000,
              conversionRates: {
                ...emptyMarketingRow().conversionRates,
                cpaBookingCompleted: 100_000,
                platformFeeRoas: 1.5,
              },
            },
          ],
        } as typeof fallback;
      }

      return { data, ok: true, status: 200 };
    });

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('90% signup source coverage');
    expect(markup).toContain('Unknown signup diagnostics');
    expect(markup).toContain('0.1.0+1');
    expect(markup).toContain('Attribution metadata missing');
    expect(markup).toContain('1 unknown');
    expect(markup).toContain('Recent signup gaps');
    expect(markup).toContain('/customers/customer-profile-1');
    expect(markup).toContain('Customer customer...');
    expect(markup).toContain('Account created; app session not reached');
    expect(markup).toContain('Summer HCM');
    expect(markup).toContain('Google / Android');
    expect(markup).toContain('Fee positive');
    expect(markup).toContain('Campaign efficiency');
    expect(mockedAdminGetResult.mock.calls.some(([href]) => String(href).includes('/dimensions/'))).toBe(false);
  });

  it('renders bounded marketing needs-action cards with direct evidence links', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      let data = fallback;
      if (String(href).startsWith('/admin/marketing/summary?')) {
        data = {
          ...(fallback as Record<string, unknown>),
          campaignEfficiency: [
            {
              ...emptyMarketingRow(),
              adSpend: 500_000,
              campaignId: 'zero-completion',
              campaignName: 'Zero Completion',
              key: 'zero-completion',
              source: 'google',
            },
          ],
          totals: {
            ...emptyMarketingRow(),
            adSpend: 500_000,
            firstOpens: 10,
            signups: 5,
          },
        } as typeof fallback;
      }

      return { data, ok: true, status: 200 };
    });

    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        platform: 'android',
        range: '7d',
        source: 'google',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Marketing needs action');
    expect(markup).toContain('Spend with no completed customer');
    expect(markup).toContain('Zero Completion recorded spend');
    expect(markup).toContain('500.000 VND');
    expect(markup).toContain(
      'href="/marketing-analytics?range=7d&amp;source=google&amp;platform=android&amp;campaignId=zero-completion#marketing-campaign-efficiency"',
    );
    expect(markup).toContain('1 open');
  });

  it('renders previous-period movement and bounded Vietnam-time trend evidence', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      let data = fallback;
      if (String(href).startsWith('/admin/marketing/summary?')) {
        data = {
          ...(fallback as Record<string, unknown>),
          comparison: {
            previousRangeLabel: 'Previous 7 days',
            firstOpens: { current: 12, previous: 8, delta: 4, deltaPercent: 50 },
            signups: { current: 5, previous: 4, delta: 1, deltaPercent: 25 },
            bookingCompleted: { current: 2, previous: 1, delta: 1, deltaPercent: 100 },
            adSpend: {
              current: 300_000,
              previous: 200_000,
              delta: 100_000,
              deltaPercent: 50,
            },
            platformFeeRevenue: {
              current: 450_000,
              previous: 300_000,
              delta: 150_000,
              deltaPercent: 50,
            },
          },
          trend: [
            {
              adSpend: 100_000,
              bookingCompleted: 1,
              bookingCreated: 2,
              date: '2026-07-20',
              firstOpens: 6,
              signups: 3,
            },
            {
              adSpend: 200_000,
              bookingCompleted: 1,
              bookingCreated: 1,
              date: '2026-07-21',
              firstOpens: 6,
              signups: 2,
            },
          ],
        } as typeof fallback;
      }

      return { data, ok: true, status: 200 };
    });

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Previous-period comparison');
    expect(markup).toContain('Previous 7 days');
    expect(markup).toContain('+50%');
    expect(markup).toContain('Acquisition and booking trend');
    expect(markup).toContain('Vietnam time');
    expect(markup).toContain('2026-07-20');
    expect(markup).toContain('First booking completed');
  });

  it('loads coupon performance rows only when requested and keeps server paging independent', async () => {
    await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        couponPage: '2',
        couponPerformance: '1',
        range: '30d',
      }),
    });

    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/marketing/coupons/summary?range=30d');
    expect(hrefs).toContain('/admin/marketing/coupons?range=30d&take=10&skip=10');
    expect(hrefs.some((href) => String(href).includes('/admin/marketing/dimensions/'))).toBe(false);
  });

  it('uses independent server paging for requested breakdown dimensions', async () => {
    await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        breakdowns: '1',
        regionPage: '2',
        sourcePage: '3',
      }),
    });

    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/marketing/dimensions/source?range=7d&take=10&skip=20');
    expect(hrefs).toContain('/admin/marketing/dimensions/region?range=7d&take=10&skip=10');
    expect(hrefs).toContain('/admin/marketing/dimensions/campaign?range=7d&take=10&skip=0');
    expect(hrefs).toContain('/admin/marketing/dimensions/platform?range=7d&take=10&skip=0');
  });

  it('uses shared admin form atoms for campaign and manual spend controls', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        campaignId: 'campaign-smoke',
        platform: 'android',
        range: '30d',
        regionCode: 'hcm',
        spend: 'add',
        source: 'google',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-grid form-grid marketing-analytics-campaign-form');
    expect(markup).toContain('Active marketing filters');
    expect(markup).toContain('More filters');
    expect(markup).toContain('Clear platform');
    expect(markup).toContain('Clear campaign');
    expect(markup).toContain('Clear all');
    expect(markup).toContain('Range: 30 days');
    expect(markup).toContain('Source: Google');
    expect(markup).toContain('Platform: Android');
    expect(markup).not.toContain('Region: Ho Chi Minh City');
    expect(markup).toContain('Campaign: campaign-smoke');
    expect(markup).toContain('admin-form-grid form-grid marketing-spend-form');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('marketing-analytics-apply-button');
    expect(markup).not.toContain('booking-date-apply-button');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).not.toContain('marketing-analytics-form-field');
    expect(markup).not.toContain('marketing-spend-notes');
    expect(pageSource).not.toContain('marketing-analytics-form-field');
    expect(pageSource).not.toContain('marketing-spend-notes');
    expect(markup).not.toContain('calendar-field');
    expect(markup).not.toContain('<div class="calendar-field"><span>Date</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Campaign ID</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Spend amount</span>');
    expect(markup).not.toContain('<label><span>Date</span><input');
    expect(markup).not.toContain('<label><span>Source</span><select');
    expect(markup).not.toContain('<label><span>Campaign ID</span><input');
  });

  it('renders marketing evidence cards with shared Vuexy section surfaces', async () => {
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('class="marketing-analytics-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-filter-panel marketing-analytics-filter-panel admin-section');
    expect(markup).not.toContain('usage-overview-filter-panel marketing-analytics-filter-panel');
    expect(markup).toContain('booking-date-filter-buttons marketing-analytics-range-buttons');
    expect(markup).not.toContain('booking-date-filter-buttons usage-overview-range-buttons');
    expect(markup).not.toContain('card admin-section marketing-spend-panel');
    expect(markup).toContain('Add spend');
    expect(markup).toContain('card admin-kpi-card marketing-analytics-metric');
    expect(markup).toContain('Business outcome metrics');
    expect(markup).not.toContain('<span class="metric-card-scope is-period">Last 7 days</span>');
    expect(markup).toContain('Tracked entrants');
    expect(markup).toContain('Attribution quality');
    expect(markup).toContain('Signup source coverage');
    expect(markup).toContain('Known signups');
    expect(markup).toContain('Unknown signups');
    expect(markup).toContain('Campaign efficiency');
    expect(markup).toContain('Marketing needs action');
    expect(markup).toContain('No marketing evidence in last 7 days');
    expect(markup).toContain('No campaign evidence in last 7 days');
    expect(markup).toContain('marketing-operations-grid');
    expect(markup).toContain('marketing-campaign-efficiency-card');
    expect(markup).toContain('New signups');
    expect(markup).toContain('CPA completed customer');
    expect(markup).toContain('Gross ROAS');
    expect(markup).toContain('Fee ROAS');
    expect(markup).toContain('Signup cohort');
    expect(markup).toContain('New customer cohort');
    expect(markup).toContain('conversion cannot exceed 100%');
    expect(markup).not.toContain('Stored app-session first-open proxy');
    expect(markup).not.toContain('<p>First opens</p>');
    expect(markup).toContain('Coupon checkout performance');
    expect(markup).toContain('No coupon checkout activity in this range');
    expect(markup).not.toContain('Coupon code performance');
    expect(markup).not.toContain('Coupon rows are not loaded by default.');
    expect(markup).toContain('href="/coupons"');
    expect(markup).toContain('href="/finance-tax/coupon-finance"');
    expect(markup).toContain('marketing-coupon-performance-group');
    expect(markup).not.toContain('marketing-coupon-metric-grid');
    expect(markup).not.toContain('card admin-section marketing-coupon-performance-section');
    expect(markup).not.toContain('vietnam-overview-metric');
    expect(markup).toContain('class="metric-card"');
    expect(markup).not.toContain(
      '<article class="card admin-kpi-card metric-card marketing-analytics-metric',
    );
    expect(pageSource).toContain('AdminMetricGrid');
    expect(pageSource).not.toContain('AdminKpiCard');
    expect(pageSource).not.toContain('vietnam-overview-metric-grid');
    expect(markup).not.toContain(
      'card admin-filter-panel usage-overview-filter-panel marketing-analytics-filter-panel',
    );
    expect(markup).not.toContain('card admin-filter-panel marketing-spend-panel');
    expect(markup).toContain('card admin-section marketing-funnel-card');
    expect(markup).toContain('admin-section-body marketing-funnel-list');
    expect(markup).toContain('card admin-section marketing-insight-card');
    expect(markup).toContain('admin-section-body marketing-insight-list');
    expect(markup).toContain('card admin-section marketing-table-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-funnel-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-insight-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-table-card');
    expect(markup).not.toContain('usage-overview-grid marketing-analytics-grid');
    expect(markup).toContain('admin-section-body marketing-breakdown-loader-body');
    expect(markup).toContain('empty-state marketing-breakdown-loader-empty');
    expect(markup).toContain('admin-form-control-link button button-primary');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).toContain('AdminOverviewGrid');
    expect(pageSource).not.toContain('<section className="usage-overview-grid');
    expect(pageSource).not.toContain('<a className="button button-primary"');
    expect(pageSource).not.toContain('bodyClassName="empty-state"');
  });

  it('loads one exact spend row only for review and shows a bounded change summary', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).startsWith('/admin/marketing/spend-daily?')
        ? {
            campaignId: 'launch-hcm',
            campaignName: 'Launch HCMC',
            currency: 'VND',
            id: 'spend-1',
            notes: 'invoice one',
            platform: 'android',
            regionCode: 'hcm',
            source: 'google',
            spendAmount: 400000,
            spendDate: '2026-06-20T00:00:00.000Z',
            updatedAt: '2026-06-21T02:00:00.000Z',
          }
        : fallback,
      ok: true,
      status: 200,
    }));

    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        range: '7d',
        spend: 'add',
        spendAmount: '600000',
        spendCampaignId: 'launch-hcm',
        spendCampaignName: 'Launch HCMC',
        spendDate: '2026-06-20',
        spendPlatform: 'android',
        spendPreview: '1',
        spendRegionCode: 'hcm',
        spendSource: 'google',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/marketing/spend-daily?campaignId=launch-hcm&platform=android&regionCode=hcm&source=google&spendDate=2026-06-20',
      null,
    );
    expect(markup).toContain('Change summary');
    expect(markup).toContain('Existing value');
    expect(markup).toContain('400.000 VND');
    expect(markup).toContain('600.000 VND');
    expect(markup).toContain('name="expectedUpdatedAt" value="2026-06-21T02:00:00.000Z"');
    expect(markup).toContain('name="reason"');
    expect(markup).toContain('Save spend');
  });

  it('renders requested coupon code performance with accounting context and paging', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      let data = fallback;
      if (String(href).startsWith('/admin/marketing/coupons?')) {
        data = {
          ...(fallback as Record<string, unknown>),
          rows: [
            {
              appliedBookingCount: 8,
              averageDiscountAmount: 50000,
              cancellationRate: 12.5,
              cancelledBookingCount: 1,
              completedBookingCount: 6,
              completedBookingValue: 2700000,
              completedConversionRate: 75,
              couponCode: 'WELCOME50',
              couponId: 'coupon-1',
              couponState: 'LIVE',
              latestCheckoutAt: '2026-07-22T08:00:00.000Z',
              realizedDiscountAmount: 300000,
              refundRate: 12.5,
              refundedBookingCount: 1,
            },
          ],
          totalCount: 12,
        } as typeof fallback;
      }

      return { data, ok: true, status: 200 };
    });

    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        couponPerformance: '1',
        range: '7d',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('WELCOME50');
    expect(markup).toContain('pill-success">Live');
    expect(markup).toContain('Booking value');
    expect(markup).toContain('Realized discount');
    expect(markup).toContain('Coupon finance');
    expect(markup).toContain('Showing 1 to 1 of 12 entries');
    expect(markup).toContain('couponPage=2');
  });

  it('uses shared Vuexy badge atoms instead of raw marketing pill spans', () => {
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain('const generatedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('Generated {generatedAt}');
    expect(pageSource).not.toContain('function formatDateTime(value: string)');
    expect(pageSource).not.toContain('<span className="pill pill-success">No live ad API</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain(
      'actions={<span className="pill pill-info">{overview.rangeLabel}</span>}',
    );
    expect(pageSource).not.toContain('actions={<span className="pill pill-warning">Manual input</span>}');
    expect(pageSource).not.toContain('<span className="pill pill-info">');
  });

  it('scopes marketing funnel typography to direct row slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.marketing-coupon-table-wrap > .marketing-coupon-table');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));');
    expect(css).toContain('@media (max-width: 1500px)');
    expect(css).toContain('.marketing-funnel-step > div');
    expect(css).toContain('.marketing-funnel-step > div > strong');
    expect(css).toContain('.marketing-funnel-step > div > small');
    expect(css).toContain('.marketing-funnel-step > span:not(.marketing-funnel-dot)');
    expect(css).toContain('.marketing-funnel-step > em');
    expect(css).toContain('.marketing-insight-list > p');
    expect(css).toContain('.marketing-metric-limitations');

    expect(css).not.toContain('.marketing-funnel-step div {');
    expect(css).not.toContain('.marketing-funnel-step strong {');
    expect(css).not.toContain('.marketing-funnel-step small {');
    expect(css).not.toContain('.marketing-funnel-step em {');
    expect(css).not.toContain('.marketing-insight-list p {');
  });

  it('scopes shared ranking table name-cell typography to direct copy slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.usage-overview-name-cell > div > a');
    expect(css).toContain('.usage-overview-name-cell > div > strong');
    expect(css).toContain('.usage-overview-name-cell > div > small');
    expect(css).toContain('.marketing-analytics-name-cell > div > a');
    expect(css).toContain('.marketing-analytics-name-cell > div > strong');
    expect(css).toContain('.marketing-analytics-name-cell > div > small');

    expect(css).not.toContain('.usage-overview-name-cell a,');
    expect(css).not.toContain('.usage-overview-name-cell strong,');
    expect(css).not.toContain('.usage-overview-name-cell small,');
    expect(css).not.toContain('.marketing-analytics-name-cell a,');
    expect(css).not.toContain('.marketing-analytics-name-cell strong {');
    expect(css).not.toContain('.marketing-analytics-name-cell small {');
  });

  it('renders breakdown tables with shared Vuexy table atoms when requested', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        breakdowns: '1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      'table vuexy-data-table vuexy-booking-table admin-data-table marketing-analytics-table',
    );
    expect(markup).toContain('admin-table-scroll marketing-analytics-table-wrap');
    expect(markup).not.toContain('usage-overview-table marketing-analytics-table');
    expect(markup).not.toContain('usage-overview-table-wrap');
    expect(markup).not.toContain('usage-overview-name-cell');
    expect(markup).not.toContain('usage-overview-avatar');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('marketing-analytics-name-cell');
    expect(pageSource).toContain('marketing-analytics-avatar');
    expect(pageSource).not.toContain('<div className="empty-state">');
    expect(pageSource).not.toContain(
      '<table className="table vuexy-data-table vuexy-booking-table admin-data-table usage-overview-table marketing-analytics-table">',
    );
    expect(pageSource).not.toContain('usage-overview-table-wrap');
    expect(pageSource).not.toContain('usage-overview-name-cell');
    expect(pageSource).not.toContain('usage-overview-avatar');
  });

  it('uses the shared table pagination footer for breakdown tables', () => {
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel={`${title} pagination`}');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('keeps internal funnel event keys out of the operator UI', () => {
    expect(pageSource).not.toContain('<small>{step.key}</small>');
  });

  it('uses the shared money atom for visible breakdown table amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).toContain('value: <MoneyText amount={overview.totals.adSpend} />');
    expect(pageSource).toContain(
      'value: <MoneyText amount={overview.totals.conversionRates.cpaBookingCompleted} fallback="n/a" />',
    );
    expect(pageSource).toContain('value: <MoneyText amount={overview.totals.platformFeeRevenue} />');
    expect(pageSource).toContain('Gross <MoneyText amount={overview.totals.grossBookingValue} />');
    expect(pageSource).toContain('<MoneyText amount={row.adSpend} />');
    expect(pageSource).toContain(
      '<MoneyText amount={row.conversionRates.cpaBookingCompleted} fallback="n/a" />',
    );
    expect(pageSource).toContain('<MoneyText amount={row.platformFeeRevenue} />');
    expect(pageSource).not.toContain('value: formatCurrency(overview.totals.adSpend)');
    expect(pageSource).not.toContain(
      'value: formatNullableCurrency(overview.totals.conversionRates.cpaBookingCompleted)',
    );
    expect(pageSource).not.toContain('value: formatCurrency(overview.totals.platformFeeRevenue)');
    expect(pageSource).not.toContain('detail: `Gross ${formatCurrency(overview.totals.grossBookingValue)}`');
    expect(pageSource).not.toContain('<td>{formatCurrency(row.adSpend)}</td>');
    expect(pageSource).not.toContain(
      '<td>{formatNullableCurrency(row.conversionRates.cpaBookingCompleted)}</td>',
    );
    expect(pageSource).not.toContain('<td>{formatCurrency(row.platformFeeRevenue)}</td>');
  });
});

function emptyMarketingRow() {
  return {
    firstOpens: 0,
    signups: 0,
    addressSaves: 0,
    bookingCreated: 0,
    bookingCompleted: 0,
    bookingCancelled: 0,
    firstBookingCompleted: 0,
    repeatBookingCompleted: 0,
    grossBookingValue: 0,
    platformFeeRevenue: 0,
    refundAmount: 0,
    adSpend: 0,
    conversionRates: {
      signupRate: 0,
      addressSaveRate: 0,
      bookingCreateRate: 0,
      bookingCompleteRate: 0,
      cancellationRate: 0,
      firstBookingRate: 0,
      repeatBookingRate: 0,
      cpi: null,
      cpa: null,
      cpaSignup: null,
      cpaBookingCreated: null,
      cpaBookingCompleted: null,
      roas: null,
      platformFeeRoas: null,
    },
  };
}
