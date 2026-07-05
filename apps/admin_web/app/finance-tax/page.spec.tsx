import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import FinanceTaxPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('FinanceTaxPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders a compact default overview and defers optional finance summaries', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup.match(/card admin-filter-panel admin-mb-16/g)?.length).toBe(4);
    expect(markup).toContain('Tax command board');
    expect(markup).toContain('Open finance risk');
    expect(markup).toContain('Platform VAT');
    expect(markup).toContain('Partner withholding');
    expect(markup).toContain('Monthly close');
    expect(markup).toContain('Tax finance operating model');
    expect(markup).toContain('Finance operations priority desk');
    expect(markup).toContain('Open full finance summary view');
    expect(markup).not.toContain('Coupon finance summary');
    expect(markup).not.toContain('Payout and wallet priority desk');
    expect(markup).toContain('Finance tax workspaces');
    expect(markup).toContain('admin-filter-panel-body');
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/booking-settlement-snapshots/coupon-finance-summary'),
      expect.anything(),
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/provider-wallet/withdrawal-requests/summary'),
      expect.anything(),
    );
  });

  it('uses the shared ActionMenu atom for the optional full summary link', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/page.tsx'), 'utf8');

    expect(source).toContain('ActionMenu');
    expect(source).not.toContain('<Link className="pill pill-info" href="/finance-tax?view=full">');
  });

  it('uses shared money atoms for overview finance amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('uses shared money atoms for bank match evidence amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-bank-match-evidence.tsx'), 'utf8');

    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<span className="muted">No bank transaction</span>');
    expect(source).not.toContain('<span className="muted">No journal entry</span>');
  });

  it('loads optional coupon and payout summaries only in full view', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today', view: 'full' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Coupon finance summary');
    expect(markup).toContain('Payout and wallet priority desk');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      expect.stringContaining('/admin/booking-settlement-snapshots/coupon-finance-summary'),
      expect.anything(),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      expect.stringContaining('/admin/provider-wallet/withdrawal-requests/summary'),
      expect.anything(),
    );
  });
});
