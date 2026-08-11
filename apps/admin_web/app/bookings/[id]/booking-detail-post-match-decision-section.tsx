'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminSummaryCardGrid } from '../../../components/admin-overview-card';
import { AdminCard, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import type {
  BookingOutcomeReviewPanel,
  BookingOutcomeReviewRow,
  BookingPostMatchDecisionAction,
} from './booking-outcome-review-panel';
import { resolvePostMatchCancellationFromDetail } from './actions';

const DECISION_REASON_OPTIONS = [
  { label: 'Choose a decision reason', value: '' },
  { label: 'Customer request confirmed', value: 'CUSTOMER_REQUESTED' },
  { label: 'Customer not found evidence confirmed', value: 'CUSTOMER_NOT_FOUND' },
  { label: 'Safety concern evidence confirmed', value: 'SAFETY_CONCERN' },
  { label: 'Service could not be provided', value: 'SERVICE_CANNOT_BE_PROVIDED' },
  { label: 'Other reviewed reason', value: 'OTHER' },
] as const;

type BookingDetailPostMatchDecisionSectionProps = {
  readonly bookingId: string;
  readonly outcomeReview: BookingOutcomeReviewPanel;
};

export function BookingDetailPostMatchDecisionSection({
  bookingId,
  outcomeReview,
}: BookingDetailPostMatchDecisionSectionProps) {
  const decision = outcomeReview.postMatchDecision;
  const context = outcomeReview.postMatchContext;
  const [state, formAction, pending] = useActionState(resolvePostMatchCancellationFromDetail, null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<BookingPostMatchDecisionAction | null>(null);
  const [clientError, setClientError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!state) return;
    dialogRef.current?.close();
    statusRef.current?.focus();
  }, [state]);

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
      description={decision.canResolve
        ? 'Review retained chat, closeout evidence, and operator notes before choosing the final customer money and Partner fee outcome.'
        : 'Read-only cancellation outcome, original cancellation facts, and the recorded Admin decision.'}
      id="booking-post-match-cancellation-decision"
      title={decision.canResolve ? 'Post-match cancellation processing' : 'Post-match cancellation result'}
    >
      {context ? (
        <div className="booking-post-match-detail-flow admin-mt-12">
          <PostMatchDecisionGroup
            ariaLabel="Post-match cancellation summary"
            eyebrow="1. Why cancelled"
            rows={[...(context.summary ?? []), context.reason]}
          />
          <PostMatchDecisionGroup
            ariaLabel="Post-match cancellation evidence checklist"
            eyebrow="2. Evidence available"
            rows={context.evidence}
          />
          <PostMatchDecisionGroup
            ariaLabel="Post-match cancellation money outcome"
            eyebrow="3. Current money state"
            rows={context.money}
          />
        </div>
      ) : (
        <PostMatchDecisionGroup
          ariaLabel="Post-match cancellation evidence checklist"
          eyebrow="Evidence available"
          rows={outcomeReview.rows}
        />
      )}

      <AdminCard className="booking-outcome-decision-panel">
        <div className="booking-outcome-decision-main">
          <span className="booking-post-match-decision-eyebrow">4. Resolve review</span>
          <div className="booking-outcome-decision-copy">
            <StatusBadgeFromPillClass pillClass={decision.sourceTone ?? 'pill-neutral'}>
              {decision.sourceLabel ?? 'Decision source unavailable'}
            </StatusBadgeFromPillClass>
            <StatusBadgeFromPillClass pillClass={decision.resolutionTone}>
              {decision.resolutionLabel}
            </StatusBadgeFromPillClass>
            <StatusBadgeFromPillClass pillClass={decision.feeTone}>
              {decision.feeLabel}
            </StatusBadgeFromPillClass>
            {decision.canResolve ? (
              <StatusBadgeFromPillClass pillClass={decision.slaTone ?? 'pill-neutral'}>
                {decision.slaLabel ?? 'SLA unavailable'}
              </StatusBadgeFromPillClass>
            ) : null}
          </div>
          <p className="muted">
            This booking is already cancelled. The final action closes the customer payment outcome and, when
            a fee record exists, also decides the Partner fee.
          </p>
        </div>
        {decision.canResolve ? (
          <AdminFormShell
            action={formAction}
            aria-busy={pending}
            className="booking-post-match-decision-form"
            id={`post-match-decision-form-${bookingId}`}
            onSubmit={(event) => {
              if (!selectedAction || !dialogRef.current?.open) event.preventDefault();
            }}
          >
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="decision" value={selectedAction?.decision ?? ''} />
            <div className="booking-post-match-decision-fields">
              <AdminFormSelect
                disabled={pending}
                label="Decision reason"
                labelVisibility="visible"
                name="reason"
                onChange={(event) => {
                  setReason(event.target.value);
                  setClientError('');
                }}
                options={DECISION_REASON_OPTIONS}
                required
                value={reason}
              />
              <AdminFormTextarea
                disabled={pending}
                label={reason === 'OTHER' ? 'Operator note · required' : 'Operator note · optional'}
                labelVisibility="visible"
                maxLength={1000}
                name="note"
                onChange={(event) => {
                  setNote(event.target.value);
                  setClientError('');
                }}
                placeholder="Record the retained evidence used for this decision."
                required={reason === 'OTHER'}
                rows={3}
                value={note}
              />
            </div>
            <PostMatchDecisionChanges decision={decision} selectedAction={selectedAction} />
            <div className="booking-outcome-decision-actions">
              {decision.actions.map((action) => (
                <div key={action.decision}>
                  <AdminFormControlButton
                    className={`${action.tone === 'primary' ? 'button-primary' : 'button-secondary'} admin-inline-action`}
                    disabled={pending}
                    onClick={() => openDecisionDialog({ action, dialog: dialogRef.current, note, reason, setClientError, setSelectedAction })}
                    type="button"
                  >
                    {action.label}
                  </AdminFormControlButton>
                  <small>{action.helper}</small>
                </div>
              ))}
            </div>
            {pending ? <p aria-live="polite" className="muted" role="status">Saving decision…</p> : null}
            {clientError || state ? (
              <p
                aria-live="assertive"
                className={clientError || state?.status === 'error' ? 'text-danger' : 'text-success'}
                ref={statusRef}
                role={clientError || state?.status === 'error' ? 'alert' : 'status'}
                tabIndex={-1}
              >
                {clientError || state?.message}
              </p>
            ) : null}
            <dialog
              aria-labelledby="booking-post-match-decision-dialog-title"
              className="booking-post-match-decision-dialog"
              ref={dialogRef}
            >
              <div className="booking-post-match-decision-dialog-copy">
                <span className="booking-post-match-decision-eyebrow">Confirm money outcome</span>
                <h3 id="booking-post-match-decision-dialog-title">
                  {selectedAction?.label ?? 'Confirm cancellation decision'}
                </h3>
                <p><strong>Reason</strong><span>{DECISION_REASON_OPTIONS.find((option) => option.value === reason)?.label}</span></p>
                <p><strong>Customer money</strong><span>{decision.customerMoneyBefore} → {decision.customerMoneyAfter}</span></p>
                <p><strong>Partner fee</strong><span>{decision.partnerFeeBefore} → {selectedAction?.decision === 'hold' ? decision.partnerFeeHoldAfter : decision.partnerFeeApproveAfter}</span></p>
                <p><strong>Review status</strong><span>{decision.reviewBefore} → {decision.reviewAfter}</span></p>
              </div>
              <div className="booking-post-match-decision-dialog-actions">
                <AdminFormControlButton
                  className="button-secondary"
                  disabled={pending}
                  onClick={() => dialogRef.current?.close()}
                  type="button"
                >
                  Go back
                </AdminFormControlButton>
                <AdminFormControlButton className="button-primary" disabled={pending} type="submit">
                  {pending ? 'Saving decision…' : 'Confirm and resolve'}
                </AdminFormControlButton>
              </div>
            </dialog>
          </AdminFormShell>
        ) : decision.blockedReason ? (
          <p className="admin-inline-notice is-danger" role="alert">
            <strong>Cannot resolve safely.</strong> {decision.blockedReason}
          </p>
        ) : (
          <span className="muted">
            This cancellation decision is already closed.
            {decision.decisionAt ? <> Decision recorded <DateTimeText value={decision.decisionAt} />.</> : ' Admin decision time is unavailable.'}
            {' '}{decision.sourceLabel ?? 'Decision source unavailable'}
            {decision.decidedBy ? ` by ${decision.decidedBy}` : ''}.
            {' '}Reason: {decision.decisionReasonLabel ?? 'not recorded'}.
            {decision.operatorNote ? ` Note: ${decision.operatorNote}` : ''}
            {' '}Partner fee outcome: {decision.feeLabel} ({decision.feeAmountLabel ?? 'Amount unavailable'}).
          </span>
        )}
      </AdminCard>
    </AdminSection>
  );
}

