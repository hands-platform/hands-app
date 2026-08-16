'use server';

import { revalidatePath } from 'next/cache';

import {
  AdminApiRequestError,
  adminDeleteWithBodyOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  ADMIN_OPERATOR_BASE_ROLE,
  MASTER_ADMIN_ROLE,
  isAdminOperatorPermissionCategory,
} from '../../lib/admin-operator-permissions';
import type { AdminOperatorActionState } from './action-state';

export async function inviteAdminOperator(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonAndEmailErrors(email, reason);
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPostOrThrow<{
      auditLogId: string;
      invitation: { expiresAt: string; id: string };
      setupToken: string;
    }>('/admin/admin-operator-invitations', {
      email,
      expiresInHours: numberValue(formData, 'expiresInHours') || 72,
      fullName: readString(formData, 'fullName') || null,
      masterAdminEnabled: formData.get('masterAdminEnabled') === 'true',
      permissionCategories: permissionValues(formData),
      reason,
      targetUserId: null,
    });
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: `Invitation created. It expires ${formatReceiptTime(result.invitation.expiresAt)}.`,
        setupPath: `/operator-setup#token=${encodeURIComponent(result.setupToken)}`,
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reauthenticateAdminOperator(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const password = readString(formData, 'password');
  const mfaCode = readString(formData, 'mfaCode');
  if (!password) return validationFailure({ password: 'Enter your current operator password.' });
  try {
    await adminPostOrThrow('/admin/admin-operators/reauthenticate', { mfaCode: mfaCode || undefined, password });
    return {
      status: 'success',
      receipt: { message: 'High-risk access changes are unlocked for 10 minutes.' },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function beginAdminMfaEnrollment(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const password = readString(formData, 'password');
  if (!password) return validationFailure({ password: 'Enter your current operator password.' });
  try {
    const result = await adminPostOrThrow<{
      auditLogId: string;
      otpAuthUri: string;
      recoveryCodes: string[];
      secret: string;
    }>('/admin/admin-operators/me/mfa/enrollment', { password });
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: 'Add the authenticator secret, save every recovery code, then verify a current code.',
        mfaSecret: result.secret,
        otpAuthUri: result.otpAuthUri,
        recoveryCodes: result.recoveryCodes,
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function verifyAdminMfaEnrollment(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const code = readString(formData, 'code');
  if (!/^\d{6}$/u.test(code)) return validationFailure({ code: 'Enter the current 6-digit authenticator code.' });
  try {
    const result = await adminPostOrThrow<{ auditLogId: string }>(
      '/admin/admin-operators/me/mfa/verify',
      { code },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: { auditId: result.auditLogId, message: 'MFA is verified for this Admin operator.' },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function resetAdminMfa(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId) fieldErrors.userId = 'Reload the operator detail before resetting MFA.';
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);
  try {
    const result = await adminPostOrThrow<{ auditLogId: string; revokedSessionCount: number }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-operator/mfa/reset`,
      { reason },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: `MFA was reset and ${result.revokedSessionCount} session(s) were revoked.`,
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateAdminOperatorAccess(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const expectedVersion = numberValue(formData, 'expectedVersion');
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId) fieldErrors.userId = 'Reload the operator detail before saving.';
  if (!expectedVersion) fieldErrors.expectedVersion = 'The permission version is missing. Reload before saving.';
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPatchOrThrow<{ auditLog?: { id?: string } }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-operator-access`,
      {
        expectedVersion,
        permissionCategories: permissionValues(formData),
        reason,
        roles: [
          ADMIN_OPERATOR_BASE_ROLE,
          ...(formData.get('masterAdminEnabled') === 'true' ? [MASTER_ADMIN_ROLE] : []),
        ],
      },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLog?.id,
        message: 'The direct permissions and Master Admin role were updated.',
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function initializeAdminOperatorPermission(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId) fieldErrors.userId = 'Reload the operator detail before initializing access.';
  if (formData.get('confirmation') !== 'confirmed') {
    fieldErrors.confirmation = 'Confirm the explicit permission policy before initializing it.';
  }
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPostOrThrow<{ auditLogId: string }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-operator-access/initialize`,
      { permissionCategories: permissionValues(formData), reason },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: 'The explicit permission policy was initialized. No role was changed.',
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function manageAdminOperatorInvitation(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const invitationId = readString(formData, 'invitationId');
  const mode = readString(formData, 'mode') === 'revoke' ? 'revoke' : 'resend';
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!invitationId) fieldErrors.invitationId = 'Reload the invitation list before continuing.';
  if (formData.get('confirmation') !== 'confirmed') {
    fieldErrors.confirmation = mode === 'revoke'
      ? 'Confirm that this setup link will stop working.'
      : 'Confirm that the previous setup link will be invalidated.';
  }
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPostOrThrow<{
      auditLogId: string;
      invitation?: { expiresAt: string; id: string };
      setupToken?: string;
    }>(`/admin/admin-operator-invitations/${encodeURIComponent(invitationId)}/${mode}`, {
      ...(mode === 'resend' ? { expiresInHours: numberValue(formData, 'expiresInHours') || 72 } : {}),
      reason,
    });
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: mode === 'revoke'
          ? 'The invitation was revoked. Its setup link no longer works.'
          : `A replacement invitation was created. It expires ${formatReceiptTime(result.invitation?.expiresAt ?? '')}.`,
        ...(mode === 'resend' && result.setupToken
          ? { setupPath: `/operator-setup#token=${encodeURIComponent(result.setupToken)}` }
          : {}),
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setAdminOperatorStatus(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const mode = readString(formData, 'mode') === 'reactivate' ? 'reactivate' : 'suspend';
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId) fieldErrors.userId = 'Reload the operator detail before changing access.';
  if (mode === 'suspend' && formData.get('confirmation') !== 'confirmed') {
    fieldErrors.confirmation = 'Confirm that active Admin Web sessions will end immediately.';
  }
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPostOrThrow<{ auditLogId: string; revokedSessionCount: number }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-operator/${mode}`,
      { reason },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLogId,
        message: mode === 'suspend'
          ? `Admin Web access was suspended and ${result.revokedSessionCount} active session(s) were revoked.`
          : 'Admin Web access was reactivated. Existing permissions were preserved.',
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function offboardAdminOperator(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const operatorName = readString(formData, 'operatorName');
  const confirmationName = readString(formData, 'confirmationName');
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId) fieldErrors.userId = 'Reload the operator detail before offboarding.';
  if (!operatorName || confirmationName !== operatorName) {
    fieldErrors.confirmationName = 'Enter the operator name exactly to confirm permanent offboarding.';
  }
  if (formData.get('confirmation') !== 'confirmed') {
    fieldErrors.confirmation = 'Confirm that Admin roles, credentials, and direct permissions will be removed.';
  }
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminDeleteWithBodyOrThrow<{ auditLog?: { id?: string } }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-operator`,
      { reason },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: {
        auditId: result.auditLog?.id,
        message: 'Admin Web access was permanently removed. The underlying product user was preserved.',
      },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function revokeAdminOperatorSession(
  _previousState: AdminOperatorActionState,
  formData: FormData,
): Promise<AdminOperatorActionState> {
  const userId = readString(formData, 'userId');
  const sessionId = readString(formData, 'sessionId');
  const reason = normalizeReason(readString(formData, 'reason'));
  const fieldErrors = reasonErrors(reason);
  if (!userId || !sessionId) fieldErrors.sessionId = 'Reload the session list before revoking a session.';
  if (formData.get('confirmation') !== 'confirmed') {
    fieldErrors.confirmation = 'Confirm the session impact before continuing.';
  }
  if (Object.keys(fieldErrors).length) return validationFailure(fieldErrors);

  try {
    const result = await adminPostOrThrow<{ auditLogId: string }>(
      `/admin/users/${encodeURIComponent(userId)}/admin-web-sessions/${encodeURIComponent(sessionId)}/revoke`,
      { reason },
    );
    revalidateOperatorAccess();
    return {
      status: 'success',
      receipt: { auditId: result.auditLogId, message: 'The Admin Web session was revoked.' },
    };
  } catch (error) {
    return actionFailure(error);
  }
}

function permissionValues(formData: FormData) {
  return formData.getAll('permissionCategories').filter(isAdminOperatorPermissionCategory);
}

function reasonAndEmailErrors(email: string, reason: string) {
  const fieldErrors = reasonErrors(reason);
  if (!/^\S+@\S+\.\S+$/u.test(email)) fieldErrors.email = 'Enter a valid admin email address.';
  return fieldErrors;
}

function reasonErrors(reason: string) {
  const fieldErrors: Record<string, string> = {};
  if (reason.length < 12) fieldErrors.reason = 'Enter at least 12 characters explaining this access change.';
  if (reason.length > 500) fieldErrors.reason = 'Keep the access reason to 500 characters or fewer.';
  return fieldErrors;
}

function validationFailure(fieldErrors: Record<string, string>): AdminOperatorActionState {
  return { status: 'error', error: 'Review the highlighted fields. No access change was made.', fieldErrors };
}

function actionFailure(error: unknown): AdminOperatorActionState {
  const payload = error instanceof AdminApiRequestError && isRecord(error.payload) ? error.payload : null;
  const code = typeof payload?.code === 'string' ? payload.code : '';
  const knownMessage: Record<string, string> = {
    ADMIN_OPERATOR_CREDENTIAL_EXISTS: 'This email already has operator credentials.',
    ADMIN_OPERATOR_EXISTING_USER_SELECTION_REQUIRED: 'An existing user has this email. Enter its exact user ID.',
    ADMIN_OPERATOR_INVITATION_PENDING: 'A pending invitation already exists for this email.',
    ADMIN_OPERATOR_PERMISSION_MIGRATION_REQUIRED: 'This operator needs a permission migration before access can be edited.',
    ADMIN_OPERATOR_PERMISSION_ALREADY_INITIALIZED: 'The permission policy was initialized elsewhere. Reload and review it.',
    ADMIN_OPERATOR_REAUTH_REQUIRED: 'Confirm your current password before this high-risk change.',
    ADMIN_OPERATOR_ACCESS_VERSION_CONFLICT: 'Access changed in another session. Reload and review the latest permissions.',
    ADMIN_OPERATOR_INVITATION_ACCEPTED: 'This invitation was already accepted and cannot be changed.',
    ADMIN_OPERATOR_INVITATION_REVOKED: 'This invitation is already revoked.',
    ADMIN_OPERATOR_INVITATION_STATE_CHANGED: 'The invitation changed elsewhere. Reload before continuing.',
    FINANCE_APPROVER_GOVERNANCE_REQUIRED: 'Manage the Finance Approver role from Finance Approvers before this action.',
    LAST_MASTER_ADMIN_REQUIRED: 'The last active Master Admin cannot be suspended or removed.',
    ADMIN_OPERATOR_SUSPEND_REQUIRED: 'Suspend Admin Web access before permanent offboarding.',
    ADMIN_OPERATOR_ACTIVE_SESSIONS_REMAIN: 'Revoke all active Admin Web sessions before permanent offboarding.',
  };
  if (knownMessage[code]) return { status: 'error', error: knownMessage[code] };
  if (error instanceof AdminApiRequestError) {
    if (error.status === 401) return { status: 'error', error: 'Your Admin Web session expired. Sign in again.' };
    if (error.status === 403) return { status: 'error', error: 'Master Admin access is required for this change.' };
    if (error.status === 404) return { status: 'error', error: 'The operator record no longer exists. Reload the directory.' };
    if (error.status === 409) return { status: 'error', error: 'The operator state changed. Reload before retrying.' };
    if (error.status === 429) return { status: 'error', error: 'Too many attempts. Wait briefly before retrying.' };
    if (error.status >= 500) return { status: 'error', error: 'Operator access could not be changed. No success was confirmed.' };
  }
  return { status: 'error', error: 'The Operator Access API is unavailable. Your input was preserved.' };
}

function revalidateOperatorAccess() {
  revalidatePath('/admin-operators');
  revalidatePath('/audit-log');
}

function readString(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim();
}

function numberValue(formData: FormData, name: string) {
  const parsed = Number.parseInt(readString(formData, name), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeReason(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatReceiptTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'at the recorded expiry time'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(date);
}
