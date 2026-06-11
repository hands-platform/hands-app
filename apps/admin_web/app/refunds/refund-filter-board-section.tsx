import Link from 'next/link';

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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Refund operation filters</h2>
          <p className="muted">Use these shortcuts from the dashboard to focus on the refund queue state.</p>
          <p className="muted">Refund date range: {rangeLabel}.</p>
          {activeFilterLabel && activeFilterDescription ? (
            <p className="muted">
              Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
            </p>
          ) : null}
        </div>
        <span className={`pill ${review ? 'pill-warn' : 'pill-success'}`}>
          Showing {filteredCount} of {totalCount}
        </span>
      </div>
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
          <Link className="pill pill-success" href="/refunds">
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
    </section>
  );
}
