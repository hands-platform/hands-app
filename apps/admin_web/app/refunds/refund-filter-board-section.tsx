import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminTablePanel } from '../../components/admin-table-panel';
import type { AdminDateRange } from '../../lib/date-range';

export type RefundFilterLink = {
  readonly href: string;
  readonly label: string;
  readonly review: string;
};

export type RefundRangeLink = {
  readonly href: string;
  readonly label: string;
  readonly range: AdminDateRange;
};

type RefundFilterBoardSectionProps = {
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeRange: AdminDateRange;
  readonly filteredCount: number;
  readonly rangeLabel: string;
  readonly rangeLinks: readonly RefundRangeLink[];
  readonly review: string;
  readonly reviewLinks: readonly RefundFilterLink[];
  readonly totalCount: number;
};

export function RefundFilterBoardSection({
  activeFilterDescription,
  activeFilterLabel,
  activeRange,
  filteredCount,
  rangeLabel,
  rangeLinks,
  review,
  reviewLinks,
  totalCount,
}: RefundFilterBoardSectionProps) {
  const isFiltered = Boolean(review || activeRange !== 'all');

  return (
    <AdminTablePanel
      description={`Use these shortcuts from the dashboard to focus on the refund queue state. Refund date range: ${rangeLabel}.`}
      resultLabel={`Showing ${filteredCount} of ${totalCount}`}
      resultTone={review ? 'warning' : 'success'}
      title="Refund operation filters"
    >
      {activeFilterLabel && activeFilterDescription ? (
        <p className="muted admin-mb-12">
          Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
        </p>
      ) : null}
      <AdminFilterSummary
        ariaLabel="Active refund filters"
        className="admin-mb-12"
        labels={[`Range: ${rangeLabel}`, `Queue: ${activeFilterLabel ?? 'All refunds'}`]}
        tone={review ? 'warning' : 'info'}
      />
      <div className="booking-date-filter-bar refund-filter-group admin-mb-12">
        <span className="refund-filter-group-label">Range</span>
        <AdminSegmentedControl
          activeValue={activeRange}
          ariaLabel="Refund date range filters"
          className="refund-filter-buttons"
          options={rangeLinks.map((item) => ({
            href: item.href,
            label: item.label,
            value: item.range,
          }))}
        />
      </div>
      <div className="booking-date-filter-bar refund-filter-group">
        <span className="refund-filter-group-label">Queue</span>
        <AdminSegmentedControl
          activeValue={review || 'all'}
          ariaLabel="Refund review filters"
          className="refund-filter-buttons"
          options={[
            ...(isFiltered
              ? [{ href: '/refunds?range=all&review=all', label: 'Clear filters', value: 'clear' }]
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
