import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';
import type { NotificationDateRange } from './notification-page-model';

export type NotificationFilterLink = {
  readonly href: string;
  readonly label: string;
  readonly review: string;
};

export type NotificationDateRangeLink = {
  readonly href: string;
  readonly label: string;
  readonly range: NotificationDateRange;
};

export type NotificationReviewRunbookView = {
  readonly detail: string;
  readonly primaryAction: string;
  readonly title: string;
};

type NotificationFilterBoardSectionProps = {
  readonly activeBookingLabel: string | null;
  readonly activeFilterDescription: string | null;
  readonly activeFilterLabel: string | null;
  readonly activeReview: string;
  readonly activeReviewRunbook: NotificationReviewRunbookView | null;
  readonly activeRange: NotificationDateRange;
  readonly activeRangeLabel: string;
  readonly clearHref: string;
  readonly filteredCount: number;
  readonly links: readonly NotificationFilterLink[];
  readonly rangeLinks: readonly NotificationDateRangeLink[];
  readonly totalCount: number;
};

export function NotificationFilterBoardSection({
  activeBookingLabel,
  activeFilterDescription,
  activeFilterLabel,
  activeReview,
  activeReviewRunbook,
  activeRange,
  activeRangeLabel,
  clearHref,
  filteredCount,
  links,
  rangeLinks,
  totalCount,
}: NotificationFilterBoardSectionProps) {
  const isFiltered = Boolean((activeReview && activeReview !== 'all') || activeBookingLabel);

  return (
    <AdminFilterPanel
      className="notification-filter-card admin-mb-16"
      description={
        <>
          Default view is today. Use the range buttons for past delivery evidence without loading every
          notification row.
          <br />
          Active range: <strong>{activeRangeLabel}</strong>.
          {activeFilterLabel && activeFilterDescription ? (
            <>
              <br />
              Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
            </>
          ) : null}
          {activeBookingLabel ? (
            <>
              <br />
              Active booking trace: <strong>{activeBookingLabel}</strong>. Showing only notifications tied to
              this booking id.
            </>
          ) : null}
        </>
      }
      id="notification-operation-filters"
      resultLabel={`Showing ${filteredCount} loaded row(s) of ${totalCount} total / ${activeRangeLabel}`}
      resultTone={isFiltered ? 'warning' : 'success'}
      title="Notification operation filters"
      footer={
        <>
          <div
            className="booking-date-filter-bar notification-date-filter-bar"
            aria-label="Notification date range"
          >
            <AdminSegmentedControl
              activeValue={activeRange}
              ariaLabel="Notification date range"
              className="notification-date-filter-buttons"
              options={rangeLinks.map((link) => ({
                href: link.href,
                label: link.label,
                value: link.range,
              }))}
            />
          </div>
          {activeReviewRunbook ? (
            <div className="admin-mt-10">
              <StatusBadge tone="info">{activeReviewRunbook.title}</StatusBadge>
              <p className="muted admin-mt-6">{activeReviewRunbook.detail}</p>
              <p className="muted admin-mt-6">
                <strong>Next action:</strong> {activeReviewRunbook.primaryAction}
              </p>
            </div>
          ) : null}
          <AdminFilterChipGroup>
            {isFiltered ? (
              <StatusBadgeLink href={clearHref} tone="success">
                Clear filter
              </StatusBadgeLink>
            ) : null}
            {activeBookingLabel ? <StatusBadge tone="info">Booking {activeBookingLabel}</StatusBadge> : null}
            {links.map((link) => (
              <StatusBadgeLink
                ariaCurrent={activeReview === link.review ? 'page' : undefined}
                href={link.href}
                key={link.href}
                tone={activeReview === link.review ? 'warning' : 'neutral'}
              >
                {link.label}
              </StatusBadgeLink>
            ))}
          </AdminFilterChipGroup>
        </>
      }
    />
  );
}
