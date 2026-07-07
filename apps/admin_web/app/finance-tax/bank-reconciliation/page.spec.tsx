import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import BankReconciliationPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const globalCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('BankReconciliationPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=today&review=unmatched') {
        return {
          amount: 0,
          count: 0,
          currency: 'VND',
          matchedCount: 0,
          unmatchedCount: 0,
        };
      }
      if (href === '/admin/bank-reconciliation?range=today&take=10&review=unmatched') {
        return [];
      }
      if (href === '/admin/company-bank-accounts?status=ACTIVE') {
        return [
          {
            accountNumberMasked: '****0001',
            bankName: 'VCB',
            currency: 'VND',
            id: 'bank-account-1',
            name: 'Operations VND',
            status: 'ACTIVE',
          },
        ];
      }
      return fallback;
    });
  });

  it('uses the shared Vuexy text link atom for bank transaction navigation', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the bank reconciliation list compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Bank command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps manual import bounded and shows validation failures without overlapping raw inputs', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ bankImportError: 'invalid', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank transaction import failed');
    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).toContain('Bank account');
    expect(markup).toContain('Operations VND - VCB - ****0001 - VND');
    expect(markup).toContain('<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">');
    expect(markup).not.toContain(
      '<details class="card admin-card admin-disclosure finance-reconciliation-import-disclosure" open="">',
    );
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-textarea');
    expect(markup).not.toContain('class="form-input"');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=today&review=unmatched',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=today&take=10&review=unmatched',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/company-bank-accounts?status=ACTIVE', []);
  });

  it('keeps the manual import form collapsed during normal unmatched review', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', review: 'unmatched' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).not.toContain('<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">');
  });

  it('scopes reconciliation disclosure and match heading typography to direct slots', () => {
    expect(globalCss).toContain('.finance-reconciliation-import-disclosure > summary > span');
    expect(globalCss).toContain('.finance-reconciliation-import-disclosure > summary > small');
    expect(globalCss).toContain('.finance-reconciliation-match-heading > div > strong');
    expect(globalCss).toContain('.finance-reconciliation-match-heading > div > span:not(.pill)');

    expect(globalCss).not.toContain('.finance-reconciliation-import-disclosure > summary span {');
    expect(globalCss).not.toContain('.finance-reconciliation-import-disclosure > summary small {');
    expect(globalCss).not.toContain('.finance-reconciliation-match-heading strong {');
    expect(globalCss).not.toContain('.finance-reconciliation-match-heading span:not(.pill),');
  });
});
