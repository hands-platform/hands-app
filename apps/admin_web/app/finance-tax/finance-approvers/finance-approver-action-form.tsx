'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  AdminDrawerActionFooter,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminReauthenticateOperatorForm } from '../../../components/admin-reauthenticate-operator-form';
import type { FinanceApproverActionState } from './actions';
import {
  FINANCE_APPROVER_FORM_SUCCESS_EVENT,
  FINANCE_APPROVER_REQUEST_CLOSE_EVENT,
} from './finance-approver-drawer-shell';

const INITIAL_FINANCE_APPROVER_ACTION_STATE: FinanceApproverActionState = {
  status: 'idle',
};

type FinanceApproverActionFormProps = {
  readonly action: (
    previousState: FinanceApproverActionState,
    formData: FormData,
  ) => Promise<FinanceApproverActionState>;
  readonly approveDisabled?: boolean;
  readonly cancelHref: string;
  readonly children: ReactNode;
  readonly mode: 'decision' | 'request';
  readonly operatorName: string;
};

export function FinanceApproverActionForm({
  action,
  approveDisabled = false,
  cancelHref,
  children,
  mode,
  operatorName,
}: FinanceApproverActionFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FINANCE_APPROVER_ACTION_STATE);
  const [reason, setReason] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const reasonField = mode === 'request' ? 'operatorReason' : 'decisionReason';
  const reasonError = state.fieldErrors?.[reasonField];
  const helpId = `finance-approver-${mode}-reason-help`;

  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
    if (state.status === 'success') {
      window.dispatchEvent(new Event(FINANCE_APPROVER_FORM_SUCCESS_EVENT));
    }
  }, [state.status]);

  if (state.status === 'success' && state.receipt) {
    return <FinanceApproverReceipt cancelHref={cancelHref} receipt={state.receipt} resultRef={resultRef} />;
  }

  return (
    <>
      {state.reauthRequired ? <AdminReauthenticateOperatorForm /> : null}
      <form action={formAction} className="finance-approver-action-form">
      {state.status === 'error' ? (
        <div ref={resultRef} tabIndex={-1}>
          <AdminInlineNotice role="alert" tone="danger">
            <strong>Access action not completed</strong>
            <span>{state.error}</span>
          </AdminInlineNotice>
        </div>
      ) : null}
      <fieldset disabled={pending}>
        {children}
        <div className="finance-approver-reason-field">
          <AdminFormTextarea
            ariaDescribedBy={helpId}
            ariaInvalid={Boolean(reasonError)}
            label={`${mode === 'request' ? 'Reason for changing' : 'Decision evidence for'} ${operatorName}'s access`}
            labelVisibility="visible"
            maxLength={500}
            minLength={12}
            name={reasonField}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              mode === 'request'
                ? 'Explain the operating need, ownership, and expected duration.'
                : 'State the evidence reviewed and why this decision is safe.'
            }
            required
            rows={5}
            value={reason}
          />
          <div className="finance-approver-reason-help" id={helpId}>
            <span className={reasonError ? 'text-danger' : 'muted'}>
              {reasonError ?? 'Use 12–500 characters. Whitespace is normalized by the API.'}
            </span>
            <span aria-live="polite" className="muted">{reason.length}/500</span>
          </div>
        </div>
      </fieldset>
      {pending ? <p aria-live="polite" className="muted">Saving the controlled access action…</p> : null}
      <AdminDrawerActionFooter className="finance-approver-drawer-footer">
        <AdminFormControlButton
          className="button-secondary"
          onClick={() => window.dispatchEvent(new Event(FINANCE_APPROVER_REQUEST_CLOSE_EVENT))}
          type="button"
        >
          Cancel
        </AdminFormControlButton>
        {mode === 'request' ? (
          <AdminFormControlButton className="button-primary" disabled={pending} type="submit">
            Submit access request
          </AdminFormControlButton>
        ) : (
          <>
            <AdminFormControlButton
              className="button-outline"
              disabled={pending}
              name="decision"
              type="submit"
              value="REJECT"
            >
              Reject and close request
            </AdminFormControlButton>
            <AdminFormControlButton
              className="button-primary"
              disabled={pending || approveDisabled}
              name="decision"
              type="submit"
              value="APPROVE"
            >
              Approve and execute
            </AdminFormControlButton>
          </>
        )}
      </AdminDrawerActionFooter>
      </form>
    </>
  );
}

function FinanceApproverReceipt({
  cancelHref,
  receipt,
  resultRef,
}: {
  readonly cancelHref: string;
  readonly receipt: NonNullable<FinanceApproverActionState['receipt']>;
  readonly resultRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isPending = receipt.status === 'PENDING';
  return (
    <div className="finance-approver-receipt" ref={resultRef} tabIndex={-1}>
      <AdminInlineNotice role="status" tone={receipt.status === 'REJECTED' ? 'warning' : 'success'}>
        <strong>{isPending ? 'Access request submitted' : `Access request ${receipt.status.toLowerCase()}`}</strong>
        <span>
          {isPending
            ? 'A different verified role governor must decide this request before any role changes.'
            : receipt.status === 'APPROVED'
              ? 'The independent decision and role execution were saved together.'
              : 'The request was rejected and the operator role did not change.'}
        </span>
      </AdminInlineNotice>
      <dl className="finance-approver-receipt-grid">
        <div><dt>Request ID</dt><dd>{receipt.requestId}</dd></div>
        <div><dt>Target</dt><dd>{identityLabel(receipt.target)}</dd></div>
        <div><dt>Before</dt><dd>{receipt.previousEnabled ? 'Finance approver' : 'No independent approval authority'}</dd></div>
        <div><dt>After</dt><dd>{receipt.requestedEnabled ? 'Finance approver' : 'No independent approval authority'}</dd></div>
        <div><dt>Requester</dt><dd>{identityLabel(receipt.requester)}</dd></div>
        <div><dt>Decision maker</dt><dd>{receipt.decisionMaker ? identityLabel(receipt.decisionMaker) : 'Awaiting independent review'}</dd></div>
        <div><dt>Requested</dt><dd>{formatVietnamDateTime(receipt.requestedAt)}</dd></div>
        <div><dt>Executed</dt><dd>{receipt.executedAt ? formatVietnamDateTime(receipt.executedAt) : 'Not executed'}</dd></div>
      </dl>
      <div className="actions">
        {isPending ? (
          <AdminFormControlLink className="button-primary" href="/finance-tax/finance-approvers?view=pending">
            Open pending requests
          </AdminFormControlLink>
        ) : null}
        <AdminFormControlLink className={isPending ? 'button-secondary' : 'button-primary'} href={receipt.auditHref}>
          View exact role audit
        </AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href={cancelHref}>
          Return to access list
        </AdminFormControlLink>
      </div>
    </div>
  );
}

function identityLabel(identity: { email: string | null; fullName: string | null; id: string }) {
  return identity.fullName || identity.email || identity.id;
}

function formatVietnamDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
