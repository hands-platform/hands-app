import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CashSettlementFilterSection } from './cash-settlement-filter-section';
import type { CashSettlementFilters } from './cash-settlement-page-types';

describe('CashSettlementFilterSection', () => {
  it('keeps the primary queue compact and moves secondary controls into advanced filters', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-filter-section.tsx'),
      'utf8',
    );
    const markup = renderToStaticMarkup(
      <CashSettlementFilterSection
        allOpenRowCount={12}
        filters={filters()}
        generatedAt="2026-08-09T00:00:00.000Z"
        queueCounts={{ all: 12, highDebt: 2, missingEvidence: 8, paymentCheck: 1, stale: 7 }}
        totalRowCount={7}
        visibleRowCount={7}
      />,
    );

    expect(markup).toContain('Settlement queue');
    expect(markup).toContain(
      'Queue counts ignore only the selected queue and keep search, date, age and SLA scope.',
    );
    expect(markup).toContain('Age and SLA counts describe the selected queue.');
    expect(markup).toContain('Generated 9 Aug 2026, 07:00 ICT.');
    expect(markup).toContain('All open');
    expect(markup).toContain('Missing evidence');
    expect(markup).toContain('High exposure');
    expect(markup).toContain('Additional queues');
    expect(markup).toContain('aria-label="Overdue, 7, selected"');
    expect(markup).toContain('High exposure ≥ 500k <span class="cash-settlement-queue-count">2</span>');
    expect(markup).toContain('aria-label="High exposure, at least 500,000 VND, 2"');
    expect(markup).toContain('Advanced filters');
    expect(markup).toContain('Sort receivables');
    expect(markup).toContain('Highest exposure');
    expect(markup).toContain('aria-label="Cash settlement scope"');
    expect(markup).toContain('Range: Today');
    expect(markup).toContain('Queue: Overdue');
    expect(markup).toContain('Search: smoke');
    expect(markup).toContain('name="q" value="smoke"');
    expect(markup).toContain('/cash-settlements?range=today&amp;queue=missing-evidence&amp;q=smoke&amp;sort=newest');
    expect(source).toContain('key={JSON.stringify([');
    expect(source).toContain("canonicalDefaults={{");
    expect(source).toContain("sort: 'oldest'");
    expect(source).toContain("pageSize: '10'");
    expect(source).not.toContain('missing-ref');
    expect(source).not.toContain('AdminQueueAgeSortControls');
  });

  it('does not render default scope values as active filters', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementFilterSection
        allOpenRowCount={12}
        filters={{ ...filters(), q: '', queue: 'all', range: 'all', sort: 'oldest' }}
        totalRowCount={12}
        visibleRowCount={10}
      />,
    );

    expect(markup).not.toContain('Range: All');
    expect(markup).not.toContain('Queue: All open');
    expect(markup).not.toContain('Age: all');
    expect(markup).not.toContain('Order: Oldest first');
  });

  it('puts empty recovery in the filter footer without repeating zero-value finance context', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementFilterSection
        allOpenRowCount={15}
        filters={{ ...filters(), period: '2026-08', q: '', queue: 'payment-check', range: 'all', sort: 'oldest' }}
        totalRowCount={0}
        visibleRowCount={0}
      />,
    );

    expect(markup).toContain('No booking-payment anomalies need review');
    expect(markup).toContain('Filtered: 0 rows');
    expect(markup).toContain('Accounting month 2026-08: 15 all open.');
    expect(markup).toContain('Return to All open (15)');
    expect(markup).toContain('aria-label="Cash settlement empty state actions"');
  });
});

function filters(): CashSettlementFilters {
  return {
    age: 'all',
    page: 1,
    pageSize: 10,
    period: null,
    q: 'smoke',
    queue: 'stale',
    range: 'today',
    returnTo: null,
    sla: 'all',
    sort: 'newest',
    view: null,
  };
}
