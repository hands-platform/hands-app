import { AdminReview, adminGet } from '../../lib/admin-api';
import Link from 'next/link';
import { readSearchParam } from '../../lib/date-range';
import { moderateReview } from './actions';

type ReviewsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewsPage({ searchParams }: { searchParams?: ReviewsPageSearchParams }) {
  const filters = buildReviewFilters(searchParams ? await searchParams : {});
  const allReviews = sortReviews(await adminGet<AdminReview[]>('/admin/reviews', []));
  const reviews = filterReviews(allReviews, filters);
  const summary = buildSummary(allReviews);
  const commandBoard = buildReviewCommandBoard(allReviews);
  const activeFilter = reviewFilterLinks().find((item) => item.review === filters.review);

  return (
    <>
      <h1>Feedback And Reports</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total feedback records</p>
          <h2>{summary.total}</h2>
        </div>
        <div className="card">
          <p>Reported / hidden</p>
          <h2>{summary.flagged}</h2>
        </div>
        <div className="card">
          <p>Published</p>
          <h2>{summary.published}</h2>
        </div>
        <div className="card">
          <p>Follow-up records</p>
          <h2>{summary.followUp}</h2>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Feedback command board</h2>
            <p className="muted">
              Customer comments, partner coaching notes, and public visibility decisions are handled here as
              factual service records.
            </p>
          </div>
          <span
            className={`pill ${
              commandBoard.some((item) => item.reviews.length > 0 && item.tone === 'warn')
                ? 'pill-warn'
                : 'pill-success'
            }`}
          >
            {commandBoard.reduce((sum, item) => sum + item.reviews.length, 0)} feedback signal(s)
          </span>
        </div>
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
              Moderation board for guest feedback, dispute signals, and service recovery records.
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

        <table className="table">
          <thead>
            <tr>
              <th>Feedback</th>
              <th>Partner</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Ops signal</th>
              <th>Comment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td>
                  <div>Feedback record</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {shortId(review.id)}
                  </div>
                </td>
                <td>
                  <div>{review.providerProfile?.displayName ?? 'Unknown'}</div>
                  <div className="muted">{providerReviewHint(review)}</div>
                </td>
                <td>
                  <div>
                    {review.customerProfile?.user?.fullName ??
                      review.customerProfile?.user?.phone ??
                      'Unknown'}
                  </div>
                  <div className="muted">{review.customerProfile?.user?.phone ?? 'No phone on file'}</div>
                </td>
                <td>
                  <div>{humanizeStatus(review.status)}</div>
                  <div className="muted">{statusMeaning(review.status)}</div>
                </td>
                <td>
                  <span className={signalClass(review)}>{opsSignal(review)}</span>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {opsHint(review)}
                  </div>
                </td>
                <td>
                  <div>{review.comment?.trim() || 'No written review'}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {review.reportReason?.trim() ? `Report: ${review.reportReason}` : 'No report reason'}
                  </div>
                </td>
                <td>
                  <div className="actions">
                    <form action={moderateReview}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="status" value="PUBLISHED" />
                      <button type="submit">Publish</button>
                    </form>
                    <form action={moderateReview}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="status" value="HIDDEN" />
                      <input type="hidden" name="reportReason" value="Hidden by admin" />
                      <button type="submit">Hide</button>
                    </form>
                    <form action={moderateReview}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="status" value="REPORTED" />
                      <input type="hidden" name="reportReason" value="Marked for follow-up" />
                      <button type="submit">Report</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={7}>{emptyReviewMessage(filters.review)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
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

function shortId(value: string) {
  return value.slice(0, 8);
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
