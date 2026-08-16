'use server';

import { revalidatePath } from 'next/cache';

import {
  AdminApiRequestError,
  adminPostOrThrow,
  type AdminFinanceApproverGovernanceReceipt,
} from '../../../lib/admin-api';

export type FinanceApproverActionReceipt = AdminFinanceApproverGovernanceReceipt['receipt'] & {
  previousEnabled: boolean;
};

export type FinanceApproverActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  receipt?: FinanceApproverActionReceipt;
  status: 'idle' | 'error' | 'success';
};

export async function createFinanceApproverAccessRequest(
  _previousState: FinanceApproverActionState,
  formData: FormData,
): Promise<FinanceApproverActionState> {
  const targetUserId = readFormString(formData, 'targetUserId');
  const requestedEnabled = readFormString(formData, 'requestedEnabled') === 'true';
  const operatorReason = normalizeReason(readFormString(formData, 'operatorReason'));
  const idempotencyKey = readFormString(formData, 'idempotencyKey');
  const fieldErrors = financeApproverRequestFieldErrors({ idempotencyKey, operatorReason, targetUserId });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: 'Review the highlighted access request fields. No request was submitted.',
      fieldErrors,
      status: 'error',
    };
  }

  try {
    const result = await adminPostOrThrow<AdminFinanceApproverGovernanceReceipt>(
      '/admin/finance-approver-governance/requests',
      { idempotencyKey, operatorReason, requestedEnabled, targetUserId },
    );
    revalidatePath('/finance-tax/finance-approvers');
    return {
      receipt: { ...result.receipt, previousEnabled: result.request.previousEnabled },
      status: 'success',
    };
  } catch (error) {
    return financeApproverActionErrorState(error);
  }
}

export async function decideFinanceApproverAccessRequest(
  _previousState: FinanceApproverActionState,
  formData: FormData,
): Promise<FinanceApproverActionState> {
  const requestId = readFormString(formData, 'requestId');
  const rawDecision = formData.getAll('decision').map((value) => String(value).trim()).filter(Boolean);
  const decision = rawDecision.length === 1 && ['APPROVE', 'REJECT'].includes(rawDecision[0])
    ? (rawDecision[0] as 'APPROVE' | 'REJECT')
    : null;
  const decisionReason = normalizeReason(readFormString(formData, 'decisionReason'));
  const fieldErrors: Record<string, string> = {};
  if (!requestId) fieldErrors.requestId = 'The access request ID is missing. Reload the pending queue.';
  if (!decision) fieldErrors.decision = 'Select Approve or Reject before submitting this decision.';
  if (decisionReason.length < 12) {
    fieldErrors.decisionReason = 'Enter at least 12 characters describing the decision evidence.';
  } else if (decisionReason.length > 500) {
    fieldErrors.decisionReason = 'Keep the decision evidence to 500 characters or fewer.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: 'Review the highlighted decision fields. The request was not decided.',
      fieldErrors,
      status: 'error',
    };
  }

  try {
    const result = await adminPostOrThrow<AdminFinanceApproverGovernanceReceipt>(
      `/admin/finance-approver-governance/requests/${encodeURIComponent(requestId)}/decision`,
      { decision, decisionReason },
    );
    revalidatePath('/finance-tax/finance-approvers');
    return {
      receipt: { ...result.receipt, previousEnabled: result.request.previousEnabled },
      status: 'success',
    };
  } catch (error) {
    return financeApproverActionErrorState(error);
  }
}

function financeApproverRequestFieldErrors(input: {
  idempotencyKey: string;
  operatorReason: string;
  targetUserId: string;
}) {
  const fieldErrors: Record<string, string> = {};
  if (!input.targetUserId) fieldErrors.targetUserId = 'Select an admin operator before requesting access.';
  if (input.operatorReason.length < 12) {
    fieldErrors.operatorReason = 'Enter at least 12 characters explaining why this access must change.';
  } else if (input.operatorReason.length > 500) {
    fieldErrors.operatorReason = 'Keep the access change reason to 500 characters or fewer.';
  }
  if (!/^[A-Za-z0-9:_-]{8,128}$/u.test(input.idempotencyKey)) {
    fieldErrors.idempotencyKey = 'Reload the review drawer to create a safe request key.';
  }
  return fieldErrors;
}

