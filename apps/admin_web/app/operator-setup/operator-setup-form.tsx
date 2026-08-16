'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useSyncExternalStore } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { acceptOperatorInvitation, INITIAL_OPERATOR_SETUP_STATE } from './actions';

export function OperatorSetupForm() {
  const token = useSyncExternalStore(subscribeToHash, readHashToken, () => '');
  const [state, action, pending] = useActionState(acceptOperatorInvitation, INITIAL_OPERATOR_SETUP_STATE);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
  }, [state.status]);

  if (state.status === 'success') {
    return (
      <div className="operator-setup-complete" ref={resultRef} tabIndex={-1}>
        <CheckCircle2 aria-hidden="true" size={34} />
        <div>
          <h1>Operator access is ready</h1>
          <p className="muted">Your one-time setup link has been consumed. Sign in with your admin email and new password.</p>
        </div>
        <Link className="button-primary" href="/login" prefetch={false}>Continue to sign in</Link>
      </div>
    );
  }

  return (
    <AdminFormShell action={action} className="admin-auth-form operator-setup-form">
      <input name="token" type="hidden" value={token} />
      {state.status === 'error' ? (
        <div ref={resultRef} tabIndex={-1}>
          <AdminInlineNotice role="alert" tone="danger">{state.error}</AdminInlineNotice>
        </div>
      ) : null}
      {!token ? (
        <AdminInlineNotice role="alert" tone="warning">
          Open the complete one-time link supplied by a Master Admin.
        </AdminInlineNotice>
      ) : null}
      <AdminFormInput
        ariaInvalid={Boolean(state.fieldErrors?.password)}
        autoComplete="new-password"
        className="admin-form-control-fluid"
        label="Create password"
        maxLength={256}
        minLength={12}
        name="password"
        required
        type="password"
      />
      <AdminFormInput
        ariaInvalid={Boolean(state.fieldErrors?.passwordConfirmation)}
        autoComplete="new-password"
        className="admin-form-control-fluid"
        label="Confirm password"
        maxLength={256}
        minLength={12}
        name="passwordConfirmation"
        required
        type="password"
      />
      <p className="operator-setup-guidance"><ShieldCheck aria-hidden="true" size={16} /> Use at least 12 characters. This link works once and expires automatically.</p>
      <AdminFormControlButton className="button-primary admin-auth-submit" disabled={pending || !token} type="submit">
        {pending ? 'Creating access…' : 'Create operator access'}
      </AdminFormControlButton>
    </AdminFormShell>
  );
}

function readHashToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
}

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}
