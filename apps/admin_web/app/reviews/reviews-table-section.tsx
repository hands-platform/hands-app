import { Download, Star, X } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminTextLink } from '../../components/admin-text-link';
import type { AdminReviewSummary } from '../../lib/admin-api';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { ReviewActionItem } from './review-page-actions';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import {
  REVIEW_DATE_RANGE_OPTIONS,
  REVIEW_PAGE_SIZE_OPTIONS,
  buildReviewListHref,
  reviewDateRangeLabel,
  reviewEmptyState,
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
  readonly createdAt: string | null;
  readonly customerHref: string | null;
  readonly customerInitials: string;
  readonly customerLabel: string;
  readonly isAdminCreated: boolean;
  readonly id: string;
  readonly partnerHref: string | null;
  readonly partnerInitials: string;
  readonly partnerLabel: string;
  readonly rating: number;
  readonly ratingLabel: string;
  readonly reportReasonLabel: string;
  readonly reportReasonValue: string;
  readonly reviewIdLabel: string;
  readonly serviceLabel: string;
  readonly showBookingRequestTime: boolean;
  readonly status: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
};

type ReviewsTableSectionProps = {
  readonly csvHref: string;
  readonly dateError?: string;
  readonly filters: ReviewFilters;
  readonly matchingCount: number;
  readonly pagination: ReviewPagination<ReviewTableRow>;
  readonly rows: readonly ReviewTableRow[];
  readonly summary: AdminReviewSummary;
};

