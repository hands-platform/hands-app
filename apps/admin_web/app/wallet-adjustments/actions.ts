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
  | 'attachment-required'
  | 'created'
  | 'failed'
  | 'settlement-required';

type WalletAdjustmentRedirectContext = {
  readonly ownerId?: string;
  readonly ownerType?: AdminManualWalletAdjustmentOwnerType;
};

function walletAdjustmentNoticeRedirect(notice: WalletAdjustmentNotice, context: WalletAdjustmentRedirectContext) {
  const params = new URLSearchParams({ adjustmentNotice: notice });

  if (context.ownerType) {
    params.set('ownerType', context.ownerType);
  }

  if (context.ownerId) {
    params.set('ownerId', context.ownerId);
  }

  return `/wallet-adjustments?${params.toString()}`;
}

function readManualWalletAdjustmentRedirectContext(formData: FormData): WalletAdjustmentRedirectContext {
  const ownerType = readOptionalString(formData, 'ownerType');
  const ownerId = readOptionalString(formData, 'ownerId');

  return {
    ...(ownerTypes.has(ownerType as AdminManualWalletAdjustmentOwnerType)
      ? { ownerType: ownerType as AdminManualWalletAdjustmentOwnerType }
      : {}),
    ...(ownerId ? { ownerId } : {}),
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
  const attachmentUrl = readOptionalString(formData, 'attachmentUrl');

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