function PostMatchDecisionChanges({
  decision,
  selectedAction,
}: {
  readonly decision: BookingOutcomeReviewPanel['postMatchDecision'];
  readonly selectedAction: BookingPostMatchDecisionAction | null;
}) {
  const outcomeChosen = selectedAction !== null;
  const partnerFeeAfter = !outcomeChosen
    ? 'Choose an outcome'
    : selectedAction.decision === 'hold'
      ? decision.partnerFeeHoldAfter
      : decision.partnerFeeApproveAfter;
  return (
    <section aria-label="Decision result preview" className="booking-post-match-decision-changes">
      <strong>This action will change</strong>
      <dl>
        <div><dt>Customer money</dt><dd>{decision.customerMoneyBefore} → {outcomeChosen ? decision.customerMoneyAfter : 'Choose an outcome'}</dd></div>
        <div><dt>Partner fee</dt><dd>{decision.partnerFeeBefore} → {partnerFeeAfter}</dd></div>
        <div><dt>Review status</dt><dd>{decision.reviewBefore} → {outcomeChosen ? decision.reviewAfter : 'Choose an outcome'}</dd></div>
      </dl>
    </section>
  );
}

function openDecisionDialog({
  action,
  dialog,
  note,
  reason,
  setClientError,
  setSelectedAction,
}: {
  readonly action: BookingPostMatchDecisionAction;
  readonly dialog: HTMLDialogElement | null;
  readonly note: string;
  readonly reason: string;
  readonly setClientError: (message: string) => void;
  readonly setSelectedAction: (action: BookingPostMatchDecisionAction) => void;
}) {
  if (!reason) {
    setClientError('Choose a decision reason before continuing.');
    return;
  }
  if (reason === 'OTHER' && !note.trim()) {
    setClientError('Add an operator note when Other is selected.');
    return;
  }
  setClientError('');
  setSelectedAction(action);
  window.requestAnimationFrame(() => dialog?.showModal());
}

function PostMatchDecisionGroup({
  ariaLabel,
  eyebrow,
  rows,
}: {
  readonly ariaLabel: string;
  readonly eyebrow: string;
  readonly rows: readonly BookingOutcomeReviewRow[];
}) {
  return (
    <section className="booking-post-match-detail-group">
      <strong className="booking-post-match-decision-eyebrow">{eyebrow}</strong>
      <AdminSummaryCardGrid
        ariaLabel={ariaLabel}
        className={`booking-post-match-detail-evidence-grid is-${rows.length === 1 ? 'single' : 'pair'}`}
        itemClassName="booking-post-match-detail-evidence-card"
        items={rows.map((row) => ({
          detail: row.helper,
          href: row.href,
          key: row.label,
          label: <StatusBadgeFromPillClass pillClass={row.tone}>{row.label}</StatusBadgeFromPillClass>,
          value: bookingOutcomeReviewRowValue(row),
        }))}
      />
    </section>
  );
}

function bookingOutcomeReviewRowValue(row: BookingOutcomeReviewRow) {
  return row.dateTimeValue ? <DateTimeText fallback={row.value} value={row.dateTimeValue} /> : row.value;
}
