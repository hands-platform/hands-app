import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import MonthlyTaxClosingPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('MonthlyTaxClosingPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps period and remittance forms on shared AdminForm atoms', async () => {
    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Monthly closing period');
    expect(markup).toContain('Monthly closing action');
    expect(markup).toContain('Closeout risk queue');
    expect(markup).toContain('Monthly reconciliation');
    expect(markup.match(/card admin-filter-panel admin-mb-16/g)?.length).toBe(4);
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });
});
