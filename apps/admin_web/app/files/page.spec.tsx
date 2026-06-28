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

  it('keeps file review hydration paged and fetches summary separately', async () => {
    await FilesPage({
      searchParams: Promise.resolve({ page: '3' }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/files/review-providers?take=25&skip=50');
    expect(hrefs).toContain('/admin/files/review-summary');
  });
});
