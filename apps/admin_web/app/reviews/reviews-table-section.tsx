import Link from 'next/link';
import { Download, Star, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminAvatarStatusDot } from '../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
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
  readonly reportReasonLabel: string;
  readonly serviceLabel: string;
  readonly shortIdLabel: string;
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
        className="vuexy-review-filter-card admin-mb-16"
        id="customer-review-controls"
        resultLabel={`Showing ${pagination.totalRows} of ${totalReviewCount}`}
        resultTone={activeFilterLabels.length > 0 ? 'warning' : 'info'}
        title="Customer Review"
        description="Customer-written reviews are published by default. Hold a review to remove it from app visibility."
        footer={(
          <div className="vuexy-review-filter-summary">
            {activeFilterLabels.map((label) => (
              <span className="pill pill-warn" key={label}>
                {label}
              </span>
            ))}
            {activeFilterLabels.length > 0 ? (
              <Link
                className="button button-secondary vuexy-review-clear-filter"
                href={buildReviewListHref(filters, { q: '', review: '' })}
              >
                <X aria-hidden="true" size={14} />
                Clear filters
              </Link>
            ) : null}
          </div>
        )}
      >
        <form action="/reviews" className="vuexy-review-controls">
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
          <AdminFormSelect
            className="vuexy-review-select"
            defaultValue={filters.review}
            label="Review status"
            name="review"
            options={reviewStatusOptions}
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
      </AdminFilterPanel>

      <section className="vuexy-review-card" aria-label="Customer review table">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={emptyMessage}
            headers={['', 'Partner', 'Customer', 'Review', 'Date', 'Status', 'Actions']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="vuexy-review-check-cell">
                  <input aria-label={`Select review ${row.shortIdLabel}`} type="checkbox" />
                </td>
                <td>
                  <div className="vuexy-review-person">
                    <span className="admin-person-avatar-shell">
                      <span className="vuexy-review-avatar vuexy-review-avatar-square">{row.partnerInitials}</span>
                      <AdminAvatarStatusDot status={row.partnerAvatarStatus} />
                    </span>
                    <div>
                      <strong>{row.partnerLabel}</strong>
                      <span>{row.partnerHint}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-review-person">
                    <span className="admin-person-avatar-shell">
                      <span className="vuexy-review-avatar">{row.customerInitials}</span>
                      <AdminAvatarStatusDot status={row.customerAvatarStatus} />
                    </span>
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
                  <div className="vuexy-review-actions">
                    <ReviewActionDropdown actions={row.actions} label={row.actionLabel} />
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>

        <div className="vuexy-review-footer">
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
      </section>
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

const reviewStatusOptions = [
  { label: 'All', value: '' },
  { label: 'Published', value: 'published' },
  { label: 'Held', value: 'held' },
  { label: 'Follow-up', value: 'follow-up' },
  { label: 'Reported', value: 'reported' },
] as const;
