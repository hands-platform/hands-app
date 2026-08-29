'use client';

import { Save, X } from 'lucide-react';
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminNotePanel, AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { DateTimeText } from '../../components/date-time-text';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { operationalPolicyAnchor } from '../../lib/operations-policy';
import { initialOperationsPolicyActionState } from './action-state';
import { updateOperationalPolicy } from './actions';
import { policyImpactDetails } from './policy-impact-details';
import { policyDisplayValue } from './policy-value-display';

type OperationsPolicyFormProps = {
  readonly returnHref: string;
  readonly setting: AdminOperationalPolicySetting;
};

export function OperationsPolicyForm({ returnHref, setting }: OperationsPolicyFormProps) {
  const draftStorageKey = `operations-policy:draft:${setting.key}`;
  const valueType = typeof setting.value;
  const isNumber = valueType === 'number';
  const impact = policyImpactDetails(setting.key);
  const risk = setting.risk ?? 'low';
  const blastRadius = setting.blastRadius ?? impact.area;
  const [actionState, formAction, isPending] = useActionState(
    updateOperationalPolicy,
    initialOperationsPolicyActionState,
  );
  const [nextValue, setNextValue] = useState(String(setting.value));
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationLabel, setConfirmationLabel] = useState('');
  const [touched, setTouched] = useState({
    confirmationLabel: false,
    confirmed: false,
    reason: false,
    value: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const confirmedNavigationRef = useRef(false);
  const validation = validatePolicyChange(setting, nextValue, reason, confirmed, confirmationLabel);
  const valueError =
    actionState.fieldErrors?.value ?? (touched.value || submitAttempted ? validation.value : undefined);
  const reasonError =
    actionState.fieldErrors?.reason ?? (touched.reason || submitAttempted ? validation.reason : undefined);
  const confirmationError =
    actionState.fieldErrors?.confirmed ??
    (touched.confirmed || submitAttempted ? validation.confirmed : undefined);
  const labelError =
    actionState.fieldErrors?.confirmationLabel ??
    (touched.confirmationLabel || submitAttempted ? validation.confirmationLabel : undefined);
  const isDirty =
    nextValue !== String(setting.value) || reason.length > 0 || confirmed || confirmationLabel.length > 0;
  const hasUnsavedChanges = actionState.status !== 'success' && isDirty;
  const canSubmit =
    !isPending &&
    actionState.status !== 'success' &&
    !validation.value &&
    !validation.reason &&
    !validation.confirmed &&
    !validation.confirmationLabel;
  const submitPolicyAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      formData.append(submitter.name, submitter.value);
    }
    startTransition(() => formAction(formData));
  };

  useEffect(() => {
    if (actionState.status === 'error') errorSummaryRef.current?.focus();
  }, [actionState]);

  useEffect(() => {
    try {
      const storedDraft = window.sessionStorage.getItem(draftStorageKey);
      if (!storedDraft) return;
      window.sessionStorage.removeItem(draftStorageKey);
      const draft = JSON.parse(storedDraft) as {
        confirmationLabel?: string;
        confirmed?: boolean;
        nextValue?: string;
        reason?: string;
      };
      const restoreTimer = window.setTimeout(() => {
        if (typeof draft.nextValue === 'string') setNextValue(draft.nextValue);
        if (typeof draft.reason === 'string') setReason(draft.reason);
        if (typeof draft.confirmed === 'boolean') setConfirmed(draft.confirmed);
        if (typeof draft.confirmationLabel === 'string') setConfirmationLabel(draft.confirmationLabel);
      }, 0);
      return () => window.clearTimeout(restoreTimer);
    } catch {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    const confirmDiscard = () => !hasUnsavedChanges || window.confirm('Discard unsaved policy change?');
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link) return;
      const destination = new URL(link.getAttribute('href') ?? '', window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href ||
        link.hasAttribute('download') ||
        link.getAttribute('target') === '_blank'
      )
        return;
      if (isPending || !confirmDiscard()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      confirmedNavigationRef.current = true;
      window.setTimeout(() => {
        confirmedNavigationRef.current = false;
      }, 0);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (confirmedNavigationRef.current) {
        confirmedNavigationRef.current = false;
        return;
      }
      if (!hasUnsavedChanges && !isPending) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onPopState = () => {
      if (isPending) {
        window.history.forward();
        return;
      }
      if (hasUnsavedChanges && !confirmDiscard()) {
        window.sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            confirmationLabel,
            confirmed,
            nextValue,
            reason,
          }),
        );
        window.history.forward();
      }
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [confirmationLabel, confirmed, draftStorageKey, hasUnsavedChanges, isPending, nextValue, reason]);

  return (
    <form
      action={formAction}
      className="card admin-card operations-policy-change-form"
      id={operationalPolicyAnchor(setting.key)}
      noValidate
      onSubmit={submitPolicyAction}
    >
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="label" value={setting.label} />
      <input type="hidden" name="valueType" value={valueType} />
      <input type="hidden" name="expectedValue" value={String(setting.value)} />
      <input type="hidden" name="min" value={setting.min ?? ''} />
      <input type="hidden" name="max" value={setting.max ?? ''} />
      <input type="hidden" name="risk" value={risk} />
      <AdminSectionHeader
        actions={
          <AdminFormControlLink className="button-secondary" href={returnHref}>
            <X size={16} aria-hidden="true" />
            Close
          </AdminFormControlLink>
        }
        description={displayOperationalWording(setting.description)}
        status={
          <StatusBadge tone={risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'info'}>
            {risk} risk
          </StatusBadge>
        }
        title={`Change ${displayOperationalWording(setting.label)}`}
      />
      <AdminTraceSummary
        defaultKind="record"
        defaultScope="Policy change"
        metrics={[
          { label: 'Before', value: policyDisplayValue(setting) },
          {
            label: 'After',
            value: policyDisplayValue({ ...setting, value: parsedPreviewValue(nextValue, valueType) }),
          },
          { label: 'Scope', value: setting.category },
          { label: 'Operating impact', value: impact.area },
          { label: 'Blast radius', value: blastRadius },
          {
            label: 'Effective',
            value: setting.requiresRestart ? 'After service restart' : 'Immediately after save',
          },
        ]}
      />
      <AdminNotePanel className="admin-mt-12">
        <strong>{impact.title}</strong>
        <p className="muted">{impact.detail}</p>
        <p className="muted admin-mt-6">
          Saved changes take effect immediately unless a service restart is required. The policy value and
          audit event are committed together.
        </p>
      </AdminNotePanel>

      {actionState.status === 'error' ? (
        <div className="operations-policy-change-alert admin-mt-12" ref={errorSummaryRef} tabIndex={-1}>
          <AdminNoticeCard role="alert" tone="danger">
            <strong>Policy change not saved</strong>
            <p>{actionState.message}</p>
            {actionState.reauthRequired ? (
              <AdminFormControlButton
                aria-controls="admin-reauthentication-panel"
                className="button-secondary admin-mt-10"
                onClick={openIdentityConfirmation}
                type="button"
              >
                Confirm identity
              </AdminFormControlButton>
            ) : null}
          </AdminNoticeCard>
        </div>
      ) : null}

      {actionState.status === 'success' && actionState.success ? (
        <AdminNoticeCard
          className="operations-policy-success-summary admin-mt-12"
          role="status"
          tone="success"
        >
          <strong>{actionState.success.policy} saved</strong>
          <dl>
            <div>
              <dt>Before → After</dt>
              <dd>
                {actionState.success.before} → {actionState.success.after}
              </dd>
            </div>
            <div>
              <dt>Audit ID</dt>
              <dd>{actionState.success.auditId ?? 'Open audit trail'}</dd>
            </div>
            <div>
              <dt>Changed by</dt>
              <dd>{actionState.success.changedBy}</dd>
            </div>
            <div>
              <dt>Effective at</dt>
              <dd><DateTimeText fallback="Invalid effective time" value={actionState.success.effectiveAt} /></dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{actionState.success.reason}</dd>
            </div>
          </dl>
          <AdminFormActionRow className="admin-mt-12">
            <AdminFormControlLink className="button-secondary" href={returnHref}>
              Back to filtered policies
            </AdminFormControlLink>
            <AdminFormControlLink className="button-secondary" href={actionState.success.auditHref}>
              Open audit record
            </AdminFormControlLink>
            <AdminFormControlButton
              className="button-secondary"
              disabled={isPending}
              formNoValidate
              name="intent"
              type="submit"
              value="rollback"
            >
              {isPending ? 'Reverting…' : 'Revert to Before'}
            </AdminFormControlButton>
          </AdminFormActionRow>
        </AdminNoticeCard>
      ) : null}

      {setting.options?.length ? (
        <AdminFormSelect
          ariaDescribedBy="operations-policy-value-error"
          ariaInvalid={Boolean(valueError)}
          className="admin-form-control-fluid admin-mt-12"
          label="New value"
          labelVisibility="visible"
          name="value"
          onChange={(event) => {
            setNextValue(event.target.value);
            setTouched((current) => ({ ...current, value: true }));
          }}
          options={setting.options.map((option) => ({
            label: displayOperationalWording(option.label),
            value: option.value,
          }))}
          value={nextValue}
        />
      ) : valueType === 'boolean' ? (
        <AdminFormSelect
          ariaDescribedBy="operations-policy-value-error"
          ariaInvalid={Boolean(valueError)}
          className="admin-form-control-fluid admin-mt-12"
          label="New value"
          labelVisibility="visible"
          name="value"
          onChange={(event) => {
            setNextValue(event.target.value);
            setTouched((current) => ({ ...current, value: true }));
          }}
          options={[
            { label: 'Enabled', value: 'true' },
            { label: 'Disabled', value: 'false' },
          ]}
          value={nextValue}
        />
      ) : (
        <AdminFormInput
          ariaDescribedBy="operations-policy-value-error"
          ariaInvalid={Boolean(valueError)}
          className="admin-form-control-fluid admin-mt-12"
          label={`New value ${setting.unit ? `(${setting.unit})` : ''}${
            isNumber && setting.min !== undefined && setting.max !== undefined
              ? `, ${setting.min}-${setting.max}`
              : ''
          }`}
          labelVisibility="visible"
          max={isNumber ? (setting.max ?? undefined) : undefined}
          min={isNumber ? (setting.min ?? undefined) : undefined}
          name="value"
          onChange={(event) => {
            setNextValue(event.target.value);
            setTouched((current) => ({ ...current, value: true }));
          }}
          type={isNumber ? 'number' : 'text'}
          value={nextValue}
        />
      )}
      {valueError ? (
        <p className="admin-form-field-message" id="operations-policy-value-error">
          {valueError}
        </p>
      ) : (
        <p className="admin-form-field-help" id="operations-policy-value-error">
          {nextValue === String(setting.value)
            ? 'Choose a value different from the current value.'
            : 'New value differs from the current policy. Add evidence and confirmation before saving.'}
        </p>
      )}

      <AdminFormTextarea
        ariaDescribedBy="operations-policy-reason-help operations-policy-reason-error"
        ariaInvalid={Boolean(reasonError)}
        className="admin-form-control-fluid admin-mt-12"
        label="Change reason"
        labelVisibility="visible"
        maxLength={500}
        name="reason"
        onChange={(event) => {
          setReason(event.target.value);
          setTouched((current) => ({ ...current, reason: true }));
        }}
        placeholder="State the operating evidence and expected outcome."
        value={reason}
      />
      <div className="admin-form-field-meta" id="operations-policy-reason-help">
        <span>12–500 characters after whitespace normalization</span>
        <span>{normalizeReason(reason).length}/500</span>
      </div>
      {reasonError ? (
        <p className="admin-form-field-message" id="operations-policy-reason-error">
          {reasonError}
        </p>
      ) : null}

      <AdminFormCheckbox
        ariaDescribedBy={confirmationError ? 'operations-policy-confirmation-error' : undefined}
        ariaInvalid={Boolean(confirmationError)}
        checked={confirmed}
        className="admin-mt-12"
        label="I reviewed the before and after values, operating impact, and effective time."
        name="confirmed"
        onChange={(event) => {
          setConfirmed(event.target.checked);
          setTouched((current) => ({ ...current, confirmed: true }));
        }}
        value="yes"
      >
        I reviewed the before and after values, operating impact, and effective time.
      </AdminFormCheckbox>
      {confirmationError ? (
        <p className="admin-form-field-message" id="operations-policy-confirmation-error">
          {confirmationError}
        </p>
      ) : null}

      {risk === 'high' ? (
        <>
          <AdminFormInput
            ariaDescribedBy="operations-policy-label-confirmation-help operations-policy-label-confirmation-error"
            ariaInvalid={Boolean(labelError)}
            className="admin-form-control-fluid admin-mt-12"
            label={`Type “${setting.label}” to confirm`}
            labelVisibility="visible"
            name="confirmationLabel"
            onChange={(event) => {
              setConfirmationLabel(event.target.value);
              setTouched((current) => ({ ...current, confirmationLabel: true }));
            }}
            type="text"
            value={confirmationLabel}
          />
          <p className="admin-form-field-help" id="operations-policy-label-confirmation-help">
            Required because this change can affect {blastRadius.toLowerCase()}.
          </p>
          {labelError ? (
            <p className="admin-form-field-message" id="operations-policy-label-confirmation-error">
              {labelError}
            </p>
          ) : null}
        </>
      ) : null}

      <AdminFormActionRow className="admin-mt-12">
        <AdminFormControlButton className="button-primary" disabled={!canSubmit} type="submit">
          <Save size={16} aria-hidden="true" />
          {isPending ? 'Saving policy…' : 'Save policy change'}
        </AdminFormControlButton>
        <AdminFormControlLink className="button-secondary" href={returnHref}>
          Cancel
        </AdminFormControlLink>
      </AdminFormActionRow>
    </form>
  );
}

