import { Download, Save, Star, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminAvatar } from '../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import { moderateReview } from './actions';
import { ReviewActionDropdown } from './review-action-dropdown';
import type { ReviewActionItem } from './review-page-actions';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import { REVIEW_PAGE_SIZE_OPTIONS, buildReviewListHref, reviewFilterDescription } from './review-page-model';

export type ReviewTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ReviewActionItem[];
  readonly appVisibilityLabel: string;
  readonly bookingLabel: string;
  readonly commentLabel: string;
  readonly commentValue: string;
  readonly createdAtLabel: string;
  readonly customerInitials: string;
  readonly customerLabel: string;
  readonly customerAvatarStatus: AdminAvatarStatus;
  readonly customerPhone: string;
  readonly id: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
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
            headers={['Partner', 'Customer', 'Review', 'Date', 'Visibility', 'Edit Review', 'Actions']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="vuexy-review-person">
                    <AdminAvatar
                      className="vuexy-review-avatar vuexy-review-avatar-square"
                      initials={row.partnerInitials}
                      status={row.partnerAvatarStatus}
                    />
                    <div>
                      <strong>{row.partnerLabel}</strong>
                      <span>{row.partnerHint}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-review-person">
                    <AdminAvatar
                      className="vuexy-review-avatar"
                      initials={row.customerInitials}
                      status={row.customerAvatarStatus}
                    />
                    <div>
                      <strong className="vuexy-review-customer">{row.customerLabel}</strong>
                      <span>{row.customerPhone}</span>
                    </div>
                  </div>
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
                <td className="vuexy-review-date-cell">{row.createdAtLabel}</td>
                <td>
                  <span className={row.statusClassName}>{row.statusLabel}</span>
                  <small>{row.statusMeaning}</small>
                  <small>{row.appVisibilityLabel}</small>
                </td>
                <td>
                  <form action={moderateReview} className="vuexy-review-edit-form">
                    <input name="reviewId" type="hidden" value={row.id} />
                    <input name="status" type="hidden" value={row.status} />
                    <input name="reportReason" type="hidden" value={row.reportReasonValue} />
                    <label className="vuexy-review-rating-field">
                      <span>Rating</span>
                      <select defaultValue={String(row.rating)} name="rating">
                        {reviewRatingOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <AdminFormTextarea
                      className="vuexy-review-comment-field"
                      defaultValue={row.commentValue}
                      label="Review content"
                      name="comment"
                      placeholder="Review content"
                      rows={3}
                      textareaClassName="vuexy-review-comment-textarea"
                    />
                    <button className="vuexy-review-save-button" type="submit">
                      <Save aria-hidden="true" size={14} />
                      Save
                    </button>
                  </form>
                </td>
                <td>
                  <div className="vuexy-review-actions">
                    <ReviewActionDropdown actions={row.actions} label={row.actionLabel} />
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

const reviewRatingOptions = [5, 4, 3, 2, 1].map((rating) => ({
  label: `${rating} star${rating === 1 ? '' : 's'}`,
  value: String(rating),
}));
