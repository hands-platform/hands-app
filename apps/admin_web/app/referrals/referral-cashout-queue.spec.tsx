import { readFileSync } from 'node:fs';
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
  audience: 'PARTNER',
  attribution: {
    audience: 'PARTNER',
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
  detailHref: '/referrals/partners/parent-partner',
  latestDecision: {
    action: 'referral_reward.cashout_approve',
    actor: { id: 'admin-1', fullName: 'Ops Admin', phone: '+84000009999' },
    createdAt,
    reason: 'approved for bank transfer',
    status: 'CASHOUT_APPROVED',
    walletLedgerReference: 'wallet-credit-ledger-1',
  },
  parent: {
    href: '/partners/parent-partner',
    id: 'parent-partner',
    label: 'Parent Partner',
    phone: '+84000000001',
  },
  payoutProfile: {
    account: {
      accountHolderName: 'Parent Partner',
      accountNumberLast4: '1234',
      accountNumberMasked: '****1234',
      bankName: 'VCB',
      id: 'bank-1',
      isPrimary: true,
      rejectionReason: 'Account holder name does not match KYC.',
      reviewedAt: createdAt,
      status: 'REJECTED',
      updatedAt: createdAt,
    },
    helper: 'Account holder name does not match KYC.',
    label: 'Bank correction required',
    status: 'CORRECTION_REQUIRED',
    type: 'PROVIDER_BANK_ACCOUNT',
  },
  qualifyingBookingId: 'booking-1',
  referred: {
    href: '/partners/referred-partner',
    id: 'referred-partner',
    label: 'Referred Partner',
    phone: '+84000000002',
  },
  status: 'CASHOUT_APPROVED',
  walletLedgerReference: 'wallet-credit-ledger-1',
};

const cashoutQueueSource = readFileSync('app/referrals/referral-cashout-queue.tsx', 'utf8');

describe('Referral cashout queue', () => {
  it('uses the shared Vuexy text link atom for inline cashout navigation', () => {
    expect(cashoutQueueSource).toContain('AdminTextLink');
    expect(cashoutQueueSource).not.toContain("import Link from 'next/link';");
    expect(cashoutQueueSource).not.toContain('<Link');
    expect(cashoutQueueSource).not.toMatch(/className=(?:\{)?["'`][^"'`]*\btext-link\b/);
  });

  it('uses the shared segmented control atom for cashout state filters', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'all', q: '', status: 'approved' }}
        rows={[row]}
        summary={summary}
      />,
    );

    expect(cashoutQueueSource).toContain('AdminSegmentedControl');
    expect(markup).toContain('booking-date-filter-buttons referral-reward-queue');
    expect(markup).toContain('booking-date-filter-button is-active');
  });

  it('uses the shared StatusBadge atom for the queue count chip', () => {
    expect(cashoutQueueSource).toContain('StatusBadge');
    expect(cashoutQueueSource).not.toContain('actions={<span className="pill">{rows.length} shown</span>}');
  });

  it('keeps cashout filter forms on the shared AdminFormGrid shell without page-local form classes', () => {
    expect(cashoutQueueSource).toContain('AdminFormGrid');
    expect(cashoutQueueSource).not.toContain('className="admin-filter-form"');
  });

  it('uses the shared Vuexy action dropdown surface for cashout decision forms', () => {
    expect(cashoutQueueSource).toContain('ActionMenuDropdownSurface');
    expect(cashoutQueueSource).not.toContain('<details className="admin-action-dropdown referral-reward-action-dropdown">');
  });

  it('uses the shared Vuexy button atom for cashout decision submit actions', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'all', q: '', status: 'approved' }}
        rows={[row]}
        summary={summary}
      />,
    );

    expect(cashoutQueueSource).not.toContain('<button\n              className="admin-action-item admin-action-button"');
    expect(markup).toContain('admin-form-control-button button button-secondary admin-action-item admin-action-button');
  });

  it('uses the shared table pagination footer for the cashout queue', () => {
    expect(cashoutQueueSource).toContain('AdminTablePaginationFooter');
    expect(cashoutQueueSource).not.toContain('<AdminTableFooter>');
    expect(cashoutQueueSource).not.toContain(
      'Showing {startItem} to {endItem} of {summary.totalCount} entries',
    );
  });

  it('uses the shared Vuexy table section wrapper for the cashout queue', () => {
    expect(cashoutQueueSource).toContain('AdminTableSection');
    expect(cashoutQueueSource).not.toContain(
      'className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"',
    );
  });

  it('uses the shared money atom for cashout exposure and row amounts', () => {
    expect(cashoutQueueSource).toContain('MoneyText');
    expect(cashoutQueueSource).not.toContain("value: formatMoney(summary.totalAmount, 'VND', '0 VND')");
    expect(cashoutQueueSource).not.toContain('{item.count} · {formatMoney(item.amount, \'VND\', \'0 VND\')}');
    expect(cashoutQueueSource).not.toContain('<strong>{formatMoney(row.amount, row.currency, \'0 VND\')}</strong>');
  });

  it('uses the shared date time atom for cashout timestamps', () => {
    expect(cashoutQueueSource).toContain('DateTimeText');
    expect(cashoutQueueSource).not.toContain('<div className="muted">{formatDateTime(row.createdAt)}</div>');
    expect(cashoutQueueSource).not.toContain('<div className="muted">{formatDateTime(row.latestDecision.createdAt)}</div>');
    expect(cashoutQueueSource).not.toContain('Updated {formatDateTime(account.updatedAt)}');
  });

  it('uses the shared inline fallback atom for missing cashout ledger and decision values', () => {
    expect(cashoutQueueSource).toContain('AdminInlineFallback');
    expect(cashoutQueueSource).not.toContain(
      "<div className=\"muted\">{row.walletLedgerReference ?? 'No wallet ledger yet'}</div>",
    );
    expect(cashoutQueueSource).not.toContain('<span className="muted">No decision yet</span>');
  });

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
    expect(markup).toContain(
      'card admin-section vuexy-booking-table-card vuexy-booking-table-group booking-monitor-filter-panel admin-mt-16',
    );
    expect(markup).not.toContain('admin-filter-panel-eyebrow">Queue');
    expect(markup).toContain('class="admin-form-control-button button button-primary" type="submit">Apply filters');
    expect(markup).toContain('Cashout approved');
    expect(markup).toContain('Parent Partner');
    expect(markup).toContain('Referred Partner');
    expect(markup).toContain('25.000 VND');
    expect(markup).toContain('Bank correction required');
    expect(markup).toContain('VCB');
    expect(markup).toContain('****1234');
    expect(markup).toContain('Account holder name does not match KYC.');
    expect(markup).toContain('date-time-text');
    expect(markup).toContain('Updated <time class="date-time-text"');
    expect(markup).toContain('approved for bank transfer');
    expect(markup).toContain('Mark paid');
    expect(markup).toContain('Transfer reference');
    expect(markup).toContain('Require tax review');
    expect(markup).toContain('Request bank correction');
    expect(markup).toContain('type="hidden" name="bankAccountId" value="bank-1"');
    expect(markup).toContain('href="/referrals/cashouts?status=approved&amp;q=parent"');
    expect(markup).toContain('aria-label="Referral cashout queue pages"');
  });
});
