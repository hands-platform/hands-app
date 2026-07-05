import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminCustomerReferralParent } from '../../lib/admin-api';
import { ReferralParentDetailPage, referralParentDetailHref } from './referral-detail';

const createdAt = '2026-06-24T10:00:00.000Z';
const referralStoreEnvKeys = [
  'REFERRAL_PUBLIC_BASE_URL',
  'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
  'REFERRAL_CUSTOMER_IOS_STORE_URL',
  'CUSTOMER_ANDROID_STORE_URL',
  'CUSTOMER_IOS_STORE_URL',
  'CUSTOMER_ANDROID_APP_URL',
  'CUSTOMER_IOS_APP_URL',
] as const;
const detailSource = readFileSync('app/referrals/referral-detail.tsx', 'utf8');

const customerReferralParent: AdminCustomerReferralParent = {
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
    createdAt,
  },
  referrals: [
    {
      id: 'attribution-1',
      createdAt,
      fraudReviewStatus: 'CLEAR',
      installSource: 'referral-link',
      platform: 'ios',
      referredCustomer: {
        id: 'referred-customer',
        user: {
          id: 'user-referred',
          fullName: 'Referred Customer',
          phone: '+84000000002',
        },
      },
      rewards: [
        {
          id: 'reward-1',
          amount: 25000,
          availableAt: createdAt,
          createdAt,
          currency: 'VND',
          latestDecision: {
            action: 'referral_reward.credit',
            actor: {
              id: 'admin-1',
              fullName: 'Ops Admin',
              phone: '+84000009999',
            },
            createdAt: '2026-06-24T11:00:00.000Z',
            reason: 'manual payout check',
            status: 'REWARDED',
            walletLedgerReference: 'wallet-ledger-1',
          },
          qualifyingBookingId: 'booking-1',
          status: 'AVAILABLE',
          walletLedgerReference: 'wallet-ledger-1',
        },
      ],
      status: 'QUALIFIED',
    },
  ],
  totals: {
    availableRewardAmount: 25000,
    availableRewardCount: 1,
    cancelledRewardAmount: 0,
    cancelledRewardCount: 0,
    heldRewardAmount: 0,
    heldRewardCount: 0,
    pendingRewardAmount: 0,
    pendingRewardCount: 0,
    referralCount: 1,
    rewardedRewardAmount: 0,
    rewardedRewardCount: 0,
    reversedRewardAmount: 0,
    reversedRewardCount: 0,
    rewardCount: 1,
    totalRewardAmount: 25000,
  },
};

