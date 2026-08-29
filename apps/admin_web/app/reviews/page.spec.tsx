import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import ReviewsPage, { metadata } from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('ReviewsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/summary')) {
        return { data: {
          averageRating: 4.6,
          held: 2,
          published: 8,
          reported: 1,
          totalCount: 12,
        }, ok: true, status: 200 };
      }

      return { data: fallback, ok: true, status: 200 };
    });
  });

  it('declares the page-specific title used by the root metadata template', () => {
    expect(metadata).toEqual({ title: 'Customer Reviews' });
  });

  it('renders scoped queue counts and defaults to all dates', async () => {
    const page = await ReviewsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('All 12');
    expect(markup).toContain('Visible 8');
    expect(markup).toContain('Needs review 1');
    expect(markup).toContain('<option value="all" selected="">All dates</option>');
    expect(markup).not.toContain('Review result summary');
    expect(markup).not.toContain('metric-card-scope');
    expect(markup).toContain('Customer Reviews');
  });

  it('hides zero KPI cards and pagination while offering empty-state recovery actions', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));

    const page = await ReviewsPage({ searchParams: Promise.resolve({ dateRange: '7d', review: 'held' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No hidden reviews');
    expect(markup.match(/Clear filters/g)).toHaveLength(1);
    expect(markup).not.toContain('View all reviews');
    expect(markup).not.toContain('card admin-kpi-card');
    expect(markup).not.toContain('Customer review pages');
  });

  it('shows a load failure instead of treating unavailable reviews as zero', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: false, status: 503 }));

    const page = await ReviewsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Review data unavailable');
    expect(markup).toContain('Retry customer reviews');
    expect(markup).not.toContain('No customer reviews yet');
    expect(markup).not.toContain('card admin-kpi-card');
  });

  it('shows reversed custom dates inline without requesting review data', async () => {
    const page = await ReviewsPage({
      searchParams: Promise.resolve({ dateFrom: '2026-08-05', dateRange: 'custom', dateTo: '2026-08-01' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('From date must be on or before To date.');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('All —');
    expect(markup).toContain('Visible —');
    expect(markup).toContain('Needs review —');
    expect(markup).toContain('Hidden —');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Export unavailable: correct the custom date range');
    expect(markup).not.toContain('href="/reviews/export');
    expect(markup).not.toContain('Review result summary');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('loads the exact review for confirmation and preserves return context', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href) === '/admin/reviews/review-42') {
        return { data: {
          booking: { id: 'booking-42' },
          comment: 'A review outside the current page.',
          customerProfile: { user: { fullName: 'Mai' } },
          id: 'review-42',
          providerProfile: { displayName: 'Linh' },
          rating: 4,
          status: 'PUBLISHED',
        }, ok: true, status: 200 };
      }
      if (String(href).includes('/summary')) {
        return { data: { totalCount: 12 }, ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });
    const page = await ReviewsPage({ searchParams: Promise.resolve({
      confirm: 'moderate',
      dateRange: '30d',
      page: '2',
      pageSize: '25',
      q: 'mai',
      review: 'held',
      returnTo: '/reviews?dateRange=30d&page=2&q=mai',
      reviewId: 'review-42',
      sort: 'oldest',
      status: 'REPORTED',
    }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('A review outside the current page.');
    expect(markup).toContain('Customer</dt><dd>Mai');
    expect(markup).toContain('Partner</dt><dd>Linh');
    expect(markup).toContain('href="/reviews?dateRange=30d&amp;page=2&amp;q=mai"');
    expect(markup).toContain('Moderation reason');
    expect(markup).toContain('Operator note (optional)');
    const listRequest = mockedAdminGetResult.mock.calls
      .map(([href]) => new URL(String(href), 'http://admin.local'))
      .find((url) => url.pathname === '/admin/reviews');
    expect(Object.fromEntries(listRequest?.searchParams.entries() ?? [])).toMatchObject({
      q: 'mai',
      review: 'held',
      skip: '25',
      sort: 'oldest',
      take: '25',
    });
    expect(listRequest?.searchParams.has('confirm')).toBe(false);
    expect(listRequest?.searchParams.has('reviewId')).toBe(false);
    expect(listRequest?.searchParams.has('status')).toBe(false);
  });
});
