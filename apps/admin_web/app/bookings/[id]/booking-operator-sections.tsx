import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminStageItem } from '../../../components/admin-stage-item';
import {
  AdminActionCard,
  AdminNotePanel,
  AdminSection,
  AdminTaskCard,
  AdminTaskGrid,
} from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { AdminBookingDetail } from '../../../lib/admin-api';
import {
  captureBookingPayment,
  refundBookingPayment,
  releaseBookingPayment,
  syncBookingPayment,
} from './actions';
import { ActionLink, OperatorCommandAction, type OperatorCommand } from './booking-operator-actions';
import { BookingCashDebtSettlementForm, BookingPaymentAction } from './booking-payment-actions';
import { isTerminalPayment } from './booking-formatters';

type OperatorCommandQueue = {
  status: string;
  tone: string;
  labels: Array<{ label: string; value: string; helper: string }>;
  commands: OperatorCommand[];
};

type OperatorActionMatrixRow = {
  action: string;
  available: boolean;
  status: string;
  tone: string;
  evidence: string;
  operatorRule: string;
  href: string;
  hrefLabel: string;
};

type ActionEvidenceGateRow = {
  action: string;
  className: string;
  pillClass: string;
  status: string;
  evidence: string;
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
  operatorRule: string;
  href: string;
};

type ActionEvidenceGate = {
  status: string;
  tone: string;
  rows: ActionEvidenceGateRow[];
};

type FinalGateReason = {
  className: string;
  pillClass: string;
  title: string;
  detail: string;
  operatorRule: string;
};

type PaymentActionReadout = {
  className: string;
  pillClass: string;
  status: string;
  evidence: string;
  operatorRule: string;
};

type OpsBadge = {
  label: string;
  tone: string;
};

export type BookingOperatorQueueSectionsProps = {
  bookingId: string;
  operatorCommandQueue: OperatorCommandQueue;
  operatorActionMatrix: OperatorActionMatrixRow[];
};

export type BookingOpsCommandCenterProps = {
  booking: AdminBookingDetail;
  instruction: string;
  badges: OpsBadge[];
  finalGateReason: FinalGateReason;
  actionEvidenceGate: ActionEvidenceGate;
  actionGateByAction: Map<string, PaymentActionReadout>;
  cashDebtNeedsSettlement: boolean;
};

const OPERATOR_ACTION_AVAILABILITY_HEADERS = [
  'Action',
  'Availability',
  'Evidence',
  'Operator rule',
  'Open',
] as const;

