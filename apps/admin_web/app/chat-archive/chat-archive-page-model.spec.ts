import { buildChatArchiveLoadPlan } from './chat-archive-page-model';

describe('chat archive page model', () => {
  it('defaults audit loading to today with bounded API requests', () => {
    const plan = buildChatArchiveLoadPlan({});

    expect(plan.dateFilters.range).toBe('today');
    expect(plan.archiveHref).toBe('/admin/chat-archive?dateRange=today&take=50');
    expect(plan.archiveSummaryHref).toBe('/admin/chat-archive/summary?dateRange=today');
    expect(plan.repairBookingsHref).toBe('/admin/bookings?dateRange=today&take=50');
  });

  it('passes search, sender, status, and custom dates through to bounded API requests', () => {
    const plan = buildChatArchiveLoadPlan({
      from: '2026-06-01',
      q: ' late ',
      sender: 'partner',
      status: 'completed',
      to: '2026-06-02',
    });

    expect(plan.archiveHref).toBe(
      '/admin/chat-archive?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&status=completed&sender=partner&q=late&take=50',
    );
    expect(plan.archiveSummaryHref).toBe(
      '/admin/chat-archive/summary?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&status=completed&sender=partner&q=late',
    );
    expect(plan.repairBookingsHref).toBe(
      '/admin/bookings?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&take=50',
    );
  });

  it('paginates the chat archive API with server skip and keeps filters in page hrefs', () => {
    const plan = buildChatArchiveLoadPlan({
      page: '3',
      q: 'room',
      range: '7d',
      sender: 'customer',
    });

    expect(plan.archiveHref).toBe(
      '/admin/chat-archive?dateRange=7d&sender=customer&q=room&take=50&skip=100',
    );
    expect(plan.archivePageHref(2)).toBe('/chat-archive?q=room&sender=customer&range=7d&page=2');
    expect(plan.archivePageHref(1)).toBe('/chat-archive?q=room&sender=customer&range=7d');
  });
});
