import { AdminFormControlButton, AdminFormControlLink, AdminFormShell } from '../../../components/admin-form-controls';
import { AdminSummaryCardGrid } from '../../../components/admin-overview-card';
import { AdminCard, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import type { BookingOutcomeReviewPanel, BookingOutcomeReviewRow } from './booking-outcome-review-panel';
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
          <StatusBadgeFromPillClass pillClass={outcomeReview.tone}>
            {outcomeReview.status}
          </StatusBadgeFromPillClass>
          {outcomeReview.primaryHref && outcomeReview.primaryLabel ? (
            <AdminFormControlLink className="button-secondary admin-inline-action" href={outcomeReview.primaryHref}>
              {outcomeReview.primaryLabel}
            </AdminFormControlLink>
          ) : null}
        </div>
      }
      className="admin-mb-16 booking-post-match-cancellation-decision-card"
      description="Review retained chat, closeout evidence, and operator notes before choosing the final Partner fee outcome."
      id="booking-post-match-cancellation-decision"
      title="Post-match cancellation processing"
    >
      <AdminSummaryCardGrid
        ariaLabel="Post-match cancellation evidence checklist"
        className="booking-post-match-detail-evidence-grid admin-mt-12"
        itemClassName="booking-post-match-detail-evidence-card"
        items={outcomeReview.rows.map((row) => ({
          detail: row.helper,
          href: row.href,
          key: row.label,
          label: <StatusBadgeFromPillClass pillClass={row.tone}>{row.label}</StatusBadgeFromPillClass>,
          value: bookingOutcomeReviewRowValue(row),
        }))}
      />

      <AdminCard className="booking-outcome-decision-panel">
        <div className="booking-outcome-decision-main">
          <div className="booking-outcome-decision-copy">
            <StatusBadgeFromPillClass pillClass={decision.resolutionTone}>
              {decision.resolutionLabel}
            </StatusBadgeFromPillClass>
            <StatusBadgeFromPillClass pillClass={decision.feeTone}>
              {decision.feeLabel}
            </StatusBadgeFromPillClass>
            <StatusBadgeFromPillClass pillClass={decision.timingTone}>
              {decision.timingLabel}
            </StatusBadgeFromPillClass>
          </div>
          <p className="muted">
            Approve restores the eligible Partner fee impact. Hold keeps the existing Partner fee deduction
            for this closed booking.
          </p>
        </div>
        {decision.canResolve ? (
          <div className="booking-outcome-decision-actions">
            <AdminFormShell action={approvePostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.approveNote} />
              <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
                Approve cancellation
              </AdminFormControlButton>
              <small>Restore eligible fee impact</small>
            </AdminFormShell>
            <AdminFormShell action={holdPostMatchCancellationFromDetail}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="note" value={decision.holdNote} />
              <AdminFormControlButton className="button-secondary admin-inline-action" type="submit">
                Hold fee deduction
              </AdminFormControlButton>
              <small>Keep existing deduction</small>
            </AdminFormShell>
          </div>
        ) : (
          <span className="muted">This cancellation decision is already closed.</span>
        )}
      </AdminCard>
    </AdminSection>
  );
}

function bookingOutcomeReviewRowValue(row: BookingOutcomeReviewRow) {
  return row.dateTimeValue ? <DateTimeText fallback={row.value} value={row.dateTimeValue} /> : row.value;
}