export function BookingOperatorQueueSections({
  bookingId,
  operatorCommandQueue,
  operatorActionMatrix,
}: BookingOperatorQueueSectionsProps) {
  return (
    <>
      <AdminSection
        actions={
          <StatusBadgeFromPillClass pillClass={operatorCommandQueue.tone}>
            {operatorCommandQueue.status}
          </StatusBadgeFromPillClass>
        }
        className="admin-mb-16"
        description="Same-shift actions queued for operator handling."
        id="operator-command-queue"
        title="Operator command queue"
      >
        <AdminTraceSummary
          className="admin-mt-12"
          metrics={operatorCommandQueue.labels.map((label) => ({
            detail: label.helper,
            label: label.label,
            value: label.value,
          }))}
        />
        <div className="setup-stage-list admin-mt-12">
          {operatorCommandQueue.commands.map((command) => (
            <AdminStageItem key={command.id}>
              <span>{command.label}</span>
              <div>
                <strong>{command.title}</strong>
                <p className="muted">{command.detail}</p>
                <small>{command.owner}</small>
              </div>
              <OperatorCommandAction bookingId={bookingId} command={command} />
            </AdminStageItem>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <StatusBadge tone="info">
            {operatorActionMatrix.filter((row) => row.available).length}/{operatorActionMatrix.length}{' '}
            available
          </StatusBadge>
        }
        className="admin-mb-16"
        description="Manual action availability and the linked destination for each action."
        id="operator-action-availability"
        title="Operator action availability"
      >
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={OPERATOR_ACTION_AVAILABILITY_HEADERS}
            rowCount={operatorActionMatrix.length}
          >
            {operatorActionMatrix.map((row) => (
              <tr key={row.action}>
                <td>{row.action}</td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
                </td>
                <td>{row.evidence}</td>
                <td>{row.operatorRule}</td>
                <td>
                  <ActionLink href={row.href} label={row.hrefLabel} />
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminSection>
    </>
  );
}

export function BookingOpsCommandCenter({
  booking,
  instruction,
  badges,
  finalGateReason,
  actionEvidenceGate,
  actionGateByAction,
  cashDebtNeedsSettlement,
}: BookingOpsCommandCenterProps) {
  return (
    <AdminSection
      actions={
        <>
          {badges.map((badge) => (
            <StatusBadgeFromPillClass key={badge.label} pillClass={badge.tone}>
              {badge.label}
            </StatusBadgeFromPillClass>
          ))}
        </>
      }
      className="ops-command-center admin-mb-16"
      description={instruction}
      id="booking-ops"
      title="Operations command center"
    >
      <AdminNotePanel className="admin-mt-14">
        <div id="booking-gate-reason">
          <AdminTaskCard
            className={finalGateReason.className}
            detail={finalGateReason.detail}
            leading={
              <StatusBadgeFromPillClass pillClass={finalGateReason.pillClass}>
                Booking gate reason
              </StatusBadgeFromPillClass>
            }
            title={finalGateReason.title}
          >
            <small>{finalGateReason.operatorRule}</small>
          </AdminTaskCard>
        </div>
      </AdminNotePanel>
      <AdminNotePanel className="admin-mt-14">
        <AdminSectionHeader
          actions={
            <StatusBadgeFromPillClass pillClass={actionEvidenceGate.tone}>
              {actionEvidenceGate.status}
            </StatusBadgeFromPillClass>
          }
          description="Evidence status for the manual action buttons below."
          title="Action evidence gate"
        />
        <AdminTaskGrid className="admin-mt-12">
          {actionEvidenceGate.rows.map((row) => (
            <AdminActionCard
              className={row.className}
              detail={<ActionEvidenceGateDetail row={row} />}
              href={row.href}
              key={row.action}
              leading={<StatusBadgeFromPillClass pillClass={row.pillClass}>{row.status}</StatusBadgeFromPillClass>}
              title={row.action}
              variant="ops-task"
            >
              <small>{row.operatorRule}</small>
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      </AdminNotePanel>
      <div className="action-button-grid">
        {booking.payment?.id ? (
          <>
            <BookingPaymentAction
              action={syncBookingPayment}
              bookingId={booking.id}
              paymentId={booking.payment.id}
              label="Sync payment"
              disabled={!booking.payment.providerRef || isTerminalPayment(booking.payment.status)}
              readout={actionGateByAction.get('Payment sync')}
            />
            <BookingPaymentAction
              action={captureBookingPayment}
              bookingId={booking.id}
              paymentId={booking.payment.id}
              label="Capture"
              disabled={
                booking.payment.status === 'CAPTURED' ||
                booking.payment.status === 'REFUNDED' ||
                booking.payment.status === 'RELEASED'
              }
              readout={actionGateByAction.get('Payment capture')}
            />
            <BookingPaymentAction
              action={releaseBookingPayment}
              bookingId={booking.id}
              paymentId={booking.payment.id}
              label="Release"
              disabled={
                booking.payment.status === 'CAPTURED' ||
                booking.payment.status === 'REFUNDED' ||
                booking.payment.status === 'RELEASED'
              }
              readout={actionGateByAction.get('Release or refund')}
              evidenceHint={`Release action state: ${booking.payment.status}.`}
              ruleHint="Release follows the action evidence gate above."
            />
            <BookingPaymentAction
              action={refundBookingPayment}
              bookingId={booking.id}
              paymentId={booking.payment.id}
              label="Refund"
              disabled={booking.payment.status === 'REFUNDED' || booking.payment.status === 'RELEASED'}
              readout={actionGateByAction.get('Release or refund')}
              evidenceHint={`Refund action state: ${booking.payment.status}.`}
              ruleHint="Refund follows the action evidence gate above."
              requiresApproval
            />
            {cashDebtNeedsSettlement && booking.earning?.id && (
              <BookingCashDebtSettlementForm booking={booking} />
            )}
          </>
        ) : (
          <AdminTaskCard
            actionLabel="Payment buttons appear after a booking payment row exists."
            leading={<StatusBadge tone="neutral">Locked</StatusBadge>}
            variant="ops-blocked"
          >
            <AdminEmptyState
              message="No payment record is linked to this booking yet."
              title="No payment action available"
            />
          </AdminTaskCard>
        )}
      </div>
    </AdminSection>
  );
}

function ActionEvidenceGateDetail({ row }: { row: ActionEvidenceGateRow }) {
  if (!row.evidenceDateTimeValue) {
    return row.evidence;
  }

  return (
    <>
      {row.evidenceDateTimePrefix}
      <DateTimeText fallback={row.evidence} value={row.evidenceDateTimeValue} />
      {row.evidenceDateTimeSuffix}
    </>
  );
}