function financeApproverActionErrorState(error: unknown): FinanceApproverActionState {
  const payload = error instanceof AdminApiRequestError ? readPlainRecord(error.payload) : null;
  const code = typeof payload?.code === 'string' ? payload.code : '';
  const field = typeof payload?.field === 'string' ? payload.field : '';
  const message = financeApproverActionErrorMessage(error, code, payload);
  return {
    error: message,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
    status: 'error',
  };
}

function financeApproverActionErrorMessage(
  error: unknown,
  code: string,
  payload: Record<string, unknown> | null,
) {
  if (code === 'SELF_ACCESS_CHANGE_FORBIDDEN') {
    return 'You cannot change your own finance approval access. Ask another role governor.';
  }
  if (code === 'MAKER_CANNOT_APPROVE') {
    return 'The requester cannot decide this access request. Ask a different verified role governor.';
  }
  if (code === 'FINANCE_APPROVER_REASON_LENGTH') {
    return 'Use between 12 and 500 characters after whitespace is normalized.';
  }
  if (code === 'FINANCE_APPROVER_ACCESS_NO_OP') {
    return 'This operator already has the requested access. Reload and review the latest state.';
  }
  if (code === 'DUPLICATE_PENDING_REQUEST') {
    return 'This operator already has a pending access request. Open the pending queue instead.';
  }
  if (code === 'APPROVER_SET_CHANGED' || code === 'TARGET_STATE_CHANGED') {
    return 'This request is out of date because the operator access changed. Review the latest state and submit again.';
  }
  if (code === 'MINIMUM_APPROVER_COVERAGE_REQUIRED') {
    return 'Removing this approver would leave finance operations without an independent backup.';
  }
  if (code === 'FIXTURE_TARGET_FORBIDDEN') {
    return 'This test fixture cannot count toward production finance approval readiness.';
  }
  if (
    code === 'TEST_OR_FIXTURE_ACCOUNT' ||
    code === 'UNKNOWN_PROVENANCE' ||
    code === 'NON_PRODUCTION_PROVENANCE' ||
    code === 'SETUP_INCOMPLETE' ||
    code === 'CREDENTIAL_MISSING' ||
    code === 'CREDENTIAL_DISABLED' ||
    code === 'ACCOUNT_LOCKED' ||
    code === 'MFA_NOT_VERIFIED' ||
    code === 'LEGACY_ACCESS_UNATTESTED' ||
    code === 'ROLE_MISSING' ||
    code === 'CATEGORY_NOT_ALLOWED' ||
    code === 'MAKER_CHECKER_CONFLICT' ||
    code === 'STALE_ROLE_VERSION'
  ) {
    const blockers = Array.isArray(payload?.blockers)
      ? payload.blockers
          .map((item) => readPlainRecord(item)?.message)
          .filter((message): message is string => typeof message === 'string')
      : [];
    return blockers[0] ?? 'This operator does not satisfy the verified Finance approver policy.';
  }
  if (code === 'TARGET_READINESS_UNKNOWN') {
    return 'Production provenance and operator authentication must be verified before changing this access.';
  }
  if (code === 'INDEPENDENT_ROLE_GOVERNOR_REQUIRED') {
    return 'A different verified role governor is required before this access request can proceed.';
  }
  if (code === 'ACCESS_REQUEST_ALREADY_DECIDED') {
    return 'This request has already been decided. Reload the pending queue for the final result.';
  }
  if (error instanceof AdminApiRequestError) {
    if (error.status === 401) return 'Your admin session expired. Sign in again before changing finance access.';
    if (error.status === 403) return 'You do not have permission to perform this finance access action.';
    if (error.status === 404) return 'The operator or request no longer exists. Reload the current list.';
    if (error.status === 409) return 'The finance access state changed. Reload and review the latest request.';
    if (error.status === 429) return 'Too many requests were submitted. Wait briefly, then retry with the same review.';
    const requestId = typeof payload?.requestId === 'string' ? ` Request ID: ${payload.requestId}.` : '';
    if (error.status >= 500) return `Finance approval access could not be changed. No confirmed result was saved.${requestId}`;
  }
  return 'Finance approval access could not be changed because the API was unavailable. Your review input was preserved.';
}

function normalizeReason(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}

function readFormString(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim();
}

function readPlainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
