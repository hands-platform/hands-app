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

  it('renders the overview workspaces as Vuexy-style admin filter panels', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup.match(/card admin-filter-panel admin-mb-16/g)?.length).toBe(5);
    expect(markup).toContain('Tax finance operating model');
    expect(markup).toContain('Finance operations priority desk');
    expect(markup).toContain('Coupon finance summary');
    expect(markup).toContain('Payout and wallet priority desk');
    expect(markup).toContain('Finance tax workspaces');
    expect(markup).toContain('admin-filter-panel-body');
  });
});
