import Link from 'next/link';

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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Payment operation filters</h2>
          <p className="muted">
            Jump straight from the dashboard lane into the payment subset that needs operator review.
          </p>
          <p className="muted">
            Payment date range: {rangeLabel}. Until the payment table stores its own timestamp, this uses the
            linked booking record date.
          </p>
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
          <Link className="pill pill-success" href="/payments">
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
