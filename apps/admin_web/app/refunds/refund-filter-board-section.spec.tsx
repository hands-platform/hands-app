import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

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
  it('remounts only the Refund filter form when its URL-owned values change', () => {
    const source = readFileSync('app/refunds/refund-filter-board-section.tsx', 'utf8');

    expect(source).toContain('key={JSON.stringify(filters)}');
  });

  it('renders the desktop toolbar, explicit all-date option, search, and separate Reset action', () => {
    const markup = renderToStaticMarkup(
      <RefundFilterBoardSection
        ageCounts={ageCounts}
        ageHref={(age) => `/refunds?range=all&review=open&sort=oldest&age=${age}`}
        clearCustomerScopeHref="/refunds?range=all&review=open&sort=oldest"
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
    expect(markup).toContain('<option value="other">Other review</option>');
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
        clearCustomerScopeHref="/refunds?range=all&review=open&sort=oldest"
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

  it('shows only the controls available to a non-open queue and exposes customer scope separately', () => {
    const markup = renderToStaticMarkup(
      <RefundFilterBoardSection
        ageCounts={ageCounts}
        ageHref={(age) => `/refunds?review=requested&age=${age}`}
        clearCustomerScopeHref="/refunds?range=30d&review=requested&sort=newest&q=Customer+One&age=3-7d&pageSize=25"
        filters={{
          age: '3-7d', customerProfileId: 'customer-profile-123456789', pageSize: 25,
          q: 'Customer One', range: '30d', review: 'requested', sla: 'all', sort: 'newest',
        }}
        queueSla={{ overdueCount: 4, thresholdMinutes: 240 }}
        resetHref="/refunds?range=all&review=open&sort=oldest"
        slaHref={(sla) => `/refunds?sla=${sla}`}
      />,
    );

    expect(markup).toContain('More filters · Age');
    expect(markup).not.toContain('More filters · Age and SLA');
    expect(markup).toContain('Customer scope · customer');
    expect(markup).toContain('title="Customer profile customer-profile-123456789"');
    expect(markup).toContain('Clear customer scope');
    expect(markup).toContain('href="/refunds?range=30d&amp;review=requested&amp;sort=newest&amp;q=Customer+One&amp;age=3-7d&amp;pageSize=25"');
    expect(markup).not.toContain('Customer: customer-profile-123456789');
  });
});
