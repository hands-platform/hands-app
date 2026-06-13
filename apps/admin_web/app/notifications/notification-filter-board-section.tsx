import Link from 'next/link';

export type NotificationFilterLink = {
  readonly href: string;
  readonly label: string;
  readonly review: string;
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
  readonly filteredCount: number;
  readonly links: readonly NotificationFilterLink[];
  readonly totalCount: number;
};

export function NotificationFilterBoardSection({
  activeBookingLabel,
  activeFilterDescription,
  activeFilterLabel,
  activeReview,
  activeReviewRunbook,
  filteredCount,
  links,
  totalCount,
}: NotificationFilterBoardSectionProps) {
  const isFiltered = Boolean(activeReview || activeBookingLabel);

  return (
    <div className="card soft-card admin-mb-16">
      <div className="toolbar">
        <div>
          <h3>Notification operation filters</h3>
          <p className="muted">
            Open each queue directly from the command dashboard without hunting through rows.
          </p>
          {activeFilterLabel && activeFilterDescription ? (
            <p className="muted">
              Active queue: <strong>{activeFilterLabel}</strong> - {activeFilterDescription}
            </p>
          ) : null}
          {activeBookingLabel ? (
            <p className="muted">
              Active booking trace: <strong>{activeBookingLabel}</strong>. Showing only notifications tied to
              this booking id.
            </p>
          ) : null}
          {activeReviewRunbook ? (
            <div className="admin-mt-10">
              <span className="pill pill-info">{activeReviewRunbook.title}</span>
              <p className="muted admin-mt-6">{activeReviewRunbook.detail}</p>
              <p className="muted admin-mt-6">
                <strong>Next action:</strong> {activeReviewRunbook.primaryAction}
              </p>
            </div>
          ) : null}
        </div>
        <span className={`pill ${isFiltered ? 'pill-warn' : 'pill-success'}`}>
          Showing {filteredCount} of {totalCount}
        </span>
      </div>
      <div className="participant-list">
        {isFiltered ? (
          <Link className="pill pill-success" href="/notifications">
            Clear filter
          </Link>
        ) : null}
        {activeBookingLabel ? <span className="pill pill-info">Booking {activeBookingLabel}</span> : null}
        {links.map((link) => (
          <Link
            aria-current={activeReview === link.review ? 'page' : undefined}
            className={`pill ${activeReview === link.review ? 'pill-warn' : 'pill-neutral'}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
