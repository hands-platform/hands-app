import Link from 'next/link';
import { Download, Eye, Star, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import type { ReviewActionItem } from './review-page-actions';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import { REVIEW_PAGE_SIZE_OPTIONS, buildReviewListHref, reviewFilterDescription } from './review-page-model';
import { ReviewRowActions } from './review-row-actions';

export type ReviewTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ReviewActionItem[];
  readonly appVisibilityLabel: string;
  readonly bookingHref: string | null;
  readonly bookingLabel: string;
  readonly bookingRequestTimeLabel: string;
  readonly commentLabel: string;
  readonly commentValue: string;
  readonly createdAtLabel: string;
  readonly customerHref: string | null;
  readonly customerInitials: string;
  readonly customerLabel: string;
  readonly customerAvatarStatus: AdminAvatarStatus;
  readonly customerPhone: string;
  readonly id: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
  readonly partnerHref: string | null;
  readonly partnerHint: string;
  readonly partnerInitials: string;
  readonly partnerLabel: string;
  readonly rating: number;
  readonly ratingLabel: string;
  readonly reportReasonValue: string;
  readonly reportReasonLabel: string;
  readonly serviceLabel: string;
  readonly shortIdLabel: string;
  readonly status: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
  readonly statusMeaning: string;
};

type ReviewsTableSectionProps = {
  readonly csvHref: string;
  readonly emptyMessage: string;
  readonly filters: ReviewFilters;
  readonly pagination: ReviewPagination<ReviewTableRow>;
  readonly rows: readonly ReviewTableRow[];
  readonly totalReviewCount: number;
};

