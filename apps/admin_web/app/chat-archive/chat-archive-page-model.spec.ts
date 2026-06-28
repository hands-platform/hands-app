import { buildChatArchiveLoadPlan } from './chat-archive-page-model';

describe('chat archive page model', () => {
  it('defaults audit loading to today with bounded API requests', () => {
    const plan = buildChatArchiveLoadPlan({});

    expect(plan.dateFilters.range).toBe('today');
    expect(plan.archiveHref).toBe('/admin/chat-archive?dateRange=today&take=50');
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
    expect(plan.repairBookingsHref).toBe(
      '/admin/bookings?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02&take=50',
    );
  });
});