function openIdentityConfirmation() {
  const menu = document.getElementById('admin-reauthentication-menu');
  if (!(menu instanceof HTMLDetailsElement)) return;
  menu.open = true;
  window.requestAnimationFrame(() => {
    menu.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
  });
}

export function validatePolicyChange(
  setting: AdminOperationalPolicySetting,
  rawValue: string,
  reason: string,
  confirmed: boolean,
  confirmationLabel = '',
) {
  const valueType = typeof setting.value;
  const value = parsedPreviewValue(rawValue, valueType);
  const errors: Partial<Record<'confirmationLabel' | 'confirmed' | 'reason' | 'value', string>> = {};
  if (rawValue.trim() === '' || (valueType === 'number' && typeof value !== 'number')) {
    errors.value = 'Enter a valid policy value.';
  } else if (typeof value === 'number' && setting.min != null && value < setting.min) {
    errors.value = `Enter a value of at least ${setting.min}.`;
  } else if (typeof value === 'number' && setting.max != null && value > setting.max) {
    errors.value = `Enter a value no greater than ${setting.max}.`;
  } else if (value === setting.value) {
    errors.value = 'This is the current value. Choose a different value.';
  }

  const normalizedReason = normalizeReason(reason);
  if (normalizedReason.length < 12) {
    errors.reason = 'Enter at least 12 characters describing the evidence and expected outcome.';
  } else if (normalizedReason.length > 500) {
    errors.reason = 'Keep the change reason to 500 characters or fewer.';
  }
  if (!confirmed) {
    errors.confirmed = 'Confirm that you reviewed the before and after values and effective time.';
  }
  if (setting.risk === 'high' && confirmationLabel.trim() !== setting.label) {
    errors.confirmationLabel = `Type ${setting.label} exactly to confirm this high-risk change.`;
  }
  return errors;
}

function parsedPreviewValue(value: string, valueType: string) {
  if (valueType === 'number') {
    const numberValue = Number(value);
    return value.trim() !== '' && Number.isFinite(numberValue) ? numberValue : value;
  }
  if (valueType === 'boolean') return value === 'true';
  return value;
}

function normalizeReason(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
