import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CashSettlementFilterSection } from './cash-settlement-filter-section';
import type { CashSettlementFilters } from './cash-settlement-page-types';

describe('CashSettlementFilterSection', () => {
  it('keeps the search and queue filters on shared AdminForm atoms', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-filter-section.tsx'),
      'utf8',
    );
    const markup = renderToStaticMarkup(
      <CashSettlementFilterSection filters={filters()} totalRowCount={12} visibleRowCount={10} />,
    );

    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain("import { AdminSegmentedControl } from '../../components/admin-segmented-control';");
    expect(source).toContain("import { AdminFilterSummary } from '../../components/admin-filter-summary';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('StatusBadgeLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('pillClass');
    expect(markup).toContain('Cash settlement date range');
    expect(markup).toContain('admin-form-search');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('booking-date-filter-bar cash-settlement-filter-group');
    expect(markup).toContain('cash-settlement-filter-group-label');
    expect(markup).toContain('booking-date-filter-buttons cash-settlement-filter-buttons');
    expect(markup).toContain('booking-date-filter-button is-active');
    expect(markup).toContain('Active cash settlement filters');
    expect(markup).toContain('Range: Today');
    expect(markup).toContain('Queue: Over 24h');
    expect(markup).toContain('Search: smoke');
    expect(markup).toContain('/cash-settlements?queue=stale&amp;q=smoke');
    expect(markup).toContain('/cash-settlements?range=7d&amp;queue=stale&amp;q=smoke');
    expect(markup).toContain('/cash-settlements?queue=high-debt&amp;q=smoke');
    expect(markup).not.toContain('pill pill-neutral');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain('<input aria-label="Search cash settlement queue"');
    expect(markup).not.toContain('filter-pill');
  });
});

function filters(): CashSettlementFilters {
  return {
    page: 1,
    pageSize: 10,
    q: 'smoke',
    queue: 'stale',
    range: 'today',
  };
}
