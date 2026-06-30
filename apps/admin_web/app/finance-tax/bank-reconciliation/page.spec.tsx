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
      if (href === '/admin/bank-reconciliation?range=today&take=25&review=unmatched') {
        return [];
      }
      return fallback;
    });
  });

  it('keeps manual import bounded and shows validation failures without overlapping raw inputs', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ bankImportError: 'invalid', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank transaction import failed');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-textarea');
    expect(markup).not.toContain('class="form-input"');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=today&review=unmatched',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=today&take=25&review=unmatched',
      [],
    );
  });
});
