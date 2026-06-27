import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlLink } from '../../components/admin-form-controls';
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
  const isFiltered = Boolean(activeReview || activeBookingLabel);

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
      resultLabel={`Showing ${filteredCount} of ${totalCount} / ${activeRangeLabel}`}
      resultTone={isFiltered ? 'warning' : 'success'}
      title="Notification operation filters"
      footer={
        <>
          <div
            className="booking-date-filter-bar notification-date-filter-bar"
            aria-label="Notification date range"
          >
            <div className="booking-date-filter-buttons notification-date-filter-buttons" role="group">
              {rangeLinks.map((link) => (
                <AdminFormControlLink
                  aria-current={activeRange === link.range ? 'page' : undefined}
                  className={activeRange === link.range ? 'is-active' : undefined}
                  href={link.href}
                  key={link.range}
                >
                  {link.label}
                </AdminFormControlLink>
              ))}
            </div>
          </div>
          {activeReviewRunbook ? (
            <div className="admin-mt-10">
              <span className="pill pill-info">{activeReviewRunbook.title}</span>
              <p className="muted admin-mt-6">{activeReviewRunbook.detail}</p>
              <p className="muted admin-mt-6">
                <strong>Next action:</strong> {activeReviewRunbook.primaryAction}
              </p>
            </div>
          ) : null}
          <div className="participant-list">
            {isFiltered ? (
              <AdminFormControlLink className="pill pill-success" href={clearHref}>
                Clear filter
              </AdminFormControlLink>
            ) : null}
            {activeBookingLabel ? <span className="pill pill-info">Booking {activeBookingLabel}</span> : null}
            {links.map((link) => (
              <AdminFormControlLink
                aria-current={activeReview === link.review ? 'page' : undefined}
                className={`pill ${activeReview === link.review ? 'pill-warn' : 'pill-neutral'}`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </AdminFormControlLink>
            ))}
          </div>
        </>
      }
    />
  );
}