export function ReviewsTableSection({
  csvHref,
  emptyMessage,
  filters,
  pagination,
  rows,
  totalReviewCount,
}: ReviewsTableSectionProps) {
  const activeFilterLabels = reviewActiveFilterLabels(filters);

  return (
    <>
      <AdminFilterPanel
        className="booking-monitor-filter-panel vuexy-review-filter-card admin-mb-16"
        id="customer-review-controls"
        resultLabel={`Showing ${pagination.totalRows} of ${totalReviewCount}`}
        resultTone={activeFilterLabels.length > 0 ? 'warning' : 'info'}
        title="Review operation filters"
        description="Customer-written reviews are published by default. Operators can hold visibility, mark follow-up, or correct rating and review copy."
        footer={(
          <div className="vuexy-review-filter-summary">
            {activeFilterLabels.map((label) => (
              <span className="pill pill-warn" key={label}>
                {label}
              </span>
            ))}
            {activeFilterLabels.length > 0 ? (
              <AdminFormControlLink
                className="button button-secondary vuexy-review-clear-filter"
                href={buildReviewListHref(filters, { q: '', review: '' })}
              >
                <X aria-hidden="true" size={14} />
                Clear filters
              </AdminFormControlLink>
            ) : null}
          </div>
        )}
      >
        <div className="booking-date-filter-bar vuexy-review-filter-bar" aria-label="Review list filters">
          <div className="booking-date-filter-buttons" role="group" aria-label="Review status">
            {reviewStatusButtonOptions.map((option) => (
              <a
                key={option.value}
                aria-current={filters.review === option.value ? 'page' : undefined}
                className={filters.review === option.value ? 'is-active' : undefined}
                href={buildReviewListHref(filters, { review: option.value })}
              >
                {option.label}
              </a>
            ))}
          </div>
          <form action="/reviews" className="vuexy-review-controls">
            <input name="review" type="hidden" value={filters.review} />
            <AdminFormSearch
              className="vuexy-review-search"
              defaultValue={filters.q}
              label="Search Review"
              name="q"
              placeholder="Search Review"
            />
            <AdminFormSelect
              className="vuexy-review-select"
              defaultValue={String(filters.pageSize)}
              label="Rows per page"
              name="pageSize"
              options={reviewPageSizeOptions}
            />
            <AdminFormControlButton className="vuexy-review-button">
              Apply
            </AdminFormControlButton>
            <AdminFormControlLink
              className="vuexy-review-export"
              download="hands-customer-reviews.csv"
              href={csvHref}
            >
              <Download aria-hidden="true" size={16} />
              Export
            </AdminFormControlLink>
          </form>
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-review-card"
        description="Review rows use the same table card, rounded pagination, avatars, and operator action pattern as bookings."
        id="customer-review-table"
        resultLabel={`${pagination.totalRows} review(s)`}
        resultTone={activeFilterLabels.length > 0 ? 'warning' : 'neutral'}
        title="Customer review list"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table vuexy-review-table"
            emptyMessage={emptyMessage}
            headers={['Request Time', 'Partner', 'Customer', 'Review', 'Visibility', 'Actions']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="vuexy-booking-id-line">
                    {row.bookingHref ? (
                      <Link className="text-link" href={row.bookingHref} title="Open booking detail">
                        <Eye aria-hidden="true" size={14} />
                        {row.bookingLabel}
                      </Link>
                    ) : (
                      <span className="muted">{row.bookingLabel}</span>
                    )}
                  </div>
                  <div className="muted">{row.bookingRequestTimeLabel}</div>
                </td>
                <td>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar is-partner"
                    avatarStatus={row.partnerAvatarStatus}
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={row.partnerHint}
                    href={row.partnerHref}
                    initials={row.partnerInitials}
                    label={row.partnerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar"
                    avatarStatus={row.customerAvatarStatus}
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={row.customerPhone}
                    href={row.customerHref}
                    initials={row.customerInitials}
                    label={row.customerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td className="vuexy-review-copy-cell">
                  <div aria-label={`Rating ${row.ratingLabel}`} className="vuexy-review-stars">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        aria-hidden="true"
                        className={index < row.rating ? 'is-filled' : ''}
                        key={`${row.id}-star-${index}`}
                        size={18}
                      />
                    ))}
                  </div>
                  <p>{row.commentLabel}</p>
                  <span>{row.serviceLabel}</span>
                  {row.reportReasonLabel ? <span>{row.reportReasonLabel}</span> : null}
                </td>
                <td>
                  <span className={row.statusClassName}>{row.statusLabel}</span>
                  <small>{row.statusMeaning}</small>
                  <small>{row.appVisibilityLabel}</small>
                </td>
                <td>
                  <div className="vuexy-review-actions">
                    <ReviewRowActions
                      actions={row.actions}
                      editReview={{
                        bookingHref: row.bookingHref,
                        bookingLabel: row.bookingLabel,
                        commentLabel: row.commentLabel,
                        commentValue: row.commentValue,
                        customerLabel: row.customerLabel,
                        partnerLabel: row.partnerLabel,
                        rating: row.rating,
                        ratingLabel: row.ratingLabel,
                        reportReasonValue: row.reportReasonValue,
                        requestTimeLabel: row.bookingRequestTimeLabel,
                        reviewId: row.id,
                        status: row.status,
                      }}
                      label={row.actionLabel}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>

        <div className="vuexy-booking-table-footer vuexy-review-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="Customer review pages"
            className="vuexy-review-pagination"
            hrefForPage={(page) => buildReviewListHref(filters, { page })}
            pageLinkClassName="vuexy-review-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </>
  );
}

function reviewActiveFilterLabels(filters: ReviewFilters) {
  const labels: string[] = [];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  if (filters.review) {
    labels.push(reviewFilterDescription(filters.review));
  }
  return labels;
}

const reviewPageSizeOptions = REVIEW_PAGE_SIZE_OPTIONS.map((option) => ({
  label: String(option),
  value: String(option),
}));

const reviewStatusButtonOptions = [
  { label: 'All', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Held', value: 'held' },
  { label: 'Follow-up', value: 'follow-up' },
  { label: 'Reported', value: 'reported' },
] as const;
