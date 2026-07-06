import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminCustomerReferralParent, AdminPartnerReferralParent, AdminReferralPolicy } from '../../lib/admin-api';
import {
  ReferralDashboard,
  buildReferralParentApiHref,
  buildReferralParentSummaryApiHref,
  buildReferralDashboardFilters,
  buildReferralDashboardPage,
  buildReferralListHref,
  buildReferralRewardQueueSummaries,
  filterReferralParentRows,
  paginateReferralRows,
} from './referral-dashboard';

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
  platformFeeVatRateBps: 900,
  perRewardCapAmount: null,
  policyId: 'policy-1',
  rewardMode: 'COMMISSION_PERCENT',
  source: 'stored-policy',
  totalRewardCapAmount: 500000,
};

const partnerPolicy: AdminReferralPolicy = {
  ...policy,
  audience: 'PARTNER',
  commissionPercentBps: null,
  fixedRewardAmount: 150000,
  rewardMode: 'FIXED_AMOUNT',
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
    referrals: [
      {
        createdAt: '2026-06-24T10:30:00.000Z',
        fraudReviewStatus: 'CLEAR',
        id: 'attribution-1',
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
            availableAt: '2026-06-24T10:40:00.000Z',
            createdAt: '2026-06-24T10:40:00.000Z',
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
            status: 'REWARDED',
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

const referralStoreEnvKeys = [
  'REFERRAL_PUBLIC_BASE_URL',
  'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
  'REFERRAL_CUSTOMER_IOS_STORE_URL',
  'CUSTOMER_ANDROID_STORE_URL',
  'CUSTOMER_IOS_STORE_URL',
  'CUSTOMER_ANDROID_APP_URL',
  'CUSTOMER_IOS_APP_URL',
] as const;
const dashboardSource = readFileSync('app/referrals/referral-dashboard.tsx', 'utf8');
const storeSetupSource = readFileSync('app/referrals/referral-store-setup-status.tsx', 'utf8');

function defaultReferralDashboardFiltersForTest() {
  return { q: '', reward: 'all' as const, status: 'all' as const };
}

describe('ReferralDashboard', () => {
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

  it('uses the shared Vuexy text link atom for inline referral dashboard navigation', () => {
    expect(dashboardSource).toContain('AdminTextLink');
    expect(dashboardSource).not.toMatch(/className=(?:\{)?["'`][^"'`]*\btext-link\b/);
    expect(storeSetupSource).toContain('AdminTextLink');
    expect(storeSetupSource).not.toMatch(/className=(?:\{)?["'`][^"'`]*\btext-link\b/);
  });

  it('renders policy controls and the hold-window release action', () => {
    const markup = renderToStaticMarkup(
      <ReferralDashboard audience="customer" policy={policy} rows={rows} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Customer Referrals');
    expect(markup).toContain('Policy changes are audited');
    expect(markup).toContain('aria-label="Customer referral policy controls"');
    expect(markup).toContain('class="vuexy-customer-form referral-policy-form admin-mt-16"');
    expect(markup).toContain('class="admin-form-input admin-form-control-labeled admin-form-control-fluid"');
    expect(markup).toContain('class="admin-form-select admin-form-control-labeled admin-form-control-fluid"');
    expect(markup).toContain('class="admin-form-textarea admin-form-control-labeled admin-form-control-fluid admin-grid-span-2"');
    expect(markup).toContain('class="admin-form-control-button button button-primary referral-policy-save-button"');
    expect(markup).not.toContain('referral-policy-field');
    expect(markup).not.toContain('read-only here');
    expect(markup).not.toContain('Release ready rewards');
    expect(markup).not.toContain('Mark ready rewards available');
    expect(markup).toContain('Stage ready reward candidates');
    expect(markup).toContain('aria-label="Referral policy actions"');
    expect(markup).toContain('Policy actions');
    expect(markup).toContain('Reward candidates ready for credit');
    expect(markup).toContain('Credited rewards');
    expect(markup).toContain('Platform fee VAT');
    expect(markup).toContain('9%');
    expect(markup).toContain('name="platformFeeVatRate"');
    expect(markup).toContain('15.000 VND');
    expect(markup).toContain('Credited <span class="money-text money-text-positive">15.000 VND</span>');
    expect(markup).toContain('Wallet credit is separate');
    expect(markup).toContain('Wallet posting still happens from each reward detail action');
    expect(markup).toContain('Referral rewards are company marketing/acquisition expenses');
    expect(markup).toContain('Wallet offsets settle payable and receivable balances');
    expect(markup).toContain('Customer referral cashout requires admin approval and tax review');
    expect(markup).toContain('Tax policies are configurable and must be confirmed by accounting before production use');
    expect(markup).toContain('Referral link readiness');
    expect(markup).toContain('Customer referral links route visitors to the correct store before attribution starts.');
    expect(markup).toContain('admin-directory-filter-form');
    expect(markup).toContain('admin-directory-filter-grid');
    expect(markup).toContain('admin-directory-filter-search');
    expect(markup).toContain('admin-directory-filter-select');
    expect(markup).toContain('admin-directory-filter-actions');
    expect(markup).not.toContain('Clear filters');
    expect(markup).toContain('Android store ready');
    expect(markup).toContain('iOS store missing');
    expect(markup).toContain('Public link base missing');
    expect(markup).toContain('Missing setup: REFERRAL_PUBLIC_BASE_URL, REFERRAL_CUSTOMER_IOS_STORE_URL');
    expect(markup.match(/Missing setup:/g)).toHaveLength(1);
    expect(markup).toContain('Configure store URLs');
    expect(markup).toContain('href="/setup#referrals"');
    expect(markup).toContain('Parent Customer');
    expect(markup).toContain('HANDSCUST');
    expect(markup).toContain('date-time-text');
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section"',
    );
    expect(markup).toContain('Actions');
    expect(markup).toContain('admin-action-dropdown referral-parent-action-dropdown');
    expect(markup).toContain('aria-label="Referral parent actions for parent-customer"');
    expect(markup).toContain('Latest Credit by Ops Admin');
    expect(markup).toContain('class="admin-disclosure referral-parent-reward-decision-details"');
    expect(markup).toContain('<summary>Decision details</summary>');
    expect(markup).toContain('manual payout check');
    expect(markup).toContain('Open referral detail');
    expect(markup).toContain('Open parent profile');
    expect(markup).toContain('Open referral link');
  });

  it('uses the shared StatusBadge atom for active referral filter labels', () => {
    expect(dashboardSource).toContain('StatusBadge');
    expect(dashboardSource).not.toContain('<span className="pill pill-warn" key={filter}>');
  });

  it('uses the shared MoneyText atom for visible referral money values', () => {
    expect(dashboardSource).toContain('MoneyText');
    expect(dashboardSource).not.toContain('formatMoney(');
  });

  it('uses the shared DateTimeText atom for referral dashboard timestamps', () => {
    expect(dashboardSource).toContain('DateTimeText');
    expect(dashboardSource).not.toContain('<small className="muted">{formatDateTime(code.createdAt)}</small>');
    expect(dashboardSource).not.toContain('<span className="muted">{formatDateTime(latestDecision.createdAt)}</span>');
    expect(dashboardSource).not.toContain('{formatDateTime(createdAt)}');
  });

  it('uses the shared inline fallback atom for missing referral code and activity values', () => {
    expect(dashboardSource).toContain('AdminInlineFallback');
    expect(dashboardSource).not.toContain('<span className="muted">No code</span>');
    expect(dashboardSource).not.toContain('<span className="muted">No referral activity</span>');
  });

  it('uses the shared Vuexy table panel wrapper for referral parent lists', () => {
    expect(dashboardSource).toContain('AdminTablePanel');
    expect(dashboardSource).not.toContain(
      'className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"',
    );
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

  it('normalizes referral list filters and preserves them in list hrefs', () => {
    const filters = buildReferralDashboardFilters({
      q: ' Parent ',
      reward: 'held',
      status: 'blocked',
    });

    expect(filters).toEqual({ q: 'Parent', reward: 'held', status: 'blocked' });
    expect(buildReferralListHref('customer', filters, { reward: 'available' })).toBe(
      '/referrals/customers?q=Parent&status=blocked&reward=available',
    );
    expect(buildReferralDashboardPage({ page: '2' })).toBe(2);
    expect(buildReferralDashboardPage({ page: 'not-a-page' })).toBe(1);
    expect(buildReferralListHref('customer', filters, {}, 2)).toBe(
      '/referrals/customers?q=Parent&status=blocked&reward=held&page=2',
    );
    expect(buildReferralParentApiHref('customer', defaultReferralDashboardFiltersForTest(), 3)).toBe(
      '/admin/referrals/customers?take=10&skip=20',
    );
    expect(buildReferralParentSummaryApiHref('customer', defaultReferralDashboardFiltersForTest())).toBe(
      '/admin/referrals/customers/summary',
    );
    expect(buildReferralParentApiHref('customer', filters, 3)).toBe(
      '/admin/referrals/customers?take=10&skip=20&q=Parent&status=blocked&reward=held',
    );
    expect(buildReferralParentSummaryApiHref('customer', filters)).toBe(
      '/admin/referrals/customers/summary?q=Parent&status=blocked&reward=held',
    );
  });

  it('renders shared table pagination for longer referral parent lists', () => {
    const longRows = Array.from({ length: 12 }, (_, index) =>
      referralParent({
        code: `REF${index}`,
        id: `parent-${index}`,
        name: `Parent ${index}`,
        referralStatus: 'QUALIFIED',
        rewardStatus: 'AVAILABLE',
      }),
    );
    const page = paginateReferralRows(longRows, 2, 10);

    expect(page.rows.map((row) => row.referrer.id)).toEqual(['parent-10', 'parent-11']);
    expect(page.currentPage).toBe(2);
    expect(page.totalPages).toBe(2);

    const markup = renderToStaticMarkup(
      <ReferralDashboard audience="customer" currentPage={2} policy={policy} rows={longRows} totalCount={12} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('aria-label="Referral parent pagination"');
    expect(markup).toContain('class="vuexy-booking-table-footer referral-pagination"');
    expect(markup).toContain('class="vuexy-booking-pagination referral-pagination-buttons"');
    expect(markup).toContain('class="vuexy-booking-page-link is-active"');
    expect(markup).toContain('Page 2 of 2');
    expect(markup).toContain('Showing 11-12 of 12');
    expect(markup).toContain('href="/referrals/customers"');
    expect(dashboardSource).toContain('AdminTablePaginationFooter');
    expect(dashboardSource).not.toContain('import { AdminRoundedPagination }');
    expect(dashboardSource).not.toContain('<AdminRoundedPagination');
    expect(dashboardSource).not.toContain('buildReferralPaginationPages');
  });

  it('renders server-paginated referral parent rows without slicing the loaded page again', () => {
    const pageRows = Array.from({ length: 10 }, (_, index) =>
      referralParent({
        code: `PAGE2-${index}`,
        id: `parent-${index + 10}`,
        name: `Parent ${index + 10}`,
        referralStatus: 'QUALIFIED',
        rewardStatus: 'AVAILABLE',
      }),
    );

    const markup = renderToStaticMarkup(
      <ReferralDashboard
        audience="customer"
        currentPage={2}
        policy={policy}
        rows={pageRows}
        serverPagination
        totalCount={25}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Parent 10');
    expect(markup).toContain('Parent 19');
    expect(markup).toContain('Page 2 of 3');
    expect(markup).toContain('Showing 11-20 of 25');
  });

  it('renders reward operation quick filters without losing search or referral status', () => {
    const heldParent = referralParent({
      code: 'HELDREF',
      id: 'parent-held',
      name: 'Held Parent',
      referralStatus: 'BLOCKED',
      rewardStatus: 'HELD',
    });

    const markup = renderToStaticMarkup(
      <ReferralDashboard
        audience="customer"
        filters={{ q: 'smoke', reward: 'available', status: 'pending' }}
        policy={policy}
        rows={rows}
        rewardQueueSummaries={buildReferralRewardQueueSummaries([...rows, heldParent])}
        totalCount={5}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('aria-label="Referral reward operation queue"');
    expect(markup).toContain('Ready to credit');
    expect(markup).toContain('1 · <span class="money-text money-text-positive">25.000 VND</span>');
    expect(markup).toContain('Pending checks');
    expect(markup).toContain('1 · <span class="money-text money-text-positive">5.000 VND</span>');
    expect(markup).toContain('Held review');
    expect(markup).toContain('1 · <span class="money-text money-text-positive">10.000 VND</span>');
    expect(markup).toContain('Credited');
    expect(markup).toContain('href="/referrals/customers?q=smoke&amp;status=pending"');
    expect(markup).toContain('href="/referrals/customers?q=smoke&amp;status=pending&amp;reward=held"');
    expect(markup).toContain('href="/referrals/customers?q=smoke&amp;status=pending&amp;reward=credited"');
    expect(markup).toContain(
      'aria-current="page" class="booking-date-filter-button is-active" href="/referrals/customers?q=smoke&amp;status=pending&amp;reward=available"',
    );
  });

  it('explains when referral filters hide existing parent accounts', () => {
    const markup = renderToStaticMarkup(
      <ReferralDashboard
        audience="partner"
        filters={{ q: 'smoke', reward: 'available', status: 'pending' }}
        policy={partnerPolicy}
        rewardQueueSummaries={[]}
        rows={[] satisfies AdminPartnerReferralParent[]}
        totalCount={1}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('No matching Partner referral parents');
    expect(markup).toContain('1 parent account exists, but none match the current filters.');
    expect(markup).toContain('Search: smoke');
    expect(markup).toContain('Status: Pending');
    expect(markup).toContain('Reward: Ready rewards');
    expect(markup).toContain('href="/referrals/partners"');
    expect(markup).toContain('Clear referral filters');
    expect(markup).not.toContain('Parents appear here only after at least one referral attribution is recorded.');
  });

  it('uses the shared Vuexy empty-state atom for referral parent fallbacks', () => {
    expect(dashboardSource).toContain('AdminEmptyState');
    expect(dashboardSource).not.toContain('<strong>No matching {audienceLabel} referral parents</strong>');
    expect(dashboardSource).not.toContain('<strong>No {audienceLabel} referral parents yet</strong>');
  });

  it('renders held reward totals in referral parent rows', () => {
    const heldParent = referralParent({
      code: 'HELDREF',
      id: 'parent-held',
      name: 'Held Parent',
      referralStatus: 'BLOCKED',
      rewardStatus: 'HELD',
    });

    const markup = renderToStaticMarkup(
      <ReferralDashboard audience="customer" policy={policy} rows={[heldParent]} />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Held <span class="money-text money-text-positive">10.000 VND</span>');
  });

  it('filters referral parents by search, referral status, and reward state', () => {
    const qualifiedParent = referralParent({
      code: 'HANDSCUST',
      id: 'parent-qualified',
      name: 'Qualified Parent',
      referralStatus: 'QUALIFIED',
      rewardStatus: 'AVAILABLE',
    });
    const blockedParent = referralParent({
      code: 'BLOCKEDREF',
      id: 'parent-blocked',
      name: 'Blocked Parent',
      referralStatus: 'BLOCKED',
      rewardStatus: 'HELD',
    });

    const filtered = filterReferralParentRows('customer', [qualifiedParent, blockedParent], {
      q: 'blocked',
      reward: 'held',
      status: 'blocked',
    });

    expect(filtered.map((row) => row.referrer.id)).toEqual(['parent-blocked']);
  });

  it('treats credited lifecycle rewards as credited in client fallback filters', () => {
    const creditedParent = referralParent({
      code: 'CREDITEDREF',
      id: 'parent-credited',
      name: 'Credited Parent',
      referralStatus: 'QUALIFIED',
      rewardStatus: 'CREDITED',
    });

    const filtered = filterReferralParentRows('customer', [creditedParent], {
      q: '',
      reward: 'credited',
      status: 'all',
    });

    expect(filtered.map((row) => row.referrer.id)).toEqual(['parent-credited']);
  });
});

function referralParent({
  code,
  id,
  name,
  referralStatus,
  rewardStatus,
}: {
  readonly code: string;
  readonly id: string;
  readonly name: string;
  readonly referralStatus: string;
  readonly rewardStatus: 'AVAILABLE' | 'CREDITED' | 'HELD';
}): AdminCustomerReferralParent {
  return {
    referrer: {
      id,
      user: {
        fullName: name,
        id: `${id}-user`,
        phone: '+84000000002',
      },
    },
    referralCode: {
      active: true,
      code,
      createdAt: '2026-06-24T10:00:00.000Z',
      id: `${id}-code`,
    },
    referrals: [
      {
        createdAt: '2026-06-24T11:00:00.000Z',
        fraudReviewStatus: referralStatus === 'BLOCKED' ? 'REVIEW' : 'CLEAR',
        id: `${id}-attribution`,
        platform: 'ANDROID',
        referredCustomer: {
          id: `${id}-referred`,
          user: {
            fullName: `${name} Friend`,
            id: `${id}-referred-user`,
            phone: '+84000000003',
          },
        },
        rewards: [
          {
            amount: 10000,
            createdAt: '2026-06-24T11:10:00.000Z',
            currency: 'VND',
            id: `${id}-reward`,
            status: rewardStatus,
          },
        ],
        status: referralStatus,
      },
    ],
    totals: {
      availableRewardAmount: rewardStatus === 'AVAILABLE' ? 10000 : 0,
      availableRewardCount: rewardStatus === 'AVAILABLE' ? 1 : 0,
      cancelledRewardAmount: 0,
      cancelledRewardCount: 0,
      heldRewardAmount: rewardStatus === 'HELD' ? 10000 : 0,
      heldRewardCount: rewardStatus === 'HELD' ? 1 : 0,
      pendingRewardAmount: 0,
      pendingRewardCount: 0,
      referralCount: 1,
      rewardedRewardAmount: 0,
      rewardedRewardCount: 0,
      reversedRewardAmount: 0,
      reversedRewardCount: 0,
      rewardCount: 1,
      totalRewardAmount: 10000,
    },
  };
}
