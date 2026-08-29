import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, adminGetResult } from '../../../lib/admin-api';
import PlatformVatPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('PlatformVatPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/monthly-tax-closings/summary?')
        ? { ...(fallback as Record<string, unknown>), hasActivity: true }
        : fallback,
    );
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
  });

  it('keeps the period filter on shared AdminForm atoms', async () => {
    const page = await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Platform VAT period');
    expect(markup).toContain('Active platform VAT filters');
    expect(markup).toContain('Period: 2026-06');
    expect(markup).toContain('Currency: VND');
    expect(markup).toContain('VAT command board');
    expect(markup).toContain('Tax closeout');
    expect(markup).toContain('Company output VAT');
    expect(markup).toContain('Net platform revenue');
    expect(markup).toContain('Company VAT register');
    expect(markup).toContain(
      '/finance-tax/booking-settlement-audit?range=all&amp;review=all&amp;period=2026-06',
    );
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('keeps the platform VAT period compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain(
      '<FinanceListCommandBoard ariaLabel="VAT command board" className="finance-five-card-command-board">',
    );
    expect(source).not.toContain('metrics={[');
  });

  it('keeps platform VAT CSV download off the page payload', () => {
    expect(source).toContain('buildPlatformVatExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildPlatformVatSummaryCsvHref');
  });

  it('shows net VAT totals, reversal evidence, and non-standard rate review flags', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/platform-vat/summary?period=2026-06') {
        return {
          companyOutputVatTotal: 7407,
          currency: 'VND',
          evidenceBreakdown: [
            { status: 'ZERO_UNEXPLAINED', recordCount: 1 },
            { status: 'ZERO_FROM_POLICY', recordCount: 3 },
          ],
          hasActivity: true,
          manualReviewCount: 1,
          netRevenueDelta: 0,
          period: '2026-06',
          platformFeeGrossTotal: 100000,
          platformFeeNetRevenueTotal: 92593,
          rateBreakdown: [
            {
              category: 'MANUAL_REVIEW',
              companyOutputVatTotal: 7407,
              platformFeeGrossTotal: 100000,
              platformFeeNetRevenueTotal: 92593,
              platformVatRateBps: 800,
              reversalCount: 1,
              settlementCount: 2,
            },
          ],
          reversalCount: 1,
          settlementCount: 2,
        };
      }
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        const monthlyClosingFallback = fallback as Record<string, unknown>;
        return {
          ...monthlyClosingFallback,
          companyOutputVatTotal: 7407,
          currency: 'VND',
          hasActivity: true,
          partnerWithholdingTotal: 0,
          period: '2026-06',
          periodState: 'REVIEWED',
          status: 'REVIEWED',
        };
      }
      return fallback;
    });

    const page = await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Declare');
    expect(markup).toContain('2 posted · 1 reversal');
    expect(markup).toContain('VAT review flags');
    expect(markup).toContain('Non-standard rate');
    expect(markup).toContain('Unexplained 0%');
    expect(markup).toContain('Policy-backed 0%');
    expect(markup).toContain('Open exact evidence queue');
    expect(markup).toContain(
      '/finance-tax/booking-settlement-audit?range=all&amp;review=platform-vat-evidence&amp;period=2026-06',
    );
    expect(markup).toContain('Reversals');
    expect(markup).toContain('7.407 VND');
    expect(markup).toContain('92.593 VND');
  });

  it.each([
    ['FUTURE_PERIOD', false, 'Future period', 'Monitoring not started'],
    ['NOT_STARTED', false, 'No activity', 'No close record'],
    ['NOT_STARTED', true, 'Review totals', 'Needs review'],
    ['REVIEWED', true, 'Declare', 'Needs action'],
    ['DECLARED', true, 'Record payment', 'Needs action'],
    ['PAID', true, 'Close period', 'Needs action'],
    ['CLOSED', true, 'Closed', 'Records'],
  ])('uses shared %s period semantics on the VAT page', async (periodState, hasActivity, value, scope) => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/monthly-tax-closings/summary?')) {
        return {
          ...(fallback as Record<string, unknown>),
          hasActivity,
          periodState,
          status: periodState === 'NOT_STARTED' || periodState === 'FUTURE_PERIOD' ? 'DRAFT' : periodState,
        };
      }
      return fallback;
    });

    const markup = renderToStaticMarkup(await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain(value);
    expect(markup).toContain(scope);
    expect(markup).not.toContain('No tax due');
    if (!hasActivity) expect(markup).not.toContain('Export company VAT CSV');
  });

  it.each([401, 403, 500, null])('fails closed when the VAT summary returns %s', async (status) => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/platform-vat/summary?')
        ? { data: fallback, ok: false, status }
        : { data: fallback, ok: true, status: 200 },
    );

    const markup = renderToStaticMarkup(await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain('Platform VAT data unavailable');
    expect(markup).toContain(status ? `API ${status}` : 'API unavailable');
    expect(markup).toContain('Retry Platform VAT');
    expect(markup).not.toContain('0 VND');
    expect(markup).not.toContain('Export company VAT CSV');
    expect(markup).not.toContain('Company VAT register');
  });

  it('keeps VAT rows available while marking only monthly closeout unavailable', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/monthly-tax-closings/summary?')) {
        return { data: fallback, ok: false, status: 503 };
      }
      return { data: await mockedAdminGet(href, fallback), ok: true, status: 200 };
    });
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/platform-vat/summary?')
        ? {
            ...(fallback as Record<string, unknown>),
            companyOutputVatTotal: 8_000,
            platformFeeGrossTotal: 108_000,
            platformFeeNetRevenueTotal: 100_000,
            settlementCount: 1,
          }
        : fallback,
    );

    const markup = renderToStaticMarkup(await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain('Data unavailable');
    expect(markup).toContain('VAT register data remains available');
    expect(markup).toContain('Company VAT register');
    expect(markup).toContain('8.000 VND');
    expect(markup).not.toContain('Export company VAT CSV');
  });
});
