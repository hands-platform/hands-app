import type { AdminReview, AdminReviewSummary } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';
import { buildReviewModerationConfirmation, readReviewModerationStatus } from './review-action-confirmation';
import {
  buildReviewDataHrefs,
  buildReviewExportHref,
  buildReviewFilters,
  buildReviewTableRows,
  buildServerReviewPagination,
  emptyReviewMessage,
} from './review-page-model';
import { ReviewsTableSection } from './reviews-table-section';

type ReviewsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams?: ReviewsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildReviewFilters(params);
  const dataHrefs = buildReviewDataHrefs(filters);
  const [reviews, summary] = await Promise.all([
    adminGet<AdminReview[]>(dataHrefs.listHref, []),
    adminGet<AdminReviewSummary>(dataHrefs.summaryHref, {
      averageRating: 0,
      held: 0,
      published: 0,
      reported: 0,
      totalCount: 0,
    }),
  ]);
  const pagination = buildServerReviewPagination(reviews, filters, summary.totalCount);
  const reviewRows = buildReviewTableRows(pagination.rows);
  const reviewRowPagination = { ...pagination, rows: reviewRows };
  const reviewCsvHref = buildReviewExportHref(filters);
  const confirmation =
    readSearchParam(params.confirm) === 'moderate'
      ? buildReviewModerationConfirmation(
          reviews,
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
        {
          label: 'Total reviews',
          value: summary.totalCount,
          helper: 'Matching customer review records.',
          kind: 'record',
          scope: 'All records',
        },
        {
          label: 'Published',
          value: summary.published ?? 0,
          helper: 'Visible in the app.',
          kind: 'live',
          scope: 'Live visibility',
        },
        {
          label: 'Held',
          value: summary.held ?? 0,
          helper: 'Not visible in the app.',
          kind: 'risk',
          scope: 'Needs action',
        },
        {
          label: 'Reported',
          value: summary.reported ?? 0,
          helper: 'Customer reviews flagged for operator review.',
          kind: 'risk',
          scope: 'Needs action',
        },
        {
          label: 'Average rating',
          value: (summary.averageRating ?? 0).toFixed(1),
          helper: 'Matching review average.',
          kind: 'record',
          scope: 'Review records',
        },
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
        totalReviewCount={summary.totalCount}
      />
    </AdminPageTemplate>
  );
}
