import Link from 'next/link';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { StatusBadgeLink } from '../../components/status-badge';
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
    <AdminFilterPanel
      className="admin-mt-16 admin-mb-16"
      description={
        <>
          Range: {dateRangeLabel(filters.range)}. List rows are server paginated; totals come from the summary API
          for the same range, queue, and search filters.
        </>
      }
      footer={
        <Link className="text-link" href="/finance-closeout">
          Open finance closeout
        </Link>
      }
      resultLabel={`${visibleRowCount} of ${totalRowCount}`}
      resultTone="success"
      title="Cash settlement date range"
    >
      <AdminFilterChipGroup ariaLabel="Cash settlement date range" className="admin-mt-12">
        {([
          { label: 'All dates', range: 'all' },
          { label: 'Today', range: 'today' },
          { label: 'Last 7 days', range: '7d' },
          { label: 'Last 30 days', range: '30d' },
        ] as const).map((option) => (
          <StatusBadgeLink
            ariaCurrent={option.range === filters.range ? 'page' : undefined}
            href={cashSettlementHref({
              range: option.range,
              pageSize: filters.pageSize,
              queue: filters.queue,
              q: filters.q,
            })}
            key={option.range}
            tone={option.range === filters.range ? 'info' : 'neutral'}
          >
            {option.label}
          </StatusBadgeLink>
        ))}
      </AdminFilterChipGroup>
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
        <AdminFormControlButton className="button-primary" type="submit">
          Apply
        </AdminFormControlButton>
        <Link className="text-link" href="/cash-settlements">
          Clear
        </Link>
      </form>
      <AdminFilterChipGroup ariaLabel="Cash settlement queue" className="admin-mt-12">
        {cashSettlementQueueOptions.map((option) => (
          <StatusBadgeLink
            ariaCurrent={option.value === filters.queue ? 'page' : undefined}
            href={cashSettlementHref({ range: filters.range, pageSize: filters.pageSize, queue: option.value, q: filters.q })}
            key={option.value}
            tone={option.value === filters.queue ? 'info' : 'neutral'}
          >
            {option.label}
          </StatusBadgeLink>
        ))}
      </AdminFilterChipGroup>
      <p className="muted admin-mt-10">
        Showing {visibleRowCount} of {totalRowCount} open cash debt row(s) for this filter.
        {filters.q ? ` Search: "${filters.q}".` : ''}{' '}
        {filters.queue !== 'all' ? `Queue: ${cashSettlementQueueLabel(filters.queue)}.` : ''}
      </p>
    </AdminFilterPanel>
  );
}
