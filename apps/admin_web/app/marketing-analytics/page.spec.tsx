import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import MarketingAnalyticsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedAccess = vi.mocked(getCurrentAdminOperatorAccess);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('MarketingAnalyticsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
    mockedAccess.mockResolvedValue({
      categories: ['GROWTH_MARKETING'],
      id: 'marketing-reader',
      roles: ['ADMIN'],
    });
  });

  it('keeps the route cacheable and loads only summary evidence for Overview', async () => {
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);
    const hrefs = requestedHrefs();

    expect(pageSource).not.toContain("export const dynamic = 'force-dynamic'");
    expect(hrefs).toEqual(['/admin/marketing/summary?range=7d']);
    expect(markup).toContain('Marketing workspace view');
    expect(markup).toContain('Decision reliability');
    expect(markup).toContain('Decision evidence: INSUFFICIENT');
    expect(markup).toContain('Missing ledger dates are not treated as zero spend');
    expect(markup).toContain('Marketing needs action');
    expect(markup).not.toContain('Coupon checkout performance');
    expect(markup).not.toContain('Spend ledger');
  });

  it('distinguishes summary failure from a valid empty cohort', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).startsWith('/admin/marketing/summary?'),
      status: String(href).startsWith('/admin/marketing/summary?') ? 503 : 200,
    }));

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ view: 'overview' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Marketing data is temporarily unavailable');
    expect(markup).toContain('Do not treat this state as zero activity');
    expect(markup).not.toContain('aria-label="Marketing business outcome metrics"');
  });

  it('loads the full Campaigns & spend workspace without coupon or attribution dimension requests', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', spendPage: '2', view: 'campaigns' }),
    });
    const markup = renderToStaticMarkup(page);
    const hrefs = requestedHrefs();

    expect(hrefs).toContain('/admin/marketing/summary?range=30d');
    expect(hrefs).toContain('/admin/marketing/dimensions/campaign?range=30d&take=10&skip=0');
    expect(hrefs).toContain('/admin/marketing/dimensions/region?range=30d&take=10&skip=0');
    expect(hrefs).toContain('/admin/marketing/spend-ledger?range=30d&take=25&skip=25');
    expect(hrefs.some((href) => href.includes('/dimensions/source'))).toBe(false);
    expect(hrefs.some((href) => href.includes('/coupons'))).toBe(false);
    expect(markup).toContain('Spend coverage');
    expect(markup).toContain('Campaign risk and performance');
    expect(markup).toContain('Spend &amp; location breakdown scope');
    expect(markup).toContain('Spend ledger is read only');
    expect(markup).not.toContain('Add spend');
  });

  it('keeps the selected range when clearing dimensions and separates Fee from Gross ROAS', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        campaignId: 'launch-hcm',
        platform: 'android',
        range: 'today',
        regionCode: 'hcm',
        source: 'google',
        view: 'campaigns',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Clear dimensions');
    expect(markup).toContain('/marketing-analytics?range=today&amp;view=campaigns');
    expect(markup).toContain('Use default range');
    expect(markup).toContain('Fee ROAS');
    expect(markup).toContain('Gross ROAS');
    expect(markup).not.toContain('Clear all');
  });

  it('shows server-authoritative action totals across hidden campaigns', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (!String(href).startsWith('/admin/marketing/summary?')) {
        return { data: fallback, ok: true, status: 200 };
      }
      return {
        data: {
          ...(fallback as Record<string, unknown>),
          actionSummary: {
            generatedAt: '2026-08-12T06:00:00.000Z',
            hiddenCount: 8,
            items: [
              {
                actionLabel: 'Review campaign',
                campaignKey: 'launch-hcm',
                detail: 'Launch HCM recorded spend but no completed customer.',
                evidenceReadiness: 'PARTIAL',
                key: 'campaign-no-completion:launch-hcm',
                observedValue: 600000,
                observedValueKind: 'money',
                scope: 'Spend risk',
                severity: 'danger',
                threshold: 'Spend > 0 and completed customers = 0',
                title: 'Spend with no completed customer',
              },
            ],
            thresholdVersion: 'marketing-risk-v1',
            totalCount: 12,
            visibleCount: 4,
          },
          decisionReadiness: readiness('PARTIAL'),
        } as typeof fallback,
        ok: true,
        status: 200,
      };
    });

    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ view: 'campaigns' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('12 open · 8 hidden');
    expect(markup).toContain('Showing 4 of 12');
    expect(markup).toContain('Launch HCM recorded spend but no completed customer');
    expect(markup).toContain('Spend &gt; 0 and completed customers = 0');
  });

  it('loads only source and platform breakdowns for Attribution quality', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ sourcePage: '2', view: 'attribution' }),
    });
    const markup = renderToStaticMarkup(page);
    const hrefs = requestedHrefs();

    expect(hrefs).toContain('/admin/marketing/summary?range=7d');
    expect(hrefs).toContain('/admin/marketing/dimensions/source?range=7d&take=10&skip=10');
    expect(hrefs).toContain('/admin/marketing/dimensions/platform?range=7d&take=10&skip=0');
    expect(hrefs.some((href) => href.includes('/dimensions/campaign'))).toBe(false);
    expect(hrefs.some((href) => href.includes('/spend-ledger'))).toBe(false);
    expect(markup).toContain('Attribution quality');
    expect(markup).toContain('Platform tracked entrants');
    expect(markup).not.toContain('Platform first opens');
  });

  it('keeps Coupons independent from marketing summary and other filters', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).startsWith('/admin/marketing/coupons/summary?')
        ? {
            ...(fallback as Record<string, unknown>),
            generatedAt: '2026-08-12T08:00:00.000Z',
            rangeLabel: 'Last 30 days',
          }
        : fallback,
      ok: true,
      status: 200,
    }));
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ couponPage: '2', range: '30d', source: 'google', view: 'coupons' }),
    });
    const markup = renderToStaticMarkup(page);
    const hrefs = requestedHrefs();

    expect(hrefs).toEqual(['/admin/marketing/coupons/summary?range=30d']);
    expect(markup).toContain('Coupon checkout performance');
    expect(markup).toContain('No coupon checkout activity in 30 days');
    expect(markup).toContain('Only Range applies to coupon results');
    expect(markup).not.toContain('aria-label="Source filters"');
    expect(markup).not.toContain('Additional marketing filters');
    expect(markup).not.toContain('Decision reliability');
    expect(markup).toContain('12 Aug 2026');
    expect(markup).not.toContain('1 Jan 1970');
  });

  it('renders coupon failure without a fake empty result', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: !String(href).startsWith('/admin/marketing/coupons/summary?'),
      status: String(href).startsWith('/admin/marketing/coupons/summary?') ? 503 : 200,
    }));

    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ view: 'coupons' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Coupon performance is temporarily unavailable');
    expect(markup).toContain('Coupon summary unavailable');
    expect(markup).not.toContain('No coupon checkout activity in this range');
    expect(markup).not.toContain('1 Jan 1970');
  });

  it('does not offer a no-op coupon row load when the summary is empty', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ couponPerformance: '1', range: 'today', view: 'coupons' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No coupon checkout activity in Today');
    expect(markup).toContain('View 7 days');
    expect(markup).toContain('Coupon operations');
    expect(markup).not.toContain('Load coupon performance');
  });

  it('loads coupon code rows only after an explicit on-demand request', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).startsWith('/admin/marketing/coupons/summary?')
        ? { ...(fallback as Record<string, unknown>), appliedBookingCount: 1 }
        : fallback,
      ok: true,
      status: 200,
    }));

    const defaultMarkup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: 'today', view: 'coupons' }),
    }));
    const defaultHrefs = requestedHrefs();

    expect(defaultHrefs).toEqual(['/admin/marketing/coupons/summary?range=today']);
    expect(defaultMarkup).toContain('Load coupon performance');

    mockedAdminGetResult.mockClear();
    const loadedMarkup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ couponPerformance: '1', range: 'today', view: 'coupons' }),
    }));
    const loadedHrefs = requestedHrefs();

    expect(loadedHrefs).toContain('/admin/marketing/coupons?range=today&take=10&skip=0');
    expect(loadedMarkup).toContain('No coupon checkout activity in this range.');
    expect(loadedMarkup).not.toContain('Load coupon performance');
  });

  it('lets a spend manager open one exact record while readers remain read only', async () => {
    mockedAccess.mockResolvedValue({
      categories: ['GROWTH_MARKETING', 'GROWTH_MARKETING_SPEND'],
      id: 'marketing-writer',
      roles: ['ADMIN'],
    });
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

    expect(requestedHrefs()).toContain(
      '/admin/marketing/spend-daily?campaignId=launch-hcm&platform=android&regionCode=hcm&source=google&spendDate=2026-06-20',
    );
    expect(markup).toContain('Change summary');
    expect(markup).toContain('400.000 VND');
    expect(markup).toContain('600.000 VND');
    expect(markup).toContain('name="expectedUpdatedAt" value="2026-06-21T02:00:00.000Z"');
    expect(markup).toContain('Save spend');
    expect(markup).not.toContain('Spend ledger is read only');
  });

  it('reviews a new 200/null spend row as zero with an empty optimistic version', async () => {
    mockedAccess.mockResolvedValue({
      categories: ['GROWTH_MARKETING', 'GROWTH_MARKETING_SPEND'],
      id: 'marketing-writer',
      roles: ['ADMIN'],
    });

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve(spendReviewParams()),
    }));

    expect(markup).toContain('New spend record');
    expect(markup).toContain('Existing value');
    expect(markup).toContain('0 VND');
    expect(markup).toContain('name="expectedUpdatedAt" value=""');
    expect(markup).toContain('Save spend');
  });

  it.each([
    [401, 'Session expired', 'Sign in again'],
    [403, 'Marketing spend permission required', 'Review operator access'],
    [404, 'Current spend scope was not found', 'Retry current value'],
    [409, 'Campaign key conflict', 'Review ledger conflict'],
    [429, 'Spend lookup is temporarily limited', 'Retry later'],
    [503, 'Current spend could not be loaded', 'Retry current value'],
  ])('preserves the spend draft and offers recovery when current value returns %s', async (status, title, recovery) => {
    mockedAccess.mockResolvedValue({
      categories: ['GROWTH_MARKETING', 'GROWTH_MARKETING_SPEND'],
      id: 'marketing-writer',
      roles: ['ADMIN'],
    });
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      String(href).startsWith('/admin/marketing/spend-daily?')
        ? { data: fallback, ok: false, requestId: 'request-123', status }
        : { data: fallback, ok: true, status: 200 },
    );

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve(spendReviewParams()),
    }));

    expect(markup).toContain(title);
    expect(markup).toContain('Launch HCMC');
    expect(markup).toContain('600.000 VND');
    expect(markup).toContain(recovery);
    expect(markup).toContain('Edit inputs');
    expect(markup).toContain('Cancel');
    expect(markup).toContain('Copy request ID');
    expect(markup).not.toContain('Save spend');
  });

  it('renders zero-denominator attribution as unavailable without a progressbar', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).startsWith('/admin/marketing/summary?')
        ? { ...(fallback as Record<string, unknown>), range: 'today', rangeLabel: 'Today' }
        : fallback,
      ok: true,
      status: 200,
    }));
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ range: 'today', view: 'attribution' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Not available');
    expect(markup).toContain('No signups in Today');
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain('0% of 0');
  });

  it('uses shared form, section, table, badge, and money atoms', async () => {
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({ view: 'campaigns' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('card admin-filter-panel marketing-analytics-filter-panel admin-section');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table marketing-analytics-table');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain('formatCurrency(row.adSpend)');
    expect(pageSource).not.toContain('<span className="pill pill-info">');
  });

  it('keeps funnel and name-cell typography selectors scoped', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.marketing-funnel-step > div');
    expect(css).toContain('.marketing-funnel-step > div > strong');
    expect(css).toContain('.marketing-analytics-name-cell > div > strong');
    expect(css).not.toContain('.marketing-funnel-step strong {');
    expect(css).not.toContain('.marketing-analytics-name-cell strong {');
  });
});

function requestedHrefs() {
  return mockedAdminGetResult.mock.calls.map(([href]) => String(href));
}

function spendReviewParams() {
  return {
    spend: 'add',
    spendAmount: '600000',
    spendCampaignId: 'launch-hcm',
    spendCampaignName: 'Launch HCMC',
    spendDate: '2026-06-20',
    spendPlatform: 'android',
    spendPreview: '1',
    spendRegionCode: 'hcm',
    spendSource: 'google',
  };
}

function readiness(status: 'INSUFFICIENT' | 'PARTIAL' | 'READY' | 'STALE') {
  return {
    attributionCoveragePercent: 90,
    campaignJoinCoveragePercent: 50,
    lastCompleteDate: null,
    reasons: ['Manual spend dates are incomplete.'],
    spendCoveragePercent: 50,
    status,
  };
}
