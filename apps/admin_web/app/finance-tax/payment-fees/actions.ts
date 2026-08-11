'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminPatchOrThrow, adminPostOrThrow } from '../../../lib/admin-api';

const PAYMENT_FEE_METHODS = new Set([
  'MOMO',
  'VNPAY',
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'CUSTOMER_WALLET',
  'MANUAL',
]);
const PAYMENT_FEE_RULE_TYPES = new Set(['RATE', 'FIXED', 'RATE_PLUS_FIXED']);
const PAYMENT_FEE_PAYERS = new Set(['HANDS', 'CUSTOMER', 'PARTNER', 'SHARED']);
const PAYMENT_FEE_TREATMENTS = new Set(['OPERATING_EXPENSE', 'PASS_THROUGH', 'MANUAL_REVIEW']);
const PAYMENT_FEE_DECISION_REASON_MIN_LENGTH = 12;

export async function createPaymentFeePolicyDraft(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const name = requiredText(formData, 'name');
  const effectiveFrom = requiredDate(formData, 'effectiveFrom');
  const effectiveTo = optionalDate(formData, 'effectiveTo');
  const notes = optionalText(formData, 'notes');
  const reason = requiredText(formData, 'reason');
  if (!name || !effectiveFrom || !validDateWindow(effectiveFrom, effectiveTo) || !validReason(reason)) {
    return redirectWithNotice(returnTo, 'validation');
  }

  let policy: { id: string };
  try {
    policy = await adminPostOrThrow('/admin/payment-fee-policies', {
      name,
      effectiveFrom,
      effectiveTo,
      notes,
      reason,
    });
  } catch {
    return redirectWithNotice(returnTo, 'failed');
  }
  revalidatePaymentFeePaths();
  redirectWithNotice(withPolicy(returnTo, policy.id), 'created');
}

export async function updatePaymentFeePolicyDraft(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const name = requiredText(formData, 'name');
  const effectiveFrom = requiredDate(formData, 'effectiveFrom');
  const effectiveTo = optionalDate(formData, 'effectiveTo');
  const notes = optionalText(formData, 'notes');
  const reason = requiredText(formData, 'reason');
  if (!policyId || !name || !effectiveFrom || !validDateWindow(effectiveFrom, effectiveTo) || !validReason(reason)) {
    return redirectWithNotice(returnTo, 'validation');
  }

  try {
    await adminPatchOrThrow(`/admin/payment-fee-policies/${encodeURIComponent(policyId)}`, {
      name,
      effectiveFrom,
      effectiveTo,
      notes,
      reason,
    });
  } catch {
    return redirectWithNotice(returnTo, 'failed');
  }
  revalidatePaymentFeePaths();
  redirectWithNotice(withPolicy(returnTo, policyId), 'updated');
}

export async function upsertPaymentFeePolicyRule(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const method = enumValue(formData, 'method', PAYMENT_FEE_METHODS);
  const feeType = enumValue(formData, 'feeType', PAYMENT_FEE_RULE_TYPES);
  const payer = enumValue(formData, 'payer', PAYMENT_FEE_PAYERS);
  const treatment = enumValue(formData, 'treatment', PAYMENT_FEE_TREATMENTS);
  const rateBps = nonNegativeInteger(formData, 'rateBps');
  const fixedAmount = nonNegativeInteger(formData, 'fixedAmount');
  const reason = requiredText(formData, 'reason');
  const invalidShape =
    rateBps < 0 ||
    fixedAmount < 0 ||
    (feeType === 'RATE' && fixedAmount !== 0) ||
    (feeType === 'FIXED' && rateBps !== 0) ||
    rateBps > 10000;
  if (!policyId || !method || !feeType || !payer || !treatment || invalidShape || !validReason(reason)) {
    return redirectWithNotice(returnTo, 'validation');
  }

  try {
    await adminPostOrThrow(`/admin/payment-fee-policies/${encodeURIComponent(policyId)}/rules`, {
      method,
      feeType,
      payer,
      treatment,
      rateBps,
      fixedAmount,
      reason,
    });
  } catch {
    return redirectWithNotice(returnTo, 'failed');
  }
  revalidatePaymentFeePaths();
  redirectWithNotice(withPolicy(returnTo, policyId), 'rule-saved');
}

export async function activatePaymentFeePolicy(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const confirmationPolicyId = requiredText(formData, 'confirmationPolicyId');
  const approvalAdminId = requiredText(formData, 'approvalAdminId');
  const reason = requiredText(formData, 'reason');
  if (!confirmedPolicyChange(policyId, confirmationPolicyId, reason) || !approvalAdminId) {
    return redirectWithNotice(returnTo, 'confirmation-required');
  }

  try {
    await adminPostOrThrow(`/admin/payment-fee-policies/${encodeURIComponent(policyId)}/activate`, {
      approvalAdminId,
      reason,
    });
  } catch {
    return redirectWithNotice(returnTo, 'activation-failed');
  }
  revalidatePaymentFeePaths();
  return redirectWithNotice(withPolicy(returnTo, policyId), 'activated');
}

