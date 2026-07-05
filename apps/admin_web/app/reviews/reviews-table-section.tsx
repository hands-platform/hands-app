import Link from 'next/link';
import { Download, Eye, Star, X } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { StatusBadge } from '../../components/status-badge';
import type { ReviewActionItem } from './review-page-actions';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import {
  REVIEW_DATE_RANGE_OPTIONS,
  REVIEW_PAGE_SIZE_OPTIONS,
  REVIEW_SORT_OPTIONS,
  buildReviewListHref,
  reviewDateRangeLabel,
  reviewFilterDescription,
  reviewSortLabel,
} from './review-page-model';
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
  readonly status: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
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
        footer={
          <div className="vuexy-review-filter-summary">
            {activeFilterLabels.map((label) => (
              <StatusBadge key={label} tone="warning">
                {label}
              </StatusBadge>
            ))}
            {activeFilterLabels.length > 0 ? (
              <AdminFormControlLink
                className="admin-directory-filter-button is-ghost"
                href={buildReviewListHref(filters, {
                  dateFrom: '',
                  dateRange: 'all',
                  dateTo: '',
                  q: '',
                  review: '',
                  sort: 'newest',
                })}
              >
                <X aria-hidden="true" size={14} />
                Clear filters
              </AdminFormControlLink>
            ) : null}
          </div>
        }
      >
        <div className="booking-date-filter-bar vuexy-review-filter-bar" aria-label="Review list filters">
          <AdminSegmentedControl
            activeValue={filters.review}
            ariaLabel="Review status"
            options={reviewStatusButtonOptions.map((option) => ({
              href: buildReviewListHref(filters, { review: option.value }),
              label: option.label,
              value: option.value,
            }))}
          />
          <AdminSegmentedControl
            activeValue={filters.dateRange}
            ariaLabel="Review request date"
            className="vuexy-review-date-buttons"
            options={reviewDateButtonOptions.map((option) => ({
              href: buildReviewListHref(filters, {
                dateFrom: '',
                dateRange: option.value,
                dateTo: '',
              }),
              label: option.label,
              value: option.value,
            }))}
          />
          {filters.dateRange === 'custom' ? (
            <form action="/reviews" className="booking-custom-date-grid vuexy-review-custom-date-grid">
              <input name="review" type="hidden" value={filters.review} />
              <input name="q" type="hidden" value={filters.q} />
              <input name="pageSize" type="hidden" value={filters.pageSize} />
              <input name="sort" type="hidden" value={filters.sort} />
              <input name="dateRange" type="hidden" value="custom" />
              <AdminFormDate defaultValue={filters.dateFrom} label="Date from" name="dateFrom" />
              <AdminFormDate defaultValue={filters.dateTo} label="Date to" name="dateTo" />
              <AdminFormControlButton className="button-primary booking-date-apply-button">
                Apply dates
              </AdminFormControlButton>
            </form>
          ) : null}
          <AdminSegmentedControl
            activeValue={filters.sort}
            ariaLabel="Review sort"
            className="vuexy-review-sort-buttons"
            options={REVIEW_SORT_OPTIONS.map((option) => ({
              href: buildReviewListHref(filters, { sort: option.value }),
              label: option.label,
              value: option.value,
            }))}
          />
          <form action="/reviews" className="vuexy-review-controls">
            <input name="review" type="hidden" value={filters.review} />
            <input name="dateRange" type="hidden" value={filters.dateRange} />
            <input name="dateFrom" type="hidden" value={filters.dateFrom} />
            <input name="dateTo" type="hidden" value={filters.dateTo} />
            <input name="sort" type="hidden" value={filters.sort} />
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search Review"
              name="q"
              placeholder="Search Review"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={String(filters.pageSize)}
              label="Rows per page"
              name="pageSize"
              options={reviewPageSizeOptions}
            />
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
            <AdminFormControlLink
              className="admin-directory-filter-export"
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
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card"
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
                  <div className="muted vuexy-review-submitted-line">
                    Review submitted {row.createdAtLabel}
                  </div>
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
                <td className="vuexy-review-visibility-cell">
                  <span className={row.statusClassName}>{row.statusLabel}</span>
                  <small>{row.appVisibilityLabel}</small>
                </td>
                <td>
                  <div className="vuexy-review-actions">
                    <ReviewRowActions
                      actions={row.actions}
                      editReview={{
                        commentLabel: row.commentLabel,
                        commentValue: row.commentValue,
                        rating: row.rating,
                        ratingLabel: row.ratingLabel,
                        reportReasonValue: row.reportReasonValue,
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

        <AdminTablePaginationFooter
          activePage={pagination.page}
          ariaLabel="Customer review pages"
          className="vuexy-review-footer"
          from={pagination.from}
          hrefForPage={(page) => buildReviewListHref(filters, { page })}
          pageLinkClassName="vuexy-review-page-link"
          paginationClassName="vuexy-review-pagination"
          to={pagination.to}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalRows}
        />
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
  const dateRange = reviewDateRangeLabel(filters);
  if (dateRange) {
    labels.push(dateRange);
  }
  if (filters.sort !== 'newest') {
    labels.push(`Sort: ${reviewSortLabel(filters.sort)}`);
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

const reviewDateButtonOptions = REVIEW_DATE_RANGE_OPTIONS.filter((option) => option.value !== 'all');
