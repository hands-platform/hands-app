import { renderToStaticMarkup } from 'react-dom/server';

import { RefundFilterBoardSection } from './refund-filter-board-section';

const ageCounts = {
  all: 12,
  'under-1h': 1,
  '1-4h': 2,
  '4-24h': 3,
  '1-3d': 2,
  '3-7d': 2,
  'over-7d': 2,
} as const;

describe('RefundFilterBoardSection', () => {
  it('renders the desktop toolbar, explicit all-date option, search, and separate Reset action', () => {
    const markup = renderToStaticMarkup(
      <RefundFilterBoardSection
        ageCounts={ageCounts}
        ageHref={(age) => `/refunds?range=all&review=open&sort=oldest&age=${age}`}
        filters={{
          age: 'all', customerProfileId: '', pageSize: 10, q: '', range: 'all',
          review: 'open', sla: 'all', sort: 'oldest',
        }}
        queueSla={{ overdueCount: 4, thresholdMinutes: 240 }}
        resetHref="/refunds?range=all&review=open&sort=oldest"
        slaHref={(sla) => `/refunds?range=all&review=open&sort=oldest&sla=${sla}`}
      />,
    );

    expect(markup).toContain('Refund queue');
    expect(markup).toContain('Refund, booking, payment, customer or phone');
    expect(markup).toContain('<option value="all" selected="">All dates</option>');
    expect(markup).toContain('Queue: Open work');
    expect(markup).toContain('Range: All dates');
    expect(markup).toContain('Order: Oldest first');
    expect(markup).toContain('>Reset<');
    expect(markup).not.toContain('Clear filters');
    expect(markup).not.toContain('<details open=""');
  });

  it('shows six operational age buckets and only exposes SLA for the open queue', () => {
    const markup = renderToStaticMarkup(
      <RefundFilterBoardSection
        ageCounts={ageCounts}
        ageHref={(age) => `/refunds?age=${age}`}
        filters={{
          age: 'over-7d', customerProfileId: '', pageSize: 10, q: 'refund-1', range: '30d',
          review: 'open', sla: 'overdue', sort: 'newest',
        }}
        queueSla={{ overdueCount: 4, thresholdMinutes: 240 }}
        resetHref="/refunds?range=all&review=open&sort=oldest"
        slaHref={(sla) => `/refunds?sla=${sla}`}
      />,
    );

    expect(markup).toContain('0-1h · 1');
    expect(markup).toContain('1-3d · 2');
    expect(markup).toContain('3-7d · 2');
    expect(markup).toContain('7d+ · 2');
    expect(markup).toContain('SLA · 4h');
    expect(markup).toContain('More filters · Age and SLA');
    expect(markup).toContain('2 active');
    expect(markup).toContain('Search: refund-1');
    expect(markup).toContain('<details class="refund-more-filters admin-mt-12" open=""');
  });
});
