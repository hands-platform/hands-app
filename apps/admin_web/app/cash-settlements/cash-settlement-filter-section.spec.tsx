import { renderToStaticMarkup } from 'react-dom/server';

import { CashSettlementFilterSection } from './cash-settlement-filter-section';
import type { CashSettlementFilters } from './cash-settlement-page-types';

describe('CashSettlementFilterSection', () => {
  it('keeps the search and queue filters on shared AdminForm atoms', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementFilterSection filters={filters()} totalRowCount={12} visibleRowCount={10} />,
    );

    expect(markup).toContain('Cash settlement date range');
    expect(markup).toContain('admin-form-search');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('pill pill-info');
    expect(markup).toContain('pill pill-neutral');
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
