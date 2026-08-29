'use client';

import { Check, KeyRound, XCircle } from 'lucide-react';
import { useActionState, useEffect, useRef } from 'react';

import { reauthenticateAdminOperator } from '../app/admin-operators/actions';
import { INITIAL_ADMIN_OPERATOR_ACTION_STATE } from '../app/admin-operators/action-state';
import { AdminFormControlButton, AdminFormInput } from './admin-form-light-controls';
import { AdminInlineNotice } from './admin-inline-notice';

export function AdminReauthenticateOperatorForm({ onSuccess }: { readonly onSuccess?: () => void } = {}) {
  const [state, action, pending] = useActionState(reauthenticateAdminOperator, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'success') onSuccess?.();
  }, [onSuccess, state.status]);

  return (
    <form action={action} className="operator-access-reauth-form">
      <div>
        <strong><KeyRound aria-hidden="true" size={16} /> Confirm high-risk action</strong>
        <p className="muted">Password confirmation unlocks high-risk Admin actions for 10 minutes.</p>
      </div>
      <AdminFormInput
        aria-invalid={Boolean(state.fieldErrors?.password)}
        autoComplete="current-password"
        label="Current password"
        name="password"
        required
        type="password"
      />
      <AdminFormInput
        autoComplete="one-time-code"
        inputMode="numeric"
        label="Authenticator or recovery code"
        maxLength={32}
        name="mfaCode"
        placeholder="Required when MFA is enrolled"
      />
      <AdminFormControlButton className="button-secondary" disabled={pending} type="submit">
        {pending ? 'Confirming…' : 'Confirm password'}
      </AdminFormControlButton>
      {state.status === 'idle' ? null : (
        <div className="operator-access-inline-result" ref={resultRef} tabIndex={-1}>
          <AdminInlineNotice role={state.status === 'error' ? 'alert' : 'status'} tone={state.status === 'error' ? 'danger' : 'success'}>
            {state.status === 'error' ? <XCircle aria-hidden="true" size={16} /> : <Check aria-hidden="true" size={16} />}
            <span>{state.status === 'error' ? state.error : state.receipt?.message}</span>
            {state.receipt?.auditId ? <small>Audit ID: {state.receipt.auditId}</small> : null}
          </AdminInlineNotice>
        </div>
      )}
    </form>
  );
}
