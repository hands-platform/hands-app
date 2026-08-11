import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import PlatformVatPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('PlatformVatPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
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
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="VAT command board">');
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
          partnerWithholdingTotal: 0,
          period: '2026-06',
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
    expect(markup).toContain('Manual review');
    expect(markup).toContain('Reversals');
    expect(markup).toContain('7.407 VND');
    expect(markup).toContain('92.593 VND');
  });
});
