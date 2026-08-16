'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  AdminApiRequestError,
  type AdminReferralPolicy,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';

type ReferralRewardDecisionRevalidationInput = Pick<
  ReturnType<typeof referralRewardDecisionInput>,
  'audience' | 'parentId'
>;

export async function holdReferralReward(formData: FormData) {
  await runReferralRewardDecision(formData, 'hold', 'Reward moved to hold for review.');
}

export async function releaseHeldReferralReward(formData: FormData) {
  await runReferralRewardDecision(formData, 'release', 'Hold released. Reward is available for wallet review.');
}

export async function creditReferralReward(formData: FormData) {
  await runReferralRewardDecision(formData, 'credit', 'Reward credited to the verified wallet.');
}

export async function approveReferralRewardCashout(formData: FormData) {
  await runReferralRewardDecision(formData, 'cashout-approve', 'Cashout approved for payment review.');
}

export async function requireReferralRewardTaxReview(formData: FormData) {
  await runReferralRewardDecision(formData, 'tax-review', 'Reward moved to tax review.');
}

export async function markReferralRewardCashoutPaid(formData: FormData) {
  const transferRef = String(formData.get('transferRef') || '').trim();
  if (!transferRef) {
    redirectReferralDecisionValidation(formData, 'Referral cashout paid closeout requires a transfer reference');
  }

  await runReferralRewardDecision(formData, 'cashout-paid', 'Cashout marked paid with transfer evidence.', {
    transferRef,
  });
}

function redirectReferralDecisionValidation(formData: FormData, message: string): never {
  const input = referralRewardDecisionBaseInput(formData);
  redirect(
    referralRewardDecisionNoticeHref(input, 'blocked', 'validation', {
      message,
      reason: String(formData.get('reason') || '').trim(),
    }),
  );
}

export async function requestReferralCashoutBankCorrection(formData: FormData) {
  const bankAccountId = String(formData.get('bankAccountId') || '').trim();
  if (!bankAccountId) {
    throw new Error('Partner bank account id is required');
  }

  const input = {
    audience: normalizeReferralAudience(String(formData.get('audience') || 'partner')),
    parentId: String(formData.get('parentId') || '').trim(),
    reason: String(formData.get('reason') || '').trim(),
  };
  assertReferralDecisionReason(input.reason);

  await adminPostOrThrow(
    `/admin/partner-bank-accounts/${encodeURIComponent(bankAccountId)}/reject`,
    { reason: input.reason },
  );
  const basePath = input.audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
  revalidatePath(basePath);
  revalidatePath('/referrals/cashouts');
  if (input.parentId) {
    revalidatePath(`${basePath}/${encodeURIComponent(input.parentId)}`);
    revalidatePath(`/partners/${encodeURIComponent(input.parentId)}`);
  }
  revalidatePath('/audit-log');
}

export async function reverseReferralReward(formData: FormData) {
  await runReferralRewardDecision(formData, 'reverse', 'Reward reversed with an audit reason.');
}

export async function updateReferralPolicy(formData: FormData) {
  const audience = normalizeReferralAudience(String(formData.get('audience') || ''));
  const returnTo = referralPolicyReturnTo(formData, audience);
  const rewardMode = audience === 'partner' ? 'FIXED_AMOUNT' : 'COMMISSION_PERCENT';
  const enabled = String(formData.get('enabledState') || 'off') === 'on';
  const reason = String(formData.get('reason') || '').trim();
  const confirmed = String(formData.get('confirmation') || '') === 'confirmed';
  if (reason.length < 12 || reason.length > 500 || !confirmed) {
    redirect(referralPolicyNoticeHref(returnTo, 'blocked', 'confirmation-required'));
  }
  const payload = {
    enabled,
    rewardMode,
    commissionPercentBps: audience === 'customer' ? parsePercentBps(formData.get('commissionPercent')) : null,
    fixedRewardAmount: audience === 'partner' ? parseInteger(formData.get('fixedRewardAmount')) : null,
    platformFeeVatRateBps: parsePercentBps(formData.get('platformFeeVatRate')) ?? 800,
    perRewardCapAmount: parseInteger(formData.get('perRewardCapAmount')),
    totalRewardCapAmount: parseInteger(formData.get('totalRewardCapAmount')),
    maxRewardedReferrals: parseInteger(formData.get('maxRewardedReferrals')),
    maxRewardsPerReferred: parseInteger(formData.get('maxRewardsPerReferred')),
    holdPeriodDays: parseInteger(formData.get('holdPeriodDays')) ?? 7,
    currency: 'VND',
    notes: String(formData.get('notes') || '').trim() || null,
    expectedUpdatedAt: String(formData.get('expectedUpdatedAt') || '').trim() || null,
    reason,
  };

  try {
    await adminPatchOrThrow<AdminReferralPolicy>(`/admin/referrals/policies/${audience}`, payload);
  } catch (error) {
    redirect(
      referralPolicyNoticeHref(
        returnTo,
        error instanceof AdminApiRequestError && error.status === 409 ? 'conflict' : 'blocked',
        referralActionFailureCode(error),
      ),
    );
  }

  revalidatePath('/referrals/customers');
  revalidatePath('/referrals/partners');
  revalidatePath('/audit-log');
  redirect(referralPolicyNoticeHref(returnTo, 'saved', 'policy-updated'));
}

function referralPolicyReturnTo(formData: FormData, audience: 'customer' | 'partner') {
  const pathname = audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
  const value = String(formData.get('returnTo') || '').trim();
  try {
    const url = new URL(value, 'http://admin.local');
    if (url.origin === 'http://admin.local' && url.pathname === pathname && url.searchParams.get('settings') === 'policy') {
      return `${pathname}?settings=policy`;
    }
  } catch {
    // Use the restricted policy view below.
  }
  return `${pathname}?settings=policy`;
}

