import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminCustomerReferralParent, AdminReferralPolicy } from '../../lib/admin-api';
import { ReferralDashboard } from './referral-dashboard';

const policy: AdminReferralPolicy = {
  audience: 'CUSTOMER',
  commissionPercentBps: 500,
  currency: 'VND',
  enabled: true,
  fixedRewardAmount: null,
  holdPeriodDays: 7,
  maxRewardedReferrals: 5,
  maxRewardsPerReferred: 1,
  notes: null,
  perRewardCapAmount: null,
  policyId: 'policy-1',
  rewardMode: 'COMMISSION_PERCENT',
  source: 'stored-policy',
  totalRewardCapAmount: 500000,
};

const rows: AdminCustomerReferralParent[] = [
  {
    referrer: {
      id: 'parent-customer',
      user: {
        id: 'user-parent',
        fullName: 'Parent Customer',
        phone: '+84000000001',
      },
    },
    referralCode: {
      id: 'code-1',
      active: true,
      code: 'HANDSCUST',
      createdAt: '2026-06-24T10:00:00.000Z',
    },
    referrals: [],
    totals: {
      availableRewardAmount: 25000,
      availableRewardCount: 1,
      cancelledRewardAmount: 0,
      cancelledRewardCount: 0,
      heldRewardAmount: 0,
      heldRewardCount: 0,
      pendingRewardAmount: 5000,
      pendingRewardCount: 1,
      referralCount: 1,
      rewardedRewardAmount: 15000,
      rewardedRewardCount: 1,
      reversedRewardAmount: 0,
      reversedRewardCount: 0,
      rewardCount: 2,
      totalRewardAmount: 45000,
    },
  },
];

describe('ReferralDashboard', () => {
  it('renders policy controls and the hold-window release action', () => {
    const markup = renderToStaticMarkup(
      <ReferralDashboard audience="customer" policy={policy} rows={rows} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Customer Referrals');
    expect(markup).toContain('Policy changes are audited');
    expect(markup).not.toContain('read-only here');
    expect(markup).not.toContain('Release ready rewards');
    expect(markup).toContain('Mark ready rewards available');
    expect(markup).toContain('Reward candidates ready for credit');
    expect(markup).toContain('Credited rewards');
    expect(markup).toContain('15.000 VND');
    expect(markup).toContain('Wallet credit is separate');
    expect(markup).toContain('Does not create wallet ledger entries');
    expect(markup).toContain('Parent Customer');
    expect(markup).toContain('HANDSCUST');
  });

  it('does not render NaN when referral totals come from an older API shape', () => {
    const [legacyRow] = rows.map((row) => ({
      ...row,
      totals: {
        ...row.totals,
        rewardedRewardAmount: undefined,
        rewardedRewardCount: undefined,
      },
    }));

    const markup = renderToStaticMarkup(
      <ReferralDashboard
        audience="customer"
        policy={policy}
        rows={[legacyRow as unknown as AdminCustomerReferralParent]}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Credited rewards');
    expect(markup).not.toContain('NaN VND');
  });
});
