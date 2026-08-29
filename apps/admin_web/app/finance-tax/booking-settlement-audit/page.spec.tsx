import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminBookingSettlementSnapshot } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { emptyBookingSettlementSummary } from '../tax-settlement-page-model';
import BookingSettlementAuditPage from './page';
import { settlementAuditDueStatus } from './settlement-audit-copy';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('BookingSettlementAuditPage', () => {
  it.each([
    [3, 0, '3 overdue / 0 unknown', 'Known due dates require action'],
    [0, 199, '0 overdue / 199 unknown', 'Due-date coverage incomplete'],
    [3, 7, '3 overdue / 7 unknown', 'Due-date coverage incomplete'],
    [0, 0, '0 overdue / 0 unknown', 'No overdue or unknown due dates'],
  ] as const)(
    'describes overdue %s and unknown %s due dates without false reassurance',
    (overdue, unknown, label, detail) => {
      expect(settlementAuditDueStatus(overdue, unknown)).toMatchObject({ detail, label });
    },
  );
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
  });

  it('uses server audit health and the shared Admin atoms', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('snapshot.settlementAuditHealth');
    expect(source).toContain('adminGetResult');
    expect(source).not.toContain('paymentFeeEvidenceState');
    expect(source).not.toContain('data:text/csv');
  });

  it('defaults to the all-date oldest-first action backlog', async () => {
    const requests: string[] = [];
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      requests.push(href);
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await BookingSettlementAuditPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(requests).toEqual(
      expect.arrayContaining([
        '/admin/booking-settlement-snapshots/summary?range=all&review=integrity-exceptions&sort=oldest',
        '/admin/booking-settlement-snapshots/summary?range=all&review=all&sort=oldest',
        '/admin/booking-settlement-snapshots?range=all&review=integrity-exceptions&sort=oldest&take=25',
      ]),
    );
    expect(markup).toContain('Integrity exceptions');
    expect(markup).toContain('Payment evidence');
    expect(markup).toContain('Tax due status');
    expect(markup).toContain('Amount at risk · global');
    expect(markup).toContain('All dates');
    expect(markup).toContain('Oldest action first');
    expect(markup).toContain('aria-label="Booking settlement audit records"');
  });

  it('passes names, period, payment method, and sorting to all server reads', async () => {
    const requests: string[] = [];
    mockedAdminGetResult.mockImplementation(async (href) => {
      requests.push(href);
      if (href.includes('/admin/booking-settlement-snapshots?')) {
        return { data: [snapshotFixture()], ok: true, status: 200 };
      }
      return {
        data: { ...emptyBookingSettlementSummary(), checkedAt: '2026-08-09T09:00:00.000Z', count: 26 },
        ok: true,
        status: 200,
      };
    });

    const page = await BookingSettlementAuditPage({
      searchParams: Promise.resolve({
        page: '2',
        paymentMethod: 'CARD',
        period: '2026-07',
        q: 'Demo Customer',
        range: '30d',
        review: 'clearing-evidence',
        sort: 'largest-discrepancy',
        take: '25',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(requests).toContain(
      '/admin/booking-settlement-snapshots/summary?range=30d&review=payment-evidence&period=2026-07&paymentMethod=CARD&q=Demo+Customer&sort=largest-discrepancy&reason=clearing',
    );
    expect(requests).toContain(
      '/admin/booking-settlement-snapshots/summary?range=all&review=all&sort=oldest',
    );
    expect(requests).toContain(
      '/admin/booking-settlement-snapshots?range=30d&review=payment-evidence&period=2026-07&paymentMethod=CARD&q=Demo+Customer&sort=largest-discrepancy&reason=clearing&take=25&skip=25',
    );
    expect(markup).toContain('Demo Customer');
    expect(markup).toContain('Evidence &amp; blockers');
    expect(markup).toContain('Owner / next action');
    expect(markup).toContain('Canonical Clearing Missing');
    expect(markup).toContain('Journal missing');
    expect(markup).toContain('+ 1 more');
    expect(markup).toContain('Finance Operations');
    expect(markup).toContain('Open clearing');
    expect(markup).toContain('Platform VAT');
    expect(markup).toContain('Positive VAT');
    expect(markup).toContain('returnTo=');
    expect(markup).toContain(
      '/api/admin/finance-tax/booking-settlement-audit/export?range=30d&amp;review=payment-evidence&amp;period=2026-07&amp;paymentMethod=CARD&amp;q=Demo+Customer&amp;sort=largest-discrepancy&amp;reason=clearing',
    );
    expect(markup).not.toContain('+84900000042');
    expect(markup).not.toContain('+84900000142');
  });

  it('does not render API failures as a true empty queue', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const page = await BookingSettlementAuditPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement summary unavailable');
    expect(markup).toContain('Settlement audit records unavailable');
    expect(markup).toContain('No zero-count assumption has been made');
    expect(markup).not.toContain('No settlement records match the current audit scope');
  });

  it('provides clear-search and reset recovery for a filtered empty result', async () => {
    const page = await BookingSettlementAuditPage({
      searchParams: Promise.resolve({ q: 'NO_SUCH_SETTLEMENT', range: 'all', review: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No settlement records match &quot;NO_SUCH_SETTLEMENT&quot;.');
    expect(markup).toContain('Clear search');
    expect(markup).toContain('Reset filters');
    expect(markup).toContain('range=all&amp;review=all&amp;sort=oldest&amp;take=25');
    expect(markup).toContain('range=all&amp;review=integrity-exceptions&amp;sort=oldest&amp;take=25');
  });
});

function snapshotFixture(): AdminBookingSettlementSnapshot {
  return {
    accountingJournalBatches: [],
    booking: {
      createdAt: '2026-07-20T01:00:00.000Z',
      id: 'booking-42',
      status: 'COMPLETED',
    },
    bookingId: 'booking-42',
    closedAt: null,
    companyOutputVat: 10_000,
    currency: 'VND',
    customerPaymentAmount: 500_000,
    customerProfile: {
      id: 'customer-42',
      user: { fullName: 'Demo Customer', id: 'customer-user-42', phone: '+84900000042' },
    },
    customerProfileId: 'customer-42',
    id: 'snapshot-42',
    metadata: null,
    monthlyPeriod: '2026-07',
    partnerPitAmount: 30_000,
    partnerPayoutAmount: 320_000,
    partnerTaxableRevenue: 400_000,
    partnerVatAmount: 50_000,
    partnerWithholdingTotal: 80_000,
    paymentClearingEntries: [],
    paymentMethod: 'CARD',
    paymentProcessingFee: 12_000,
    platformFeeGross: 100_000,
    platformFeeNetRevenue: 90_000,
    platformVatEvidenceStatus: 'POSITIVE_STANDARD_OR_REDUCED',
    postedAt: '2026-07-20T02:00:00.000Z',
    providerProfile: {
      displayName: 'Partner 42',
      id: 'partner-42',
      user: { fullName: 'Partner 42', id: 'partner-user-42', phone: '+84900000142' },
    },
    providerProfileId: 'partner-42',
    reversalEntries: [],
    settlementAuditHealth: {
      allocation: {
        companyCouponExpense: 0,
        customerPaymentAmount: 500_000,
        delta: 0,
        partnerPayoutAmount: 320_000,
        partnerWithholdingTotal: 80_000,
        platformFeeGross: 100_000,
      },
      blockers: [
        {
          amount: 500_000,
          blockingCloseout: true,
          code: 'CANONICAL_CLEARING_MISSING',
          dueAt: '2026-08-10T02:00:00.000Z',
          nextAction: 'Review payment clearing evidence.',
          owner: 'finance-operations',
          ownerTeam: 'Finance operations',
          priority: 30,
          remediationHref: '/finance-tax/payment-clearing?review=open',
          severity: 'BLOCKER',
        },
        {
          amount: 500_000,
          blockingCloseout: true,
          code: 'CANONICAL_JOURNAL_MISSING',
          dueAt: null,
          nextAction: 'Post the canonical journal.',
          owner: 'accounting',
          ownerTeam: 'Accounting',
          priority: 20,
          remediationHref: '/finance-tax/general-ledger?review=needs-action',
          severity: 'BLOCKER',
        },
      ],
      checkedAt: '2026-08-09T09:00:00.000Z',
      checks: {
        allocation: 'PASS',
        bankMatch: 'FAIL',
        canonicalClearing: 'FAIL',
        canonicalJournal: 'PASS',
        couponPolicy: 'NOT_APPLICABLE',
        paymentFeePolicy: 'PASS',
        reversal: 'NOT_APPLICABLE',
        taxPeriod: 'PASS',
      },
      evidence: {
        canonicalClearing: {
          count: 0,
          ids: [],
          matchedAmount: 0,
          required: true,
          state: 'FAIL',
          unmatchedAmount: 500_000,
        },
        canonicalJournal: { count: 1, ids: ['journal-42'], state: 'PASS' },
        reversal: {
          clearingCount: 0,
          count: 0,
          ids: [],
          journalCount: 0,
          lifecycle: 'NONE',
          state: 'NOT_APPLICABLE',
        },
      },
      formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
      state: 'ACTION_REQUIRED',
      workflow: {
        dueAt: '2026-08-15T16:59:59.999Z',
        reason: 'The tax period is open and remains inside the configured close window.',
        state: 'TAX_OPEN',
        urgency: 'NORMAL',
      },
    },
    settlementStatus: 'POSTED',
    taxStatus: 'DECLARED',
  };
}
