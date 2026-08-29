import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, adminGetResult } from '../../../lib/admin-api';
import PartnerWithholdingTaxPage from './page';

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

describe('PartnerWithholdingTaxPage', () => {
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

  it('keeps monthly tax filters on shared AdminForm atoms', async () => {
    const page = await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Withholding tax period');
    expect(markup).toContain('Active withholding tax filters');
    expect(markup).toContain('Period: 2026-06');
    expect(markup).toContain('Rows: 25');
    expect(markup).toContain('Withholding command board');
    expect(markup).toContain('Tax closeout');
    expect(markup).toContain('Withholding payable');
    expect(markup).toContain('Taxable partners');
    expect(markup).toContain('/finance-tax/partner-withholding-tax?period=2026-06&amp;take=25');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('class="form-input"');
  });

  it('uses the shared Vuexy text link atom for partner profile links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the withholding list compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain(
      '<FinanceListCommandBoard ariaLabel="Withholding command board" className="finance-five-card-command-board">',
    );
    expect(source).not.toContain('metrics={[');
  });

  it('keeps partner withholding CSV download off the page payload', () => {
    expect(source).toContain('buildPartnerWithholdingTaxExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildPartnerWithholdingTaxRowsCsvHref');
  });

  it('shows monthly remittance status from the tax closing summary', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partner-withholding-tax/summary?period=2026-06') {
        return {
          currency: 'VND',
          grossServiceRevenue: 1000000,
          partnerCountWithRevenue: 2,
          partnerPayoutTotal: 820000,
          partnerPitWithheldTotal: 30000,
          partnerVatWithheldTotal: 50000,
          period: '2026-06',
          taxableBookingCount: 3,
          totalPartnerTaxWithheld: 80000,
          evidenceBreakdown: [
            { status: 'COMPLETE', partnerCount: 1 },
            { status: 'EXPLICIT_ZERO', partnerCount: 1 },
            { status: 'MIXED', partnerCount: 0 },
            { status: 'MISSING_EVIDENCE', partnerCount: 0 },
          ],
        };
      }
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          companyOutputVatTotal: 10000,
          currency: 'VND',
          hasActivity: true,
          id: 'closing-1',
          paidAt: '2026-07-02T10:00:00.000Z',
          partnerWithholdingTotal: 80000,
          period: '2026-06',
          remittanceMetadata: { transferRef: 'TAX-PAID-001' },
          status: 'PAID',
        };
      }
      return fallback;
    });

    const page = await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/monthly-tax-closings/summary?period=2026-06', expect.anything());
    expect(markup).toContain('Tax closeout');
    expect(markup).toContain('Close period');
    expect(markup).toContain('TAX-PAID-001');
    expect(markup).toContain('Withholding payable');
    expect(markup).toContain('80.000 VND');
  });

  it('shows the partner taxable base and separate VAT/PIT evidence without private phone data', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partner-withholding-tax?period=2026-06&take=25') {
        return [
          {
            completedBookingCount: 2,
            currency: 'VND',
            grossServiceRevenue: 1000000,
            partnerName: 'Tax Partner',
            partnerPayoutTotal: 860000,
            partnerPhone: '+84900000000',
            partnerPitWithheldTotal: 30000,
            partnerVatWithheldTotal: 50000,
            period: '2026-06',
            providerProfileId: 'provider-1',
            totalPartnerTaxWithheld: 80000,
            completeEvidenceCount: 1,
            explicitZeroEvidenceCount: 1,
            missingEvidenceCount: 0,
            withholdingEvidenceStatus: 'MIXED',
          },
        ];
      }
      if (href === '/admin/partner-withholding-tax/summary?period=2026-06') {
        return {
          currency: 'VND',
          grossServiceRevenue: 1000000,
          partnerCountWithRevenue: 1,
          partnerPayoutTotal: 860000,
          partnerPitWithheldTotal: 30000,
          partnerVatWithheldTotal: 50000,
          period: '2026-06',
          taxableBookingCount: 2,
          totalPartnerTaxWithheld: 80000,
          evidenceBreakdown: [
            { status: 'COMPLETE', partnerCount: 0 },
            { status: 'EXPLICIT_ZERO', partnerCount: 0 },
            { status: 'MIXED', partnerCount: 1 },
            { status: 'MISSING_EVIDENCE', partnerCount: 0 },
          ],
        };
      }
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return { ...(fallback as Record<string, unknown>), hasActivity: true };
      }
      return fallback;
    });

    const page = await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner withholding register');
    expect(markup).toContain('Partner taxable revenue');
    expect(markup).toContain('VAT withheld');
    expect(markup).toContain('PIT withheld');
    expect(markup).toContain('8.0%');
    expect(markup).toContain('Withholding evidence');
    expect(markup).toContain('Mixed');
    expect(markup).toContain('1 complete · 1 explicit 0% · 0 missing');
    expect(markup).not.toContain('+84900000000');
  });

  it.each([
    ['FUTURE_PERIOD', false, 'Future period', 'Monitoring not started'],
    ['NOT_STARTED', false, 'No activity', 'No close record'],
    ['NOT_STARTED', true, 'Review totals', 'Needs review'],
    ['REVIEWED', true, 'Declare', 'Needs action'],
    ['DECLARED', true, 'Record payment', 'Needs action'],
    ['PAID', true, 'Close period', 'Needs action'],
    ['CLOSED', true, 'Closed', 'Records'],
  ])('uses shared %s period semantics on the withholding page', async (periodState, hasActivity, value, scope) => {
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

    const markup = renderToStaticMarkup(await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain(value);
    expect(markup).toContain(scope);
    expect(markup).not.toContain('No tax due');
    if (!hasActivity) expect(markup).not.toContain('Export current page CSV');
  });

  it.each([401, 403, 500, null])('fails closed when the withholding summary returns %s', async (status) => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/partner-withholding-tax/summary?')
        ? { data: fallback, ok: false, status }
        : { data: fallback, ok: true, status: 200 },
    );

    const markup = renderToStaticMarkup(await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain('Partner withholding data unavailable');
    expect(markup).toContain(status ? `API ${status}` : 'API unavailable');
    expect(markup).toContain('Retry Partner withholding');
    expect(markup).not.toContain('0 VND');
    expect(markup).not.toContain('Export current page CSV');
    expect(markup).not.toContain('Partner withholding register');
  });

  it('keeps withholding totals while marking only the Partner rows unavailable', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partner-withholding-tax?')) {
        return { data: fallback, ok: false, status: 503 };
      }
      return { data: await mockedAdminGet(href, fallback), ok: true, status: 200 };
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partner-withholding-tax/summary?')) {
        return { ...(fallback as Record<string, unknown>), partnerCountWithRevenue: 2, totalPartnerTaxWithheld: 80_000 };
      }
      if (href.startsWith('/admin/monthly-tax-closings/summary?')) {
        return { ...(fallback as Record<string, unknown>), hasActivity: true };
      }
      return fallback;
    });

    const markup = renderToStaticMarkup(await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain('Withholding payable');
    expect(markup).toContain('80.000 VND');
    expect(markup).toContain('Partner withholding register unavailable');
    expect(markup).toContain('API 503');
    expect(markup).not.toContain('Export current page CSV');
    expect(markup).not.toContain('No Partner withholding tax rows exist for this period.');
  });

  it('keeps withholding rows while marking monthly closeout unavailable', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/monthly-tax-closings/summary?')
        ? { data: fallback, ok: false, status: 503 }
        : { data: await mockedAdminGet(href, fallback), ok: true, status: 200 },
    );

    const markup = renderToStaticMarkup(await PartnerWithholdingTaxPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    }));

    expect(markup).toContain('Data unavailable');
    expect(markup).toContain('Withholding register data remains available');
    expect(markup).toContain('Partner withholding register');
    expect(markup).not.toContain('Export current page CSV');
  });
});
