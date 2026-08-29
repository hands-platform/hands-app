import {
  ADMIN_QUEUE_AGE_OPTIONS,
  ADMIN_QUEUE_SORT_OPTIONS,
  adminQueueSlaFilterLabel,
  adminQueueSlaThresholdLabel,
  type AdminQueueAge,
  type AdminQueueAgeCounts,
  type AdminQueueSlaSummary,
  type AdminQueueSlaFilter,
  type AdminQueueSort,
} from '../lib/admin-queue-list';
import { AdminSegmentedControl } from './admin-segmented-control';
import { StatusBadge, StatusBadgeLink } from './status-badge';

type AdminQueueAgeSortControlsProps = {
  readonly age: AdminQueueAge;
  readonly ageAriaLabel?: string;
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly ageHref: (age: AdminQueueAge) => string;
  readonly ageLabel?: string;
  readonly compact?: boolean;
  readonly sla?: AdminQueueSlaSummary;
  readonly slaFilter?: AdminQueueSlaFilter;
  readonly slaHref?: (sla: AdminQueueSlaFilter) => string;
  readonly sort: AdminQueueSort;
  readonly sortHref: (sort: AdminQueueSort) => string;
  readonly sortOptions?: readonly { label: string; value: AdminQueueSort }[];
};

export function AdminQueueAgeSortControls({
  age,
  ageAriaLabel = 'Queue age',
  ageCounts,
  ageHref,
  ageLabel = 'Age',
  compact = false,
  sla,
  slaFilter = 'all',
  slaHref,
  sort,
  sortHref,
  sortOptions = ADMIN_QUEUE_SORT_OPTIONS,
}: AdminQueueAgeSortControlsProps) {
  const activeSlaLabel = adminQueueSlaFilterLabel(slaFilter);
  return (
    <div className={`admin-queue-age-sort-controls${compact ? ' is-compact' : ''}`}>
      <div className="booking-date-filter-bar">
        <span className="payment-filter-group-label">{ageLabel}</span>
        <AdminSegmentedControl
          activeValue={age}
          ariaLabel={ageAriaLabel}
          options={ADMIN_QUEUE_AGE_OPTIONS.map((option) => ({
            href: ageHref(option.value),
            label: ageCounts ? `${option.label} (${ageCounts[option.value]})` : option.label,
            value: option.value,
          }))}
        />
      </div>
      <div className="booking-date-filter-bar">
        <span className="payment-filter-group-label">Order</span>
        <AdminSegmentedControl
          activeValue={sort}
          ariaLabel="Queue sort order"
          options={sortOptions.map((option) => ({
            href: sortHref(option.value),
            label: option.label,
            value: option.value,
          }))}
        />
      </div>
      {sla ? (
        <div className="booking-date-filter-bar" aria-label="Queue SLA status">
          <span className="payment-filter-group-label">SLA</span>
          <div className="participant-list admin-filter-chip-group">
            {slaFilter !== 'all' ? (
              <StatusBadge tone={adminQueueSlaFilterTone(slaFilter)}>
                Showing {activeSlaLabel}
              </StatusBadge>
            ) : null}
            {slaHref && sla.overdueCount > 0 ? (
              <StatusBadgeLink
                ariaCurrent={slaFilter === 'overdue' ? 'page' : undefined}
                ariaLabel={`Show ${sla.overdueCount} SLA-overdue records`}
                href={slaHref('overdue')}
                tone="danger"
              >
                Overdue {sla.overdueCount}
              </StatusBadgeLink>
            ) : (
              <StatusBadge tone={sla.overdueCount > 0 ? 'danger' : 'success'}>
                {sla.overdueCount > 0 ? `Overdue ${sla.overdueCount}` : 'On time'}
              </StatusBadge>
            )}
            {slaHref && slaFilter !== 'all' ? (
              <StatusBadgeLink ariaLabel="Show all queue records" href={slaHref('all')} tone="neutral">
                All queue
              </StatusBadgeLink>
            ) : null}
            <StatusBadge tone="neutral">
              Target {adminQueueSlaThresholdLabel(sla.thresholdMinutes)}
            </StatusBadge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function adminQueueSlaFilterTone(sla: AdminQueueSlaFilter) {
  if (sla === 'within') return 'success' as const;
  if (sla === 'critical') return 'danger' as const;
  if (sla === 'overdue-under-24h') return 'warning' as const;
  return 'danger' as const;
}
