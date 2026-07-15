import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import PartnerWithholdingTaxPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('PartnerWithholdingTaxPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
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
    expect(markup).toContain('Partner tax payable');
    expect(markup).toContain('Taxable partners');
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
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Withholding command board">');
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
        };
      }
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          companyOutputVatTotal: 10000,
          currency: 'VND',
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
    expect(markup).toContain('Remittance status');
    expect(markup).toContain('PAID');
    expect(markup).toContain('TAX-PAID-001');
    expect(markup).toContain('Partner tax payable');
    expect(markup).toContain('80.000 VND');
  });
});
