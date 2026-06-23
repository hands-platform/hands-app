'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type AdminReferralPolicy, adminPatch } from '../../lib/admin-api';

export async function updateReferralPolicy(formData: FormData) {
  const audience = normalizeReferralAudience(String(formData.get('audience') || ''));
  const returnTo = audience === 'partner' ? '/referrals/partners' : '/referrals/customers';
  const rewardMode = audience === 'partner' ? 'FIXED_AMOUNT' : 'COMMISSION_PERCENT';
  const enabled = String(formData.get('enabledState') || 'off') === 'on';
  const payload = {
    enabled,
    rewardMode,
    commissionPercentBps: audience === 'customer' ? parsePercentBps(formData.get('commissionPercent')) : null,
    fixedRewardAmount: audience === 'partner' ? parseInteger(formData.get('fixedRewardAmount')) : null,
    totalRewardCapAmount: parseInteger(formData.get('totalRewardCapAmount')),
    maxRewardedReferrals: parseInteger(formData.get('maxRewardedReferrals')),
    maxRewardsPerReferred: parseInteger(formData.get('maxRewardsPerReferred')),
    holdPeriodDays: parseInteger(formData.get('holdPeriodDays')) ?? 7,
    currency: String(formData.get('currency') || 'VND').trim().toUpperCase() || 'VND',
    notes: String(formData.get('notes') || '').trim() || null,
    reason: String(formData.get('reason') || '').trim() || 'Updated referral policy from Admin Web.',
  };

  const saved = await adminPatch<AdminReferralPolicy | null>(
    `/admin/referrals/policies/${audience}`,
    payload,
    null,
  );
  if (!saved?.audience) {
    redirect(`${returnTo}?status=blocked&reason=api-rejected`);
  }

  revalidatePath('/referrals/customers');
  revalidatePath('/referrals/partners');
  revalidatePath('/audit-log');
  redirect(`${returnTo}?status=saved&reason=policy-updated`);
}

function normalizeReferralAudience(value: string) {
  return value.trim().toLowerCase() === 'partner' ? 'partner' : 'customer';
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
