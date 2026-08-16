'use client';

import { type ChangeEventHandler, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, KeyRound, PauseCircle, PlayCircle, ShieldCheck, XCircle } from 'lucide-react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import {
  MASTER_ADMIN_ROLE,
  adminOperatorPermissionCategoryDefinitions,
  isHighRiskAdminOperatorPermission,
} from '../../lib/admin-operator-permissions';
import {
  inviteAdminOperator,
  initializeAdminOperatorPermission,
  manageAdminOperatorInvitation,
  offboardAdminOperator,
  reauthenticateAdminOperator,
  resetAdminMfa,
  revokeAdminOperatorSession,
  setAdminOperatorStatus,
  updateAdminOperatorAccess,
} from './actions';
import {
  INITIAL_ADMIN_OPERATOR_ACTION_STATE,
  type AdminOperatorActionState,
} from './action-state';

type OperatorAccessFormProps = {
  readonly activeSessionCount: number;
  readonly categories: readonly string[];
  readonly expectedVersion: number;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly roles: readonly string[];
};

export function InitializeOperatorPermissionForm({
  activeSessionCount,
  operatorId,
  operatorName,
}: {
  readonly activeSessionCount: number;
  readonly operatorId: string;
  readonly operatorName: string;
}) {
  const [state, action, pending] = useActionState(
    initializeAdminOperatorPermission,
    INITIAL_ADMIN_OPERATOR_ACTION_STATE,
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const highRiskCount = selectedCategories.filter((category) =>
    isHighRiskAdminOperatorPermission(category as never),
  ).length;
  return (
    <form action={action} className="operator-access-action-form">
      <ActionResult state={state} />
      <input name="userId" type="hidden" value={operatorId} />
      <fieldset disabled={pending}>
        <AdminInlineNotice role="note" tone="warning">
          <span>
            <strong>No permission policy is saved.</strong> Access remains blocked until an explicit leaf-only policy is initialized.
          </span>
        </AdminInlineNotice>
        <div className="operator-access-diff-strip" role="note">
          <span><strong>{selectedCategories.length}</strong> effective permissions selected</span>
          <span><strong>{highRiskCount}</strong> high-risk permissions</span>
          <span><strong>{activeSessionCount}</strong> active sessions remain active</span>
        </div>
        <PermissionGroups
          defaults={[]}
          onToggle={(category, checked) => setSelectedCategories((current) =>
            checked ? [...new Set([...current, category])] : current.filter((value) => value !== category))}
          selected={selectedCategories}
        />
        <ReasonField error={state.fieldErrors?.reason} label={`Reason for initializing ${operatorName}'s permission policy`} />
        <AdminFormCheckbox label="Confirm explicit permission policy" name="confirmation" required value="confirmed">
          <span>I reviewed the selected permissions. An empty selection intentionally blocks all non-role access.</span>
        </AdminFormCheckbox>
      </fieldset>
      <AdminFormControlButton className="button-primary" disabled={pending} type="submit">
        {pending ? 'Initializing policy…' : 'Initialize permission policy'}
      </AdminFormControlButton>
    </form>
  );
}

export function InviteOperatorForm() {
  const [state, action, pending] = useActionState(inviteAdminOperator, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <form action={action} className="operator-access-action-form">
      <ActionResult state={state} />
      <fieldset disabled={pending}>
        <div className="operator-access-field-grid">
          <AdminFormInput
            ariaInvalid={Boolean(state.fieldErrors?.email)}
            autoComplete="email"
            label="Admin email"
            maxLength={160}
            name="email"
            placeholder="operator@hands.vn"
            required
            type="email"
          />
          <AdminFormInput label="Operator name" maxLength={120} name="fullName" placeholder="Full name" />
          <AdminFormInput defaultValue="72" label="Invite expiry (hours)" max={168} min={1} name="expiresInHours" type="number" />
        </div>
        <AdminFormCheckbox label="Grant Master Admin" name="masterAdminEnabled" value="true">
          <span>Grant Master Admin after invitation acceptance</span>
        </AdminFormCheckbox>
        <PermissionGroups defaults={[]} />
        <ReasonField error={state.fieldErrors?.reason} label="Reason for access" />
      </fieldset>
      <AdminInlineNotice role="note" tone="info">
        <span>This flow creates a new operator invitation. Granting access to an existing user requires a server-verified user picker and is not available in this build.</span>
      </AdminInlineNotice>
      <AdminFormControlButton className="button-primary" disabled={pending} type="submit">
        {pending ? 'Creating invitation…' : 'Create one-time invitation'}
      </AdminFormControlButton>
    </form>
  );
}

export function ReauthenticateOperatorForm() {
  const [state, action, pending] = useActionState(reauthenticateAdminOperator, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <form action={action} className="operator-access-reauth-form">
      <div>
        <strong><KeyRound aria-hidden="true" size={16} /> Confirm high-risk changes</strong>
        <p className="muted">Password confirmation unlocks operator access changes for 10 minutes.</p>
      </div>
      <AdminFormInput
        ariaInvalid={Boolean(state.fieldErrors?.password)}
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
      <ActionResult compact state={state} />
    </form>
  );
}

export function ResetAdminMfaForm({ operatorId, operatorName }: {
  readonly operatorId: string;
  readonly operatorName: string;
}) {
  const [state, action, pending] = useActionState(resetAdminMfa, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <form action={action} className="operator-access-action-form">
      <ActionResult state={state} />
      <input name="userId" type="hidden" value={operatorId} />
      <AdminInlineNotice role="note" tone="warning">
        Resetting MFA signs {operatorName} out of every Admin session. Another Master Admin must perform this recovery.
      </AdminInlineNotice>
      <ReasonField error={state.fieldErrors?.reason} label={`Reason for resetting ${operatorName}'s MFA`} />
      <AdminFormControlButton className="button-danger" disabled={pending} type="submit">
        {pending ? 'Resetting…' : 'Reset MFA and revoke sessions'}
      </AdminFormControlButton>
    </form>
  );
}

export function OperatorAccessForm({
  activeSessionCount,
  categories,
  expectedVersion,
  operatorId,
  operatorName,
  roles,
}: OperatorAccessFormProps) {
  const [state, action, pending] = useActionState(updateAdminOperatorAccess, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(categories));
  const [masterAdminEnabled, setMasterAdminEnabled] = useState(roles.includes(MASTER_ADMIN_ROLE));
  const [reason, setReason] = useState('');
  const reviewDialogRef = useRef<HTMLDialogElement>(null);
  const reviewTriggerRef = useRef<HTMLSpanElement>(null);
  const focusReviewTrigger = () => reviewTriggerRef.current?.querySelector('button')?.focus();
  const changePreview = useMemo(() => ({
    added: [...selectedCategories].filter((category) => !categories.includes(category)),
    removed: categories.filter((category) => !selectedCategories.has(category)),
    roleChanged: masterAdminEnabled !== roles.includes(MASTER_ADMIN_ROLE),
  }), [categories, masterAdminEnabled, roles, selectedCategories]);
  const highRiskCount = [...selectedCategories].filter((category) => isHighRiskAdminOperatorPermission(category as never)).length;
  useEffect(() => {
    if (state.status === 'success') {
      reviewDialogRef.current?.close();
      focusReviewTrigger();
    }
  }, [state.status]);
  return (
    <form action={action} className="operator-access-action-form">
      <ActionResult state={state} />
      <input name="userId" type="hidden" value={operatorId} />
      <input name="expectedVersion" type="hidden" value={expectedVersion} />
      <fieldset disabled={pending}>
        <div className="operator-access-diff-strip" role="note">
          <span><strong>{categories.length}</strong> direct permissions</span>
          <span><strong>{highRiskCount}</strong> high-risk permissions</span>
          <span><strong>v{expectedVersion}</strong> concurrency version</span>
        </div>
        <AdminFormCheckbox
          checked={masterAdminEnabled}
          label="Master Admin role"
          name="masterAdminEnabled"
          onChange={(event) => setMasterAdminEnabled(event.currentTarget.checked)}
          value="true"
        >
          <span>All access through Master Admin role</span>
        </AdminFormCheckbox>
        <PermissionGroups
          defaults={categories}
          onToggle={(category, checked) => setSelectedCategories((current) => {
            const next = new Set(current);
            if (checked) next.add(category);
            else next.delete(category);
            return next;
          })}
          selected={[...selectedCategories]}
        />
        <div aria-live="polite" className="operator-access-change-preview">
          <strong>Change preview</strong>
          <span>Added: {changePreview.added.length ? changePreview.added.join(', ') : 'None'}</span>
          <span>Removed: {changePreview.removed.length ? changePreview.removed.join(', ') : 'None'}</span>
          <span>Role change: {changePreview.roleChanged ? (masterAdminEnabled ? 'Grant Master Admin' : 'Remove Master Admin') : 'None'}</span>
          <span>Session impact: {activeSessionCount} active session(s) remain active after a permission update.</span>
        </div>
        <ReasonField
          error={state.fieldErrors?.reason}
          label={`Reason for changing ${operatorName}'s access`}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
      </fieldset>
      <span className="admin-form-control-trigger" ref={reviewTriggerRef}>
        <AdminFormControlButton className="button-primary" disabled={pending} onClick={() => reviewDialogRef.current?.showModal()} type="button">
          Review access change
        </AdminFormControlButton>
      </span>
      <dialog
        aria-labelledby="operator-access-review-title"
        className="operator-access-review-dialog"
        onClose={focusReviewTrigger}
        ref={reviewDialogRef}
      >
          <div>
            <strong id="operator-access-review-title">Confirm access change for {operatorName}</strong>
            <AdminFormControlButton aria-label="Close access review" className="icon-button" onClick={() => {
              reviewDialogRef.current?.close();
            }} type="button">×</AdminFormControlButton>
          </div>
          <dl>
            <div><dt>Master Admin</dt><dd>{roles.includes(MASTER_ADMIN_ROLE) ? 'Enabled' : 'Disabled'} → {masterAdminEnabled ? 'Enabled' : 'Disabled'}</dd></div>
            <div><dt>Permissions added</dt><dd>{changePreview.added.length ? changePreview.added.join(', ') : 'None'}</dd></div>
            <div><dt>Permissions removed</dt><dd>{changePreview.removed.length ? changePreview.removed.join(', ') : 'None'}</dd></div>
            <div><dt>High-risk permissions</dt><dd>{highRiskCount}</dd></div>
            <div><dt>Session impact</dt><dd>{activeSessionCount} active session(s) remain active</dd></div>
            <div><dt>Reason</dt><dd>{reason.trim() || 'Enter a reason before confirming.'}</dd></div>
          </dl>
          <div className="operator-access-review-actions">
            <AdminFormControlButton className="button-secondary" onClick={() => {
              reviewDialogRef.current?.close();
            }} type="button">Cancel</AdminFormControlButton>
            <AdminFormControlButton className="button-primary" disabled={pending || reason.trim().length < 12} type="submit">
              {pending ? 'Saving access…' : 'Confirm save access'}
            </AdminFormControlButton>
          </div>
      </dialog>
    </form>
  );
}

export function InvitationActionForm({
  invitationId,
  mode,
  operatorName,
}: {
  readonly invitationId: string;
  readonly mode: 'resend' | 'revoke';
  readonly operatorName: string;
}) {
  const [state, action, pending] = useActionState(
    manageAdminOperatorInvitation,
    INITIAL_ADMIN_OPERATOR_ACTION_STATE,
  );
  return (
    <details className="operator-access-invitation-action">
      <summary>{mode === 'revoke' ? 'Revoke invitation' : 'Resend invitation'}</summary>
      <form action={action} className="operator-access-action-form">
        <ActionResult state={state} />
        <input name="invitationId" type="hidden" value={invitationId} />
        <input name="mode" type="hidden" value={mode} />
        {mode === 'resend' ? (
          <AdminFormInput defaultValue="72" label="Replacement expiry (hours)" max={168} min={1} name="expiresInHours" type="number" />
        ) : null}
        <ReasonField error={state.fieldErrors?.reason} label={`${mode === 'revoke' ? 'Reason for revoking' : 'Reason for resending'} ${operatorName}'s invitation`} />
        <AdminFormCheckbox label={`Confirm ${mode}`} name="confirmation" required value="confirmed">
          <span>{mode === 'revoke'
            ? 'The current setup link will stop working immediately.'
            : 'The current setup link will be invalidated and a replacement token will be shown once.'}</span>
        </AdminFormCheckbox>
        <AdminFormControlButton className={mode === 'revoke' ? 'button-danger' : 'button-secondary'} disabled={pending} type="submit">
          {pending ? 'Working…' : mode === 'revoke' ? 'Confirm revoke' : 'Create replacement invitation'}
        </AdminFormControlButton>
      </form>
    </details>
  );
}

export function OperatorStatusForm({
  activeSessionCount,
  operatorId,
  operatorName,
  suspended,
}: {
  readonly activeSessionCount: number;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly suspended: boolean;
}) {
  const [state, action, pending] = useActionState(setAdminOperatorStatus, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <form action={action} className="operator-access-action-form operator-access-status-form">
      <ActionResult state={state} />
      <input name="userId" type="hidden" value={operatorId} />
      <input name="mode" type="hidden" value={suspended ? 'reactivate' : 'suspend'} />
      <div className="operator-access-impact">
        {suspended ? <PlayCircle aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
        <div>
          <strong>{suspended ? `Reactivate ${operatorName}?` : `Suspend access for ${operatorName}?`}</strong>
          <p className="muted">
            {suspended
              ? 'Existing roles and direct permissions are preserved. The operator can sign in again.'
              : `This blocks new Admin Web requests and revokes ${activeSessionCount} active session(s). The underlying user is not deleted.`}
          </p>
        </div>
      </div>
      <ReasonField error={state.fieldErrors?.reason} label={suspended ? 'Reason for reactivation' : 'Reason for suspension'} />
      {!suspended ? (
        <AdminFormCheckbox label={`Confirm suspension of ${operatorName}`} name="confirmation" required value="confirmed">
          <span>I understand that active Admin Web sessions will end immediately.</span>
        </AdminFormCheckbox>
      ) : null}
      <AdminFormControlButton className={suspended ? 'button-primary' : 'button-danger'} disabled={pending} type="submit">
        {pending ? 'Saving…' : suspended ? 'Reactivate Admin Web access' : 'Suspend Admin Web access'}
      </AdminFormControlButton>
    </form>
  );
}

export function OffboardOperatorForm({
  operatorId,
  operatorName,
}: {
  readonly operatorId: string;
  readonly operatorName: string;
}) {
  const [state, action, pending] = useActionState(offboardAdminOperator, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <details className="operator-access-offboarding">
      <summary>Permanent offboarding</summary>
      <form action={action} className="operator-access-action-form">
        <ActionResult state={state} />
        <input name="userId" type="hidden" value={operatorId} />
        <input name="operatorName" type="hidden" value={operatorName} />
        <AdminInlineNotice role="alert" tone="danger">
          <span><strong>Permanent Admin Web removal.</strong> Admin roles, sign-in credential, and direct permissions are removed. The product user and retained audit evidence are preserved.</span>
        </AdminInlineNotice>
        <ReasonField error={state.fieldErrors?.reason} label={`Reason for permanently offboarding ${operatorName}`} />
        <AdminFormInput
          ariaInvalid={Boolean(state.fieldErrors?.confirmationName)}
          label={`Enter “${operatorName}” to confirm`}
          name="confirmationName"
          required
        />
        <AdminFormCheckbox label="Confirm permanent offboarding" name="confirmation" required value="confirmed">
          <span>I verified that access is suspended, active sessions are zero, and Finance Approver access is removed.</span>
        </AdminFormCheckbox>
        <AdminFormControlButton className="button-danger" disabled={pending} type="submit">
          {pending ? 'Removing Admin access…' : 'Permanently remove Admin access'}
        </AdminFormControlButton>
      </form>
    </details>
  );
}

export function SessionRevokeForm({
  current,
  operatorId,
  sessionId,
}: {
  readonly current: boolean;
  readonly operatorId: string;
  readonly sessionId: string;
}) {
  const [state, action, pending] = useActionState(revokeAdminOperatorSession, INITIAL_ADMIN_OPERATOR_ACTION_STATE);
  return (
    <details className="operator-access-session-action">
      <summary>{current ? 'Sign out this session' : 'Revoke session'}</summary>
      <form action={action} className="operator-access-action-form">
        <input name="userId" type="hidden" value={operatorId} />
        <input name="sessionId" type="hidden" value={sessionId} />
        <ReasonField
          error={state.fieldErrors?.reason}
          label={current ? 'Reason for signing out this session' : 'Reason for revoking this session'}
        />
        <AdminFormCheckbox label="Confirm session impact" name="confirmation" required value="confirmed">
          <span>{current
            ? 'This Admin Web session will end immediately and you will need to sign in again.'
            : 'The selected device will lose Admin Web access immediately.'}</span>
        </AdminFormCheckbox>
        <AdminFormControlButton aria-label={`${current ? 'Sign out' : 'Revoke'} session ${sessionId}`} className="button-secondary" disabled={pending} type="submit">
          <XCircle aria-hidden="true" size={15} /> {pending ? 'Working…' : current ? 'Confirm sign out' : 'Confirm revoke'}
        </AdminFormControlButton>
        <ActionResult compact state={state} />
      </form>
    </details>
  );
}

function PermissionGroups({
  defaults,
  onToggle,
  selected,
}: {
  readonly defaults: readonly string[];
  readonly onToggle?: (category: string, checked: boolean) => void;
  readonly selected?: readonly string[];
}) {
  const groups = new Map<string, typeof adminOperatorPermissionCategoryDefinitions>();
  for (const definition of adminOperatorPermissionCategoryDefinitions) {
    groups.set(definition.group, [...(groups.get(definition.group) ?? []), definition]);
  }
  return (
    <div className="operator-access-permission-groups">
      {[...groups.entries()].map(([group, definitions]) => (
        <details key={group} open={defaults.some((key) => definitions.some((definition) => definition.key === key))}>
          <summary>
            <span>{group}</span>
            <small>{definitions.filter((definition) => defaults.includes(definition.key)).length}/{definitions.length}</small>
          </summary>
          <div className="operator-access-permission-list">
            {definitions.map((definition) => (
              <AdminFormCheckbox
                checked={selected ? selected.includes(definition.key) : undefined}
                defaultChecked={selected ? undefined : defaults.includes(definition.key)}
                key={definition.key}
                label={definition.label}
                name="permissionCategories"
                onChange={onToggle ? (event) => onToggle(definition.key, event.currentTarget.checked) : undefined}
                value={definition.key}
              >
                <span>
                  <strong>{definition.label}</strong>
                  <small>{definition.scope} · {definition.risk} risk</small>
                </span>
              </AdminFormCheckbox>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function ReasonField({
  error,
  label,
  onChange,
}: {
  readonly error?: string;
  readonly label: string;
  readonly onChange?: ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div>
      <AdminFormTextarea
        ariaInvalid={Boolean(error)}
        label={label}
        maxLength={500}
        minLength={12}
        name="reason"
        onChange={onChange}
        placeholder="Explain the operating need, scope, and expected impact."
        required
        rows={4}
      />
      <small className={error ? 'text-danger' : 'muted'}>{error ?? 'Required · 12–500 characters'}</small>
    </div>
  );
}

function ActionResult({ compact = false, state }: { readonly compact?: boolean; readonly state: AdminOperatorActionState }) {
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== 'idle') resultRef.current?.focus();
  }, [state.status]);
  if (state.status === 'idle') return null;
  if (state.status === 'error') {
    return (
      <div className={compact ? 'operator-access-inline-result' : undefined} ref={resultRef} tabIndex={-1}>
        <AdminInlineNotice role="alert" tone="danger">
          <XCircle aria-hidden="true" size={16} />
          <span>{state.error}</span>
        </AdminInlineNotice>
      </div>
    );
  }
  return (
    <div className={compact ? 'operator-access-inline-result' : undefined} ref={resultRef} tabIndex={-1}>
      <AdminInlineNotice role="status" tone="success">
        <Check aria-hidden="true" size={16} />
        <span>{state.receipt?.message}</span>
        {state.receipt?.auditId ? <small>Audit ID: {state.receipt.auditId}</small> : null}
      </AdminInlineNotice>
      {state.receipt?.setupPath ? (
        <div className="operator-access-copy-token">
          <AdminFormStaticValue
            label="Copy-once setup path"
            labelVisibility="visible"
            value={<code>{state.receipt.setupPath}</code>}
          />
          <AdminFormControlButton
            className="button-secondary"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}${state.receipt?.setupPath ?? ''}`)}
            type="button"
          >
            <Copy aria-hidden="true" size={15} /> Copy setup link
          </AdminFormControlButton>
          <p className="muted"><ShieldCheck aria-hidden="true" size={14} /> This setup token is shown only in this receipt.</p>
        </div>
      ) : null}
    </div>
  );
}
