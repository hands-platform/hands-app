import type { AdminReview } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import Link from 'next/link';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';
import {
  buildReviewModerationConfirmation,
  readReviewModerationStatus,
} from './review-action-confirmation';
import {
  buildReviewCommandBoard,
  buildReviewFilters,
  buildReviewTableRows,
  buildSummary,
  emptyReviewMessage,
  filterReviews,
  humanizeStatus,
  reviewFilterDescription,
  reviewFilterLinks,
  reviewProviderLabel,
  reviewToneClass,
  reviewToneLabel,
  sortReviews,
} from './review-page-model';
import { ReviewsTableSection } from './reviews-table-section';

type ReviewsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams?: ReviewsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildReviewFilters(params);
  const allReviews = sortReviews(await adminGet<AdminReview[]>('/admin/reviews', []));
  const reviews = filterReviews(allReviews, filters);
  const summary = buildSummary(allReviews);
  const commandBoard = buildReviewCommandBoard(allReviews);
  const reviewRows = buildReviewTableRows(reviews);
  const activeFilter = reviewFilterLinks().find((item) => item.review === filters.review);
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
      description="Moderation board for customer comments, Partner coaching notes, and public visibility decisions."
      metrics={[
        { label: 'Total feedback records', value: summary.total, helper: 'Feedback records loaded.' },
        { label: 'Reported / hidden', value: summary.flagged, helper: 'Rows needing moderation context.' },
        { label: 'Published', value: summary.published, helper: 'Visible to customers.' },
        { label: 'Follow-up records', value: summary.followUp, helper: 'Records with report reasons.' },
      ]}
      title="Feedback And Reports"
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

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Customer comments, Partner coaching notes, and public visibility decisions are handled here as factual service records."
          status={
            <span
              className={`pill ${
                commandBoard.some((item) => item.reviews.length > 0 && item.tone === 'warn')
                  ? 'pill-warn'
                  : 'pill-success'
              }`}
            >
              {commandBoard.reduce((sum, item) => sum + item.reviews.length, 0)} feedback record(s)
            </span>
          }
          title="Feedback command board"
        />
        <div className="ops-task-grid">
          {commandBoard.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.title}>
              <span className={`signal ${reviewToneClass(item.tone)}`}>{reviewToneLabel(item.tone)}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.status}</span>
                <span className="pill">{item.reviews.length} record(s)</span>
              </div>
              {item.reviews.length > 0 ? (
                <div className="stack">
                  {item.reviews.slice(0, 3).map((review) => (
                    <span className="muted" key={`${item.title}-${review.id}`}>
                      {shortId(review.id)} / {reviewProviderLabel(review)} / {humanizeStatus(review.status)}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{item.operatorAction}</small>
            </Link>
          ))}
        </div>
      </section>

      <div className="card">
        <div className="toolbar">
          <div>
            <h2>Feedback operation filters</h2>
            <p className="muted">
              Moderation board for guest feedback, dispute records, and service recovery records.
            </p>
            {activeFilter?.review ? (
              <p className="muted">
                Active queue: <strong>{activeFilter.label}</strong> -{' '}
                {reviewFilterDescription(activeFilter.review)}
              </p>
            ) : null}
          </div>
          <div className="participant-list">
            {filters.review ? (
              <Link className="pill pill-success" href="/reviews">
                Clear filter
              </Link>
            ) : null}
            {reviewFilterLinks().map((item) => (
              <Link
                className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
            <span className={`pill ${filters.review ? 'pill-warn' : 'pill-success'}`}>
              Showing {reviews.length} of {allReviews.length}
            </span>
          </div>
        </div>

        <ReviewsTableSection
          emptyMessage={emptyReviewMessage(filters.review)}
          rows={reviewRows}
        />
      </div>
    </AdminPageTemplate>
  );
}
