import { buildChatArchiveLoadPlan } from './chat-archive-page-model';

describe('chat archive page model', () => {
  it('defaults to all dates and newest messages', () => {
    const plan = buildChatArchiveLoadPlan({});

    expect(plan.dateFilters.range).toBe('all');
    expect(plan.dateFilters.label).toBe('All dates');
    expect(plan.archiveHref).toBe('/admin/chat-archive?dateRange=all&sort=newest&take=10');
    expect(plan.archiveSummaryHref).toBe('/admin/chat-archive/summary?dateRange=all&sort=newest');
    expect(plan.currentHref).toBe('/chat-archive');
  });

  it('passes valid custom dates and all message filters to both APIs', () => {
    const plan = buildChatArchiveLoadPlan({
      from: '2026-06-01',
      q: ' late ',
      range: 'custom',
      sender: 'partner',
      sort: 'oldest',
      status: 'completed',
      to: '2026-06-02',
    });

    expect(plan.validationError).toBeNull();
    expect(plan.archiveHref).toBe(
      '/admin/chat-archive?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&status=completed&sender=partner&q=late&sort=oldest&take=10',
    );
    expect(plan.archiveSummaryHref).toBe(
      '/admin/chat-archive/summary?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&status=completed&sender=partner&q=late&sort=oldest',
    );
  });

  it.each([
    [{ range: 'custom', from: '2026-06-01' }, 'Custom date range requires valid From and To dates.'],
    [
      { range: 'custom', from: '2026-06-03', to: '2026-06-02' },
      'From date must be on or before To date.',
    ],
    [
      { range: 'custom', from: '2026-01-01', to: '2026-04-01' },
      'Custom date range cannot exceed 90 days.',
    ],
    [
      { range: 'custom', from: '2026-02-30', to: '2026-03-01' },
      'Custom date range requires valid From and To dates.',
    ],
  ])('blocks invalid custom range %# before any API request', (params, error) => {
    const plan = buildChatArchiveLoadPlan(params);

    expect(plan.validationError).toBe(error);
    expect(plan.archiveHref).toBeNull();
    expect(plan.archiveSummaryHref).toBeNull();
  });

  it('paginates on the server and preserves every filter in page links', () => {
    const plan = buildChatArchiveLoadPlan({
      page: '3',
      q: 'room',
      range: '7d',
      sender: 'customer',
      sort: 'oldest',
      status: 'active',
    });

    expect(plan.archiveHref).toBe(
      '/admin/chat-archive?dateRange=7d&status=active&sender=customer&q=room&sort=oldest&take=10&skip=20',
    );
    expect(plan.archivePageHref(2)).toBe(
      '/chat-archive?q=room&sender=customer&status=active&range=7d&sort=oldest&page=2',
    );
  });

  it('keeps direct booking links as all-date searches', () => {
    const plan = buildChatArchiveLoadPlan({ bookingId: 'booking-1' });

    expect(plan.filters.q).toBe('booking-1');
    expect(plan.archiveHref).toBe('/admin/chat-archive?dateRange=all&q=booking-1&sort=newest&take=10');
    expect(plan.currentHref).toBe('/chat-archive?q=booking-1');
  });

  it('canonicalizes page values below one without losing filters', () => {
    const plan = buildChatArchiveLoadPlan({ page: '0', q: 'booking-1', range: '30d' });

    expect(plan.activePage).toBe(1);
    expect(plan.needsCanonicalPageRedirect).toBe(true);
    expect(plan.archivePageHref(1)).toBe('/chat-archive?q=booking-1&range=30d');
  });

  it.each([
    ['status', 'missing-room'],
    ['sender', 'provider'],
    ['range', 'year'],
    ['sort', 'random'],
  ])('canonicalizes unknown %s values before loading', (key, value) => {
    const plan = buildChatArchiveLoadPlan({ [key]: value, q: 'evidence' });

    expect(plan.needsCanonicalFilterRedirect).toBe(true);
    expect(plan.archivePageHref(1)).toBe('/chat-archive?q=evidence');
  });

  it.each(['0', 'abc', '1.5'])('canonicalizes invalid page %s without losing valid filters', (page) => {
    const plan = buildChatArchiveLoadPlan({ page, q: 'evidence', sender: 'partner' });

    expect(plan.activePage).toBe(1);
    expect(plan.needsCanonicalPageRedirect).toBe(true);
    expect(plan.archivePageHref(1)).toBe('/chat-archive?q=evidence&sender=partner');
  });

  it('keeps a valid positive page unchanged', () => {
    const plan = buildChatArchiveLoadPlan({ page: '12', q: 'evidence' });

    expect(plan.activePage).toBe(12);
    expect(plan.needsCanonicalPageRedirect).toBe(false);
  });

  it('canonicalizes stale custom dates out of non-custom URLs', () => {
    const plan = buildChatArchiveLoadPlan({ from: '2026-06-01', range: 'today', to: '2026-06-02' });

    expect(plan.needsCanonicalFilterRedirect).toBe(true);
    expect(plan.currentHref).toBe('/chat-archive?range=today');
    expect(plan.archiveHref).toBe('/admin/chat-archive?dateRange=today&sort=newest&take=10');
  });
});
