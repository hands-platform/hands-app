import Link from 'next/link';
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
            Partner-side cancellations and no-show reviews after matching. Admin checks chat evidence,
            restores eligible cancellation fee impact, or keeps the Partner fee deduction.
          </p>
        </div>
        <div className="booking-post-match-header-actions">
          <div className="booking-post-match-counts" aria-label="Post-match cancellation counts">
            <span className="pill pill-info">{board.totalCount} total</span>
            <span className="pill pill-neutral">{board.monthCount} this month</span>
          </div>
          <Link className="booking-action-button is-secondary" href="/bookings?view=post-match-cancellations">
            Open queue
          </Link>
        </div>
      </div>

      <div className="booking-post-match-grid">
        <CancellationMetric
          helper="Cancellations after 15 minutes and no-show reviews need chat evidence before closeout."
          label="Needs admin review"
          tone="warn"
          value={board.pendingManualReviewCount}
        />
        <CancellationMetric
          helper="Partner cancelled within 15 minutes and the API resolved the cancellation fee outcome automatically."
          label="Auto-approved"
          tone="info"
          value={board.autoApprovedCount}
        />
        <CancellationMetric
          helper="Cancellation rows inside the 15-minute Partner window."
          label="Within 15m window"
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
          Open chat, check the Partner cancellation or no-show evidence, then approve eligible cancellation
          fee restoration or hold the existing Partner fee deduction.
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
