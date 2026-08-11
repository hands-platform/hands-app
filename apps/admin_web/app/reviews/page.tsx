import type { AdminReview, AdminReviewSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState, AdminNoticeCard } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';
import {
  buildReviewModerationConfirmation,
  readReviewModerationStatus,
  reviewModerationStatusLabel,
  safeReviewReturnTo,
} from './review-action-confirmation';
import {
  buildReviewDataHrefs,
  buildReviewExportHref,
  buildReviewFilters,
  buildReviewTableRows,
  buildServerReviewPagination,
  reviewDateRangeError,
  reviewMatchingCount,
} from './review-page-model';
import { ReviewsTableSection } from './reviews-table-section';

type ReviewsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams?: ReviewsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildReviewFilters(params);
  const dateError = reviewDateRangeError(filters);
  const dataHrefs = buildReviewDataHrefs(filters);
  const confirmRequested = readSearchParam(params.confirm) === 'moderate';
  const confirmReviewId = readSearchParam(params.reviewId);
  const emptySummary: AdminReviewSummary = {
    averageRating: 0,
    held: 0,
    published: 0,
    reported: 0,
    totalCount: 0,
  };
  const [reviewsResult, summaryResult, confirmationReviewResult] = await Promise.all([
    dateError
      ? Promise.resolve({ data: [] as AdminReview[], ok: true, status: 200 })
      : adminGetResult<AdminReview[]>(dataHrefs.listHref, []),
    dateError
      ? Promise.resolve({ data: emptySummary, ok: true, status: 200 })
      : adminGetResult<AdminReviewSummary>(dataHrefs.summaryHref, emptySummary),
    confirmRequested && confirmReviewId
      ? adminGetResult<AdminReview | null>(`/admin/reviews/${encodeURIComponent(confirmReviewId)}`, null)
      : Promise.resolve({ data: null, ok: !confirmRequested, status: confirmRequested ? 400 : 200 }),
  ]);
  const reviews = reviewsResult.data;
  const summary = summaryResult.data;
  const loadFailed = !reviewsResult.ok || !summaryResult.ok;
  const matchingCount = reviewMatchingCount(summary, filters.review);
  const pagination = buildServerReviewPagination(reviews, filters, matchingCount);
  const reviewRows = buildReviewTableRows(pagination.rows);
  const reviewRowPagination = { ...pagination, rows: reviewRows };
  const reviewCsvHref = buildReviewExportHref(filters);
  const confirmationStatus = readReviewModerationStatus(readSearchParam(params.status));
  const confirmation = confirmRequested && confirmationReviewResult.ok
      ? buildReviewModerationConfirmation(
          confirmationReviewResult.data,
          confirmationStatus,
          readSearchParam(params.reportReason),
          safeReviewReturnTo(readSearchParam(params.returnTo)),
        )
      : null;
  const confirmationError = confirmRequested && !confirmation
    ? confirmationReviewResult.status === 404
      ? 'The selected review no longer exists. Return to the list and refresh before taking action.'
      : 'The selected review could not be loaded. No moderation change has been made.'
    : '';
  const notice = reviewActionNotice(readSearchParam(params.notice));

  return (
    <AdminPageTemplate
      contentClassName="reviews-page booking-monitor"
      description="Review customer feedback, app visibility, and moderation history."
      title="Customer Reviews"
    >
      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role={notice.tone === 'danger' ? 'alert' : 'status'} tone={notice.tone}>
          {notice.message}
        </AdminNoticeCard>
      ) : null}

      {confirmationError ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Moderation confirmation unavailable</strong>
          <p>{confirmationError}</p>
          <AdminTextLink href={safeReviewReturnTo(readSearchParam(params.returnTo))}>Return to reviews</AdminTextLink>
        </AdminNoticeCard>
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          action={moderateReview}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={
            <div className="review-confirmation-summary">
              <p>{confirmation.description}</p>
              <dl>
                <div><dt>Rating</dt><dd>{confirmation.review.rating}/5</dd></div>
                <div><dt>Review</dt><dd>{reviewExcerpt(confirmation.review.comment)}</dd></div>
                <div><dt>Customer</dt><dd>{confirmation.review.customerProfile?.user?.fullName ?? 'Unknown customer'}</dd></div>
                <div><dt>Partner</dt><dd>{confirmation.review.providerProfile?.displayName ?? 'Unknown Partner'}</dd></div>
                <div><dt>Booking</dt><dd>{confirmation.review.booking?.id ? shortId(confirmation.review.booking.id) : 'No booking link'}</dd></div>
                <div><dt>Current state</dt><dd>{reviewModerationStatusLabel(confirmation.review.status)}</dd></div>
                <div><dt>Next state</dt><dd>{confirmation.nextStatusLabel}</dd></div>
                <div><dt>Impact</dt><dd>{confirmation.impact}</dd></div>
              </dl>
            </div>
          }
          hiddenInputs={confirmation.hiddenInputs}
          id={`review-moderation-${confirmation.reviewId}`}
          selectInputs={confirmation.reasonInput ? [{
            defaultValue: confirmation.reasonInput.defaultValue,
            label: 'Moderation reason',
            name: 'reportReason',
            options: confirmation.reasonInput.options,
            required: true,
          }] : []}
          textInputs={confirmation.reasonInput ? [{
            label: 'Operator note (optional)',
            maxLength: 1000,
            name: 'reason',
            placeholder: 'Add context that should appear in the moderation audit.',
          }] : []}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      {loadFailed ? (
        <AdminErrorState
          action={<AdminTextLink href="/reviews">Retry customer reviews</AdminTextLink>}
          message="Review records could not be loaded. No zero values are shown until the source is available."
          title="Review data unavailable"
        />
      ) : (
        <ReviewsTableSection
          csvHref={reviewCsvHref}
          filters={filters}
          matchingCount={matchingCount}
          pagination={reviewRowPagination}
          rows={reviewRows}
          dateError={dateError}
          summary={summary}
        />
      )}
    </AdminPageTemplate>
  );
}

function reviewExcerpt(value?: string | null) {
  const copy = value?.trim() || 'No written review';
  return copy.length > 180 ? `${copy.slice(0, 177)}...` : copy;
}

function reviewActionNotice(value: string) {
  if (value === 'hidden') return { message: 'Review hidden from app.', tone: 'success' as const };
  if (value === 'published') return { message: 'Review published.', tone: 'success' as const };
  if (value === 'needs-review') return { message: 'Review sent to Needs review.', tone: 'success' as const };
  if (value === 'updated') return { message: 'Admin-created review updated.', tone: 'success' as const };
  if (value === 'failed') {
    return {
      message: 'Review moderation failed. Refresh the review and try again. No change was saved.',
      tone: 'danger' as const,
    };
  }
  return null;
}
