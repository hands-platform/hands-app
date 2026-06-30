import Link from 'next/link';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
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
        <AdminFormSearch
          defaultValue={filters.q}
          label="Search cash settlement queue"
          name="q"
          placeholder="Partner, phone, booking, reference"
        />
        <AdminFormSelect
          defaultValue={filters.queue}
          label="Cash settlement queue"
          name="queue"
          options={[
            { label: 'All open debt', value: 'all' },
            { label: 'Over 24h', value: 'stale' },
            { label: 'High debt', value: 'high-debt' },
            { label: 'No recorded ref', value: 'missing-ref' },
            { label: 'Payment evidence check', value: 'payment-check' },
          ]}
        />
        <AdminFormControlButton className="btn btn-primary" type="submit">
          Apply
        </AdminFormControlButton>
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
