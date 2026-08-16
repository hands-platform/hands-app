'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type {
  AdminManualWalletAdjustmentOwnerOption,
  AdminManualWalletAdjustmentPreview,
  AdminManualWalletAdjustmentRequest,
  AdminManualWalletAdjustmentDirection,
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentType,
} from '../../lib/admin-api';
import {
  AdminApiRequestError,
  adminGetResult,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../lib/admin-api';
import { walletAdjustmentFormKeyFromFormData } from './wallet-adjustment-form-key';

const ownerTypes = new Set<AdminManualWalletAdjustmentOwnerType>(['CUSTOMER', 'PARTNER']);
const directions = new Set<AdminManualWalletAdjustmentDirection>(['CREDIT', 'DEBIT']);
const adjustmentTypes = new Set<AdminManualWalletAdjustmentType>([
  'PROMOTION_CREDIT',
  'CUSTOMER_COMPENSATION',
  'PARTNER_BONUS',
  'REFERRAL_CORRECTION',
  'ERROR_CORRECTION',
  'PENALTY',
  'CASH_BOOKING_DEDUCTION',
  'RECEIVABLE_WRITE_OFF',
  'MANUAL_REVERSAL',
]);
const AMOUNT_MAX = 1_000_000_000;
const REASON_MAX_LENGTH = 1_000;
const ATTACHMENT_MAX_LENGTH = 500;
const HIGH_AMOUNT_ATTACHMENT_THRESHOLD = 10_000_000;
const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const EVIDENCE_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export type WalletAdjustmentActionState = {
  readonly code?: string;
  readonly field?: string;
  readonly inputKey?: string;
  readonly message?: string;
  readonly preview?: AdminManualWalletAdjustmentPreview;
  readonly status: 'idle' | 'error' | 'success';
};

export type WalletOwnerSearchState = {
  readonly message?: string;
  readonly ownerType?: AdminManualWalletAdjustmentOwnerType;
  readonly owners: readonly AdminManualWalletAdjustmentOwnerOption[];
  readonly status: 'idle' | 'error' | 'success';
};

export async function searchWalletAdjustmentOwners(
  _previousState: WalletOwnerSearchState,
  formData: FormData,
): Promise<WalletOwnerSearchState> {
  try {
    const ownerType = readEnum(formData, 'ownerType', ownerTypes, 'Wallet owner', 'ownerType');
    const query = readRequiredString(formData, 'ownerSearch', 'Name or phone number', 'ownerSearch');
    if (query.length < 2) {
      throw new WalletAdjustmentValidationError(
        'ownerSearch',
        'SEARCH_TOO_SHORT',
        'Enter at least two characters.',
      );
    }
    const params = new URLSearchParams({ ownerType, q: query, take: '10' });
    const result = await adminGetResult<AdminManualWalletAdjustmentOwnerOption[]>(
      `/admin/wallet-adjustments/owners?${params.toString()}`,
      [],
    );
    if (!result.ok) {
      return {
        message:
          result.status === 401 || result.status === 403
            ? 'You do not have permission to search wallet owners.'
            : 'Wallet owner search could not be loaded. Try again.',
        owners: [],
        status: 'error',
      };
    }
    return { ownerType, owners: result.data, status: 'success' };
  } catch (error) {
    return { message: safeActionMessage(error), owners: [], status: 'error' };
  }
}

export async function previewManualWalletAdjustment(
  _previousState: WalletAdjustmentActionState,
  formData: FormData,
): Promise<WalletAdjustmentActionState> {
  try {
    const payload = await readManualWalletAdjustmentPayload(formData, true);
    const { idempotencyKey: _idempotencyKey, ...previewPayload } = payload;
    void _idempotencyKey;
    const preview = await adminPostOrThrow<AdminManualWalletAdjustmentPreview>(
      '/admin/wallet-adjustments/preview',
      previewPayload,
    );
    return {
      inputKey: walletAdjustmentFormKeyFromFormData(formData),
      preview,
      status: 'success',
    };
  } catch (error) {
    return actionErrorState(error);
  }
}

export async function submitManualWalletAdjustmentRequest(
  _previousState: WalletAdjustmentActionState,
  formData: FormData,
): Promise<WalletAdjustmentActionState> {
  let payload: Awaited<ReturnType<typeof readManualWalletAdjustmentPayload>>;
  try {
    payload = await readManualWalletAdjustmentPayload(formData, false);
  } catch (error) {
    return actionErrorState(error);
  }

  let request: AdminManualWalletAdjustmentRequest;
  try {
    request = await adminPostOrThrow<AdminManualWalletAdjustmentRequest>(
      '/admin/wallet-adjustment-requests',
      payload,
    );
  } catch (error) {
    return actionErrorState(error);
  }

  revalidateWalletAdjustmentSurfaces(payload.ownerType, payload.ownerId);
  redirect(
    `/wallet-adjustments?view=requests&requestStatus=REQUESTED&adjustmentNotice=requested&requestId=${encodeURIComponent(request.id)}`,
  );
}

// Customer detail uses this action too. Its return target remains allowlisted, while the
// wallet workspace redirect never carries owner, amount, reason, or evidence values.
export async function createManualWalletAdjustment(formData: FormData) {
  const ownerType = readOptionalString(formData, 'ownerType');
  const ownerId = readOptionalString(formData, 'ownerId');
  const redirectTo = readCustomerDetailReturnTo(formData, ownerType, ownerId);
  let payload: Awaited<ReturnType<typeof readManualWalletAdjustmentPayload>>;

  try {
    payload = await readManualWalletAdjustmentPayload(formData, false);
  } catch (error) {
    const notice = error instanceof WalletAdjustmentValidationError ? error.notice : 'failed';
    return redirect(walletAdjustmentNoticeRedirect(notice, redirectTo));
  }

  let request: AdminManualWalletAdjustmentRequest;

  try {
    request = await adminPostOrThrow<AdminManualWalletAdjustmentRequest>(
      '/admin/wallet-adjustment-requests',
      payload,
    );
  } catch (error) {
    return redirect(
      walletAdjustmentNoticeRedirect(isAdminApiAuthError(error) ? 'admin-auth' : 'failed', redirectTo),
    );
  }

  revalidateWalletAdjustmentSurfaces(payload.ownerType, payload.ownerId);
  redirect(
    walletAdjustmentNoticeRedirect(
      'requested',
      redirectTo,
      request?.id ?? '',
    ),
  );
}

type WalletAdjustmentNotice =
  | 'admin-auth'
  | 'attachment-invalid'
  | 'attachment-required'
  | 'created'
  | 'requested'
  | 'failed'
  | 'monthly-period-invalid'
  | 'settlement-required';

function walletAdjustmentNoticeRedirect(
  notice: WalletAdjustmentNotice,
  redirectTo = '',
  requestId = '',
) {
  if (redirectTo) {
    const hashIndex = redirectTo.indexOf('#');
    const path = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
    const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : '';
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}walletAdjustmentNotice=${encodeURIComponent(notice)}${hash}`;
  }

  const params = new URLSearchParams({ adjustmentNotice: notice, view: 'create' });
  if (requestId) params.set('requestId', requestId);
  return `/wallet-adjustments?${params.toString()}`;
}

async function readManualWalletAdjustmentPayload(formData: FormData, previewOnly: boolean) {
  const ownerType = readEnum(formData, 'ownerType', ownerTypes, 'Wallet owner', 'ownerType');
  const ownerId = readRequiredString(formData, 'ownerId', 'Wallet owner', 'ownerId');
  const direction = readEnum(formData, 'direction', directions, 'Direction', 'direction');
  const adjustmentType = readEnum(
    formData,
    'adjustmentType',
    adjustmentTypes,
    'Adjustment reason',
    'adjustmentType',
  );
  const amount = readPositiveAmount(formData);
  const reason = readRequiredString(formData, 'reason', 'Detailed reason', 'reason');
  if (reason.length < 12) {
    throw new WalletAdjustmentValidationError(
      'reason',
      'REASON_TOO_SHORT',
      'Use at least 12 characters so the correction can be audited.',
    );
  }
  if (reason.length > REASON_MAX_LENGTH) {
    throw new WalletAdjustmentValidationError('reason', 'REASON_TOO_LONG', 'Use 1,000 characters or fewer.');
  }
  const monthlyPeriod = readMonthlyPeriod(formData);
  const attachmentUrl = readAttachmentUrl(formData);
  const attachmentFileId =
    readOptionalString(formData, 'attachmentFileId') || (await uploadWalletAdjustmentEvidence(formData));
  const operationalCause = readRequiredString(
    formData,
    'operationalCause',
    'Operational cause',
    'operationalCause',
  );
  const expectedCorrection = readRequiredString(
    formData,
    'expectedCorrection',
    'Expected correction',
    'expectedCorrection',
  );
  const caseReference = readOptionalString(formData, 'caseReference');

  if (adjustmentType === 'CASH_BOOKING_DEDUCTION') {
    throw new WalletAdjustmentValidationError(
      'adjustmentType',
      'WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED',
      'Cash booking deductions must be handled in booking settlement.',
      'settlement-required',
    );
  }
  if (adjustmentType === 'MANUAL_REVERSAL' && !readOptionalString(formData, 'reversalOfRequestId')) {
    throw new WalletAdjustmentValidationError(
      'adjustmentType',
      'WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED',
      'Start a reversal from an executed adjustment record.',
    );
  }
  if (
    !previewOnly &&
    requiresAttachmentEvidence(adjustmentType, amount) &&
    !attachmentFileId &&
    !attachmentUrl
  ) {
    throw new WalletAdjustmentValidationError(
      'attachmentFile',
      'ATTACHMENT_REQUIRED',
      'Add evidence before creating this approval request.',
      'attachment-required',
    );
  }

  return {
    adjustmentType,
    amount,
    ...(attachmentFileId ? { attachmentFileId } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(caseReference ? { caseReference } : {}),
    direction,
    expectedCorrection,
    idempotencyKey: readOptionalString(formData, 'idempotencyKey') || randomUUID(),
    ...(monthlyPeriod ? { monthlyPeriod } : {}),
    ownerId,
    ownerType,
    operationalCause,
    reason,
    ...(readOptionalString(formData, 'reversalOfRequestId')
      ? { reversalOfRequestId: readOptionalString(formData, 'reversalOfRequestId') }
      : {}),
  };
}

async function uploadWalletAdjustmentEvidence(formData: FormData) {
  const file = formData.get('attachmentFile');
  if (!(file instanceof File) || file.size === 0) return '';
  const contentType = file.type.trim().toLowerCase();
  if (!EVIDENCE_CONTENT_TYPES.has(contentType)) {
    throw new WalletAdjustmentValidationError(
      'attachmentFile',
      'ATTACHMENT_TYPE_INVALID',
      'Use a PDF, JPEG, PNG, or WebP evidence file.',
      'attachment-invalid',
    );
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    throw new WalletAdjustmentValidationError(
      'attachmentFile',
      'ATTACHMENT_TOO_LARGE',
      'Evidence files must be 10 MB or smaller.',
      'attachment-invalid',
    );
  }

  const presigned = await adminPostOrThrow<{
    file: { id: string };
    upload: { headers?: Record<string, string>; method: string; url: string };
  }>('/files/presign', {
    contentType,
    fileName: file.name,
    purpose: 'finance-evidence',
    sizeBytes: file.size,
    visibility: 'PRIVATE',
  });
  if (!/^https?:\/\//u.test(presigned.upload.url)) {
    throw new WalletAdjustmentValidationError(
      'attachmentFile',
      'STORAGE_UNAVAILABLE',
      'Private evidence storage is not configured.',
      'attachment-invalid',
    );
  }
  const upload = await fetch(presigned.upload.url, {
    body: Buffer.from(await file.arrayBuffer()),
    headers: presigned.upload.headers ?? { 'content-type': contentType },
    method: presigned.upload.method || 'PUT',
  });
  if (!upload.ok) {
    throw new WalletAdjustmentValidationError(
      'attachmentFile',
      'ATTACHMENT_UPLOAD_FAILED',
      'Evidence upload failed. Choose the file and try again.',
      'attachment-invalid',
    );
  }
  await adminPostOrThrow(`/files/${encodeURIComponent(presigned.file.id)}/complete`, {
    sizeBytes: file.size,
  });
  return presigned.file.id;
}

function readRequiredString(formData: FormData, key: string, label: string, field: string) {
  const value = readOptionalString(formData, key);
  if (!value) {
    throw new WalletAdjustmentValidationError(field, 'REQUIRED', `${label} is required.`);
  }
  return value;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveAmount(formData: FormData) {
  const value = Number(formData.get('amount'));
  if (!Number.isInteger(value) || value <= 0) {
    throw new WalletAdjustmentValidationError('amount', 'AMOUNT_INVALID', 'Enter a positive whole VND amount.');
  }
  if (value > AMOUNT_MAX) {
    throw new WalletAdjustmentValidationError('amount', 'AMOUNT_TOO_HIGH', 'Amount cannot exceed 1,000,000,000 VND.');
  }
  return value;
}

function readAttachmentUrl(formData: FormData) {
  const value = readOptionalString(formData, 'attachmentUrl');
  if (!value) return '';
  if (value.length > ATTACHMENT_MAX_LENGTH) {
    throw new WalletAdjustmentValidationError(
      'attachmentUrl',
      'ATTACHMENT_TOO_LONG',
      'Evidence reference must be 500 characters or fewer.',
      'attachment-invalid',
    );
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('unsupported protocol');
    return url.toString();
  } catch {
    throw new WalletAdjustmentValidationError(
      'attachmentUrl',
      'ATTACHMENT_INVALID',
      'Use a valid HTTPS evidence link.',
      'attachment-invalid',
    );
  }
}

function readMonthlyPeriod(formData: FormData) {
  const value = readOptionalString(formData, 'monthlyPeriod');
  if (!value) {
    throw new WalletAdjustmentValidationError(
      'monthlyPeriod',
      'WALLET_ADJUSTMENT_PERIOD_REQUIRED',
      'Choose an open accounting month.',
      'monthly-period-invalid',
    );
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new WalletAdjustmentValidationError(
      'monthlyPeriod',
      'MONTHLY_PERIOD_INVALID',
      'Choose a valid accounting month.',
      'monthly-period-invalid',
    );
  }
  return value;
}

function readEnum<T extends string>(
  formData: FormData,
  key: string,
  allowedValues: ReadonlySet<T>,
  label: string,
  field: string,
) {
  const value = readRequiredString(formData, key, label, field);
  if (!allowedValues.has(value as T)) {
    throw new WalletAdjustmentValidationError(field, 'INVALID_OPTION', `${label} is invalid.`);
  }
  return value as T;
}

function requiresAttachmentEvidence(adjustmentType: AdminManualWalletAdjustmentType, amount: number) {
  return amount >= HIGH_AMOUNT_ATTACHMENT_THRESHOLD || adjustmentType === 'RECEIVABLE_WRITE_OFF';
}

function actionErrorState(error: unknown): WalletAdjustmentActionState {
  if (error instanceof WalletAdjustmentValidationError) {
    return { code: error.code, field: error.field, message: error.message, status: 'error' };
  }
  if (isAdminApiAuthError(error)) {
    return {
      code: 'ADMIN_PERMISSION_REQUIRED',
      message: 'You do not have permission to create wallet adjustment requests.',
      status: 'error',
    };
  }
  if (error instanceof AdminApiRequestError) {
    const payload = error.payload;
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'PREVIEW_FAILED';
    const field = policyErrorField(code);
    return { code, field, message: policyErrorMessage(code), status: 'error' };
  }
  return {
    code: 'PREVIEW_FAILED',
    message: 'The preview could not be loaded. Your inputs are still here; try again.',
    status: 'error',
  };
}

function policyErrorField(code: string) {
  if (code === 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED') return 'adjustmentType';
  if (code === 'WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED') return 'adjustmentType';
  if (code === 'WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED') return 'adjustmentType';
  if (code === 'WALLET_ADJUSTMENT_PERIOD_REQUIRED') return 'monthlyPeriod';
  if (code === 'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND') return 'monthlyPeriod';
  if (code === 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN') return 'monthlyPeriod';
  if (code === 'WALLET_ADJUSTMENT_EVIDENCE_INVALID') return 'attachmentFile';
  return undefined;
}

function policyErrorMessage(code: string) {
  if (code === 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED') {
    return 'This wallet owner and adjustment reason cannot be used together. Choose another reason.';
  }
  if (code === 'WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED') {
    return 'Start a reversal from an executed adjustment record.';
  }
  if (code === 'WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED') {
    return 'Cash booking deductions must be handled in booking settlement.';
  }
  if (code === 'WALLET_ADJUSTMENT_PERIOD_REQUIRED') return 'Choose an open accounting month.';
  if (code === 'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND') return 'That accounting month no longer exists.';
  if (code === 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN') return 'That accounting month is no longer open.';
  if (code === 'WALLET_ADJUSTMENT_EVIDENCE_INVALID') return 'Upload a valid private finance evidence file.';
  return 'The preview could not be loaded. Your inputs are still here; try again.';
}

function safeActionMessage(error: unknown) {
  return error instanceof WalletAdjustmentValidationError
    ? error.message
    : 'Wallet owner search could not be loaded. Try again.';
}

function readCustomerDetailReturnTo(formData: FormData, ownerType: string, ownerId: string) {
  if (ownerType !== 'CUSTOMER' || !ownerId) return '';
  const requestedReturnTo = readOptionalString(formData, 'redirectTo');
  const expectedReturnTo = `/customers/${encodeURIComponent(ownerId)}#customer-wallet-adjustment-request`;
  return requestedReturnTo === expectedReturnTo ? expectedReturnTo : '';
}

function revalidateWalletAdjustmentSurfaces(ownerType: AdminManualWalletAdjustmentOwnerType, ownerId: string) {
  revalidatePath('/wallet-adjustments');
  revalidatePath('/finance-tax/approval-queue');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partners');
  revalidatePath('/customers');
  if (ownerType === 'CUSTOMER') revalidatePath(`/customers/${ownerId}`);
  revalidatePath('/audit-log');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

class WalletAdjustmentValidationError extends Error {
  constructor(
    readonly field: string,
    readonly code: string,
    message: string,
    readonly notice: WalletAdjustmentNotice = 'failed',
  ) {
    super(message);
  }
}
