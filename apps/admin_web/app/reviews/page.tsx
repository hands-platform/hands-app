import type { AdminReview } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import type { ActionMenuItem } from '../../components/action-menu';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import Link from 'next/link';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';
import {
  buildReviewModerationConfirmation,
  readReviewModerationStatus,
  reviewModerationConfirmHref,
} from './review-action-confirmation';
import { ReviewsTableSection, type ReviewTableRow } from './reviews-table-section';

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

      <section className="card" style={{ marginBottom: 16 }}>
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

function buildReviewTableRows(reviews: readonly AdminReview[]): ReviewTableRow[] {
  return reviews.map((review) => ({
    actionLabel: `Feedback actions for ${shortId(review.id)}`,
    actions: reviewModerationActionMenuItems(review),
    commentLabel: review.comment?.trim() || 'No written review',
    customerLabel: review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown',
    customerPhone: review.customerProfile?.user?.phone ?? 'No phone on file',
    id: review.id,
    opsHint: opsHint(review),
    opsSignal: opsSignal(review),
    providerHint: providerReviewHint(review),
    providerLabel: review.providerProfile?.displayName ?? 'Unknown',
    reportReasonLabel: review.reportReason?.trim() ? `Report: ${review.reportReason}` : 'No report reason',
    shortIdLabel: shortId(review.id),
    signalClassName: signalClass(review),
    statusLabel: humanizeStatus(review.status),
    statusMeaning: statusMeaning(review.status),
  }));
}

function sortReviews(reviews: AdminReview[]) {
  return [...reviews].sort((left, right) => {
    const signalDiff = reviewPriority(left) - reviewPriority(right);
    if (signalDiff !== 0) {
      return signalDiff;
    }
    return dateMs(right.createdAt) - dateMs(left.createdAt);
  });
}

function reviewPriority(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 0;
  }
  if (review.status === 'HIDDEN') {
    return 1;
  }
  if (review.status === 'PUBLISHED') {
    return 3;
  }
  return 4;
}

type ReviewCommandTone = 'warn' | 'info' | 'ok';

type ReviewCommandItem = {
  title: string;
  detail: string;
  status: string;
  operatorAction: string;
  href: string;
  tone: ReviewCommandTone;
  reviews: AdminReview[];
};

function buildReviewCommandBoard(reviews: AdminReview[]): ReviewCommandItem[] {
  const reported = reviews.filter((review) => review.status === 'REPORTED');
  const followUp = reviews.filter(
    (review) => review.status === 'REPORTED' || Boolean(review.reportReason?.trim()),
  );
  const hidden = reviews.filter((review) => review.status === 'HIDDEN');

  return [
    {
      title: 'Reported feedback',
      detail: 'Customer or operator reports need moderation, support notes, and public visibility decision.',
      status: 'Reported',
      operatorAction: 'Open reported rows first, then publish, hide, or keep under follow-up.',
      href: '/reviews?review=reported',
      tone: reported.length > 0 ? 'warn' : 'ok',
      reviews: reported,
    },
    {
      title: 'Service follow-up',
      detail: 'Records with report reasons need booking context, chat evidence, and support follow-up.',
      status: 'Follow-up',
      operatorAction: 'Check booking context, customer notes, and service evidence.',
      href: '/reviews?review=follow-up',
      tone: followUp.length > 0 ? 'warn' : 'ok',
      reviews: followUp,
    },
    {
      title: 'Hidden evidence',
      detail: 'Hidden reviews should not disappear operationally; they remain useful for disputes.',
      status: 'Hidden',
      operatorAction: 'Make sure hidden rows have a clear reason and audit trail.',
      href: '/reviews?review=hidden',
      tone: hidden.length > 0 ? 'info' : 'ok',
      reviews: hidden,
    },
  ];
}

function buildReviewFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: normalizeReviewFilter(readParam(params.review)),
  };
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function filterReviews(reviews: AdminReview[], filters: ReturnType<typeof buildReviewFilters>) {
  if (!filters.review) {
    return reviews;
  }
  return reviews.filter((review) => reviewMatchesFilter(review, filters.review));
}

function reviewMatchesFilter(review: AdminReview, filter: string) {
  if (filter === 'reported') {
    return review.status === 'REPORTED';
  }
  if (filter === 'follow-up') {
    return review.status === 'REPORTED' || Boolean(review.reportReason?.trim());
  }
  if (filter === 'hidden') {
    return review.status === 'HIDDEN';
  }
  if (filter === 'published') {
    return review.status === 'PUBLISHED';
  }
  return true;
}

