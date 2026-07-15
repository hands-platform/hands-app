import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import PartnerCustomerEvaluationsPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('PartnerCustomerEvaluationsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/summary')) {
        return { totalCount: 6 };
      }

      return fallback;
    });
  });

  it('labels partner-written customer evaluations as internal records, not a public review workflow', async () => {
    const page = await PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<span class="metric-card-scope is-record">All records</span>');
    expect(markup).toContain('<span class="metric-card-scope is-record">Admin-only records</span>');
    expect(markup).toContain('<span class="metric-card-scope is-record">Policy guard</span>');
  });
});
