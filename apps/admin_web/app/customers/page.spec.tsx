import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminCustomer } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import CustomersPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('CustomersPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server customer rows without applying a second local filter', async () => {
    const serverRow = {
      gender: 'male',
      id: 'server-customer-row',
      userId: 'server-user-row',
      user: {
        createdAt: '2026-06-01T09:00:00.000Z',
        fullName: 'Server Trusted Customer',
        id: 'server-user-row',
        phone: '+84900001111',
        roles: ['CUSTOMER'],
      },
    } as AdminCustomer;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/customers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 120 };
      }

      if (href.startsWith('/admin/customers')) {
        return [serverRow];
      }

      return fallback;
    });

    const page = await CustomersPage({ searchParams: Promise.resolve({ gender: 'female', pageSize: '10' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Customer');
    expect(markup).toContain('Showing 1 to 1 of 120 entries');
  });
});
