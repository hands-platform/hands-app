import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminReferralCashoutQueueRow, AdminReferralCashoutQueueSummary } from '../../lib/admin-api';
import {
  ReferralCashoutQueuePage,
  buildReferralCashoutApiHref,
  buildReferralCashoutPage,
  buildReferralCashoutSummaryApiHref,
} from './referral-cashout-queue';

const createdAt = '2026-06-24T10:00:00.000Z';

const summary: AdminReferralCashoutQueueSummary = {
  totalAmount: 105000,
  totalCount: 4,
  statusSummaries: [
    { amount: 50000, count: 2, status: 'requested' },
    { amount: 25000, count: 1, status: 'approved' },
    { amount: 30000, count: 1, status: 'tax-review' },
    { amount: 0, count: 0, status: 'paid' },
  ],
};

const row: AdminReferralCashoutQueueRow = {
  id: 'reward-1',
  amount: 25000,
  audience: 'CUSTOMER',
  attribution: {
    audience: 'CUSTOMER',
    createdAt,
    fraudReviewStatus: 'CLEAR',
    id: 'attribution-1',
    installSource: 'referral-link',
    platform: 'ios',
    status: 'QUALIFIED',
  },
  availableAt: createdAt,
  calculationSnapshot: { taxPolicySnapshot: 'CUSTOMER_CASHOUT_REVIEW' },
  createdAt,
  currency: 'VND',
  detailHref: '/referrals/customers/parent-customer',
  latestDecision: {
    action: 'referral_reward.cashout_approve',
    actor: { id: 'admin-1', fullName: 'Ops Admin', phone: '+84000009999' },
    createdAt,
    reason: 'approved for bank transfer',
    status: 'CASHOUT_APPROVED',
    walletLedgerReference: 'wallet-credit-ledger-1',
  },
  parent: {
    href: '/customers/parent-customer',
    id: 'parent-customer',
    label: 'Parent Customer',
    phone: '+84000000001',
  },
  qualifyingBookingId: 'booking-1',
  referred: {
    href: '/customers/referred-customer',
    id: 'referred-customer',
    label: 'Referred Customer',
    phone: '+84000000002',
  },
  status: 'CASHOUT_APPROVED',
  walletLedgerReference: 'wallet-credit-ledger-1',
};

describe('Referral cashout queue', () => {
  it('builds bounded cashout queue API hrefs from search params', () => {
    const filters = { audience: 'customer' as const, q: 'parent', status: 'approved' as const };

    expect(buildReferralCashoutPage({ page: '3' })).toBe(3);
    expect(buildReferralCashoutApiHref(filters, 3)).toBe(
      '/admin/referrals/cashouts?take=10&skip=20&audience=customer&status=approved&q=parent',
    );
    expect(buildReferralCashoutSummaryApiHref(filters)).toBe(
      '/admin/referrals/cashouts/summary?audience=customer&status=approved&q=parent',
    );
  });

  it('renders a finance-ready cashout queue with actions and rounded pagination', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={2}
        filters={{ audience: 'all', q: 'parent', status: 'approved' }}
        rows={[row]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Referral Cashouts');
    expect(markup).toContain('Cashout approved');
    expect(markup).toContain('Parent Customer');
    expect(markup).toContain('Referred Customer');
    expect(markup).toContain('25.000 VND');
    expect(markup).toContain('approved for bank transfer');
    expect(markup).toContain('Mark paid');
    expect(markup).toContain('Transfer reference');
    expect(markup).toContain('Require tax review');
    expect(markup).toContain('href="/referrals/cashouts?status=approved&amp;q=parent"');
    expect(markup).toContain('aria-label="Referral cashout queue pages"');
  });
});
