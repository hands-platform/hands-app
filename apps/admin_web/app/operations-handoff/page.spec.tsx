import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import OperationsHandoffPage, { metadata } from './page';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props}>{children}</a>;
  },
}));
vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});
vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));

const mockedGet = vi.mocked(adminGetResult);
const mockedAccess = vi.mocked(getCurrentAdminOperatorAccess);
const emptyHandoffs = {
  items: [],
  openCount: 0,
  pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
  totalCount: 0,
};

describe('OperationsHandoffPage', () => {
  beforeEach(() => {
    redirect.mockClear();
    mockedGet.mockReset();
    mockedAccess.mockResolvedValue({
      categories: ['BOOKINGS_REALTIME'],
      email: 'operator@hands.test',
      fullName: 'Current Operator',
      id: 'admin-1',
      phone: null,
      roles: ['ADMIN'],
    });
    mockedGet.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
  });

  it('renders the launch-off state without reading handoff APIs or operator access', async () => {
    vi.stubEnv('SHIFT_HANDOFF_LAUNCH_ENABLED', 'false');
    try {
      const markup = renderToStaticMarkup(
        await OperationsHandoffPage({ searchParams: Promise.resolve({ view: 'history' }) }),
      );

      expect(markup).toContain('Not active for current launch');
      expect(markup).toContain('Existing audit history remains retained');
      expect(mockedGet).not.toHaveBeenCalled();
      expect(mockedAccess).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('loads Current from the canonical bare route with independent exact queues', async () => {
    const markup = renderToStaticMarkup(await OperationsHandoffPage({ searchParams: Promise.resolve({}) }));
    const hrefs = mockedGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('<h1>Shift Handoff</h1>');
    expect(markup).toContain('Current shift summary');
    expect(markup).not.toContain('No open handoffs');
    expect(markup).toContain('Create handoff');
    expect(markup).toContain('Current Operator · Admin · operator@hands.test');
    expect(markup).toContain('Clear-shift confirmation · No open cases at handoff time');
    expect(markup).toContain('Preview handoff');
    expect(markup).toContain(' Current shift</a>');
    expect(markup).not.toContain('Open case filters');
    expect(markup).not.toContain('Select visible page');
    expect(markup).not.toContain('Selectable open handoff cases');
    expect(hrefs).toEqual([
      '/admin/operations-handoff/shift?page=1&pageSize=25&relationship=assigned&scope=current&status=open',
      '/admin/operations-handoff/shift?page=1&pageSize=25&relationship=waiting&scope=current&status=open',
      '/admin/operations-handoff/open-cases?age=all&page=1&pageSize=25&queue=all',
      '/admin/operations-handoff/operators',
    ]);
    expect(mockedAccess).toHaveBeenCalledTimes(1);
  });

  it('loads only the paged shift ledger in explicit History', async () => {
    mockedGet.mockResolvedValueOnce({ data: emptyHandoffs, ok: true, status: 200 });
    const markup = renderToStaticMarkup(
      await OperationsHandoffPage({ searchParams: Promise.resolve({ view: 'history' }) }),
    );

    expect(markup).toContain('Handoff history filters');
    expect(markup).toContain('Date range uses sent time. Confirmed time is shown separately.');
    expect(markup).toContain('No handoff history');
    expect(markup.match(/ Reset<\/a>/gu) ?? []).toHaveLength(1);
    expect(markup).toContain('<span class="admin-form-label">Search</span>');
    expect(markup).toContain('<span class="admin-form-label">Operator</span>');
    expect(markup).not.toContain('Create handoff');
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(String(mockedGet.mock.calls[0]?.[0])).toContain('/admin/operations-handoff/shift?');
  });

  it('redirects the legacy Current alias while preserving its query', async () => {
    await expect(
      OperationsHandoffPage({
        searchParams: Promise.resolve({ age: 'over-24h', page: '2', q: 'refund', view: 'handoff' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/operations-handoff?age=over-24h&page=2&q=refund');
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('does not present a History API failure as an empty ledger', async () => {
    mockedGet.mockResolvedValueOnce({ data: emptyHandoffs, ok: false, status: 500 });
    const markup = renderToStaticMarkup(
      await OperationsHandoffPage({ searchParams: Promise.resolve({ view: 'history' }) }),
    );

    expect(markup).toContain('Handoff history unavailable');
    expect(markup).not.toContain('No handoff history');
  });

  it('keeps filters and one reset for a filtered-empty current queue', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: emptyHandoffs, ok: true, status: 200 })
      .mockResolvedValueOnce({ data: emptyHandoffs, ok: true, status: 200 })
      .mockResolvedValueOnce({
        data: {
          items: [],
          openCount: 3,
          pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
        },
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({ data: [], ok: true, status: 200 });

    const markup = renderToStaticMarkup(
      await OperationsHandoffPage({
        searchParams: Promise.resolve({ age: 'over-24h', q: 'not-found', queue: 'refund-review' }),
      }),
    );

    expect(markup).toContain('Open case filters');
    expect(markup).toContain('Find open work by case ID, queue, or age.');
    expect(markup).toContain('No open cases match the current filters.');
    expect(markup).toContain('<span class="admin-form-label">Search</span>');
    expect(markup.match(/ Reset<\/a>/gu) ?? []).toHaveLength(1);
    expect(markup).not.toContain('Selectable open handoff cases');
  });

  it('defines the suffix-free page title for the root layout template', () => {
    expect(metadata).toEqual({ title: 'Shift Handoff' });
  });
});
