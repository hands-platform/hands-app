import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import ProvidersPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('ProvidersPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server partner rows without applying a second local search filter', async () => {
    const serverRow = {
      displayName: 'Server Trusted Partner',
      gender: 'female',
      id: 'server-partner-row',
      status: 'OFFLINE',
      user: {
        createdAt: '2026-06-01T09:00:00.000Z',
        fullName: 'Server Trusted Partner',
        id: 'server-user-row',
        phone: '+84900002222',
      },
      userId: 'server-user-row',
    } as AdminProvider;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 120 };
      }

      if (href.startsWith('/admin/partners/list-providers')) {
        return [serverRow];
      }

      if (href === '/admin/operational-policy') {
        return [];
      }

      return fallback;
    });

    const page = await ProvidersPage({ searchParams: Promise.resolve({ pageSize: '10', q: 'linh' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Partner');
    expect(markup).toContain('Showing 1 to 1 of 120 entries');
  });
});
