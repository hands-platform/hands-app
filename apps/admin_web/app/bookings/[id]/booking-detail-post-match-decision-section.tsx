import Link from 'next/link';
import type { BookingOutcomeReviewPanel } from './booking-outcome-review-panel';
import {
  approvePostMatchCancellationFromDetail,
  holdPostMatchCancellationFromDetail,
} from './actions';

type BookingDetailPostMatchDecisionSectionProps = {
  readonly bookingId: string;
  readonly outcomeReview: BookingOutcomeReviewPanel;
};

export function BookingDetailPostMatchDecisionSection({
  bookingId,
  outcomeReview,
}: BookingDetailPostMatchDecisionSectionProps) {
  const decision = outcomeReview.postMatchDecision;

  if (!decision.visible) {
    return null;
  }

  return (
    <section className="card admin-mb-16" id="booking-post-match-cancellation-decision">
      <div className="ops-section-header">
        <div>
          <h2>Post-match cancellation processing</h2>
          <p className="muted">
            Review retained chat and close the Partner cancellation decision from this booking detail.
          </p>
        </div>
        <div className="booking-outcome-review-actions">
          <span className={`pill ${outcomeReview.tone}`}>{outcomeReview.status}</span>
          {outcomeReview.primaryHref && outcomeReview.primaryLabel ? (
            <Link className="button button-secondary admin-inline-action" href={outcomeReview.primaryHref}>
              {outcomeReview.primaryLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="booking-outcome-decision-panel">
        <div className="booking-outcome-decision-copy">
          <span className={`pill ${decision.resolutionTone}`}>{decision.resolutionLabel}</span>
          <span className={`pill ${decision.feeTone}`}>{decision.feeLabel}</span>
          <span className={`pill ${decision.timingTone}`}>{decision.timingLabel}</span>
        </div>
        {decision.canResolve ? (
          <div className="booking-outcome-decision-actions">
            <form action={approvePostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.approveNote} />
              <button className="button button-primary admin-inline-action" type="submit">
                Approve cancellation
              </button>
            </form>
            <form action={holdPostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.holdNote} />
              <button className="button button-secondary admin-inline-action" type="submit">
                Hold fee deduction
              </button>
            </form>
          </div>
        ) : (
          <span className="muted">This cancellation decision is already closed.</span>
        )}
      </div>
    </section>
  );
}
