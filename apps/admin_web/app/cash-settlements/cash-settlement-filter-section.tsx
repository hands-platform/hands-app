import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTextLink } from '../../components/admin-text-link';
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
        <AdminTextLink href="/finance-closeout">
          Open finance closeout
        </AdminTextLink>
      }
      resultLabel={`${visibleRowCount} of ${totalRowCount}`}
      resultTone="success"
      title="Cash settlement date range"
    >
      <div className="booking-date-filter-bar cash-settlement-filter-group admin-mt-12">
        <span className="cash-settlement-filter-group-label">Range</span>
        <AdminSegmentedControl
          activeValue={filters.range}
          ariaLabel="Cash settlement date range"
          className="cash-settlement-filter-buttons"
          options={([
            { label: 'All dates', range: 'all' },
            { label: 'Today', range: 'today' },
            { label: 'Last 7 days', range: '7d' },
            { label: 'Last 30 days', range: '30d' },
          ] as const).map((option) => ({
            href: cashSettlementHref({
              range: option.range,
              pageSize: filters.pageSize,
              queue: filters.queue,
              q: filters.q,
            }),
            label: option.label,
            value: option.range,
          }))}
        />
      </div>
      <AdminFormGrid action="/cash-settlements" className="admin-mt-12">
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
        <AdminTextLink href="/cash-settlements">
          Clear
        </AdminTextLink>
      </AdminFormGrid>
      <div className="booking-date-filter-bar cash-settlement-filter-group admin-mt-12">
        <span className="cash-settlement-filter-group-label">Queue</span>
        <AdminSegmentedControl
          activeValue={filters.queue}
          ariaLabel="Cash settlement queue"
          className="cash-settlement-filter-buttons"
          options={cashSettlementQueueOptions.map((option) => ({
            href: cashSettlementHref({
              range: filters.range,
              pageSize: filters.pageSize,
              queue: option.value,
              q: filters.q,
            }),
            label: option.label,
            value: option.value,
          }))}
        />
      </div>
      <AdminFilterSummary
        ariaLabel="Active cash settlement filters"
        className="admin-mt-10"
        labels={buildCashSettlementActiveFilterLabels(filters)}
        tone="info"
      />
    </AdminFilterPanel>
  );
}

function buildCashSettlementActiveFilterLabels(filters: CashSettlementFilters) {
  const labels = [
    `Range: ${dateRangeLabel(filters.range)}`,
    `Queue: ${cashSettlementQueueLabel(filters.queue)}`,
  ];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  return labels;
}
