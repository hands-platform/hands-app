'use server';

import { revalidatePath } from 'next/cache';

import type {
  AdminManualWalletAdjustmentDirection,
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentType,
} from '../../lib/admin-api';
import { adminPostOrThrow } from '../../lib/admin-api';

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

export async function createManualWalletAdjustment(formData: FormData) {
  const payload = readManualWalletAdjustmentPayload(formData, true);

  await adminPostOrThrow('/admin/wallet-adjustments', payload);

  revalidatePath('/wallet-adjustments');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/payouts');
  revalidatePath('/partners');
  revalidatePath('/customers');
  revalidatePath('/audit-log');
}

export function readManualWalletAdjustmentPayload(formData: FormData, requireApproval: boolean) {
  const ownerType = readEnum(formData, 'ownerType', ownerTypes, 'Owner type');
  const ownerId = readRequiredString(formData, 'ownerId', 'Owner profile id');
  const direction = readEnum(formData, 'direction', directions, 'Direction');
  const adjustmentType = readEnum(formData, 'adjustmentType', adjustmentTypes, 'Adjustment type');
  const amount = readPositiveAmount(formData);
  const reason = readRequiredString(formData, 'reason', 'Reason');
  const approvalId = readOptionalString(formData, 'approvalId');
  const monthlyPeriod = readOptionalString(formData, 'monthlyPeriod');
  const attachmentUrl = readOptionalString(formData, 'attachmentUrl');

  if (requireApproval && !approvalId) {
    throw new Error('Approval id is required');
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
