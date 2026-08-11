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
  type AdminQueueAgeCounts,
  type AdminQueueSlaSummary,
} from '../../lib/admin-queue-list';
import {
  cashSettlementHref,
  cashSettlementQueueLabel,
} from './cash-settlement-page-filters';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
} from './cash-settlement-page-types';

type CashSettlementFilterSectionProps = {
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly queueSla?: AdminQueueSlaSummary;
  readonly filters: CashSettlementFilters;
  readonly generatedAt?: string;
  readonly queueCounts?: {
    all: number;
    highDebt: number;
    missingEvidence: number;
    paymentCheck: number;
    stale: number;
  };
  readonly totalRowCount: number;
  readonly visibleRowCount: number;
};

export function CashSettlementFilterSection({
  ageCounts,
  filters,
  generatedAt,
  queueCounts,
  queueSla,
  totalRowCount,
  visibleRowCount,
}: CashSettlementFilterSectionProps) {
  const activeFilterLabels = buildCashSettlementActiveFilterLabels(filters);

  return (
    <AdminFilterPanel
      className="admin-mt-16 admin-mb-16 cash-settlement-filter-panel"
      description={
        <>
          Counts ignore the selected queue and use the current search, date, age and SLA scope.
          {generatedAt ? ` Generated ${new Date(generatedAt).toLocaleString('en-GB')}.` : ''}
        </>
      }
      footer={activeFilterLabels.length ? (
        <AdminFilterSummary
          ariaLabel="Cash settlement scope"
          labels={activeFilterLabels}
          tone="info"
        />
      ) : undefined}
      resultLabel={`${visibleRowCount} of ${totalRowCount}`}
      resultTone={totalRowCount > 0 ? 'warning' : 'success'}
      title="Settlement queue"
    >
      <div className="booking-date-filter-bar cash-settlement-filter-group admin-mt-12">
        <span className="cash-settlement-filter-group-label">Queue</span>
        <AdminSegmentedControl
          activeValue={filters.queue}
          ariaLabel="Cash settlement queue"
          className="cash-settlement-filter-buttons"
          options={cashSettlementQueueOptions.slice(0, 3).map((option) => ({
            ariaLabel: `${option.label}, ${cashSettlementQueueCount(queueCounts, option.value)}${filters.queue === option.value ? ', selected' : ''}`,
            href: cashSettlementHref({ ...filters, page: 1, queue: option.value }),
            label: <>{option.label} <span className="cash-settlement-queue-count">{cashSettlementQueueCount(queueCounts, option.value)}</span></>,
            value: option.value,
          }))}
          semantics="navigation"
        />
      </div>
      <div className="booking-date-filter-bar cash-settlement-filter-group admin-mt-8">
        <span className="cash-settlement-filter-group-label">Additional queues</span>
        <AdminSegmentedControl
          activeValue={filters.queue}
          ariaLabel="Additional cash settlement queues"
          className="cash-settlement-filter-buttons"
          options={cashSettlementQueueOptions.slice(3).map((option) => ({
            ariaLabel: `${option.label}, ${cashSettlementQueueCount(queueCounts, option.value)}${filters.queue === option.value ? ', selected' : ''}`,
            href: cashSettlementHref({ ...filters, page: 1, queue: option.value }),
            label: <>{option.label} <span className="cash-settlement-queue-count">{cashSettlementQueueCount(queueCounts, option.value)}</span></>,
            title: option.value === 'high-debt' ? 'Remaining exposure of at least 500,000 VND' : undefined,
            value: option.value,
          }))}
          semantics="navigation"
        />
      </div>
      <AdminFormGrid action="/cash-settlements" className="admin-mt-12">
        <input type="hidden" name="queue" value={filters.queue} />
        {filters.period ? <input type="hidden" name="period" value={filters.period} /> : null}
        {filters.returnTo ? <input type="hidden" name="returnTo" value={filters.returnTo} /> : null}
        <AdminFormSearch
          defaultValue={filters.q}
          label="Search cash settlement queue"
          name="q"
          placeholder="Partner, phone, booking, earning or evidence"
        />
        <AdminFormSelect
          defaultValue={filters.sort}
          label="Sort receivables"
          labelVisibility="visible"
          name="sort"
          options={[
            { label: 'Oldest first', value: 'oldest' },
            { label: 'Highest exposure', value: 'highest-debt' },
            { label: 'Newest first', value: 'newest' },
          ]}
        />
        <AdminFormControlButton className="button-primary" type="submit">
          Apply
        </AdminFormControlButton>
        <AdminTextLink
          href={cashSettlementHref({
            ...filters,
            age: 'all',
            page: 1,
            q: '',
            queue: 'all',
            sla: 'all',
            sort: 'oldest',
          })}
        >
          Clear
        </AdminTextLink>
        <details className="cash-settlement-advanced-filters">
          <summary>Advanced filters</summary>
          <div className="admin-form-grid admin-mt-12">
            {filters.period ? null : (
              <AdminFormSelect
                defaultValue={filters.range}
                label="Created range"
                labelVisibility="visible"
                name="range"
                options={[
                  { label: 'All dates', value: 'all' },
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 days', value: '7d' },
                  { label: 'Last 30 days', value: '30d' },
                ]}
              />
            )}
            <AdminFormSelect
              defaultValue={filters.age}
              label="Age"
              labelVisibility="visible"
              name="age"
              options={[
                { label: `All ages (${totalRowCount})`, value: 'all' },
                { label: `Under 1 hour (${ageCounts?.['under-1h'] ?? 0})`, value: 'under-1h' },
                { label: `1-4 hours (${ageCounts?.['1-4h'] ?? 0})`, value: '1-4h' },
                { label: `4-24 hours (${ageCounts?.['4-24h'] ?? 0})`, value: '4-24h' },
                { label: `Over 24 hours (${ageCounts?.['over-24h'] ?? 0})`, value: 'over-24h' },
              ]}
            />
            <AdminFormSelect
              defaultValue={filters.sla}
              label="SLA"
              labelVisibility="visible"
              name="sla"
              options={[
                { label: 'All SLA states', value: 'all' },
                { label: `Overdue (${queueSla?.overdueCount ?? 0})`, value: 'overdue' },
                { label: 'Critical', value: 'critical' },
              ]}
            />
            <AdminFormSelect
              defaultValue={String(filters.pageSize)}
              label="Rows per page"
              labelVisibility="visible"
              name="pageSize"
              options={[
                { label: '10 rows', value: '10' },
                { label: '25 rows', value: '25' },
                { label: '50 rows', value: '50' },
              ]}
            />
          </div>
        </details>
      </AdminFormGrid>
      <div className="admin-mt-12">
        <AdminTextLink href="/finance-overview">Open Finance Overview</AdminTextLink>
      </div>
    </AdminFilterPanel>
  );
}

