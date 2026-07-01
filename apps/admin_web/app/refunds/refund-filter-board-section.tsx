import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
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
          <Link
            className={`pill ${activeRange === item.range ? 'pill-info' : 'pill-neutral'}`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="participant-list">
        {isFiltered ? (
          <Link className="pill pill-success" href="/refunds?range=all&review=all">
            Clear filters
          </Link>
        ) : null}
        {reviewLinks.map((item) => (
          <Link
            className={`pill ${review === item.review ? 'pill-warn' : 'pill-neutral'}`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </AdminFilterPanel>
  );
}