export async function requestPaymentFeePolicyApproval(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const confirmationPolicyId = requiredText(formData, 'confirmationPolicyId');
  const reason = requiredText(formData, 'reason');
  if (!confirmedPolicyChange(policyId, confirmationPolicyId, reason)) {
    return redirectWithNotice(returnTo, 'confirmation-required');
  }

  try {
    await adminPostOrThrow(
      `/admin/payment-fee-policies/${encodeURIComponent(policyId)}/approval-request`,
      { reason },
    );
  } catch {
    return redirectWithNotice(returnTo, 'approval-request-failed');
  }
  revalidatePaymentFeePaths();
  return redirectWithNotice(withPolicy(returnTo, policyId), 'approval-requested');
}

export async function rejectPaymentFeePolicyApproval(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const confirmationPolicyId = requiredText(formData, 'confirmationPolicyId');
  const reason = requiredText(formData, 'reason');
  if (!confirmedPolicyChange(policyId, confirmationPolicyId, reason)) {
    return redirectWithNotice(returnTo, 'confirmation-required');
  }

  try {
    await adminPostOrThrow(
      `/admin/payment-fee-policies/${encodeURIComponent(policyId)}/approval-reject`,
      { reason },
    );
  } catch {
    return redirectWithNotice(returnTo, 'approval-reject-failed');
  }
  revalidatePaymentFeePaths();
  return redirectWithNotice(withPolicy(returnTo, policyId), 'approval-rejected');
}

export async function cancelPaymentFeePolicyApproval(formData: FormData) {
  const returnTo = paymentFeeReturnTo(formData);
  const policyId = requiredText(formData, 'policyId');
  const confirmationPolicyId = requiredText(formData, 'confirmationPolicyId');
  const reason = requiredText(formData, 'reason');
  if (!confirmedPolicyChange(policyId, confirmationPolicyId, reason)) {
    return redirectWithNotice(returnTo, 'confirmation-required');
  }

  try {
    await adminPostOrThrow(
      `/admin/payment-fee-policies/${encodeURIComponent(policyId)}/approval-cancel`,
      { reason },
    );
  } catch {
    return redirectWithNotice(returnTo, 'approval-cancel-failed');
  }
  revalidatePaymentFeePaths();
  return redirectWithNotice(withPolicy(returnTo, policyId), 'approval-cancelled');
}

function confirmedPolicyChange(policyId: string, confirmationPolicyId: string, reason: string) {
  return Boolean(
    policyId &&
    confirmationPolicyId === policyId &&
    reason.length >= PAYMENT_FEE_DECISION_REASON_MIN_LENGTH
  );
}

function validReason(reason: string) {
  return reason.length >= PAYMENT_FEE_DECISION_REASON_MIN_LENGTH;
}

function requiredText(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim();
}

function optionalText(formData: FormData, name: string) {
  return requiredText(formData, name) || null;
}

function requiredDate(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function optionalDate(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function validDateWindow(effectiveFrom: string, effectiveTo: string | null) {
  return !effectiveTo || Date.parse(effectiveTo) > Date.parse(effectiveFrom);
}

function enumValue(formData: FormData, name: string, values: ReadonlySet<string>) {
  const value = requiredText(formData, name).toUpperCase();
  return values.has(value) ? value : null;
}

function nonNegativeInteger(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  return Number.isInteger(value) && value >= 0 ? value : -1;
}

function paymentFeeReturnTo(formData: FormData) {
  const value = requiredText(formData, 'returnTo');
  if (!value || value.startsWith('//') || value.includes('\n')) {
    return '/finance-tax/payment-fees';
  }
  try {
    const url = new URL(value, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/finance-tax/payment-fees') {
      return '/finance-tax/payment-fees';
    }
    const safe = new URL('/finance-tax/payment-fees', 'http://admin.local');
    for (const key of ['period', 'policyId', 'method']) {
      const item = url.searchParams.get(key);
      if (item) safe.searchParams.set(key, item);
    }
    if (url.searchParams.get('settings') === 'policy') safe.searchParams.set('settings', 'policy');
    return `${safe.pathname}${safe.search}`;
  } catch {
    return '/finance-tax/payment-fees';
  }
}

function withPolicy(returnTo: string, policyId: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('policyId', policyId);
  url.searchParams.delete('policyNotice');
  return `${url.pathname}${url.search}`;
}

function redirectWithNotice(returnTo: string, notice: string): never {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('policyNotice', notice);
  redirect(`${url.pathname}${url.search}`);
}

function revalidatePaymentFeePaths() {
  revalidatePath('/finance-tax/payment-fees');
  revalidatePath('/finance-overview');
  revalidatePath('/finance-closeout');
  revalidatePath('/audit-log');
}
