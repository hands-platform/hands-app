'use client';

import { useActionState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { beginAdminMfaEnrollment, verifyAdminMfaEnrollment } from './actions';
import { INITIAL_ADMIN_OPERATOR_ACTION_STATE } from './action-state';

export function AdminMfaEnrollmentForm({
  enrolledAt,
  recoveryCodesRemaining,
  state,
}: {
  readonly enrolledAt: string | null;
  readonly recoveryCodesRemaining: number;
  readonly state: string;
}) {
  const [beginState, beginAction, beginPending] = useActionState(
    beginAdminMfaEnrollment,
    INITIAL_ADMIN_OPERATOR_ACTION_STATE,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyAdminMfaEnrollment,
    INITIAL_ADMIN_OPERATOR_ACTION_STATE,
  );

  if (state === 'VERIFIED') {
    return (
      <AdminNoticeCard className="operator-access-mfa-notice" tone="success">
        <strong><ShieldCheck aria-hidden="true" size={18} /> MFA verified</strong>
        <p>Authenticator protection is active. {recoveryCodesRemaining} recovery code(s) remain.</p>
        <StatusBadge tone="success">Enrolled {enrolledAt ? new Date(enrolledAt).toLocaleDateString('en-GB') : ''}</StatusBadge>
      </AdminNoticeCard>
    );
  }

  return (
    <AdminNoticeCard className="operator-access-mfa-notice" tone="warning">
      <strong><KeyRound aria-hidden="true" size={18} /> Complete MFA enrollment</strong>
      <p>Master Admin and Finance actions stay blocked until an authenticator code is verified.</p>
      <form action={beginAction} className="operator-access-reauth-form">
        <AdminFormInput
          ariaInvalid={Boolean(beginState.fieldErrors?.password)}
          autoComplete="current-password"
          label="Current password"
          name="password"
          required
          type="password"
        />
        <AdminFormControlButton className="button-secondary" disabled={beginPending} type="submit">
          {beginPending ? 'Preparing…' : state === 'CONFIGURING' ? 'Restart enrollment' : 'Start enrollment'}
        </AdminFormControlButton>
      </form>
      {beginState.error ? <AdminInlineNotice role="alert" tone="danger">{beginState.error}</AdminInlineNotice> : null}
      {beginState.receipt?.mfaSecret ? (
        <div className="operator-mfa-enrollment-secret" role="status">
          <p><strong>Authenticator secret</strong></p>
          <code>{beginState.receipt.mfaSecret}</code>
          <a href={beginState.receipt.otpAuthUri}>Open authenticator setup URI</a>
          <p><strong>One-time recovery codes</strong></p>
          <div className="operator-mfa-recovery-codes">
            {beginState.receipt.recoveryCodes?.map((code) => <code key={code}>{code}</code>)}
          </div>
          <AdminInlineNotice role="note" tone="warning">
            Save these codes now. They are not shown again.
          </AdminInlineNotice>
        </div>
      ) : null}
      <form action={verifyAction} className="operator-access-reauth-form">
        <AdminFormInput
          ariaInvalid={Boolean(verifyState.fieldErrors?.code)}
          autoComplete="one-time-code"
          inputMode="numeric"
          label="Current authenticator code"
          maxLength={6}
          name="code"
          pattern="[0-9]{6}"
          required
        />
        <AdminFormControlButton className="button-primary" disabled={verifyPending} type="submit">
          {verifyPending ? 'Verifying…' : 'Verify MFA'}
        </AdminFormControlButton>
      </form>
      {verifyState.error ? <AdminInlineNotice role="alert" tone="danger">{verifyState.error}</AdminInlineNotice> : null}
      {verifyState.receipt ? <AdminInlineNotice role="status" tone="success">{verifyState.receipt.message}</AdminInlineNotice> : null}
    </AdminNoticeCard>
  );
}
