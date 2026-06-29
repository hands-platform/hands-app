import Link from 'next/link';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { dateRangeLabel } from '../../lib/date-range';
import {
  cashSettlementHref,
  cashSettlementQueueLabel,
} from './cash-settlement-page-filters';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
} from './cash-settlement-page-types';

type CashSettlementFilterSectionProps = {
  readonly filters: CashSettlementFilters;
  readonly totalRowCount: number;
  readonly visibleRowCount: number;
};

export function CashSettlementFilterSection({
  filters,
  totalRowCount,
  visibleRowCount,
}: CashSettlementFilterSectionProps) {
  return (
    <section className="card admin-mt-16 admin-mb-16">
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        }
        description={
          <>
            Range: {dateRangeLabel(filters.range)}. List rows are server paginated; totals come from the summary API
            for the same range, queue, and search filters.
          </>
        }
        title="Cash settlement date range"
      />
      <div className="filter-row admin-mt-12">
        {[
          ['All dates', cashSettlementHref({ range: 'all', pageSize: filters.pageSize, queue: filters.queue, q: filters.q })],
          ['Today', cashSettlementHref({ range: 'today', pageSize: filters.pageSize, queue: filters.queue, q: filters.q })],
          ['Last 7 days', cashSettlementHref({ range: '7d', pageSize: filters.pageSize, queue: filters.queue, q: filters.q })],
          ['Last 30 days', cashSettlementHref({ range: '30d', pageSize: filters.pageSize, queue: filters.queue, q: filters.q })],
        ].map(([label, href]) => (
          <Link className="filter-pill" href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
      <form className="inline-form admin-mt-12" action="/cash-settlements">
        <input type="hidden" name="range" value={filters.range} />
        <input type="hidden" name="pageSize" value={filters.pageSize} />
        <input
          aria-label="Search cash settlement queue"
          defaultValue={filters.q}
          name="q"
          placeholder="Partner, phone, booking, reference"
        />
        <select aria-label="Cash settlement queue" defaultValue={filters.queue} name="queue">
          <option value="all">All open debt</option>
          <option value="stale">Over 24h</option>
          <option value="high-debt">High debt</option>
          <option value="missing-ref">No recorded ref</option>
          <option value="payment-check">Payment evidence check</option>
        </select>
        <button type="submit">Apply</button>
        <Link className="text-link" href="/cash-settlements">
          Clear
        </Link>
      </form>
      <div className="filter-row admin-mt-12">
        {cashSettlementQueueOptions.map((option) => (
          <Link
            className="filter-pill"
            href={cashSettlementHref({ range: filters.range, pageSize: filters.pageSize, queue: option.value, q: filters.q })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <p className="muted admin-mt-10">
        Showing {visibleRowCount} of {totalRowCount} open cash debt row(s) for this filter.
        {filters.q ? ` Search: "${filters.q}".` : ''}{' '}
        {filters.queue !== 'all' ? `Queue: ${cashSettlementQueueLabel(filters.queue)}.` : ''}
      </p>
    </section>
  );
}
