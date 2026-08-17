import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import { redirect } from 'next/navigation';

import type { AdminCustomer, AdminCustomerSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import CustomersPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const mockedRedirect = vi.mocked(redirect);
const customerPageSource = readFileSync('app/customers/page.tsx', 'utf8');
const globalsCss = readFileSync('app/globals.css', 'utf8');

describe('CustomersPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      id: 'master-admin',
      roles: ['MASTER_ADMIN'],
    });
    mockedRedirect.mockClear();
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
        phone: '+84*******11',
        roles: ['CUSTOMER'],
      },
    } as AdminCustomer;

    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/customers/summary')) {
        return {
          data: {
            generatedAt: '2026-06-28T00:00:00.000Z',
            activeBookingCount: 8,
            totalCount: 120,
            genderBreakdown: { female: 91, male: 20, other: 4, unknown: 5 },
            todayJoined: 7,
            todayJoinedGenderBreakdown: { female: 4, male: 2, other: 0, unknown: 1 },
            todaySeen: 13,
            todaySeenGenderBreakdown: { female: 8, male: 4, other: 1, unknown: 0 },
            monthSeen: 44,
            monthSeenGenderBreakdown: { female: 25, male: 12, other: 3, unknown: 4 },
            needsActionCount: 6,
            viewCounts: { activeToday: 13, all: 240, needsAction: 6, newToday: 7 },
          } satisfies AdminCustomerSummary,
          ok: true,
          status: 200,
        };
      }

      if (href.startsWith('/admin/customers')) {
        return { data: [serverRow], ok: true, status: 200 };
      }

      return { data: fallback, ok: true, status: 200 };
    });

    const page = await CustomersPage({ searchParams: Promise.resolve({ gender: 'female', pageSize: '10' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Customer');
    expect(markup).toContain('+84*******11');
    expect(markup).not.toContain('+84900001111');
    expect(markup).toContain('Showing 1 to 1 of 6 entries');
    expect(markup).toContain('Payment and review queue');
    expect(markup).toContain(
      'Find customer accounts and resolve payment, refund, or reported-review issues.',
    );
    expect(markup).toContain('Payment &amp; review');
    expect(markup).not.toContain('class="metric-card"');
    expect(markup).not.toContain('aligned to the Vuexy management table');
    expect(markup).not.toContain('Female 91');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toEqual([
      '/admin/customers/summary?gender=female',
      '/admin/customers?view=needs-action&gender=female&take=10&skip=0',
    ]);
  });

  it('uses a compact refresh action instead of unrelated page shortcuts', () => {
    expect(customerPageSource).toContain('AdminFormControlLink');
    expect(customerPageSource).not.toContain('className="text-link"');
    expect(customerPageSource).toContain('CustomerRefreshAction');
    expect(customerPageSource).not.toContain('Open bookings');
    expect(customerPageSource).not.toContain('Open payments');
    expect(customerPageSource).not.toContain('Open reviews');
  });

  it('sets the customer directory document title', () => {
    expect(customerPageSource).toContain("title: 'Customers | HANDS Admin'");
  });

  it('keeps directory-only customers visible without exposing profile links', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['CUSTOMERS_DIRECTORY'],
      id: 'directory-admin',
      roles: ['ADMIN'],
    });
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/customers/summary')) {
        return {
          data: {
            totalCount: 1,
            viewCounts: { activeToday: 0, all: 1, needsAction: 0, newToday: 0 },
          },
          ok: true,
          status: 200,
        };
      }
      if (href.startsWith('/admin/customers')) {
        return {
          data: [
            {
              id: 'directory-customer',
              userId: 'directory-user',
              user: { fullName: 'Directory Customer', phone: '+84*******22' },
            },
          ],
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(
      await CustomersPage({ searchParams: Promise.resolve({ view: 'all' }) }),
    );

    expect(markup).toContain('Directory Customer');
    expect(markup).toContain('Customer detail access required');
    expect(markup).not.toContain('href="/customers/directory-customer');
  });

  it('redirects an out-of-range page while the parallel row read is in flight', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({
      data: {
        totalCount: 35,
        viewCounts: { activeToday: 0, all: 35, needsAction: 0, newToday: 0 },
      },
      ok: true,
      status: 200,
    });

    await expect(
      CustomersPage({ searchParams: Promise.resolve({ page: '99', view: 'all' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/customers?view=all&page=4');
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(2);
  });

  it('does not send an invalid custom date range to the API', async () => {
    await expect(
      CustomersPage({
        searchParams: Promise.resolve({ dateFrom: '2026-08-10', dateRange: 'custom', dateTo: '2026-08-01' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/customers');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('renders an API failure separately from a true empty queue', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({ data: { totalCount: 0 }, ok: false, status: 503 });

    const markup = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Unable to load customers');
    expect(markup).toContain('Customer data could not be loaded. Refresh the page and try again.');
    expect(markup).not.toContain('No payment or review issues found');
  });

  it('keeps the default customer queue compact enough to reach the directory in the first viewport', () => {
    expect(customerPageSource).not.toContain('metricsClassName="customer-command-metrics"');
    expect(customerPageSource).not.toContain('metrics={');
    expect(customerPageSource.indexOf('<CustomerFilterBoard')).toBeLessThan(
      customerPageSource.indexOf('<CustomersTableSection'),
    );
    expect(globalsCss).toContain('.vuexy-customer-filter-card > .admin-filter-panel-header,');
    expect(globalsCss).toContain('.vuexy-customer-table-card > .admin-filter-panel-header {');
  });
});