function referralPolicyNoticeHref(returnTo: string, status: string, reason: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('status', status);
  url.searchParams.set('reason', reason);
  return `${url.pathname}${url.search}`;
}

function normalizeReferralAudience(value: string) {
  return value.trim().toLowerCase() === 'partner' ? 'partner' : 'customer';
}

function referralRewardDecisionInput(formData: FormData) {
  const rewardId = String(formData.get('rewardId') || '').trim();
  if (!rewardId) {
    throw new Error('Referral reward id is required');
  }

  const reason = String(formData.get('reason') || '').trim();
  assertReferralDecisionReason(reason);
  if (String(formData.get('confirmation') || '') !== 'confirmed') {
    throw new Error('Confirm the reward decision before submitting');
  }
  const expectedStatus = String(formData.get('expectedStatus') || '').trim();
  const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') || '').trim();
  if (!expectedStatus || !expectedUpdatedAt) {
    throw new Error('Reward state evidence is required; refresh and try again');
  }

  return {
    audience: normalizeReferralAudience(String(formData.get('audience') || '')),
    expectedStatus,
    expectedUpdatedAt,
    parentId: String(formData.get('parentId') || '').trim(),
    reason,
    rewardId,
  };
}

async function runReferralRewardDecision(
  formData: FormData,
  action: 'cashout-approve' | 'cashout-paid' | 'credit' | 'hold' | 'release' | 'reverse' | 'tax-review',
  successMessage: string,
  extraPayload: Record<string, string> = {},
) {
  const baseInput = referralRewardDecisionBaseInput(formData);
  let input: ReturnType<typeof referralRewardDecisionInput>;
  try {
    input = referralRewardDecisionInput(formData);
  } catch (error) {
    redirect(
      referralRewardDecisionNoticeHref(baseInput, 'blocked', 'validation', {
        message: error instanceof Error ? error.message : 'Check the required decision evidence.',
        reason: String(formData.get('reason') || '').trim(),
      }),
    );
  }

  try {
    await adminPostOrThrow(
      `/admin/referrals/rewards/${encodeURIComponent(input.rewardId)}/${action}`,
      {
        expectedStatus: input.expectedStatus,
        expectedUpdatedAt: input.expectedUpdatedAt,
        reason: input.reason,
        ...extraPayload,
      },
    );
  } catch (error) {
    redirect(
      referralRewardDecisionNoticeHref(input, 'blocked', referralActionFailureCode(error), {
        message: referralActionFailureMessage(error),
        reason: input.reason,
      }),
    );
  }

  revalidateReferralRewardDecisionPaths(input);
  redirect(referralRewardDecisionNoticeHref(input, 'saved', action, { message: successMessage }));
}

function referralRewardDecisionBaseInput(formData: FormData) {
  return {
    audience: normalizeReferralAudience(String(formData.get('audience') || '')),
    parentId: String(formData.get('parentId') || '').trim(),
    rewardId: String(formData.get('rewardId') || '').trim(),
  };
}

function referralRewardDecisionNoticeHref(
  input: ReferralRewardDecisionRevalidationInput & { rewardId?: string },
  status: 'blocked' | 'saved',
  code: string,
  detail: { message: string; reason?: string },
) {
  const basePath = input.audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
  const path = input.parentId ? `${basePath}/${encodeURIComponent(input.parentId)}` : basePath;
  const params = new URLSearchParams({ actionCode: code, actionMessage: detail.message, actionStatus: status });
  if (detail.reason) params.set('actionReason', detail.reason.slice(0, 500));
  if (input.rewardId) params.set('rewardId', input.rewardId);
  return `${path}?${params.toString()}`;
}

function assertReferralDecisionReason(reason: string) {
  if (reason.length < 12 || reason.length > 500) {
    throw new Error('Decision reason must be between 12 and 500 characters');
  }
}

function referralActionFailureCode(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) return 'network';
  if (error.status === 400) return 'invalid';
  if (error.status === 403) return 'forbidden';
  if (error.status === 409) return 'conflict';
  return error.status >= 500 ? 'service' : 'rejected';
}

function referralActionFailureMessage(error: unknown) {
  const code = referralActionFailureCode(error);
  if (code === 'invalid') return 'The API rejected this decision. Review the evidence and reason.';
  if (code === 'forbidden') return 'You do not have permission to perform this reward action.';
  if (code === 'conflict') return 'This reward changed after the page loaded. Refresh before deciding again.';
  if (code === 'service') return 'The reward service failed. No successful action was recorded; retry later.';
  if (code === 'network') return 'The reward service could not be reached. Check connectivity and retry.';
  return 'The reward action was rejected. Refresh the record before retrying.';
}

function revalidateReferralRewardDecisionPaths(input: ReferralRewardDecisionRevalidationInput) {
  const basePath = input.audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
  revalidatePath(basePath);
  revalidatePath('/referrals/cashouts');
  if (input.parentId) {
    revalidatePath(`${basePath}/${encodeURIComponent(input.parentId)}`);
  }
  revalidatePath('/audit-log');
}

function parsePercentBps(value: FormDataEntryValue | null) {
  const number = parseNumber(value);
  return number === null ? null : Math.round(number * 100);
}

function parseInteger(value: FormDataEntryValue | null) {
  const number = parseNumber(value);
  return number === null ? null : Math.trunc(number);
}

function parseNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
