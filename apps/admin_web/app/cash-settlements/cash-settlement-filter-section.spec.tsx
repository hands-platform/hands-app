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
    expect(source).toContain('<AdminTextLink');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('pillClass');
    expect(markup).toContain('Cash settlement date range');
    expect(markup).toContain('admin-form-search');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('pill pill-info');
    expect(markup).toContain('pill pill-neutral');
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
