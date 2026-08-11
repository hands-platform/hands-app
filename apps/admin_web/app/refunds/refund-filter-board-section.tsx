import { AdminDetails } from '../../components/admin-details';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';
import type { AdminRefundQueueAge } from '../../lib/admin-api';
import type { AdminQueueSlaFilter, AdminQueueSlaSummary } from '../../lib/admin-queue-list';
import { adminQueueSlaFilterLabel, adminQueueSlaThresholdLabel } from '../../lib/admin-queue-list';
import type { AdminDateRange } from '../../lib/date-range';

export type RefundFilterValues = {
  readonly age: AdminRefundQueueAge;
  readonly customerProfileId: string;
  readonly pageSize: number;
  readonly q: string;
  readonly range: AdminDateRange;
  readonly review: string;
  readonly sla: AdminQueueSlaFilter;
  readonly sort: 'newest' | 'oldest';
};

type RefundFilterBoardSectionProps = {
  readonly ageCounts: Record<AdminRefundQueueAge, number>;
  readonly ageHref: (age: AdminRefundQueueAge) => string;
  readonly filters: RefundFilterValues;
  readonly queueSla: AdminQueueSlaSummary;
  readonly resetHref: string;
  readonly slaHref: (sla: AdminQueueSlaFilter) => string;
};

const REFUND_AGE_OPTIONS = [
  { label: 'All ages', value: 'all' },
  { label: '0-1h', value: 'under-1h' },
  { label: '1-4h', value: '1-4h' },
  { label: '4-24h', value: '4-24h' },
  { label: '1-3d', value: '1-3d' },
  { label: '3-7d', value: '3-7d' },
  { label: '7d+', value: 'over-7d' },
] as const satisfies readonly { label: string; value: AdminRefundQueueAge }[];

const REFUND_QUEUE_OPTIONS = [
  { label: 'Open work', value: 'open' },
  { label: 'Approval required', value: 'requested' },
  { label: 'Gateway processing', value: 'processing' },
  { label: 'Reconciliation required', value: 'state-mismatch' },
  { label: 'Closed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All records', value: 'all' },
] as const;

export function RefundFilterBoardSection({
  ageCounts,
  ageHref,
  filters,
  queueSla,
  resetHref,
  slaHref,
}: RefundFilterBoardSectionProps) {
  const advancedActive = filters.age !== 'all' || filters.sla !== 'all' || Boolean(filters.customerProfileId);
  const advancedCount = Number(filters.age !== 'all') +
    Number(filters.review === 'open' && filters.sla !== 'all') +
    Number(Boolean(filters.customerProfileId));
  const activeLabels = [
    `Queue: ${optionLabel(REFUND_QUEUE_OPTIONS, filters.review)}`,
    `Range: ${rangeLabel(filters.range)}`,
    `Order: ${filters.sort === 'oldest' ? 'Oldest first' : 'Newest first'}`,
    ...(filters.q ? [`Search: ${filters.q}`] : []),
    ...(filters.customerProfileId ? [`Customer: ${filters.customerProfileId}`] : []),
    ...(filters.age !== 'all' ? [`Age: ${optionLabel(REFUND_AGE_OPTIONS, filters.age)}`] : []),
    ...(filters.review === 'open' && filters.sla !== 'all'
      ? [`SLA: ${adminQueueSlaFilterLabel(filters.sla)}`]
      : []),
  ];

  return (
    <AdminTablePanel
      className="refund-filter-panel"
      description="Search and narrow the server-owned refund queue. Scope changes return to page 1."
      title="Refund queue"
    >
      <AdminDirectoryFilterForm action="/refunds" className="refund-filter-form" method="get">
        <AdminFormSearch
          className="refund-filter-search"
          defaultValue={filters.q}
          label="Search refunds"
          name="q"
          placeholder="Refund, booking, payment, customer or phone"
        />
        <AdminFormSelect
          defaultValue={filters.review}
          label="Queue"
          name="review"
          options={REFUND_QUEUE_OPTIONS}
        />
        <AdminFormSelect
          defaultValue={filters.range}
          label="Range"
          name="range"
          options={[
            { label: 'All dates', value: 'all' },
            { label: 'Today', value: 'today' },
            { label: 'Last 7 days', value: '7d' },
            { label: 'Last 30 days', value: '30d' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.sort}
          label="Sort"
          name="sort"
          options={[
            { label: 'Oldest first', value: 'oldest' },
            { label: 'Newest first', value: 'newest' },
          ]}
        />
        {filters.customerProfileId ? (
          <input name="customerProfileId" type="hidden" value={filters.customerProfileId} />
        ) : null}
        {filters.age !== 'all' ? <input name="age" type="hidden" value={filters.age} /> : null}
        {filters.review === 'open' && filters.sla !== 'all' ? (
          <input name="sla" type="hidden" value={filters.sla} />
        ) : null}
        {filters.pageSize !== 10 ? <input name="pageSize" type="hidden" value={filters.pageSize} /> : null}
        <AdminFormControlButton className="button-primary" type="submit">Apply</AdminFormControlButton>
        <AdminTextLink href={resetHref}>Reset</AdminTextLink>
      </AdminDirectoryFilterForm>

      <AdminFilterSummary
        ariaLabel="Active refund filters"
        className="refund-active-filter-summary admin-mt-12"
        labels={activeLabels}
        tone="info"
      />

      <AdminDetails className="refund-more-filters admin-mt-12" open={advancedActive}>
        <summary>
          <span>More filters · Age and SLA</span>
          {advancedCount > 0 ? <StatusBadge tone="info">{advancedCount} active</StatusBadge> : null}
        </summary>
        <div className="admin-disclosure-content refund-more-filter-content">
          <div className="refund-filter-control-row">
            <span className="refund-filter-group-label">Case age</span>
            <AdminSegmentedControl
              activeValue={filters.age}
              ariaLabel="Refund case age"
              options={REFUND_AGE_OPTIONS.map((option) => ({
                href: ageHref(option.value),
                label: `${option.label} · ${ageCounts[option.value]}`,
                value: option.value,
              }))}
              semantics="navigation"
            />
          </div>
          {filters.review === 'open' ? (
            <div className="refund-filter-control-row">
              <span className="refund-filter-group-label">
                SLA · {adminQueueSlaThresholdLabel(queueSla.thresholdMinutes)}
              </span>
              <AdminSegmentedControl
                activeValue={filters.sla}
                ariaLabel="Refund SLA"
                options={([
                  { label: 'All SLA states', value: 'all' },
                  { label: 'Within SLA', value: 'within' },
                  { label: 'Overdue', value: 'overdue' },
                  { label: 'Overdue under 24h', value: 'overdue-under-24h' },
                  { label: '24h+ critical', value: 'critical' },
                ] as const).map((option) => ({
                  href: slaHref(option.value),
                  label: option.label,
                  value: option.value,
                }))}
                semantics="navigation"
              />
            </div>
          ) : null}
        </div>
      </AdminDetails>
    </AdminTablePanel>
  );
}

function optionLabel(
  options: readonly { readonly label: string; readonly value: string }[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function rangeLabel(range: AdminDateRange) {
  if (range === 'all') return 'All dates';
  if (range === 'today') return 'Today';
  if (range === '7d') return 'Last 7 days';
  return 'Last 30 days';
}
