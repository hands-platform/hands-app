import { AdminStageItemLink, AdminStageList } from '../../../components/admin-stage-item';
import { AdminDetailGrid, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type { ReactNode } from 'react';

export type BookingNeedsActionItem = {
  readonly detail: string;
  readonly href: string;
  readonly key: string;
  readonly label: string;
  readonly tone: 'danger' | 'warning';
};

export type BookingNeedsActionInput = {
  readonly bookingStatus: string;
  readonly chatRepairCanSubmit: boolean;
  readonly closeoutCanSubmit: boolean;
  readonly matchingExpiryCanSubmit: boolean;
  readonly noShowCanSubmit: boolean;
  readonly openTasks: readonly {
    readonly helper: string;
    readonly label: string;
    readonly status: string;
  }[];
  readonly postMatchDecisionCanResolve: boolean;
};

export type BookingDecisionStripProps = {
  readonly assignee: string;
  readonly bookingStatus: string;
  readonly contactDetail: string;
  readonly contactValue: string;
  readonly items: readonly BookingNeedsActionItem[];
  readonly lastUpdatedAt?: string | null;
  readonly locationDetail: string;
  readonly locationValue: string;
  readonly paymentDetail: string;
  readonly paymentValue: string;
  readonly recommendedAction: string;
  readonly recommendedHref: string;
  readonly recommendedReason: string;
  readonly sla: string;
};

export function bookingNeedsActionItems({
  bookingStatus,
  chatRepairCanSubmit,
  closeoutCanSubmit,
  matchingExpiryCanSubmit,
  noShowCanSubmit,
  openTasks,
  postMatchDecisionCanResolve,
}: BookingNeedsActionInput): BookingNeedsActionItem[] {
  const items: BookingNeedsActionItem[] = [];

  if (postMatchDecisionCanResolve) {
    items.push({
      detail: 'Review retained evidence before approving the cancellation or holding the fee deduction.',
      href: '#booking-post-match-cancellation-decision',
      key: 'post-match-cancellation',
      label: 'Resolve post-match cancellation',
      tone: 'danger',
    });
  }

  if (chatRepairCanSubmit) {
    items.push({
      detail: 'A final Partner exists, but the retained booking chat room is missing.',
      href: '#chat-repair',
      key: 'chat-repair',
      label: 'Repair booking chat',
      tone: 'danger',
    });
  }

  if (closeoutCanSubmit) {
    items.push({
      detail: 'Confirm payment, payout, fee, tax, wallet, and refund evidence before closing the booking.',
      href: '#completed-closeout',
      key: 'completed-closeout',
      label: 'Reconcile completed booking',
      tone: 'warning',
    });
  }

  if (matchingExpiryCanSubmit) {
    items.push({
      detail: 'The matching window ended and the customer is still waiting.',
      href: '#matching-expiry',
      key: 'matching-expiry',
      label: 'Close expired matching',
      tone: 'warning',
    });
  }

  if (noShowCanSubmit) {
    items.push({
      detail: 'The Partner has arrived. Confirm customer contact evidence before closing the booking.',
      href: '#no-show-handling',
      key: 'no-show',
      label: 'Confirm arrival or no-show',
      tone: 'warning',
    });
  }

  for (const [index, task] of openTasks.entries()) {
    // Routine pending checkpoints are retained in the audit trail. Only a real
    // blocker belongs in the operator's exception queue.
    if (task.status !== 'BLOCKED') continue;

    items.push({
      detail: task.helper,
      href: '#booking-structured-ops-status',
      key: `ops-task-${index}-${task.label}`,
      label: `${task.label} is blocked`,
      tone: 'danger',
    });
  }

  return items.map((item) => ({
    ...item,
    detail: item.detail || `Review this action for the ${humanizeStatus(bookingStatus)} booking.`,
  }));
}

export function BookingNeedsActionSection({
  assignee,
  bookingStatus,
  contactDetail,
  contactValue,
  items,
  lastUpdatedAt,
  locationDetail,
  locationValue,
  paymentDetail,
  paymentValue,
  recommendedAction,
  recommendedHref,
  recommendedReason,
  sla,
}: BookingDecisionStripProps) {
  const hasActions = items.length > 0;

  return (
    <AdminSection
      actions={
        <StatusBadge tone={hasActions ? 'warning' : 'success'}>
          {hasActions ? `${items.length} open` : 'Clear'}
        </StatusBadge>
      }
      className="admin-mb-16 booking-needs-action-summary booking-decision-strip"
      description="Current evidence and the next recommended operator decision."
      id="booking-needs-action-summary"
      title="Decision strip"
    >
      <AdminDetailGrid className="booking-decision-strip-facts">
        <DecisionFact
          detail={lastUpdatedAt ? <DateTimeText value={lastUpdatedAt} /> : 'No update timestamp'}
          label="Status"
          value={humanizeStatus(bookingStatus)}
        />
        <DecisionFact detail="No booking deadline is configured." label="SLA" value={sla} />
        <DecisionFact detail="No operator is assigned." label="Assignee" value={assignee} />
        <DecisionFact detail={contactDetail} label="Contact" value={contactValue} />
        <DecisionFact detail={locationDetail} label="Location" value={locationValue} />
        <DecisionFact detail={paymentDetail} label="Payment" value={paymentValue} />
      </AdminDetailGrid>
      <AdminStageList className="booking-needs-action-list booking-decision-recommendation">
        <AdminStageItemLink href={recommendedHref}>
          <span className="booking-needs-action-copy">
            <small>Recommended action</small>
            <strong>{recommendedAction}</strong>
            <small>{recommendedReason}</small>
          </span>
          <StatusBadge tone={hasActions ? items[0]?.tone ?? 'warning' : 'info'}>
            {hasActions ? 'Review' : 'Next'}
          </StatusBadge>
        </AdminStageItemLink>
      </AdminStageList>
    </AdminSection>
  );
}

function DecisionFact({
  detail,
  label,
  value,
}: {
  readonly detail: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="booking-decision-fact">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function humanizeStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
