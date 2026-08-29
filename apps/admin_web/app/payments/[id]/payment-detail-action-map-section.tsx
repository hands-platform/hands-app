import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDetails } from '../../../components/admin-details';
import { AdminStageItem, AdminStageList } from '../../../components/admin-stage-item';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, type StatusBadgeTone } from '../../../components/status-badge';
import type { AdminPaymentActionDecision, AdminPaymentEvidenceSummary } from '../../../lib/admin-api';

type PaymentDetailActionMapSectionProps = {
  readonly activeRefund?: {
    readonly href: string;
    readonly id: string;
    readonly status: string;
  } | null;
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly bookingStatus: string;
  readonly cashDebtSettlementForm: ReactNode;
  readonly confirmation: ReactNode;
  readonly decisions: readonly AdminPaymentActionDecision[];
  readonly evidence?: AdminPaymentEvidenceSummary;
  readonly evaluatedAt?: string | null;
  readonly paymentStatus: string;
};

export function PaymentDetailActionMapSection({
  activeRefund,
  actionLabel,
  actions,
  bookingStatus,
  cashDebtSettlementForm,
  confirmation,
  decisions,
  evidence,
  evaluatedAt,
  paymentStatus,
}: PaymentDetailActionMapSectionProps) {
  const recommended = decisions.find((decision) => decision.recommended && decision.state !== 'BLOCKED') ??
    decisions.find((decision) => decision.state === 'REVIEW_REQUIRED') ?? null;
  const evidenceTone = paymentEvidenceTone(evidence?.state);
  const decisionTone = activeRefund
    ? 'warning'
    : recommended
      ? paymentDecisionTone(recommended)
      : evidence?.state === 'CONFLICT' ? 'danger' : 'neutral';
  const resultLabel = activeRefund
    ? activeRefund.status === 'REQUESTED' ? 'Refund review pending' : 'Refund in progress'
    : recommended
      ? paymentActionLabel(recommended.action)
      : evidence?.state === 'CONFLICT'
        ? 'Evidence conflict'
        : 'No executable action';

  return (
    <AdminTablePanel
      className="payment-decision-panel"
      description="Server-owned policy decision for the current payment, booking, and evidence state."
      id="payment-decision"
      resultLabel={resultLabel}
      resultTone={decisionTone}
      title="Payment decision"
    >
      {confirmation}
      <div className="payment-decision-strip" role="group" aria-label="Current payment decision">
        <div>
          <span>Next safe action</span>
          <StatusBadge tone={decisionTone}>{resultLabel}</StatusBadge>
          <small>
            {activeRefund
              ? <>Refund {activeRefund.id} is already {activeRefund.status.replaceAll('_', ' ').toLowerCase()}. Use the active refund action below.</>
              : recommended?.reason ?? 'Reload or review the payment record before attempting a money action.'}
          </small>
        </div>
        <div>
          <span>Current state</span>
          <strong>{paymentStatus.replaceAll('_', ' ')}</strong>
          <small>Booking: {bookingStatus.replaceAll('_', ' ')}</small>
        </div>
        <div>
          <span>Payment evidence</span>
          <StatusBadge tone={evidenceTone}>{evidence?.label ?? 'Unavailable'}</StatusBadge>
          <small>{evidence?.reason ?? 'No evidence summary was returned by the API.'}</small>
          <small>Evidence verified <DateTimeText fallback="Not recorded" value={evidence?.verifiedAt} /></small>
        </div>
        <div>
          <span>Policy check</span>
          <strong>{recommended?.policyVersion ?? decisions[0]?.policyVersion ?? 'Unavailable'}</strong>
          <small>Policy evaluated <DateTimeText fallback="Not recorded" value={evaluatedAt} /></small>
        </div>
      </div>

      <div className="actions admin-mt-16">
        <ActionMenu actions={actions} label={actionLabel} />
      </div>
      {cashDebtSettlementForm}

      <AdminDetails className="admin-mt-12">
        <summary><span>All action decisions</span><small>{decisions.length} policy checks</small></summary>
        <div className="admin-disclosure-content">
          <AdminStageList>
            {decisions.map((decision) => (
              <AdminStageItem key={decision.action}>
                <StatusBadge tone={paymentDecisionTone(decision)}>{decision.state.replaceAll('_', ' ')}</StatusBadge>
                <div>
                  <strong>{paymentActionLabel(decision.action)}</strong>
                  <p className="muted">{decision.reason}</p>
                  <small>
                    {decision.requiredEvidence.length
                      ? `Required evidence: ${decision.requiredEvidence.join(', ')}`
                      : 'No additional evidence declared.'}
                  </small>
                </div>
              </AdminStageItem>
            ))}
            {decisions.length === 0 ? (
              <AdminStageItem>
                <StatusBadge tone="warning">Unavailable</StatusBadge>
                <div>
                  <strong>No action decision returned</strong>
                  <p className="muted">Do not execute a payment action until this record is reloaded successfully.</p>
                </div>
              </AdminStageItem>
            ) : null}
          </AdminStageList>
        </div>
      </AdminDetails>
    </AdminTablePanel>
  );
}

function paymentActionLabel(action: AdminPaymentActionDecision['action']) {
  if (action === 'CAPTURE') return 'Capture payment';
  if (action === 'RELEASE') return 'Release authorization';
  if (action === 'REQUEST_REFUND') return 'Request refund review';
  return 'Sync gateway status';
}

function paymentDecisionTone(decision: AdminPaymentActionDecision): StatusBadgeTone {
  if (decision.state === 'BLOCKED') return 'neutral';
  if (decision.action === 'REQUEST_REFUND' || decision.state === 'REVIEW_REQUIRED') return 'danger';
  if (decision.action === 'SYNC') return 'info';
  return 'warning';
}

function paymentEvidenceTone(state: AdminPaymentEvidenceSummary['state'] | undefined): StatusBadgeTone {
  if (state === 'VERIFIED') return 'success';
  if (state === 'CONFLICT') return 'danger';
  if (state === 'MISSING') return 'warning';
  return 'neutral';
}
