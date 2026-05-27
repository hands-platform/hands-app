import { AdminReview, adminGet } from '../../lib/admin-api';
import { moderateReview } from './actions';

export default async function ReviewsPage() {
  const reviews = sortReviews(await adminGet<AdminReview[]>('/admin/reviews', []));
  const summary = buildSummary(reviews);

  return (
    <>
      <h1>Reviews And Reports</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total reviews</p>
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
          <p>Low rating</p>
          <h2>{summary.lowRating}</h2>
        </div>
        <div className="card">
          <p>Tips attached</p>
          <h2>{summary.tipped}</h2>
        </div>
      </section>

      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">
              Moderation board for guest feedback, dispute signals, and partner quality monitoring.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">Newest flagged first</span>
            <span className="pill pill-info">Moderation hint</span>
            <span className="pill pill-warn">Fast publish / hide / follow-up</span>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Review</th>
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
                  <div>{starRow(review.rating)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {review.rating}/5
                    {review.tipAmount > 0 ? ` - Tip ${review.tipAmount}` : ''}
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
                <td colSpan={7}>No reviews loaded.</td>
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
    return right.rating - left.rating;
  });
}

function reviewPriority(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 0;
  }
  if (review.status === 'HIDDEN') {
    return 1;
  }
  if (review.rating <= 2) {
    return 2;
  }
  if (review.status === 'PUBLISHED') {
    return 3;
  }
  return 4;
}

function buildSummary(reviews: AdminReview[]) {
  return {
    total: reviews.length,
    flagged: reviews.filter((review) => review.status === 'REPORTED' || review.status === 'HIDDEN').length,
    published: reviews.filter((review) => review.status === 'PUBLISHED').length,
    lowRating: reviews.filter((review) => review.rating <= 2).length,
    tipped: reviews.filter((review) => review.tipAmount > 0).length,
  };
}

function starRow(rating: number) {
  const fullStars = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}`;
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
      return 'Review state under moderation';
  }
}

function providerReviewHint(review: AdminReview) {
  if (review.rating <= 2) {
    return 'Low-score feedback may need service recovery follow-up';
  }
  if (review.tipAmount > 0) {
    return 'Guest left a tip, which often signals a strong experience';
  }
  return 'Use this review to track partner quality and consistency';
}

function signalClass(review: AdminReview) {
  if (review.status === 'REPORTED' || review.rating <= 2) {
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
  if (review.rating <= 2) {
    return 'Low-score follow-up';
  }
  if (review.tipAmount > 0) {
    return 'High-satisfaction';
  }
  return 'Monitor';
}

function opsHint(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'Review the text, confirm the report reason, and decide whether to keep it hidden.';
  }
  if (review.status === 'HIDDEN') {
    return 'Hidden reviews should still be documented for support or partner coaching.';
  }
  if (review.rating <= 2) {
    return 'Low ratings deserve service recovery review before the pattern spreads.';
  }
  if (review.tipAmount > 0) {
    return 'Tipped reviews can highlight partner strengths worth reinforcing.';
  }
  return 'Routine feedback row for customer sentiment and partner quality tracking.';
}
