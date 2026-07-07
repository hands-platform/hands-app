import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadgeLink } from '../../components/status-badge';
import type { AdminDateRange } from '../../lib/date-range';

export type PaymentFilterLink = {
  readonly href: string;
  readonly label: string;
  readonly review: string;
};

export type PaymentRangeLink = {
  readonly href: string;
  readonly label: string;
  readonly range: AdminDateRange;
};

type PaymentFilterBoardSectionProps = {
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeRange: AdminDateRange;
  readonly filteredCount: number;
  readonly rangeLabel: string;
  readonly rangeLinks: readonly PaymentRangeLink[];
  readonly review: string;
  readonly reviewLinks: readonly PaymentFilterLink[];
  readonly totalCount: number;
};

export function PaymentFilterBoardSection({
  activeFilterDescription,
  activeFilterLabel,
  activeRange,
  filteredCount,
  rangeLabel,
  rangeLinks,
  review,
  reviewLinks,
  totalCount,
}: PaymentFilterBoardSectionProps) {
  const isFiltered = Boolean(review || activeRange !== 'all');

  return (
    <AdminTablePanel
      description={`Jump straight from the dashboard lane into the payment subset that needs operator review. Payment date range: ${rangeLabel}. Until the payment table stores its own timestamp, this uses the linked booking record date.`}
      resultLabel={`Showing ${filteredCount} of ${totalCount}`}
      resultTone={review ? 'warning' : 'success'}
      title="Payment operation filters"
    >
      {activeFilterLabel && activeFilterDescription ? (
        <p className="muted admin-mb-12">
          Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
        </p>
      ) : null}
      <AdminFilterChipGroup ariaLabel="Payment date range filters" className="admin-mb-12">
        {rangeLinks.map((item) => (
          <StatusBadgeLink
            ariaCurrent={activeRange === item.range ? 'page' : undefined}
            href={item.href}
            key={item.label}
            tone={activeRange === item.range ? 'info' : 'neutral'}
          >
            {item.label}
          </StatusBadgeLink>
        ))}
      </AdminFilterChipGroup>
      <AdminFilterChipGroup ariaLabel="Payment review filters">
        {isFiltered ? (
          <StatusBadgeLink href="/payments?range=all&review=all" tone="success">
            Clear filters
          </StatusBadgeLink>
        ) : null}
        {reviewLinks.map((item) => (
          <StatusBadgeLink
            ariaCurrent={review === item.review ? 'page' : undefined}
            href={item.href}
            key={item.label}
            tone={review === item.review ? 'warning' : 'neutral'}
          >
            {item.label}
          </StatusBadgeLink>
        ))}
      </AdminFilterChipGroup>
    </AdminTablePanel>
  );
}
