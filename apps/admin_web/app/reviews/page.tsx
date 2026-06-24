import type { AdminReview } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';
import { buildReviewModerationConfirmation, readReviewModerationStatus } from './review-action-confirmation';
import {
  REVIEW_EXPORT_COLUMNS,
  buildReviewExportRows,
  buildReviewFilters,
  buildReviewTableRows,
  buildSummary,
  emptyReviewMessage,
  filterReviews,
  paginateReviewRows,
  sortReviews,
} from './review-page-model';
import { ReviewsTableSection } from './reviews-table-section';

type ReviewsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams?: ReviewsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildReviewFilters(params);
  const allReviews = await adminGet<AdminReview[]>('/admin/reviews', []);
  const reviews = filterReviews(sortReviews(allReviews, filters.sort), filters);
  const pagination = paginateReviewRows(reviews, filters);
  const summary = buildSummary(allReviews);
  const reviewRows = buildReviewTableRows(pagination.rows);
  const reviewRowPagination = { ...pagination, rows: reviewRows };
  const reviewCsvHref = buildCsvDataHref(buildReviewExportRows(reviews), [...REVIEW_EXPORT_COLUMNS]);
  const confirmation =
    readSearchParam(params.confirm) === 'moderate'
      ? buildReviewModerationConfirmation(
          allReviews,
          readSearchParam(params.reviewId),
          readReviewModerationStatus(readSearchParam(params.status)),
          readSearchParam(params.reportReason),
        )
      : null;

  return (
    <AdminPageTemplate
      contentClassName="reviews-page booking-monitor"
      description="All customer-written reviews, Partner service context, and app visibility moderation in one board."
      metrics={[
        { label: 'Total reviews', value: summary.total, helper: 'Customer review records loaded.' },
        { label: 'Published', value: summary.published, helper: 'Visible in the app.' },
        { label: 'Held', value: summary.held, helper: 'Not visible in the app.' },
        { label: 'Average rating', value: summary.averageRating, helper: 'Published and held review mix.' },
      ]}
      title="Customer Reviews"
    >
      {confirmation ? (
        <ConfirmDialog
          action={moderateReview}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`review-moderation-${confirmation.reviewId}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <ReviewsTableSection
        csvHref={reviewCsvHref}
        emptyMessage={emptyReviewMessage(filters.review)}
        filters={filters}
        pagination={reviewRowPagination}
        rows={reviewRows}
        totalReviewCount={allReviews.length}
      />
    </AdminPageTemplate>
  );
}
