import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import type { BookingPostMatchCancellationBoard } from './booking-post-match-cancellations-model';

type BookingPostMatchCancellationsSectionProps = {
  readonly board: BookingPostMatchCancellationBoard;
};

const POST_MATCH_CANCELLATION_TABLE_HEADERS = ['Review Lane', 'Count', 'Handling Rule'] as const;

export function BookingPostMatchCancellationsSection({ board }: BookingPostMatchCancellationsSectionProps) {
  const metrics = [
    {
      count: board.pendingManualReviewCount,
      helper: 'Cancellations after 15 minutes and no-show reviews need chat evidence before closeout.',
      label: 'Needs admin review',
      tone: 'pill-warn',
    },
    {
      count: board.autoApprovedCount,
      helper:
        'Partner cancelled within 15 minutes and the API resolved the cancellation fee outcome automatically.',
      label: 'Auto-approved',
      tone: 'pill-info',
    },
    {
      count: board.autoApprovalWindowCount,
      helper: 'Cancellation rows inside the 15-minute Partner window.',
      label: 'Within 15m window',
      tone: 'pill-info',
    },
    {
      count: board.feeHeldCount,
      helper: 'Partner fee is still held until approval restores the unpaid earning.',
      label: 'Fee held',
      tone: 'pill-danger',
    },
    {
      count: board.feeRestoredCount,
      helper: 'Cancellation has been approved or the unpaid earning was restored to zero.',
      label: 'Fee restored',
      tone: 'pill-success',
    },
  ];

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

      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table admin-mt-14"
          emptyMessage="No post-match cancellation metrics are available."
          headers={POST_MATCH_CANCELLATION_TABLE_HEADERS}
          rowCount={metrics.length}
        >
          {metrics.map((metric) => (
            <tr key={metric.label}>
              <td>
                <span className={`pill ${metric.tone}`}>{metric.label}</span>
              </td>
              <td>
                <strong>{metric.count}</strong>
              </td>
              <td>
                <span className="muted">{metric.helper}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <div className="booking-post-match-operator-note admin-mt-14">
        <strong>Admin handling rule</strong>
        <span>
          Open chat, check the Partner cancellation or no-show evidence, then approve eligible cancellation
          fee restoration or hold the existing Partner fee deduction.
        </span>
      </div>
    </section>
  );
}
