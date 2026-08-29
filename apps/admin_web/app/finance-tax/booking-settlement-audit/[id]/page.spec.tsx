import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminBookingSettlementSnapshot } from '../../../../lib/admin-api';
import { adminGetResult } from '../../../../lib/admin-api';
import BookingSettlementAuditDetailPage from './page';

vi.mock('../../../../lib/admin-api', async () => {
  const actual =
    await vi.importActual<typeof import('../../../../lib/admin-api')>('../../../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('BookingSettlementAuditDetailPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for settlement audit evidence links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('uses server health, distinguishes API errors, and preserves the list return context', () => {
    expect(source).toContain('snapshot.settlementAuditHealth');
    expect(source).toContain('adminGetResult');
    expect(source).toContain('safeBookingSettlementAuditReturnTo');
    expect(source).toContain('Back to results');
    expect(source).toContain('Settlement evidence unavailable');
    expect(source).toContain('contentClassName="booking-settlement-audit-detail"');
    expect(source).not.toContain('accountingJournalBatches?.[0]');
    expect(source).not.toContain('paymentClearingEntries?.[0]');
    expect(source).not.toContain("'Ready for tax review'");
  });

  it('renders every prioritized blocker with owner, due state, amount, and direct remediation', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: detailFixture(), ok: true, status: 200 });

    const page = await BookingSettlementAuditDetailPage({
      params: Promise.resolve({ id: 'snapshot-detail' }),
      searchParams: Promise.resolve({
        returnTo: '/finance-tax/booking-settlement-audit?review=integrity-exceptions',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Action checklist');
    expect(markup).toContain('Canonical Clearing Missing');
    expect(markup).toContain('Canonical Journal Missing');
    expect(markup).toContain('Finance Operations');
    expect(markup).toContain('Accounting');
    expect(markup).toContain('Blocks closeout');
    expect(markup).toContain('Open clearing');
    expect(markup).toContain('Open journal');
    expect(markup).toContain('Tax workflow open');
    expect(markup).toContain('Technical evidence');
    expect(markup).not.toContain('Journal PASS');
  });

  it('renders a reversal status-only mismatch as non-amount evidence', async () => {
    const fixture = detailFixture();
    fixture.settlementAuditHealth.blockers = [
      {
        blockingCloseout: true,
        code: 'REVERSAL_STATUS_MISMATCH',
        dueAt: null,
        nextAction: 'Update or verify the external refund clearing status; the amount already matches.',
        owner: 'finance-operations',
        ownerTeam: 'Finance operations',
        priority: 20,
        remediationHref: '/finance-tax/settlement-reversals/reversal-detail',
        severity: 'BLOCKER',
      },
    ];
    mockedAdminGetResult.mockResolvedValue({ data: fixture, ok: true, status: 200 });

    const page = await BookingSettlementAuditDetailPage({
      params: Promise.resolve({ id: 'snapshot-detail' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reversal Status Mismatch');
    expect(markup).toContain('Not amount-based');
    expect(markup).toContain('the amount already matches');
  });
});

function detailFixture() {
  return {
    accountingJournalBatches: [],
    auditAmountAtRisk: 500_000,
    booking: { createdAt: '2026-07-20T01:00:00.000Z', id: 'booking-detail', status: 'COMPLETED' },
    bookingId: 'booking-detail',
    closedAt: null,
    companyOutputVat: 10_000,
    currency: 'VND',
    customerPaymentAmount: 500_000,
    customerProfile: {
      id: 'customer-detail',
      user: { fullName: 'Demo Customer', id: 'customer-user-detail' },
    },
    customerProfileId: 'customer-detail',
    id: 'snapshot-detail',
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
    postedAt: '2026-07-20T02:00:00.000Z',
    providerProfile: {
      displayName: 'Partner Detail',
      id: 'partner-detail',
      user: { id: 'partner-user-detail' },
    },
    providerProfileId: 'partner-detail',
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
        canonicalJournal: 'FAIL',
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
        canonicalJournal: { count: 0, ids: [], state: 'FAIL' },
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
        reason: 'The tax period remains inside the configured close window.',
        state: 'TAX_OPEN',
        urgency: 'NORMAL',
      },
    },
    settlementStatus: 'POSTED',
    taxStatus: 'OPEN',
  } as unknown as AdminBookingSettlementSnapshot;
}