function reviewFilterLinks() {
  return [
    { label: 'All feedback', href: '/reviews', review: '' },
    { label: 'Reported', href: '/reviews?review=reported', review: 'reported' },
    { label: 'Follow-up', href: '/reviews?review=follow-up', review: 'follow-up' },
    { label: 'Hidden', href: '/reviews?review=hidden', review: 'hidden' },
    { label: 'Published', href: '/reviews?review=published', review: 'published' },
  ];
}

function reviewFilterDescription(review: string) {
  if (review === 'reported') {
    return 'feedback records that need moderation follow-up.';
  }
  if (review === 'follow-up') {
    return 'feedback records with report reasons or moderation follow-up.';
  }
  if (review === 'hidden') {
    return 'feedback removed from public visibility but retained for evidence.';
  }
  if (review === 'published') {
    return 'feedback currently visible to customers.';
  }
  return 'all feedback records.';
}

function reviewModerationActionMenuItems(review: AdminReview): readonly ActionMenuItem[] {
  return [
    {
      description:
        review.status === 'PUBLISHED'
          ? 'Feedback is already published.'
          : 'Review before making this feedback visible.',
      disabled: review.status === 'PUBLISHED',
      href: reviewModerationConfirmHref(review.id, 'PUBLISHED'),
      kind: 'link',
      label: 'Publish',
      tone: 'info',
    },
    {
      description:
        review.status === 'HIDDEN'
          ? 'Feedback is already hidden.'
          : 'Review before removing this feedback from public visibility.',
      disabled: review.status === 'HIDDEN',
      href: reviewModerationConfirmHref(review.id, 'HIDDEN', 'Hidden by admin'),
      kind: 'link',
      label: 'Hide',
      tone: 'danger',
    },
    {
      description:
        review.status === 'REPORTED'
          ? 'Feedback is already marked for follow-up.'
          : 'Review before adding moderation follow-up.',
      disabled: review.status === 'REPORTED',
      href: reviewModerationConfirmHref(review.id, 'REPORTED', 'Marked for follow-up'),
      kind: 'link',
      label: 'Report',
      tone: 'warning',
    },
  ];
}

function emptyReviewMessage(review: string) {
  if (!review) {
    return 'No feedback records loaded.';
  }
  return `No feedback records currently match this queue. ${reviewFilterDescription(review)}`;
}

function buildSummary(reviews: AdminReview[]) {
  return {
    total: reviews.length,
    flagged: reviews.filter((review) => review.status === 'REPORTED' || review.status === 'HIDDEN').length,
    published: reviews.filter((review) => review.status === 'PUBLISHED').length,
    followUp: reviews.filter((review) => review.status === 'REPORTED' || Boolean(review.reportReason?.trim()))
      .length,
  };
}

function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusMeaning(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Visible to customers';
    case 'HIDDEN':
      return 'Removed from public view';
    case 'REPORTED':
      return 'Needs moderation follow-up';
    default:
      return 'Feedback state under moderation';
  }
}

function providerReviewHint(review: AdminReview) {
  if (review.status === 'REPORTED' || review.reportReason?.trim()) {
    return 'Feedback has a follow-up marker';
  }
  return 'Use this record to track service feedback and booking context';
}

function reviewProviderLabel(review: AdminReview) {
  return review.providerProfile?.displayName ?? 'Unknown partner';
}

function reviewToneClass(tone: ReviewCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

function reviewToneLabel(tone: ReviewCommandTone) {
  if (tone === 'warn') {
    return 'Needs moderation';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}

function signalClass(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'signal signal-warn';
  }
  if (review.status === 'PUBLISHED') {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'Needs moderation';
  }
  if (review.status === 'HIDDEN') {
    return 'Already hidden';
  }
  return 'Monitor';
}

function opsHint(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'Review the text, confirm the report reason, and decide whether to keep it hidden.';
  }
  if (review.status === 'HIDDEN') {
    return 'Hidden feedback should still be documented for support or partner coaching.';
  }
  return 'Routine feedback row for customer sentiment and booking context.';
}

function dateMs(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeReviewFilter(value: string) {
  if (value === 'low-rating' || value === 'service-recovery') {
    return 'follow-up';
  }
  return value;
}
