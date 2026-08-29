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
  updatedAt: createdAt,
  walletLedgerReference: 'wallet-credit-ledger-1',
};

const customerRow: AdminReferralCashoutQueueRow = {
  ...row,
  audience: 'CUSTOMER',
  detailHref: '/referrals/customers/parent-customer',
  parent: {
    href: '/customers/parent-customer',
    id: 'parent-customer',
    label: 'Parent Customer',
    phone: '+84000000003',
  },
  payoutProfile: {
    account: null,
    helper: 'Customer rewards remain wallet-only in the current MVP.',
    label: 'Wallet only',
    status: 'WALLET_ONLY',
    type: 'CUSTOMER_WALLET',
  },
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
    expect(cashoutQueueSource).toContain('AdminFilterSummary');
    expect(markup).toContain('booking-date-filter-buttons referral-reward-queue');
    expect(markup).toContain('booking-date-filter-button is-active');
    expect(markup).toContain('Active referral cashout filters');
    expect(markup).toContain('Audience: All audiences');
    expect(markup).toContain('State: Cashout approved');
  });

  it('shows default needs-action and all-cashout queue filters as selectable states', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'all', q: '', status: 'needs-action' }}
        rows={[row]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Needs action');
    expect(markup).toContain('All cashouts');
    expect(markup).toContain('4 · <span class="money-text money-text-positive">105.000 VND</span>');
    expect(markup).toContain(
      'aria-current="page" class="booking-date-filter-button is-active" href="/referrals/cashouts"',
    );
    expect(markup).toContain('href="/referrals/cashouts?status=all"');
  });

  it('keeps status facets scoped to audience and search instead of the selected status', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'partner', q: 'parent', status: 'approved' }}
        rows={[row]}
        summary={{ ...summary, totalAmount: 25000, totalCount: 1 }}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('1 cashout(s)');
    expect(markup).toContain('All cashouts</span><strong>4 · <span class="money-text money-text-positive">105.000 VND</span>');
    expect(markup).toContain('Needs action</span><strong>4 · <span class="money-text money-text-positive">105.000 VND</span>');
  });

  it('keeps cashout exposure scoped to the active filter instead of vague current-copy', () => {
    expect(cashoutQueueSource).toContain('Total amount in the active cashout filter.');
    expect(cashoutQueueSource).not.toContain('current cashout filter');
  });

  it('uses the shared StatusBadge atom for the queue count chip', () => {
    expect(cashoutQueueSource).toContain('StatusBadge');
    expect(cashoutQueueSource).not.toContain('actions={<span className="pill">{rows.length} shown</span>}');
  });

  it('keeps cashout filter forms on the shared AdminFormGrid shell without page-local form classes', () => {
    expect(cashoutQueueSource).toContain('AdminFormGrid');
    expect(cashoutQueueSource).not.toContain('className="admin-filter-form"');
  });

  it('keeps the cashout filter panel off the legacy booking monitor filter class', () => {
    expect(cashoutQueueSource).toContain('className="referral-cashout-filter-panel admin-mt-16"');
    expect(cashoutQueueSource).not.toContain(
      '<AdminFilterPanel\n        className="booking-monitor-filter-panel admin-mt-16"',
    );
  });

  it('uses the shared Vuexy action dropdown surface for cashout decision forms', () => {
    expect(cashoutQueueSource).toContain('ActionMenuDropdownSurface');
    expect(cashoutQueueSource).not.toContain('<details className="admin-action-dropdown referral-reward-action-dropdown">');
  });

  it('uses the authenticated Finance operator and server-side request evidence for paid cashout closeout', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'all', q: '', status: 'approved' }}
        rows={[row]}
        summary={summary}
      />,
    );

    expect(markup).toContain('The signed-in Finance operator is recorded as the paid closeout approver.');
    expect(markup).toContain('The API enforces separation from the cashout request approver.');
    expect(markup).not.toContain('name="approvalAdminId"');
    expect(cashoutQueueSource).not.toContain('financeApproverOptions');
    expect(cashoutQueueSource).not.toContain('requiresApproval');
  });

  it('renders queue cashout forms with state evidence, confirmation, and safe queue return context', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={2}
        filters={{ audience: 'partner', q: 'parent', status: 'approved' }}
        rows={[row]}
        summary={{ ...summary, totalCount: 12 }}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('type="hidden" name="expectedStatus" value="CASHOUT_APPROVED"');
    expect(markup).toContain(`type="hidden" name="expectedUpdatedAt" value="${row.updatedAt}"`);
    expect(markup).toContain('name="returnTo" value="/referrals/cashouts?audience=partner&amp;status=approved&amp;q=parent&amp;page=2"');
    expect(markup).toContain('name="confirmation" value="confirmed"');
    expect(markup).toContain('I reviewed the current state, payout destination, reason, and wallet impact.');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain('required=""');
    expect(markup).toContain('Payout destination: VCB · •••• 1234 · Parent Partner');
    expect(markup).toContain('The API revalidates this exact account before wallet debit.');
  });

  it('renders legacy Customer cashout rows as read-only without mutation forms', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'customer', q: '', status: 'approved' }}
        rows={[customerRow]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('Unavailable in wallet-only MVP');
    expect(markup).toContain('Legacy cashout row · read-only investigation');
    expect(markup).not.toContain(`Referral cashout actions for ${customerRow.id}`);
    expect(markup).not.toContain('Mark paid');
    expect(markup).not.toContain('Approve cashout');
    expect(markup).not.toContain('Require tax review');
  });

  it('lets FINANCE_TAX decide a legacy Customer tax-review row without exposing payment', () => {
    const taxReviewRow: AdminReferralCashoutQueueRow = {
      ...customerRow,
      status: 'TAX_REVIEW_REQUIRED',
    };
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        canReviewTax
        currentPage={1}
        filters={{ audience: 'customer', q: '', status: 'tax-review' }}
        rows={[taxReviewRow]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain(`Referral cashout actions for ${taxReviewRow.id}`);
    expect(markup).toContain('Approve tax review');
    expect(markup).toContain('Keep in tax review');
    expect(markup).toContain('Reject cashout; retain wallet reward');
    expect(markup).toContain('Customer cash payout remains unavailable after tax approval');
    expect(markup).not.toContain('Mark paid');
    expect(markup).not.toContain('Approve cashout');
    expect(markup).not.toContain('name="transferRef"');
  });

  it('keeps a tax-review row read-only when the operator lacks FINANCE_TAX', () => {
    const taxReviewRow: AdminReferralCashoutQueueRow = {
      ...row,
      status: 'TAX_REVIEW_REQUIRED',
    };
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        canReviewTax={false}
        currentPage={1}
        filters={{ audience: 'partner', q: '', status: 'tax-review' }}
        rows={[taxReviewRow]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('FINANCE_TAX access required');
    expect(markup).not.toContain(`Referral cashout actions for ${taxReviewRow.id}`);
  });

  it('keeps loaded rows read-only when the summary request is unavailable', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'partner', q: '', status: 'approved' }}
        mutationsEnabled={false}
        partialReadError="Cashout summary could not be loaded. Loaded rows are read-only until the summary is available."
        rows={[row]}
        summary={{ ...summary, totalAmount: 0, totalCount: 0 }}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Cashout summary could not be loaded');
    expect(markup).toContain('1 cashout row loaded · summary unavailable');
    expect(markup).toContain('Actions unavailable until the list and summary reload successfully.');
    expect(markup).not.toContain(`aria-label="Referral cashout actions for ${row.id}"`);
    expect(markup).not.toContain('aria-label="Referral cashout queue summary"');
  });

  it('shows a read failure instead of zero metrics or an empty cashout table', () => {
    const markup = renderToStaticMarkup(
      <ReferralCashoutQueuePage
        currentPage={1}
        filters={{ audience: 'all', q: '', status: 'needs-action' }}
        readError="Referral cashout rows could not be loaded. Retry before making a payout decision."
        rows={[]}
        summary={summary}
      />,
    ).replace(/\s+/g, ' ');

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Referral cashout data unavailable');
    expect(markup).toContain('Retry before making a payout decision.');
    expect(markup).toContain('>Retry</a>');
    expect(markup).not.toContain('Cashout rows');
    expect(markup).not.toContain('No referral cashouts match the current filters.');
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

  it('renders a finance-ready cashout queue with actions and a one-page summary', () => {
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
      'card admin-section vuexy-booking-table-card vuexy-booking-table-group referral-cashout-table-panel admin-mt-16',
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
    expect(markup).toContain('Showing 1 to 1 of 4 entries');
    expect(markup).not.toContain('aria-label="Referral cashout queue pages"');
  });
});
