'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type {
  AdminManualWalletAdjustmentDirection,
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentType,
} from '../../lib/admin-api';
import { adminPostOrThrow, isAdminApiAuthError } from '../../lib/admin-api';

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
const HIGH_AMOUNT_ATTACHMENT_THRESHOLD = 10_000_000;
const ATTACHMENT_REQUIRED_ADJUSTMENT_TYPES = new Set<AdminManualWalletAdjustmentType>([
  'RECEIVABLE_WRITE_OFF',
]);
const SETTLEMENT_ONLY_ADJUSTMENT_TYPES = new Set<AdminManualWalletAdjustmentType>([
  'CASH_BOOKING_DEDUCTION',
]);

export async function createManualWalletAdjustment(formData: FormData) {
  let payload: ReturnType<typeof readManualWalletAdjustmentPayload>;

  try {
    payload = readManualWalletAdjustmentPayload(formData, true);
  } catch (error) {
    const notice =
      error instanceof WalletAdjustmentValidationError ? error.notice : 'failed';
    return redirect(
      walletAdjustmentNoticeRedirect(notice, readManualWalletAdjustmentRedirectContext(formData)),
    );
  }

  try {
    await adminPostOrThrow('/admin/wallet-adjustments', payload);
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect(walletAdjustmentNoticeRedirect('admin-auth', payload));
    }
    return redirect(walletAdjustmentNoticeRedirect('failed', payload));
  }

  revalidatePath('/wallet-adjustments');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partners');
  revalidatePath('/customers');
  revalidatePath('/audit-log');
  redirect(walletAdjustmentNoticeRedirect('created', payload));
}

type WalletAdjustmentNotice =
  | 'admin-auth'
  | 'approval-required'
  | 'attachment-invalid'
  | 'attachment-required'
  | 'created'
  | 'failed'
  | 'settlement-required';

type WalletAdjustmentRedirectContext = {
  readonly adjustmentType?: AdminManualWalletAdjustmentType;
  readonly amount?: number | string;
  readonly approvalId?: string;
  readonly attachmentUrl?: string;
  readonly direction?: AdminManualWalletAdjustmentDirection;
  readonly monthlyPeriod?: string;
  readonly ownerId?: string;
  readonly ownerType?: AdminManualWalletAdjustmentOwnerType;
  readonly reason?: string;
};

function walletAdjustmentNoticeRedirect(notice: WalletAdjustmentNotice, context: WalletAdjustmentRedirectContext) {
  const params = new URLSearchParams({ adjustmentNotice: notice });

  if (context.ownerType) {
    params.set('ownerType', context.ownerType);
  }

  if (context.ownerId) {
    params.set('ownerId', context.ownerId);
  }

  if (context.direction) {
    params.set('direction', context.direction);
  }

  if (context.adjustmentType) {
    params.set('adjustmentType', context.adjustmentType);
  }

  if (context.amount !== undefined && context.amount !== '') {
    params.set('amount', String(context.amount));
  }

  if (context.approvalId) {
    params.set('approvalId', context.approvalId);
  }

  if (context.reason) {
    params.set('reason', context.reason);
  }

  if (context.monthlyPeriod) {
    params.set('monthlyPeriod', context.monthlyPeriod);
  }

  if (context.attachmentUrl) {
    params.set('attachmentUrl', context.attachmentUrl);
  }

  return `/wallet-adjustments?${params.toString()}`;
}

function readManualWalletAdjustmentRedirectContext(formData: FormData): WalletAdjustmentRedirectContext {
  const ownerType = readOptionalString(formData, 'ownerType');
  const ownerId = readOptionalString(formData, 'ownerId');
  const direction = readOptionalString(formData, 'direction');
  const adjustmentType = readOptionalString(formData, 'adjustmentType');
  const amount = readOptionalString(formData, 'amount');
  const approvalId = readOptionalString(formData, 'approvalId');
  const attachmentUrl = readSafeAttachmentUrlForRedirect(formData);
  const monthlyPeriod = readOptionalString(formData, 'monthlyPeriod');
  const reason = readOptionalString(formData, 'reason');

  return {
    ...(adjustmentTypes.has(adjustmentType as AdminManualWalletAdjustmentType)
      ? { adjustmentType: adjustmentType as AdminManualWalletAdjustmentType }
      : {}),
    ...(amount ? { amount } : {}),
    ...(approvalId ? { approvalId } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(directions.has(direction as AdminManualWalletAdjustmentDirection)
      ? { direction: direction as AdminManualWalletAdjustmentDirection }
      : {}),
    ...(monthlyPeriod ? { monthlyPeriod } : {}),
    ...(ownerTypes.has(ownerType as AdminManualWalletAdjustmentOwnerType)
      ? { ownerType: ownerType as AdminManualWalletAdjustmentOwnerType }
      : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(reason ? { reason } : {}),
  };
}

function readManualWalletAdjustmentPayload(formData: FormData, requireApproval: boolean) {
  const ownerType = readEnum(formData, 'ownerType', ownerTypes, 'Owner type');
  const ownerId = readRequiredString(formData, 'ownerId', 'Owner profile id');
  const direction = readEnum(formData, 'direction', directions, 'Direction');
  const adjustmentType = readEnum(formData, 'adjustmentType', adjustmentTypes, 'Adjustment type');
  const amount = readPositiveAmount(formData);
  const reason = readRequiredString(formData, 'reason', 'Reason');
  const approvalId = readOptionalString(formData, 'approvalId');
  const monthlyPeriod = readOptionalString(formData, 'monthlyPeriod');
  const attachmentUrl = readAttachmentUrl(formData);

  if (SETTLEMENT_ONLY_ADJUSTMENT_TYPES.has(adjustmentType)) {
    throw new WalletAdjustmentValidationError('settlement-required');
  }

  if (requireApproval && !approvalId) {
    throw new WalletAdjustmentValidationError('approval-required');
  }

  if (requiresAttachmentEvidence(adjustmentType, amount) && !attachmentUrl) {
    throw new WalletAdjustmentValidationError('attachment-required');
  }

  return {
    adjustmentType,
    amount,
    ...(approvalId ? { approvalId } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    direction,
    ...(monthlyPeriod ? { monthlyPeriod } : {}),
    ownerId,
    ownerType,
    reason,
  };
}

function readRequiredString(formData: FormData, key: string, label: string) {
  const value = readOptionalString(formData, key);
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveAmount(formData: FormData) {
  const value = Number(formData.get('amount'));
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  return value;
}

function readAttachmentUrl(formData: FormData) {
  const value = readOptionalString(formData, 'attachmentUrl');
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new WalletAdjustmentValidationError('attachment-invalid');
  }
}

function readSafeAttachmentUrlForRedirect(formData: FormData) {
  try {
    return readAttachmentUrl(formData);
  } catch {
    return '';
  }
}

function readEnum<T extends string>(
  formData: FormData,
  key: string,
  allowedValues: ReadonlySet<T>,
  label: string,
) {
  const value = readRequiredString(formData, key, label);
  if (!allowedValues.has(value as T)) {
    throw new Error(`${label} is invalid`);
  }
  return value as T;
}

function requiresAttachmentEvidence(
  adjustmentType: AdminManualWalletAdjustmentType,
  amount: number,
) {
  return (
    amount >= HIGH_AMOUNT_ATTACHMENT_THRESHOLD ||
    ATTACHMENT_REQUIRED_ADJUSTMENT_TYPES.has(adjustmentType)
  );
}

class WalletAdjustmentValidationError extends Error {
  constructor(readonly notice: WalletAdjustmentNotice) {
    super(notice);
  }
}
