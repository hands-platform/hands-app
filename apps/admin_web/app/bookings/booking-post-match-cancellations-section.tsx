import type { BookingPostMatchCancellationBoard } from './booking-post-match-cancellations-model';

type BookingPostMatchCancellationsSectionProps = {
  readonly board: BookingPostMatchCancellationBoard;
};

export function BookingPostMatchCancellationsSection({ board }: BookingPostMatchCancellationsSectionProps) {
  return (
    <section className="card booking-post-match-cancellations-card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Post-match Cancellations</h2>
          <p>
            Partner-side cancellations after matching. Admin approves fee restoration or keeps the Partner fee
            hold based on chat evidence.
          </p>
        </div>
        <div className="booking-post-match-counts" aria-label="Post-match cancellation counts">
          <span className="pill pill-info">{board.totalCount} total</span>
          <span className="pill pill-neutral">{board.monthCount} this month</span>
        </div>
      </div>

      <div className="booking-post-match-grid">
        <CancellationMetric
          helper="After 15 minutes from match, admin must review chat and confirm the outcome."
          label="Needs admin review"
          tone="warn"
          value={board.pendingManualReviewCount}
        />
        <CancellationMetric
          helper="Within 15 minutes from match; approval is policy-safe unless evidence says otherwise."
          label="Auto-approval window"
          tone="info"
          value={board.autoApprovalWindowCount}
        />
        <CancellationMetric
          helper="Partner fee is still held until approval restores the unpaid earning."
          label="Fee still held"
          tone="danger"
          value={board.feeHeldCount}
        />
        <CancellationMetric
          helper="Cancellation has been approved or the unpaid earning was restored to zero."
          label="Fee restored"
          tone="success"
          value={board.feeRestoredCount}
        />
      </div>

      <div className="booking-post-match-operator-note">
        <strong>Admin handling rule</strong>
        <span>
          Open chat, check the Partner cancellation note, then choose approve to restore the fee impact or
          hold to keep the existing Partner fee deduction.
        </span>
      </div>
    </section>
  );
}

function CancellationMetric({
  helper,
  label,
  tone,
  value,
}: {
  readonly helper: string;
  readonly label: string;
  readonly tone: 'danger' | 'info' | 'success' | 'warn';
  readonly value: number;
}) {
  return (
    <div className={`booking-post-match-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </div>
  );
}
