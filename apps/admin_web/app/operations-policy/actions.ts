'use server';

import { revalidatePath, updateTag } from 'next/cache';

import {
  AdminApiRequestError,
  AdminOperationalPolicySetting,
  AdminOperatorAccessDeniedError,
  AdminOperationalPolicyAuditPage,
  adminGetResult,
  adminPatchOrThrow,
} from '../../lib/admin-api';

export type OperationsPolicyActionState = {
  readonly fieldErrors?: Partial<Record<'confirmationLabel' | 'confirmed' | 'reason' | 'value', string>>;
  readonly message?: string;
  readonly status: 'idle' | 'error' | 'success';
  readonly success?: {
    readonly after: string;
    readonly auditId: string | null;
    readonly auditHref: string;
    readonly before: string;
    readonly changedBy: string;
    readonly effectiveAt: string;
    readonly policy: string;
    readonly reason: string;
  };
};

export const initialOperationsPolicyActionState: OperationsPolicyActionState = { status: 'idle' };

export async function updateOperationalPolicy(
  _previousState: OperationsPolicyActionState,
  formData: FormData,
): Promise<OperationsPolicyActionState> {
  const key = String(formData.get('key') || '').trim();
  const label = String(formData.get('label') || key).trim();
  const rollback = formData.get('intent') === 'rollback';
  if (rollback && !_previousState.success) {
    return policyActionError('The saved change is no longer available to revert. Refresh the policy and review its audit record.');
  }
  const rawValue = rollback
    ? _previousState.success?.before ?? ''
    : String(formData.get('value') || '').trim();
  const expectedRawValue = rollback
    ? _previousState.success?.after ?? ''
    : String(formData.get('expectedValue') || '').trim();
  const valueType = String(formData.get('valueType') || 'string');
  const reason = rollback
    ? normalizeReason(
        `Revert ${label} to the audited Before value after reviewing ${_previousState.success?.auditId ?? 'the prior audit record'}.`,
      ).slice(0, 500)
    : normalizeReason(String(formData.get('reason') || ''));
  const confirmed = rollback || formData.get('confirmed') === 'yes';
  const risk = String(formData.get('risk') || 'low');
  const confirmationLabel = rollback ? label : String(formData.get('confirmationLabel') || '').trim();
  const min = optionalFiniteNumber(formData.get('min'));
  const max = optionalFiniteNumber(formData.get('max'));
  const fieldErrors: NonNullable<OperationsPolicyActionState['fieldErrors']> = {};
  const value = parsePolicyValue(rawValue, valueType);
  const expectedValue = parsePolicyValue(expectedRawValue, valueType);

  if (!key || value === null || expectedValue === null) {
    fieldErrors.value = 'Enter a valid policy value.';
  } else if (valueType === 'number' && typeof value === 'number' && min !== null && value < min) {
    fieldErrors.value = `Enter a value of at least ${min}.`;
  } else if (valueType === 'number' && typeof value === 'number' && max !== null && value > max) {
    fieldErrors.value = `Enter a value no greater than ${max}.`;
  } else if (value === expectedValue) {
    fieldErrors.value = 'This is the current value. Choose a different value.';
  }

  if (reason.length < 12) {
    fieldErrors.reason = 'Enter at least 12 characters describing the evidence and expected outcome.';
  } else if (reason.length > 500) {
    fieldErrors.reason = 'Keep the change reason to 500 characters or fewer.';
  }
  if (!confirmed) {
    fieldErrors.confirmed = 'Confirm that you reviewed the before and after values and effective time.';
  }
  if (risk === 'high' && confirmationLabel !== label) {
    fieldErrors.confirmationLabel = `Type ${label} exactly to confirm this high-risk change.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: 'Review the highlighted fields before saving this policy change.',
      status: 'error',
    };
  }

  try {
    const auditHealth = await adminGetResult<AdminOperationalPolicyAuditPage>(
      '/admin/operational-policy/audit?source=operator&take=1',
      { items: [], nextCursor: null, source: 'operator' },
    );
    if (!auditHealth.ok) {
      return policyActionError(
        'Policy audit evidence is unavailable. No policy change was attempted. Retry after System Health recovers.',
      );
    }
    const saved = await adminPatchOrThrow<AdminOperationalPolicySetting>(
      `/admin/operational-policy/${encodeURIComponent(key)}`,
      {
        ...(risk === 'high' ? { confirmationLabel } : {}),
        expectedValue,
        reason,
        value,
      },
    );

    updateTag('operations-policy');
    revalidatePath('/operations-policy');
    revalidatePath('/audit-log');
    return {
      status: 'success',
      success: {
        after: String(saved.value),
        auditId: saved.auditId ?? null,
        auditHref: saved.auditId
          ? `/audit-log?bucket=Operations%2FPolicy&event=${encodeURIComponent(saved.auditId)}&range=all&sort=newest`
          : '/operations-policy?details=audit',
        before: String(expectedValue),
        changedBy: saved.updatedBy?.fullName ?? saved.updatedBy?.phone ?? 'Current operator',
        effectiveAt: saved.effectiveAt ?? saved.updatedAt ?? new Date().toISOString(),
        policy: saved.label ?? label,
        reason,
      },
    };
  } catch (error) {
    if (error instanceof AdminOperatorAccessDeniedError) {
      return policyActionError('You do not have System Policy write access. Ask a Master Admin to review this change.');
    }
    if (error instanceof AdminApiRequestError) {
      if (error.status === 409) {
        const apiMessage = readApiMessage(error.payload);
        if (apiMessage.includes('not editable') || apiMessage.includes('cannot be changed')) {
          return policyActionError('This policy is read-only under the current lifecycle contract.');
        }
        return policyActionError(
          'Another operator changed this policy after the page loaded. Refresh the policy before trying again.',
        );
      }
      if (error.status === 401 || error.status === 403) {
        return policyActionError('Your session does not have permission to change this policy.');
      }
      if (error.status === 400) {
        const apiMessage = readApiMessage(error.payload);
        if (apiMessage.includes('already has this value')) {
          return policyActionError('This policy already has the selected value. Refresh before editing again.', {
            value: 'This is the current value. Choose a different value.',
          });
        }
        if (apiMessage.includes('unsupported option') || apiMessage.includes('between')) {
          return policyActionError('The selected value is outside the allowed policy range.', {
            value: 'Choose a supported value within the displayed range.',
          });
        }
        if (apiMessage.includes('reason')) {
          return policyActionError('The change reason does not meet the policy audit requirement.', {
            reason: 'Enter a reason between 12 and 500 characters.',
          });
        }
        if (apiMessage.includes('type') && apiMessage.includes('confirm')) {
          return policyActionError('The high-risk confirmation label did not match this policy.', {
            confirmationLabel: `Type ${label} exactly.`,
          });
        }
        return policyActionError('The policy value or reason was rejected. Review the highlighted fields.');
      }
      return policyActionError('The policy service could not save this change. Try again after checking API status.');
    }
    return policyActionError('The policy service could not be reached. Check the connection and try again.');
  }
}

function policyActionError(
  message: string,
  fieldErrors?: OperationsPolicyActionState['fieldErrors'],
): OperationsPolicyActionState {
  return { fieldErrors, message, status: 'error' };
}

function normalizeReason(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parsePolicyValue(rawValue: string, valueType: string) {
  if (valueType === 'number') {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
  }
  if (valueType === 'boolean') {
    return rawValue === 'true' ? true : rawValue === 'false' ? false : null;
  }
  return rawValue || null;
}

function optionalFiniteNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readApiMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join(' ').toLowerCase();
  return typeof message === 'string' ? message.toLowerCase() : '';
}
