import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminCustomer, AdminCustomerSummary } from '../../lib/admin-api';
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
const customerPageSource = readFileSync('app/customers/page.tsx', 'utf8');

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
        return {
          generatedAt: '2026-06-28T00:00:00.000Z',
          totalCount: 120,
          genderBreakdown: { female: 91, male: 20, other: 4, unknown: 5 },
          todayJoined: 7,
          todayJoinedGenderBreakdown: { female: 4, male: 2, other: 0, unknown: 1 },
          todaySeen: 13,
          todaySeenGenderBreakdown: { female: 8, male: 4, other: 1, unknown: 0 },
          monthSeen: 44,
          monthSeenGenderBreakdown: { female: 25, male: 12, other: 3, unknown: 4 },
        } satisfies AdminCustomerSummary;
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
    expect(markup).toContain('Female 91 / Male 20 / Other 4 / Not captured 5');
    expect(markup).toContain('Female 4 / Male 2 / Other 0 / Not captured 1');
    expect(markup).toContain('Female 8 / Male 4 / Other 1 / Not captured 0');
    expect(markup).toContain('Female 25 / Male 12 / Other 3 / Not captured 4');
  });

  it('uses the shared Vuexy text link atom for inline page actions', () => {
    expect(customerPageSource).toContain('AdminTextLink');
    expect(customerPageSource).not.toContain('className="text-link"');
  });
});
