import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import FilesPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('FilesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps file review hydration paged and renders the review queue on the shared Vuexy section surface', async () => {
    const page = await FilesPage({
      searchParams: Promise.resolve({ page: '3' }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);
    const markup = renderToStaticMarkup(page);

    expect(hrefs).toContain('/admin/files/review-providers?take=10&skip=20');
    expect(hrefs).toContain('/admin/files/review-summary');
    expect(markup).toContain('Review queue');
    expect(markup).toContain('card admin-section vuexy-booking-table-card vuexy-booking-table-group');
  });
});
