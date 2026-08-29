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
    expect(markup).toContain('Missing spend dates are never treated as zero');
    expect(markup).toContain('Marketing needs action');
    expect(markup).toContain('No acquisition or paid-spend activity in this range');
    expect(markup).toContain('View 30 days');
    expect(markup).toContain('Show zero-value details');
    expect(markup).toContain('Metric scope');
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
    expect(markup).not.toContain('No acquisition or paid-spend activity in this range');
  });

  it('does not compact acquisition-only, spend-only, paid-missing, or active Overview states', async () => {
    const states = [
      {
        decisionReadiness: { reasons: [], status: 'READY' },
        spendCoverage: { totalSpendAmount: null, trackingExpected: false },
        totals: { firstOpens: 1 },
      },
      {
        decisionReadiness: { reasons: ['NO_ACQUISITION_EVIDENCE'], status: 'INSUFFICIENT' },
        spendCoverage: { status: 'COMPLETE', totalSpendAmount: 100_000, trackingExpected: true },
        totals: { adSpend: 100_000 },
      },
      {
        decisionReadiness: {
          reasons: ['NO_ACQUISITION_EVIDENCE', 'NO_SPEND_EVIDENCE'],
          status: 'INSUFFICIENT',
        },
        spendCoverage: { status: 'MISSING', totalSpendAmount: null, trackingExpected: true },
        totals: {},
      },
      {
        decisionReadiness: { reasons: ['LOW_ATTRIBUTION_COVERAGE'], status: 'PARTIAL' },
        spendCoverage: { totalSpendAmount: null, trackingExpected: false },
        totals: { firstOpens: 3, signups: 2 },
      },
    ];

    for (const state of states) {
      mockedAdminGetResult.mockImplementation(async (href, fallback) => {
        if (!String(href).startsWith('/admin/marketing/summary?')) {
          return { data: fallback, ok: true, status: 200 };
        }
        const base = fallback as Record<string, unknown>;
        return {
          data: {
            ...base,
            decisionReadiness: {
              ...(base.decisionReadiness as object),
              ...state.decisionReadiness,
            },
            spendCoverage: { ...(base.spendCoverage as object), ...state.spendCoverage },
            totals: { ...(base.totals as object), ...state.totals },
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      });

      const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
        searchParams: Promise.resolve({ range: '30d', view: 'overview' }),
      }));

      expect(markup).not.toContain('No acquisition or paid-spend activity in this range');
      expect(markup).not.toContain('Show zero-value details');
      expect(markup).toContain('aria-label="Marketing business outcome metrics"');
    }
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

  it.each([
    [[], 'None', null],
    [['2026-08-20'], '2026-08-20', null],
    [['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'], '2026-08-17, 2026-08-18, 2026-08-19, 2026-08-20', null],
    [['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'], '2026-08-16, 2026-08-17, 2026-08-18, 2026-08-19', '+1 more'],
  ] as const)('shows a complete missing-date summary for %i dates', async (dates, visibleDates, moreLabel) => {
    mockSpendCoverage([...dates]);

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'campaigns' }),
    }));
    const coverageSection = sectionMarkup(markup, 'Spend coverage');

    expect(coverageSection).toContain(visibleDates);
    if (moreLabel) expect(coverageSection).toContain(moreLabel);
    else expect(coverageSection).not.toContain(' more');
    expect(coverageSection).not.toContain('Add spend for');
  });

  it('links the oldest missing date to a permission-gated spend draft without guessing source or platform', async () => {
    mockedAccess.mockResolvedValue({
      categories: ['GROWTH_MARKETING', 'GROWTH_MARKETING_SPEND'],
      id: 'marketing-writer',
      roles: ['ADMIN'],
    });
    const dates = Array.from({ length: 30 }, (_, index) => `2026-07-${String(index + 1).padStart(2, '0')}`);
    mockSpendCoverage(dates);

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'campaigns' }),
    }));
    const coverageSection = sectionMarkup(markup, 'Spend coverage');

    expect(coverageSection).toContain('+26 more');
    expect(coverageSection).toContain('Oldest missing date');
    expect(coverageSection).toContain('Add spend for 2026-07-01');
    expect(coverageSection).toContain(
      '/marketing-analytics?range=30d&amp;view=campaigns&amp;spend=add&amp;spendDate=2026-07-01#marketing-spend-panel',
    );
    expect(coverageSection).not.toContain('spendSource=');
    expect(coverageSection).not.toContain('spendPlatform=');
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

  it('shows tracked entrants for source and platform rows that have no signups', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      const path = String(href);
      if (path.includes('/dimensions/source?')) {
        return {
          data: {
            ...(fallback as object),
            rows: [dimensionRow({ firstOpens: 4, key: 'direct', source: 'direct' })],
            totalCount: 1,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      if (path.includes('/dimensions/platform?')) {
        return {
          data: {
            ...(fallback as object),
            rows: [dimensionRow({ firstOpens: 4, key: 'android', platform: 'android' })],
            totalCount: 1,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'attribution' }),
    }));
    const sourceSection = sectionMarkup(markup, 'Source performance');
    const platformSection = sectionMarkup(markup, 'Platform tracked entrants');

    expect(sourceSection).toContain('Tracked entrants');
    expect(sourceSection).toContain('Direct');
    expect(sourceSection).toContain('<td>4</td><td>0</td>');
    expect(platformSection).toContain('Tracked entrants');
    expect(platformSection).toContain('Android');
    expect(platformSection).toContain('<td>4</td><td>0</td>');
  });

  it('renders region evidence fields without unmeasured acquisition or return columns', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/dimensions/region?')) {
        return {
          data: {
            ...(fallback as object),
            rows: [
              dimensionRow({
                addressSaves: 3,
                adSpend: 0,
                bookingCancelled: 100,
                bookingCompleted: 2,
                bookingCreated: 4,
                key: 'hcm',
                regionCode: 'hcm',
                regionName: 'Ho Chi Minh City',
              }),
            ],
            totalCount: 1,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'campaigns' }),
    }));
    const regionSection = sectionMarkup(markup, 'Recent location evidence');
    const campaignSection = sectionMarkup(markup, 'Campaign risk and performance');

    expect(regionSection).toContain('Address evidence');
    expect(regionSection).toContain('Bookings created');
    expect(regionSection).toContain('Recorded spend');
    expect(regionSection).not.toContain('>Signups<');
    expect(regionSection).not.toContain('CPA completed');
    expect(regionSection).not.toContain('Fee ROAS');
    expect(regionSection).not.toContain('Gross ROAS');
    expect(regionSection).toContain('sampled independently by evidence source, up to 100 records per source');
    expect(regionSection).toContain('<td>3</td><td>4</td><td>2</td><td>100</td>');
    expect(campaignSection).toContain('Signups');
    expect(campaignSection).toContain('Fee ROAS');
    expect(campaignSection).toContain('Gross ROAS');
    expect(campaignSection).not.toContain('Tracked entrants');
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

  it.each([
    ['today', 'View 7 days', 'View Today'],
    ['7d', 'View 30 days', 'View 7 days'],
    ['30d', 'View 7 days', 'View 30 days'],
  ] as const)('offers one non-current coupon empty alternative for %s', async (range, expected, current) => {
    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range, view: 'coupons' }),
    }));

    expect(markup).toContain(expected);
    expect(markup).not.toContain(current);
    expect(markup).toContain('No coupon checkout was recorded for this booking-created cohort');
    expect(markup.match(/Coupon operations/g)).toHaveLength(1);
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

  it('keeps coupon identity and last checkout together in the compact seven-column table', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      const path = String(href);
      if (path.startsWith('/admin/marketing/coupons/summary?')) {
        return {
          data: { ...(fallback as object), appliedBookingCount: 5 } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      if (path.startsWith('/admin/marketing/coupons?')) {
        return {
          data: {
            ...(fallback as object),
            rows: [
              {
                appliedBookingCount: 5,
                averageDiscountAmount: 50_000,
                cancellationRate: 20,
                cancelledBookingCount: 1,
                completedBookingCount: 2,
                completedBookingValue: 900_000,
                completedConversionRate: 40,
                couponCode: 'WELCOME10',
                couponId: 'coupon-1',
                couponState: 'LIVE',
                latestCheckoutAt: '2026-08-20T03:00:00.000Z',
                realizedDiscountAmount: 100_000,
                refundedBookingCount: 2,
                refundRate: 40,
              },
            ],
            totalCount: 1,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ couponPerformance: '1', range: '30d', view: 'coupons' }),
    }));
    const tableSection = sectionMarkup(markup, 'Coupon code performance');
    const headers = ['Coupon', 'State', 'Checkouts', 'Completed', 'Exceptions', 'Conversion', 'Last checkout'];

    expect(headers.every((header) => tableSection.includes(`>${header}</th>`))).toBe(true);
    expect(headers.map((header) => tableSection.indexOf(`>${header}</th>`))).toEqual(
      [...headers].map((header) => tableSection.indexOf(`>${header}</th>`)).sort((left, right) => left - right),
    );
    expect(tableSection).toContain('1 cancelled / 2 refunded');
    expect(tableSection).toContain('WELCOME10');
    expect(tableSection).toContain('20 Aug 2026');
    expect(tableSection).not.toContain('Realized discount');
    expect(tableSection).not.toContain('Booking value');
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toContain('.marketing-coupon-table-wrap > .marketing-coupon-table');
    expect(css).toContain('min-width: 0;');
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
    const reviewSection = sectionMarkup(markup, 'Add daily spend');
    expect(reviewSection).toContain('Ho Chi Minh City');
    expect(reviewSection).not.toContain('>hcm<');
  });

  it('uses the Region display label in the spend ledger', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).startsWith('/admin/marketing/spend-ledger?')) {
        return {
          data: {
            ...(fallback as object),
            rows: [
              {
                campaignKey: null,
                campaignName: null,
                currency: 'VND',
                id: 'spend-1',
                notes: null,
                platform: 'android',
                regionCode: 'other-vietnam',
                source: 'google',
                spendAmount: 100_000,
                spendDate: '2026-08-20',
                updatedAt: '2026-08-20T03:00:00.000Z',
                updatedById: 'admin-1',
              },
            ],
            totalCount: 1,
          } as typeof fallback,
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'campaigns' }),
    }));
    const ledgerSection = sectionMarkup(markup, 'Spend ledger');

    expect(ledgerSection).toContain('Other Vietnam');
    expect(ledgerSection).not.toContain('>other-vietnam<');
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

  it('keeps filters and reliability before action while using the desktop compact contract', async () => {
    const markup = renderToStaticMarkup(await MarketingAnalyticsPage({
      searchParams: Promise.resolve({ range: '30d', view: 'campaigns' }),
    }));
    const filterIndex = markup.indexOf('Marketing filters');
    const reliabilityIndex = markup.indexOf('Decision reliability');
    const actionIndex = markup.indexOf('Marketing needs action');
    const css = readFileSync('app/globals.css', 'utf8');

    expect(filterIndex).toBeGreaterThanOrEqual(0);
    expect(reliabilityIndex).toBeGreaterThan(filterIndex);
    expect(actionIndex).toBeGreaterThan(reliabilityIndex);
    expect(css).toContain('.marketing-evidence-strip');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(250px, 1.4fr);');
    expect(css).toContain('.marketing-needs-action-grid > .ops-task-card > .ops-task-card-value');
    expect(css).toContain('grid-row: 2;');
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

function dimensionRow(overrides: Record<string, unknown>) {
  return {
    key: 'row',
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
    ...overrides,
  };
}

function sectionMarkup(markup: string, title: string) {
  const titleIndex = markup.indexOf(`>${title}</h2>`);
  const start = markup.lastIndexOf('<section', titleIndex);
  if (start < 0) return '';

  let depth = 0;
  for (const match of markup.slice(start).matchAll(/<\/?section\b[^>]*>/g)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0 && match.index !== undefined) {
      return markup.slice(start, start + match.index + match[0].length);
    }
  }
  return '';
}

function mockSpendCoverage(missingDates: string[]) {
  mockedAdminGetResult.mockImplementation(async (href, fallback) => {
    if (!String(href).startsWith('/admin/marketing/summary?')) {
      return { data: fallback, ok: true, status: 200 };
    }
    const base = fallback as Record<string, unknown>;
    return {
      data: {
        ...base,
        spendCoverage: {
          ...(base.spendCoverage as object),
          expectedDayCount: missingDates.length,
          missingDates,
          recordedDayCount: 0,
          status: missingDates.length > 0 ? 'MISSING' : 'COMPLETE',
          trackingExpected: missingDates.length > 0,
        },
      } as typeof fallback,
      ok: true,
      status: 200,
    };
  });
}
