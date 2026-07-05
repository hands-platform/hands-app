import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadgeLink } from '../../components/status-badge';
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
      <div className="participant-list admin-mb-12">
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
      </div>
      <div className="participant-list">
        {isFiltered ? (
          <StatusBadgeLink href="/refunds?range=all&review=all" tone="success">
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
      </div>
    </AdminTablePanel>
  );
}
