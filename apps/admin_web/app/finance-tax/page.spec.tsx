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

    expect(markup).toContain('card admin-section admin-mb-16');
    expect(markup).toContain('card admin-filter-panel booking-monitor-filter-panel admin-mt-16');
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
    expect(markup).toContain('admin-section-body');
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/booking-settlement-snapshots/coupon-finance-summary'),
      expect.anything(),
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/provider-wallet/withdrawal-requests/summary'),
      expect.anything(),
    );
  });

  it('keeps header actions compact like customer management pages', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);
    const headerActions = readHeaderActionsMarkup(markup);

    expect(headerActions).toContain('Payment clearing');
    expect(headerActions).toContain('General ledger');
    expect(headerActions).toContain('Bank reconciliation');
    expect(headerActions).not.toContain('Booking settlement audit');
    expect(headerActions).not.toContain('Partner withholding tax');
    expect((headerActions.match(/admin-form-control-link button button-secondary/g) ?? [])).toHaveLength(3);
  });

  it('renders finance priorities and workspaces through customer-aligned table panels', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('finance-overview-table-card');
    expect(markup).toContain('admin-table-scroll finance-overview-table-wrap');
    expect(markup).toContain('finance-overview-table-action');
    expect(markup).toContain('<th scope="col">Signal</th>');
    expect(markup).toContain('<th scope="col">Workspace</th>');
    expect(markup).toContain('<th scope="col">Evidence</th>');
    expect(markup).toContain('<th scope="col">Action</th>');
    expect(markup).toContain('Finance operations priority desk');
    expect(markup).toContain('Finance tax workspaces');
    expect(sectionMarkup(markup, 'Finance tax workspaces')).not.toContain('admin-stage-list');
  });

  it('uses Vuexy button atoms for optional finance summary actions', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);
    const optionalSummary = navMarkup(markup, 'Finance optional summary actions');

    expect(optionalSummary).toContain('admin-form-control-link button button-secondary');
    expect(optionalSummary).not.toContain('pill pill-info');
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

  it('scopes finance overview KPI cards by active queue, needs action, and monthly tax period', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/page.tsx'), 'utf8');

    expect(source).toContain("const settlementScope = 'Active queue';");
    expect(source).toContain('scope: settlementScope');
    expect(source).toContain("scope: 'Needs action'");
    expect(source).toContain('scope: monthlyScope');
    expect(source).toContain("kind: 'record'");
    expect(source).toContain("kind: 'action'");
    expect(source).toContain("kind: 'period'");
    expect(source).toContain("kind: 'risk'");
    expect(source).toContain('Bookings with coupon metadata in the selected finance range and active queue.');
    expect(source).not.toContain('current finance range');
  });
});

function readHeaderActionsMarkup(markup: string) {
  return sectionMarkup(markup, 'admin-page-header-actions');
}

function sectionMarkup(markup: string, marker: string) {
  const index = markup.indexOf(marker);
  if (index < 0) {
    return '';
  }

  return markup.slice(index, index + 3000);
}

function navMarkup(markup: string, marker: string) {
  const index = markup.indexOf(marker);
  if (index < 0) {
    return '';
  }
  const navEnd = markup.indexOf('</nav>', index);

  return markup.slice(index, navEnd > index ? navEnd : index + 1000);
}