export function ReviewsTableSection({
  csvHref,
  dateError = '',
  filters,
  matchingCount,
  pagination,
  rows,
  summary,
}: ReviewsTableSectionProps) {
  const activeFilterLabels = reviewActiveFilterLabels(filters);
  const emptyCopy = reviewEmptyState(filters);
  const clearFiltersHref = buildReviewListHref(filters, {
    dateFrom: '',
    dateRange: 'all',
    dateTo: '',
    q: '',
    review: '',
    sort: 'newest',
  });
  const emptyState = rows.length === 0 ? (
    <AdminEmptyState
      message={emptyCopy.message}
      title={emptyCopy.title}
    />
  ) : null;

  return (
    <>
      <AdminFilterPanel
        className="vuexy-review-filter-card admin-mb-16"
        id="customer-review-controls"
        resultLabel={dateError ? 'Invalid date range' : undefined}
        resultTone={dateError ? 'danger' : filters.review === 'reported' ? 'warning' : 'info'}
        title="Review controls"
        footer={
          <AdminFilterSummary
            ariaLabel="Active review filters"
            className="vuexy-review-filter-summary"
            labels={activeFilterLabels}
            tone={filters.review === 'reported' ? 'warning' : 'info'}
          >
            {activeFilterLabels.length > 0 ? (
              <AdminFormControlLink
                className="admin-directory-filter-button is-ghost"
                href={clearFiltersHref}
              >
                <X aria-hidden="true" size={14} />
                Clear filters
              </AdminFormControlLink>
            ) : null}
          </AdminFilterSummary>
        }
      >
        <div className="booking-date-filter-bar vuexy-review-filter-bar" aria-label="Review list filters">
          <div className="reviews-filter-group">
            <strong>Status</strong>
            <AdminSegmentedControl
              activeValue={filters.review}
              ariaLabel="Review status"
              options={reviewStatusButtonOptions(summary, !dateError).map((option) => ({
                href: buildReviewListHref(filters, { review: option.value }),
                label: option.label,
                value: option.value,
              }))}
            />
          </div>
          <AdminFormGrid action="/reviews" className="vuexy-review-controls">
            <input name="review" type="hidden" value={filters.review} />
            <input name="dateFrom" type="hidden" value={filters.dateFrom} />
            <input name="dateTo" type="hidden" value={filters.dateTo} />
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search reviews"
              name="q"
              placeholder="Search name, booking, review ID"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.dateRange}
              label="Submitted date"
              labelVisibility="visible"
              name="dateRange"
              options={reviewDateButtonOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.sort}
              label="Sort"
              labelVisibility="visible"
              name="sort"
              options={reviewSortControlOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={String(filters.pageSize)}
              label="Rows"
              labelVisibility="visible"
              name="pageSize"
              options={reviewPageSizeOptions}
            />
            <AdminFormActionRow className="vuexy-review-filter-actions" wide={false}>
              <AdminFormControlButton className="admin-directory-filter-button">Update list</AdminFormControlButton>
              {dateError ? (
                <AdminFormControlButton
                  aria-label="Export unavailable: correct the custom date range"
                  className="button-secondary admin-directory-filter-export"
                  disabled
                  title="Correct the custom date range before exporting."
                  type="button"
                >
                  <Download aria-hidden="true" size={16} />
                  Export
                </AdminFormControlButton>
              ) : (
                <AdminFormControlLink className="admin-directory-filter-export" href={csvHref}>
                  <Download aria-hidden="true" size={16} />
                  Export
                </AdminFormControlLink>
              )}
            </AdminFormActionRow>
          </AdminFormGrid>
          {filters.dateRange === 'custom' ? (
            <AdminFormShell action="/reviews" className="booking-custom-date-grid vuexy-review-custom-date-grid">
              <input name="review" type="hidden" value={filters.review} />
              <input name="q" type="hidden" value={filters.q} />
              <input name="pageSize" type="hidden" value={filters.pageSize} />
              <input name="sort" type="hidden" value={filters.sort} />
              <input name="dateRange" type="hidden" value="custom" />
              <AdminFormDate
                ariaDescribedBy={dateError ? 'review-date-error' : undefined}
                ariaInvalid={Boolean(dateError)}
                autoFocus={Boolean(dateError)}
                defaultValue={filters.dateFrom}
                label="From"
                labelVisibility="visible"
                name="dateFrom"
                native={true}
              />
              <AdminFormDate
                ariaDescribedBy={dateError ? 'review-date-error' : undefined}
                ariaInvalid={Boolean(dateError)}
                defaultValue={filters.dateTo}
                label="To"
                labelVisibility="visible"
                name="dateTo"
                native={true}
              />
              <AdminFormControlButton className="button-primary booking-date-apply-button">
                Apply dates
              </AdminFormControlButton>
              {dateError ? (
                <AdminInlineNotice className="admin-grid-span-2" id="review-date-error" role="alert" tone="danger">
                  {dateError}
                </AdminInlineNotice>
              ) : null}
            </AdminFormShell>
          ) : null}
        </div>
      </AdminFilterPanel>

      {dateError ? null : <AdminTablePanel
        className="vuexy-review-card"
        id="customer-review-table"
        resultLabel={`${matchingCount} matching`}
        resultTone={filters.review === 'reported' ? 'warning' : 'info'}
        title="Review queue"
      >
        {rows.length === 0 ? emptyState : <AdminTableScroll ariaLabel="Customer reviews table">
          <AdminDataTable
            className="vuexy-booking-table vuexy-review-table"
            emptyMessage={emptyState}
            headers={['Submitted', 'Review', 'Parties', 'State', 'Actions']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <DateTimeText fallback="No submitted date" value={row.createdAt} />
                  <div className="muted vuexy-review-submitted-line">Review {row.reviewIdLabel}</div>
                  <div className="vuexy-booking-id-line vuexy-review-booking-line">
                    {row.bookingHref ? (
                      <AdminTextLink href={row.bookingHref} title="Open booking detail">
                        Booking {row.bookingLabel}
                      </AdminTextLink>
                    ) : (
                      <span className="muted">{row.bookingLabel}</span>
                    )}
                  </div>
                  {row.showBookingRequestTime ? (
                    <div className="muted vuexy-review-requested-line">Requested {row.bookingRequestTimeLabel}</div>
                  ) : null}
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
                    <span className="vuexy-review-rating-value">{row.ratingLabel}</span>
                  </div>
                  <p>{row.commentLabel}</p>
                  <span>{row.serviceLabel}</span>
                  {row.isAdminCreated ? <span>Admin-created review</span> : null}
                  {row.reportReasonLabel ? <span>{row.reportReasonLabel}</span> : null}
                </td>
                <td className="vuexy-review-parties-cell">
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar is-partner"
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    href={row.partnerHref}
                    initials={row.partnerInitials}
                    label={row.partnerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar"
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    href={row.customerHref}
                    initials={row.customerInitials}
                    label={row.customerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td className="vuexy-review-visibility-cell">
                  <StatusBadgeFromPillClass pillClass={row.statusClassName}>{row.statusLabel}</StatusBadgeFromPillClass>
                  <small>{row.appVisibilityLabel}</small>
                </td>
                <td>
                  <div className="vuexy-review-actions">
                    <ReviewRowActions
                      actions={row.actions}
                      editReview={{
                        canEdit: row.isAdminCreated,
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
        </AdminTableScroll>}

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
      </AdminTablePanel>}

    </>
  );
}

function reviewActiveFilterLabels(filters: ReviewFilters) {
  const labels: string[] = [];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  if (filters.review) {
    labels.push(reviewStatusFilterLabel(filters.review));
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

const reviewSortControlOptions = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Highest rating', value: 'rating-desc' },
  { label: 'Lowest rating', value: 'rating-asc' },
] as const;

function reviewStatusButtonOptions(summary: AdminReviewSummary, countsAvailable: boolean) {
  const count = (value: number | undefined) => countsAvailable ? (value ?? 0) : '—';
  return [
    { label: `All ${count(summary.totalCount)}`, value: '' },
    { label: `Visible ${count(summary.published)}`, value: 'published' },
    { label: `Needs review ${count(summary.reported)}`, value: 'reported' },
    { label: `Hidden ${count(summary.held)}`, value: 'held' },
  ] as const;
}

const reviewDateButtonOptions = REVIEW_DATE_RANGE_OPTIONS;

function reviewStatusFilterLabel(review: string) {
  if (review === 'published') return 'Visible';
  if (review === 'reported') return 'Needs review';
  if (review === 'held') return 'Hidden';
  return 'All';
}
