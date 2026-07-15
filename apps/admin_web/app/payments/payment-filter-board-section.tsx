import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminTablePanel } from '../../components/admin-table-panel';
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
      <AdminFilterSummary
        ariaLabel="Active payment filters"
        className="admin-mb-12"
        labels={[`Range: ${rangeLabel}`, `Queue: ${activeFilterLabel ?? 'All payments'}`]}
        tone={review ? 'warning' : 'info'}
      />
      <div className="booking-date-filter-bar payment-filter-group admin-mb-12">
        <span className="payment-filter-group-label">Range</span>
        <AdminSegmentedControl
          activeValue={activeRange}
          ariaLabel="Payment date range filters"
          className="payment-filter-buttons"
          options={rangeLinks.map((item) => ({
            href: item.href,
            label: item.label,
            value: item.range,
          }))}
        />
      </div>
      <div className="booking-date-filter-bar payment-filter-group">
        <span className="payment-filter-group-label">Queue</span>
        <AdminSegmentedControl
          activeValue={review || 'all'}
          ariaLabel="Payment review filters"
          className="payment-filter-buttons"
          options={[
            ...(isFiltered
              ? [{ href: '/payments?range=all&review=all', label: 'Clear filters', value: 'clear' }]
              : []),
            ...reviewLinks.map((item) => ({
              href: item.href,
              label: item.label,
              value: item.review,
            })),
          ]}
        />
      </div>
    </AdminTablePanel>
  );
}
