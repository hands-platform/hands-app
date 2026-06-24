import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminCustomerReferralParent } from '../../lib/admin-api';
import { ReferralParentDetailPage, referralParentDetailHref } from './referral-detail';

const createdAt = '2026-06-24T10:00:00.000Z';

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
    reversedRewardAmount: 0,
    reversedRewardCount: 0,
    rewardCount: 1,
    totalRewardAmount: 25000,
  },
};

describe('Referral detail presentation', () => {
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
    expect(markup).toContain('wallet-ledger-1');
    expect(markup).toContain('AVAILABLE');
    expect(markup).not.toContain('Hold reward');
    expect(markup).not.toContain('Reverse reward');
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

    expect(markup).toContain('Hold reward');
    expect(markup).toContain('Reverse reward');
    expect(markup).toContain('name="parentId" value="parent-customer"');
  });
});
