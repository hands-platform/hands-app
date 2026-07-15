import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import ReviewsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('ReviewsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/summary')) {
        return {
          averageRating: 4.6,
          held: 2,
          published: 8,
          reported: 1,
          totalCount: 12,
        };
      }

      return fallback;
    });
  });

  it('labels review KPIs by records, live visibility, and needs-action moderation work', async () => {
    const page = await ReviewsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<span class="metric-card-scope is-record">All records</span>');
    expect(markup).toContain('<span class="metric-card-scope is-live">Live visibility</span>');
    expect(markup).toContain('<span class="metric-card-scope is-risk">Needs action</span>');
    expect(markup).toContain('<span class="metric-card-scope is-record">Review records</span>');
    expect(markup).toContain('Customer Reviews');
  });
});
