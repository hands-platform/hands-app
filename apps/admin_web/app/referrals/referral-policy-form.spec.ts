import { describe, expect, it } from 'vitest';

import type { AdminReferralPolicy } from '../../lib/admin-api';
import { policyChanges, policyDraft, policyDraftIsValid, policySaveBlocker } from './referral-policy-form';

const policy: AdminReferralPolicy = {
  audience: 'CUSTOMER',
  commissionPercentBps: 500,
  currency: 'VND',
  enabled: true,
  fixedRewardAmount: null,
  holdPeriodDays: 7,
  maxRewardedReferrals: 10,
  maxRewardsPerReferred: 1,
  notes: 'Operational policy',
  platformFeeVatRateBps: 800,
  perRewardCapAmount: 50_000,
  policyId: 'policy-1',
  rewardMode: 'COMMISSION_PERCENT',
  source: 'stored-policy',
  totalRewardCapAmount: 500_000,
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('referral policy form state', () => {
  it('keeps the unchanged policy in a no-save state', () => {
    const draft = policyDraft(policy);

    expect(policyChanges(policy, draft)).toEqual([]);
    expect(policyDraftIsValid(policy, draft)).toBe(true);
    expect(policySaveBlocker({ confirmed: false, dirty: false, reasonValid: false, valid: true }))
      .toBe('Change at least one policy value to enable save.');
  });

  it('describes before and after units and validates bounded percentage values', () => {
    const draft = { ...policyDraft(policy), commissionPercent: '6' };

    expect(policyChanges(policy, draft)).toContain('Reward percent: 5% -> 6%');
    expect(policyDraftIsValid(policy, draft)).toBe(true);
    expect(policyDraftIsValid(policy, { ...draft, commissionPercent: '101' })).toBe(false);
    expect(policySaveBlocker({ confirmed: true, dirty: true, reasonValid: true, valid: true }))
      .toBe('Ready to save with server validation and audit evidence.');
  });
});