describe('Referral detail presentation', () => {
  const originalReferralStoreEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of referralStoreEnvKeys) {
      originalReferralStoreEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.REFERRAL_CUSTOMER_ANDROID_STORE_URL =
      'https://play.google.com/store/apps/details?id=com.massagevn.customer';
  });

  afterEach(() => {
    for (const key of referralStoreEnvKeys) {
      const originalValue = originalReferralStoreEnv.get(key);
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
    originalReferralStoreEnv.clear();
  });

  it('builds stable referral parent detail routes', () => {
    expect(referralParentDetailHref('customer', 'parent customer')).toBe('/referrals/customers/parent%20customer');
    expect(referralParentDetailHref('partner', 'parent-partner')).toBe('/referrals/partners/parent-partner');
  });

  it('renders parent, attribution, and reward ledger details without listing unrelated accounts', () => {
    const markup = renderToStaticMarkup(
      <ReferralParentDetailPage audience="customer" row={customerReferralParent} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Customer Referral Detail');
    expect(markup).toContain('Parent Customer');
    expect(markup).toContain('/customers/parent-customer');
    expect(markup).toContain('HANDSCUST');
    expect(markup).toContain('Referred Customer');
    expect(markup.match(/href="\/customers\/referred-customer"/g)).toHaveLength(2);
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section"',
    );
    expect(markup).toContain('Attribution attribution-1');
    expect(markup).toContain('Credited 1');
    expect(markup).toContain('1 reward(s) / <span class="money-text money-text-positive">25.000 VND</span>');
    expect(markup).toContain('wallet-ledger-1');
    expect(markup).toContain('class="admin-disclosure referral-reward-evidence-details"');
    expect(markup).toContain('<summary>Decision evidence</summary>');
    expect(markup).toContain('Decision evidence');
    expect(markup).toContain('Ledger wallet-ledger-1');
    expect(markup).toContain('Booking booking-1');
    expect(markup).toContain('Latest decision Credit by Ops Admin');
    expect(markup).toContain('Reason manual payout check');
    expect(markup).toContain('AVAILABLE');
    expect(markup).not.toContain('Hold reward');
    expect(markup).not.toContain('Reverse reward');
  });

  it('renders customer reward calculation snapshots for accounting review', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              amount: 35556,
              calculationSnapshot: {
                companyOutputVat: 9481,
                platformFeeGross: 128000,
                platformFeeNetRevenue: 118519,
                platformFeeVatRateBps: 800,
                rewardAmountSnapshot: 35556,
                rewardRateSnapshotBps: 3000,
              },
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('Calculation snapshot');
    expect(markup).toContain('Gross fee <span class="money-text money-text-positive">128.000 VND</span>');
    expect(markup).toContain('VAT 8%');
    expect(markup).toContain('Net fee <span class="money-text money-text-positive">118.519 VND</span>');
    expect(markup).toContain('Rate 30%');
    expect(markup).toContain('Snapshot reward <span class="money-text money-text-positive">35.556 VND</span>');
  });

  it('shows referral public link and store URL readiness on the parent detail', () => {
    const markup = renderToStaticMarkup(
      <ReferralParentDetailPage audience="customer" row={customerReferralParent} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Referral store setup');
    expect(markup).toContain('Public link base missing');
    expect(markup).toContain('Android store ready');
    expect(markup).toContain('iOS store missing');
    expect(markup).toContain('Configure store URLs');
    expect(markup).toContain('href="/setup#referrals"');
  });

  it('summarizes credited referral rewards separately from available candidates', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      totals: {
        ...customerReferralParent.totals,
        availableRewardAmount: 0,
        availableRewardCount: 0,
        rewardedRewardAmount: 25000,
        rewardedRewardCount: 1,
      },
    };

    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('Credited rewards');
    expect(markup).toContain('Rewards already posted to wallet ledger entries.');
    expect(markup).toContain('25.000 VND');
  });

  it('renders hold and reverse actions for uncredited reward candidates', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              qualifyingBookingId: null,
              status: 'PENDING',
              walletLedgerReference: null,
            },
          ],
        },
      ],
    };
    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('admin-action-dropdown referral-reward-action-dropdown');
    expect(markup).toContain('aria-label="Referral reward actions for reward-1"');
    expect(markup).toContain('Hold for review');
    expect(markup).toContain('Reverse reward');
    expect(markup).not.toContain('No booking');
    expect(markup).toContain('No qualifying booking linked');
    expect(markup.match(/No qualifying booking linked/g)).toHaveLength(1);
    expect(markup).toContain('name="parentId" value="parent-customer"');
    expect(markup).toContain('placeholder="Operator decision reason"');
    expect(markup).toContain('admin-form-input referral-reward-action-reason-input');
    expect(markup).toContain('Reward decision reason');
    expect(markup.match(/name="reason"/g)).toHaveLength(1);
    expect(markup).not.toContain('placeholder="Operator reason for hold"');
    expect(markup).not.toContain('placeholder="Operator reason for reversal"');
    expect(markup).not.toContain('Hold referral reward for admin review from detail page.');
    expect(markup).not.toContain('Reverse referral reward from detail review.');
  });

  it('uses the shared Vuexy action dropdown surface for reward decision forms', () => {
    expect(detailSource).toContain('ActionMenuDropdownSurface');
    expect(detailSource).not.toContain('<details className="admin-action-dropdown referral-reward-action-dropdown">');
  });

  it('uses the shared MoneyText atom for visible referral detail money values', () => {
    expect(detailSource).toContain('MoneyText');
    expect(detailSource).not.toContain('formatMoney(');
  });

  it('renders a wallet credit action only for available uncredited reward candidates', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              status: 'AVAILABLE',
              walletLedgerReference: null,
            },
          ],
        },
      ],
    };
    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('admin-action-dropdown referral-reward-action-dropdown');
    expect(markup).toContain('Credit to wallet');
    expect(markup).toContain('placeholder="Operator decision reason"');
    expect(markup).toContain('admin-form-input referral-reward-action-reason-input');
    expect(markup).toContain('Reward decision reason');
    expect(markup).toContain('No wallet ledger yet');
    expect(markup).toContain('Operator reason required for next action');
    expect(markup).not.toContain('Credit ready referral reward to wallet after detail review.');
  });

  it('renders cashout approval and tax review actions for cashout-requested wallet rewards', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              status: 'CASHOUT_REQUESTED',
              walletLedgerReference: 'customer-wallet-ledger-1',
            },
          ],
        },
      ],
    };
    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('admin-action-dropdown referral-reward-action-dropdown');
    expect(markup).toContain('Approve cashout');
    expect(markup).toContain('Require tax review');
    expect(markup).toContain('Cashout requested');
    expect(markup).toContain('customer-wallet-ledger-1');
    expect(markup).not.toContain('<td><span class="muted">Ledger posted</span></td>');
  });

  it('renders a paid closeout action with transfer reference for approved cashouts', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              status: 'CASHOUT_APPROVED',
              walletLedgerReference: 'customer-earned-ledger-1',
            },
          ],
        },
      ],
    };
    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('admin-action-dropdown referral-reward-action-dropdown');
    expect(markup).toContain('Mark paid');
    expect(markup).toContain('Require tax review');
    expect(markup).toContain('Transfer reference');
    expect(markup).toContain('name="transferRef"');
    expect(markup).toContain('Cashout approved');
  });

  it('summarizes reward rows into an operator review board', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              id: 'reward-ready',
              status: 'AVAILABLE',
              walletLedgerReference: null,
            },
            {
              ...customerReferralParent.referrals[0].rewards[0],
              id: 'reward-held',
              amount: 10000,
              status: 'HELD',
              walletLedgerReference: null,
            },
          ],
        },
      ],
      totals: {
        ...customerReferralParent.totals,
        heldRewardAmount: 10000,
        heldRewardCount: 1,
        rewardCount: 2,
        totalRewardAmount: 35000,
      },
    };

    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('Referral operations board');
    expect(markup).toContain('Ready to credit');
    expect(markup).toContain('Held for review');
    expect(markup).toContain('1 ready / 1 held');
    expect(markup).toContain('Credit ready rewards or hold suspicious rows.');
    expect(markup).toContain('Ready 1');
    expect(markup).toContain('Held 1');
    expect(markup).toContain('2 reward(s) / <span class="money-text money-text-positive">35.000 VND</span>');
    expect(markup).toContain('Reward decision timeline');
    expect(markup).toContain('Attribution captured');
    expect(markup).toContain('Qualification and fraud check');
    expect(markup).toContain('Reward queue');
    expect(markup).toContain('1 ready · 1 held · 0 pending');
    expect(markup).toContain('Wallet decision');
    expect(markup).toContain('Use row actions for wallet credit, hold, or reversal.');
  });

  it('treats credited lifecycle rewards as ledger-posted review rows even before legacy rewarded status is present', () => {
    const row: AdminCustomerReferralParent = {
      ...customerReferralParent,
      referrals: [
        {
          ...customerReferralParent.referrals[0],
          rewards: [
            {
              ...customerReferralParent.referrals[0].rewards[0],
              status: 'CREDITED',
              walletLedgerReference: null,
            },
          ],
        },
      ],
      totals: {
        ...customerReferralParent.totals,
        availableRewardAmount: 0,
        availableRewardCount: 0,
        rewardedRewardAmount: 25000,
        rewardedRewardCount: 1,
      },
    };

    const markup = renderToStaticMarkup(<ReferralParentDetailPage audience="customer" row={row} />).replace(
      /\s+/g,
      ' ',
    );

    expect(markup).toContain('Credited 1');
    expect(markup).toContain('Ledger posted');
    expect(markup).toContain('Referral reward has been credited to wallet liability.');
    expect(markup).not.toContain('Pending 1');
  });
});
