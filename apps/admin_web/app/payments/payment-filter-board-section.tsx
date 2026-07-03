import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
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
          <Link className="pill pill-success" href="/payments?range=all&review=all">
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
