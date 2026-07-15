import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingPostMatchCancellationBoard,
  type BookingPostMatchCancellationBoard as BookingPostMatchCancellationBoardModel,
} from './booking-post-match-cancellations-model';

export type BookingPostMatchCancellationsSectionProps = {
  readonly board: BookingPostMatchCancellationBoardModel;
};

export type BookingPostMatchCancellationBoardProps = {
  readonly bookings: readonly AdminBooking[];
  readonly currentTimeMs: number;
};

const POST_MATCH_CANCELLATION_TABLE_HEADERS = ['Review Lane', 'Count', 'Handling Rule'] as const;
const POST_MATCH_CANCELLATION_DECISION_FLOW = [
  {
    helper: 'Use the retained chat layer or booking detail to read Partner cancellation and no-show context.',
    label: '1. Review evidence',
    value: 'Chat and notes',
  },
  {
    helper: 'Approve restores eligible Partner fee impact; hold keeps the existing fee deduction.',
    label: '2. Decide fee outcome',
    value: 'Approve or hold',
  },
  {
    helper: 'Resolved rows stay in the cancellation page for audit, month counts, and operator handoff.',
    label: '3. Keep audit trail',
    value: 'Resolved record',
  },
] as const;

export function BookingPostMatchCancellationBoard({
  bookings,
  currentTimeMs,
}: BookingPostMatchCancellationBoardProps) {
  const board = buildBookingPostMatchCancellationBoard(bookings, currentTimeMs);
  return board ? <BookingPostMatchCancellationsSection board={board} /> : null;
}

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
    <AdminSection
      actions={
        <div className="booking-post-match-header-actions">
          <div className="booking-post-match-counts" aria-label="Post-match cancellation counts">
            <StatusBadge tone="info">{board.totalCount} total</StatusBadge>
            <StatusBadge tone="neutral">{board.monthCount} this month</StatusBadge>
          </div>
          <AdminFormControlLink className="booking-action-button is-secondary" href="/bookings/post-match-cancellations">
            Open queue
          </AdminFormControlLink>
        </div>
      }
      className="booking-post-match-cancellations-card admin-mt-16"
      description="Partner-side cancellations and no-show reviews after matching. Admin checks chat evidence, restores eligible cancellation fee impact, or keeps the Partner fee deduction."
      title="Post-match Cancellations"
    >

      <div className="booking-post-match-decision-flow admin-mt-14" aria-label="Post-match decision flow">
        {POST_MATCH_CANCELLATION_DECISION_FLOW.map((item) => (
          <div className="booking-post-match-decision-step" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.helper}</p>
          </div>
        ))}
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
                <StatusBadgeFromPillClass pillClass={metric.tone}>{metric.label}</StatusBadgeFromPillClass>
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
    </AdminSection>
  );
}
