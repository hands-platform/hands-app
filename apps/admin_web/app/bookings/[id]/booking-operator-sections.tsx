import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminSection } from '../../../components/admin-surface';
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
        actions={<span className={`pill ${operatorCommandQueue.tone}`}>{operatorCommandQueue.status}</span>}
        className="admin-mb-16"
        description="Same-shift actions queued for operator handling."
        id="operator-command-queue"
        title="Operator command queue"
      >
        <div className="service-trace-summary admin-mt-12">
          {operatorCommandQueue.labels.map((label) => (
            <div key={label.label}>
              <span>{label.label}</span>
              <strong>{label.value}</strong>
              <small>{label.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list admin-mt-12">
          {operatorCommandQueue.commands.map((command) => (
            <div className="setup-stage-item" key={command.id}>
              <span>{command.label}</span>
              <div>
                <strong>{command.title}</strong>
                <p className="muted">{command.detail}</p>
                <small>{command.owner}</small>
              </div>
              <OperatorCommandAction bookingId={bookingId} command={command} />
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <span className="pill pill-info">
            {operatorActionMatrix.filter((row) => row.available).length}/{operatorActionMatrix.length}{' '}
            available
          </span>
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
                  <span className={`pill ${row.tone}`}>{row.status}</span>
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
            <span className={`pill ${badge.tone}`} key={badge.label}>
              {badge.label}
            </span>
          ))}
        </>
      }
      className="ops-command-center admin-mb-16"
      description={instruction}
      id="booking-ops"
      title="Operations command center"
    >
      <div className="ops-task-note admin-mt-14">
        <div className={`ops-task-card ${finalGateReason.className}`} id="booking-gate-reason">
          <div>
            <span className={`pill ${finalGateReason.pillClass}`}>Booking gate reason</span>
            <h3>{finalGateReason.title}</h3>
            <p>{finalGateReason.detail}</p>
          </div>
          <small>{finalGateReason.operatorRule}</small>
        </div>
      </div>
      <div className="ops-task-note admin-mt-14">
        <div className="ops-section-header">
          <div>
            <strong>Action evidence gate</strong>
            <p className="muted">
              Evidence status for the manual action buttons below.
            </p>
          </div>
          <span className={`pill ${actionEvidenceGate.tone}`}>{actionEvidenceGate.status}</span>
        </div>
        <div className="ops-task-grid admin-mt-12">
          {actionEvidenceGate.rows.map((row) => (
            <a className={`ops-task-card ${row.className}`} href={row.href} key={row.action}>
              <div>
                <span className={`pill ${row.pillClass}`}>{row.status}</span>
                <h3>{row.action}</h3>
                <p>{row.evidence}</p>
              </div>
              <small>{row.operatorRule}</small>
            </a>
          ))}
        </div>
      </div>
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
          <div className="action-button-card ops-task-blocked">
            <span className="pill pill-neutral">Locked</span>
            <strong>No payment action available</strong>
            <p className="muted">No payment record is linked to this booking yet.</p>
            <small>Payment buttons appear after a booking payment row exists.</small>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
