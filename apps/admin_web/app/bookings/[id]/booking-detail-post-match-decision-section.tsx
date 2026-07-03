import Link from 'next/link';
import { AdminFormControlButton } from '../../../components/admin-form-controls';
import { AdminSection } from '../../../components/admin-surface';
import type { BookingOutcomeReviewPanel } from './booking-outcome-review-panel';
import { approvePostMatchCancellationFromDetail, holdPostMatchCancellationFromDetail } from './actions';

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
    <AdminSection
      actions={
        <div className="booking-outcome-review-actions">
          <span className={`pill ${outcomeReview.tone}`}>{outcomeReview.status}</span>
          {outcomeReview.primaryHref && outcomeReview.primaryLabel ? (
            <Link className="button button-secondary admin-inline-action" href={outcomeReview.primaryHref}>
              {outcomeReview.primaryLabel}
            </Link>
          ) : null}
        </div>
      }
      className="admin-mb-16 booking-post-match-cancellation-decision-card"
      description="Review retained chat, closeout evidence, and operator notes before choosing the final Partner fee outcome."
      id="booking-post-match-cancellation-decision"
      title="Post-match cancellation processing"
    >

      <div
        aria-label="Post-match cancellation evidence checklist"
        className="booking-post-match-detail-evidence-grid admin-mt-12"
      >
        {outcomeReview.rows.map((row) => (
          <Link className="booking-post-match-detail-evidence-card" href={row.href} key={row.label}>
            <span className={`pill ${row.tone}`}>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.helper}</small>
          </Link>
        ))}
      </div>

      <div className="card admin-card booking-outcome-decision-panel">
        <div className="booking-outcome-decision-main">
          <div className="booking-outcome-decision-copy">
            <span className={`pill ${decision.resolutionTone}`}>{decision.resolutionLabel}</span>
            <span className={`pill ${decision.feeTone}`}>{decision.feeLabel}</span>
            <span className={`pill ${decision.timingTone}`}>{decision.timingLabel}</span>
          </div>
          <p className="muted">
            Approve restores the eligible Partner fee impact. Hold keeps the existing Partner fee deduction
            for this closed booking.
          </p>
        </div>
        {decision.canResolve ? (
          <div className="booking-outcome-decision-actions">
            <form action={approvePostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.approveNote} />
              <AdminFormControlButton className="button button-primary admin-inline-action" type="submit">
                Approve cancellation
              </AdminFormControlButton>
              <small>Restore eligible fee impact</small>
            </form>
            <form action={holdPostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.holdNote} />
              <AdminFormControlButton className="button button-secondary admin-inline-action" type="submit">
                Hold fee deduction
              </AdminFormControlButton>
              <small>Keep existing deduction</small>
            </form>
          </div>
        ) : (
          <span className="muted">This cancellation decision is already closed.</span>
        )}
      </div>
    </AdminSection>
  );
}