function buildCashSettlementActiveFilterLabels(filters: CashSettlementFilters) {
  const labels = [
    ...(filters.period ? [`Accounting month: ${filters.period}`] : []),
    ...(filters.range !== 'all' ? [`Range: ${dateRangeLabel(filters.range)}`] : []),
    ...(filters.queue !== 'all' ? [`Queue: ${cashSettlementQueueLabel(filters.queue)}`] : []),
    ...(filters.age !== 'all' ? [`Age: ${filters.age}`] : []),
    ...(filters.sla && filters.sla !== 'all'
      ? [`SLA: ${filters.sla}`]
      : []),
    ...(filters.sort !== 'oldest'
      ? [`Order: ${filters.sort === 'highest-debt' ? 'Highest exposure' : 'Newest first'}`]
      : []),
  ];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  return labels;
}

function cashSettlementQueueCount(
  counts: CashSettlementFilterSectionProps['queueCounts'],
  queue: (typeof cashSettlementQueueOptions)[number]['value'],
) {
  if (!counts) return 0;
  if (queue === 'all') return counts.all;
  if (queue === 'stale') return counts.stale;
  if (queue === 'missing-evidence') return counts.missingEvidence;
  if (queue === 'high-debt') return counts.highDebt;
  return counts.paymentCheck;
}
