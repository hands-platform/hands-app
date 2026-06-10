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
  readonly allRowsInRangeCount: number;
  readonly filters: CashSettlementFilters;
  readonly visibleRowCount: number;
};

export function CashSettlementFilterSection({
  allRowsInRangeCount,
  filters,
  visibleRowCount,
}: CashSettlementFilterSectionProps) {
  return (
    <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        }
        description={
          <>
            Range: {dateRangeLabel(filters.range)}. All date-filtered totals are calculated from visible cash
            earning records; all-date totals use the API summary.
          </>
        }
        title="Cash settlement date range"
      />
      <div className="filter-row" style={{ marginTop: 12 }}>
        {[
          ['All dates', cashSettlementHref({ range: 'all', queue: filters.queue, q: filters.q })],
          ['Today', cashSettlementHref({ range: 'today', queue: filters.queue, q: filters.q })],
          ['Last 7 days', cashSettlementHref({ range: '7d', queue: filters.queue, q: filters.q })],
          ['Last 30 days', cashSettlementHref({ range: '30d', queue: filters.queue, q: filters.q })],
        ].map(([label, href]) => (
          <Link className="filter-pill" href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
      <form className="inline-form" style={{ marginTop: 12 }} action="/cash-settlements">
        <input type="hidden" name="range" value={filters.range} />
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
      <div className="filter-row" style={{ marginTop: 12 }}>
        {cashSettlementQueueOptions.map((option) => (
          <Link
            className="filter-pill"
            href={cashSettlementHref({ range: filters.range, queue: option.value, q: filters.q })}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Showing {visibleRowCount} of {allRowsInRangeCount} open cash debt row(s) for this date range.
        {filters.q ? ` Search: "${filters.q}".` : ''}{' '}
        {filters.queue !== 'all' ? `Queue: ${cashSettlementQueueLabel(filters.queue)}.` : ''}
      </p>
    </section>
  );
}
