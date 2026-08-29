import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import PartnerCustomerEvaluationsPage from './page';

const { mockedRedirect } = vi.hoisted(() => ({
  mockedRedirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockedRedirect,
  usePathname: () => '/reviews/partner-customer-evaluations',
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('PartnerCustomerEvaluationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminGetResult.mockImplementation(async (href) => successfulResultFor(String(href)) as never);
  });

  it('renders the all-dates internal Partner note workspace by default', async () => {
    const page = await PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner Notes About Customers');
    expect(markup).toContain('Internal · Not customer-visible');
    expect(markup).toContain(
      'Internal notes Partners submit when they mark a service complete. These notes are not customer-visible.',
    );
    expect(markup).toContain('Partner note search');
    expect(markup).toContain('All dates');
    expect(markup).toContain('A retained internal Partner note.');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      expect.stringContaining('/admin/partner-customer-reviews?'),
      [],
    );
    expect(String(mockedAdminGetResult.mock.calls[0]?.[0])).not.toContain('from=');
  });

  it('uses plain-language confirmation reason copy', async () => {
    const page = await PartnerCustomerEvaluationsPage({
      searchParams: Promise.resolve({
        confirm: 'moderate',
        noteId: 'partner-note-1',
        targetStatus: 'REPORTED',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reason for this change');
    expect(markup).not.toContain('Review-state reason');
  });

  it('keeps Today explicit in API date boundaries', async () => {
    await PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({ dateRange: 'today' }) });

    const calls = mockedAdminGetResult.mock.calls.map(([href]) => String(href));
    expect(calls.some((href) => href.includes('/summary?') && href.includes('from=') && href.includes('to='))).toBe(true);
    expect(calls.some((href) => href.includes('/partner-customer-reviews?') && href.includes('from=') && href.includes('to='))).toBe(true);
  });

  it('normalizes empty custom dates to the canonical all-dates route', async () => {
    await expect(
      PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({ dateRange: 'custom' }) }),
    ).rejects.toThrow('REDIRECT:/reviews/partner-customer-evaluations');
  });

  it('shows reversed custom dates inline without querying the API', async () => {
    const page = await PartnerCustomerEvaluationsPage({
      searchParams: Promise.resolve({
        dateFrom: '2026-06-20',
        dateRange: 'custom',
        dateTo: '2026-06-10',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Submitted date is invalid');
    expect(markup).toContain('From date must be on or before To date.');
    expect(markup).not.toContain('Partner notes table');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('does not turn a summary failure into zero notes', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({ data: summary(), ok: false, status: 503 });

    const page = await PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner note summary unavailable');
    expect(markup).toContain('No zero counts are shown');
    expect(markup).not.toContain('No Partner notes were submitted in this period.');
  });

  it('keeps the summary visible but reports a list failure explicitly', async () => {
    mockedAdminGetResult
      .mockResolvedValueOnce({ data: summary(), ok: true, status: 200 })
      .mockResolvedValueOnce({ data: [], ok: false, status: 503 });

    const page = await PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner note list unavailable');
    expect(markup).toContain('no missing rows are shown as an empty result');
    expect(markup).not.toContain('No Partner notes were submitted in this period.');
  });

  it('measures the page-one summary-to-list request start order with deferred responses', async () => {
    const summaryResponse = deferredResult({ data: summary(), ok: true, status: 200 });
    const listResponse = deferredResult({ data: [note()], ok: true, status: 200 });
    const started: string[] = [];

    mockedAdminGetResult.mockImplementation((href) => {
      if (String(href).includes('/summary')) {
        started.push('summary');
        return summaryResponse.promise as never;
      }
      started.push('list');
      return listResponse.promise as never;
    });

    const pagePromise = PartnerCustomerEvaluationsPage({ searchParams: Promise.resolve({}) });
    await vi.waitFor(() => expect(started).toEqual(['summary']));

    summaryResponse.resolve();
    await vi.waitFor(() => expect(started).toEqual(['summary', 'list']));
    listResponse.resolve();
    await pagePromise;
  });

  it('canonicalizes page 99 and the canonical last page loads its rows', async () => {
    mockedAdminGetResult.mockResolvedValueOnce({ data: summary({ retained: 25, totalCount: 25 }), ok: true, status: 200 });

    await expect(
      PartnerCustomerEvaluationsPage({
        searchParams: Promise.resolve({ page: '99', pageSize: '10', q: 'refunded', status: 'retained' }),
      }),
    ).rejects.toThrow(
      'REDIRECT:/reviews/partner-customer-evaluations?q=refunded&page=3&status=retained',
    );

    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href) => {
      const value = String(href);
      if (value.includes('/summary')) {
        return { data: summary({ retained: 25, totalCount: 25 }), ok: true, status: 200 } as never;
      }
      expect(value).toContain('skip=20');
      return { data: [note({ id: 'last-page-note' })], ok: true, status: 200 } as never;
    });

    const page = await PartnerCustomerEvaluationsPage({
      searchParams: Promise.resolve({ page: '3', pageSize: '10', q: 'refunded', status: 'retained' }),
    });
    expect(renderToStaticMarkup(page)).toContain('last-page-note');
  });
});

function successfulResultFor(href: string) {
  if (href.includes('/summary')) return { data: summary(), ok: true, status: 200 };
  if (href.match(/partner-customer-reviews\/[^?]+$/)) return { data: note(), ok: true, status: 200 };
  return { data: [note()], ok: true, status: 200 };
}

function summary(input: Partial<{ needsReview: number; restricted: number; retained: number; totalCount: number }> = {}) {
  return { needsReview: 0, restricted: 0, retained: 1, totalCount: 1, ...input };
}

function note(input: Record<string, unknown> = {}) {
  return {
    booking: { id: 'booking-1', openedAt: '2026-08-01T07:00:00.000Z', services: [] },
    comment: 'A retained internal Partner note.',
    createdAt: '2026-08-01T08:00:00.000Z',
    customerProfile: { id: 'customer-1', user: { fullName: 'Customer One' } },
    id: 'partner-note-1',
    providerProfile: { id: 'partner-1', displayName: 'Partner One' },
    status: 'PUBLISHED',
    ...input,
  };
}

function deferredResult<T>(value: T) {
  let resolvePromise: ((result: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(value),
  };
}
