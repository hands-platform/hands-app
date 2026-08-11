import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

import { adminGet, adminGetResult } from '../../lib/admin-api';
import BankReconciliationPage from './bank-reconciliation/page';
import BookingSettlementAuditPage from './booking-settlement-audit/page';
import CouponFinancePage from './coupon-finance/page';
import GeneralLedgerPage from './general-ledger/page';
import PaymentClearingPage from './payment-clearing/page';
import SettlementReversalsPage from './settlement-reversals/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
  };
});

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ refresh: vi.fn() }),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('finance list pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
  });

  it.each([
    ['booking settlement audit', BookingSettlementAuditPage, 'Audit records', 'Integrity exceptions'],
    ['coupon finance', CouponFinancePage, 'Coupon finance filters', 'Coupon settlement rows'],
    [
      'settlement reversals',
      SettlementReversalsPage,
      'Settlement reversal filters',
      'Settlement reversal rows',
    ],
  ] as const)(
    'renders %s filters and rows with Vuexy table panels',
    async (_name, Page, filterTitle, tableTitle) => {
      const page = await Page({
        searchParams: Promise.resolve({ range: 'today' }),
      });
      const markup = renderToStaticMarkup(page);

      expect(markup).toContain(filterTitle);
      expect(markup).toContain(tableTitle);
      expect(markup).toContain('card admin-filter-panel admin-mb-16');
      expect(markup).toContain('vuexy-booking-table-card');
      expect(markup).toContain('vuexy-booking-table');
      expect(markup).not.toContain('card admin-card-scroll');

      if (_name === 'coupon finance') {
        expect(markup).toContain('Coupon finance command board');
        expect(markup).toContain('Coupon review flags');
        expect(markup).toContain('Company coupon expense');
        expect(markup).toContain('Platform fee discount');
        expect(markup).toContain('Coupon records');
        expect(markup).toContain('Current filtered totals');
        expect(markup).toContain('10 rows');
        expect(markup).toContain('/finance-tax/coupon-finance?range=today&amp;review=coupon-review');
      }
    },
  );

  it.each([
    [
      'booking settlement audit',
      BookingSettlementAuditPage,
      '/finance-tax/booking-settlement-audit/snapshot-1',
      [
        {
          booking: { status: 'COMPLETED' },
          bookingId: 'booking-1',
          companyOutputVat: 5000,
          currency: 'VND',
          customerPaymentAmount: 500000,
          customerProfile: { user: { fullName: 'Demo Customer', phone: '+84900000001' } },
          customerProfileId: 'customer-1',
          id: 'snapshot-1',
          metadata: { companyCouponExpense: 0, couponCodeSnapshot: 'WELCOME10', couponDiscountAmount: 10000 },
          monthlyPeriod: '2026-06',
          partnerPayoutAmount: 435000,
          partnerPitAmount: 15000,
          partnerVatAmount: 0,
          partnerWithholdingTotal: 15000,
          paymentMethod: 'CARD',
          paymentProcessingFee: 12000,
          platformFeeGross: 50000,
          platformFeeNetRevenue: 45000,
          postedAt: '2026-06-20T09:10:00.000Z',
          providerProfile: {
            displayName: 'Linh Wellness',
            user: { fullName: 'Demo Partner', phone: '+84900000002' },
          },
          providerProfileId: 'provider-1',
          settlementAuditHealth: {
            allocation: {
              companyCouponExpense: 0,
              customerPaymentAmount: 500000,
              delta: 0,
              partnerPayoutAmount: 435000,
              partnerWithholdingTotal: 15000,
              platformFeeGross: 50000,
            },
            blockers: [
              {
                code: 'CANONICAL_CLEARING_MISSING',
                nextAction: 'Create or recover the canonical payment clearing evidence.',
                ownerTeam: 'Payment Operations',
                severity: 'BLOCKER',
              },
            ],
            checkedAt: '2026-06-20T09:15:00.000Z',
            checks: {
              allocation: 'PASS',
              bankMatch: 'FAIL',
              canonicalClearing: 'FAIL',
              canonicalJournal: 'PASS',
              couponPolicy: 'NOT_APPLICABLE',
              paymentFeePolicy: 'PASS',
              reversal: 'NOT_APPLICABLE',
              taxPeriod: 'FAIL',
            },
            evidence: {
              canonicalClearing: {
                count: 0,
                ids: [],
                matchedAmount: 0,
                required: true,
                state: 'FAIL',
                unmatchedAmount: 500000,
              },
              canonicalJournal: { count: 1, ids: ['journal-1'], state: 'PASS' },
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
          },
          settlementStatus: 'POSTED',
          taxStatus: 'OPEN',
        },
      ],
      {
        actionRequiredCount: 1,
        allocationMismatchCount: 0,
        amountAtRisk: 500000,
        checkedAt: '2026-06-20T09:15:00.000Z',
        clearCount: 0,
        clearingEvidenceIssueCount: 1,
        closedTaxCount: 0,
        companyOutputVat: 5000,
        count: 1,
        currency: 'VND',
        customerPaymentAmount: 500000,
        declaredTaxCount: 0,
        feeEvidenceIssueCount: 1,
        journalEvidenceIssueCount: 0,
        needsActionCount: 1,
        openTaxCount: 1,
        paidTaxCount: 0,
        partnerPayoutAmount: 390000,
        partnerWithholdingTotal: 15000,
        paymentProcessingFee: 12000,
        paymentFeeEvidenceIssueCount: 0,
        platformFeeGross: 50000,
        platformFeeNetRevenue: 45000,
        resolvedCount: 0,
        reversalIncompleteCount: 0,
        reversedClearCount: 0,
        reversedCount: 0,
        taxEvidenceIssueCount: 1,
        unknownCount: 0,
        couponEvidenceIssueCount: 0,
      },
    ],
    [
      'payment clearing',
      PaymentClearingPage,
      '/finance-tax/payment-clearing/clearing-1',
      [
        {
          _count: { bankReconciliationMatches: 0 },
          amount: 500000,
          booking: { status: 'COMPLETED' },
          bookingId: 'booking-1',
          currency: 'VND',
          id: 'clearing-1',
          occurredAt: '2026-06-20T09:10:00.000Z',
          payment: {
            amount: 500000,
            currency: 'VND',
            method: 'CARD',
            status: 'CAPTURED',
          },
          paymentId: 'payment-1',
          sourceKey: 'seed-finance-smoke-clearing',
          status: 'OPEN',
          type: 'CUSTOMER_PAYMENT_CAPTURED',
        },
      ],
      {
        amount: 500000,
        assignedCount: 0,
        clearedCount: 0,
        count: 1,
        currency: 'VND',
        openAmount: 500000,
        openCount: 1,
        partiallyClearedAmount: 0,
        partiallyClearedCount: 0,
        reversedCount: 0,
        unassignedCount: 1,
      },
    ],
    [
      'general ledger',
      GeneralLedgerPage,
      '/finance-tax/general-ledger/journal-batch-1',
      [
        {
          _count: { entries: 2 },
          booking: { status: 'COMPLETED' },
          bookingId: 'booking-1',
          createdAt: '2026-06-20T09:00:00.000Z',
          currency: 'VND',
          customerProfile: { user: { fullName: 'Demo Customer', phone: '+84900000001' } },
          customerProfileId: 'customer-1',
          id: 'journal-batch-1',
          monthlyPeriod: '2026-06',
          postedAt: '2026-06-20T09:10:00.000Z',
          providerProfile: {
            displayName: 'Linh Wellness',
            user: { fullName: 'Demo Partner', phone: '+84900000002' },
          },
          providerProfileId: 'provider-1',
          reversedAt: null,
          sourceId: 'booking-1',
          sourceKey: 'seed-finance-smoke-journal-batch',
          sourceType: 'BOOKING_SETTLEMENT',
          status: 'POSTED',
          totalCredit: 500000,
          totalDebit: 500000,
          updatedAt: '2026-06-20T09:10:00.000Z',
        },
      ],
      {
        balancedCount: 1,
        count: 1,
        currency: 'VND',
        draftCount: 0,
        postedCount: 1,
        reversedCount: 0,
        totalCredit: 500000,
        totalDebit: 500000,
        unbalancedAmount: 0,
        unbalancedCount: 0,
      },
    ],
    [
      'bank reconciliation',
      BankReconciliationPage,
      '/finance-tax/bank-reconciliation/bank-transaction-1',
      [
        {
          _count: { reconciliationMatches: 0 },
          amount: 500000,
          bankAccount: {
            accountNumberLast4: '3101',
            accountNumberMasked: '****3101',
            bankName: 'Vietcombank',
            name: 'HANDS Finance Smoke Account',
          },
          counterpartyName: 'Demo customer card processor',
          currency: 'VND',
          description: 'Finance smoke bank transaction',
          id: 'bank-transaction-1',
          occurredAt: '2026-06-20T10:00:00.000Z',
          sourceKey: 'seed-finance-smoke-bank-transaction',
          status: 'UNMATCHED',
          transferRef: 'FIN-SMOKE-3101',
          type: 'INFLOW',
          valueDate: '2026-06-20T00:00:00.000Z',
        },
      ],
      {
        amount: 500000,
        assignedCount: 0,
        count: 1,
        currency: 'VND',
        ignoredCount: 0,
        matchedAmount: 0,
        matchedCount: 0,
        openExposureAmount: 500000,
        oldestUnassignedAt: '2026-06-20T10:00:00.000Z',
        partiallyMatchedAmount: 0,
        partiallyMatchedCount: 0,
        reversedCount: 0,
        unassignedCount: 1,
        unassignedOver48hAmount: 500000,
        unassignedOver48hCount: 1,
        unmatchedAmount: 500000,
        unmatchedCount: 1,
      },
    ],
    [
      'settlement reversals',
      SettlementReversalsPage,
      '/finance-tax/general-ledger/reversal-journal-1',
      [
        {
          accountingJournalBatches: [
            {
              id: 'reversal-journal-1',
              postedAt: '2026-06-20T11:00:00.000Z',
              sourceKey: 'journal:reversal:1',
              status: 'POSTED',
            },
          ],
          bookingId: 'booking-1',
          companyOutputVat: 5000,
          currency: 'VND',
          customerPaymentAmount: 500000,
          customerProfileId: 'customer-1',
          id: 'reversal-1',
          monthlyPeriod: '2026-07',
          occurredAt: '2026-07-01T11:00:00.000Z',
          originalMonthlyClosingId: 'closing-1',
          originalMonthlyPeriod: '2026-06',
          originalSettlementSnapshot: {
            customerProfile: { user: { fullName: 'Demo Customer', phone: '+84900000001' } },
            providerProfile: {
              displayName: 'Linh Wellness',
              user: { fullName: 'Demo Partner', phone: '+84900000002' },
            },
          },
          originalSettlementSnapshotId: 'snapshot-1',
          partnerPitAmount: 15000,
          partnerPayoutAmount: 390000,
          partnerTaxableRevenue: 400000,
          partnerVatAmount: 0,
          partnerWithholdingTotal: 15000,
          paymentClearingEntries: [
            {
              amount: 500000,
              currency: 'VND',
              id: 'clearing-1',
              occurredAt: '2026-07-01T11:00:00.000Z',
              sourceKey: 'clearing:reversal:1',
              status: 'OPEN',
              type: 'REFUND_REVERSAL',
            },
          ],
          paymentId: 'payment-1',
          paymentMethod: 'CARD',
          paymentProcessingFee: 12000,
          platformFeeGross: 50000,
          platformFeeNetRevenue: 45000,
          providerProfileId: 'provider-1',
          providerEarningId: 'earning-1',
          reason: 'Refund after payout',
          settlementStatus: 'REVERSED',
          sourceKey: 'seed-finance-smoke-reversal',
          taxStatus: 'REVERSED',
        },
      ],
      {
        cashCount: 0,
        companyOutputVat: 5000,
        count: 1,
        currency: 'VND',
        customerPaymentAmount: 500000,
        nonCashCount: 1,
        partnerPayoutAmount: 390000,
        partnerWithholdingTotal: 15000,
        paymentProcessingFee: 12000,
        platformFeeGross: 50000,
        platformFeeNetRevenue: 45000,
      },
    ],
  ] as const)(
    'renders %s rows with a dedicated detail action column',
    async (_name, Page, detailHref, rows, summary) => {
      mockedAdminGet.mockImplementation(async (href, fallback) => {
        const requestHref = String(href);
        if (
          requestHref.includes('/bank-reconciliation/withdrawal-candidate-summary') ||
          requestHref.includes('/bank-reconciliation/import-batches/summary') ||
          requestHref.includes('/bank-reconciliation/evidence-source-summary') ||
          requestHref.includes('/bank-reconciliation/review-owner-summary') ||
          requestHref.includes('/booking-payment-clearing/review-owner-summary') ||
          requestHref.includes('/deposit-requests/reconciliation-owner-summary')
        ) {
          return fallback;
        }
        if (requestHref.includes('/summary')) {
          return summary;
        }
        if (
          requestHref.includes('/bank-reconciliation/import-batches') ||
          requestHref.includes('/company-bank-accounts') ||
          requestHref.includes('/admin/users')
        ) {
          return fallback;
        }
        return rows.length > 0 ? rows : fallback;
      });

      const page = await Page({
        searchParams: Promise.resolve({ range: 'today' }),
      });
      const markup = renderToStaticMarkup(page);

      if (_name === 'bank reconciliation' || _name === 'payment clearing') {
        expect(markup).toContain('Review and match');
      } else if (_name === 'booking settlement audit') {
        expect(markup).toContain('Open audit record');
      } else if (_name !== 'settlement reversals' && _name !== 'general ledger') {
        expect(markup).toContain('Open detail');
      }
      expect(markup).toContain(detailHref);
      if (_name === 'booking settlement audit') {
        expect(markup).toContain('booking-settlement-audit-command-strip');
        expect(markup).toContain('Global action required');
        expect(markup).toContain('Amount at risk · global');
      } else {
        expect(markup).toContain('finance-list-command-board admin-mb-16');
        expect(markup).not.toContain('usage-overview-command-grid finance-list-command-board');
        expect(markup).toContain('card admin-kpi-card finance-list-command-card is-');
        expect(markup).toContain('metric-card-icon');
        expect(markup).not.toContain('finance-list-command-icon');
        expect(markup).not.toContain('usage-overview-command-card finance-list-command-card');
        expect(markup).not.toContain('usage-overview-command-icon');
      }
      expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table');
      expect(markup).toContain('vuexy-booking-table-footer');

      if (_name === 'payment clearing') {
        expect(markup).toContain('Clearing command board');
        expect(markup).toContain('Unassigned reviews');
        expect(markup).toContain('Open exposure');
        expect(markup).toContain('Over SLA');
        expect(markup).toContain('Terminal outcomes');
        expect(markup).not.toContain('Cleared ratio');
        expect(markup).toContain('Bank matches 0');
        expect(markup).toContain('money-text money-text-positive');
      }

      if (_name === 'booking settlement audit') {
        expect(markup).toContain('Integrity exceptions');
        expect(markup).toContain('Payment evidence');
        expect(markup).toContain('Tax workflow');
        expect(markup).toContain('Reversals');
        expect(markup).toContain('Evidence &amp; blockers');
        expect(markup).toContain('Owner / next action');
        expect(markup).toContain(
          '/finance-tax/booking-settlement-audit?range=all&amp;review=integrity-exceptions&amp;sort=oldest&amp;take=25',
        );
        expect(markup).toContain('money-text money-text-positive');
      }

      if (_name === 'general ledger') {
        expect(markup).toContain('Journal batch integrity queues');
        expect(markup).toContain('Blocked integrity');
        expect(markup).toContain('Draft batches');
        expect(markup).toContain('Journal batch results');
        expect(markup).not.toContain('Open detail');
        expect(markup).toContain('money-text money-text-positive');
      }

      if (_name === 'bank reconciliation') {
        expect(markup).toContain('Bank command board');
        expect(markup).toContain('48h+ unassigned');
        expect(markup).toContain('Open exposure');
        expect(markup).toContain('Resolved rate');
        expect(markup).toContain('Unmatched');
        expect(markup).toContain('money-text money-text-positive');
      }

      if (_name === 'settlement reversals') {
        expect(markup).toContain('Reversal command board');
        expect(markup).toContain('Non-cash share');
        expect(markup).toContain('Tax correction recorded');
        expect(markup).toContain('10 rows');
        expect(markup).toContain('/finance-tax/settlement-reversals?range=today&amp;take=10');
        expect(markup).toContain('Refund after payout');
        expect(markup).toContain('Clearing open');
        expect(markup).toContain('Journal POSTED · Clearing OPEN');
        expect(markup).toContain('/finance-tax/settlement-reversals/reversal-1');
        expect(markup).toContain('/finance-tax/booking-settlement-audit/snapshot-1');
        expect(markup).toContain('money-text money-text-positive');
      }
    },
  );

  it('uses shared badge atoms for payment clearing status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/payment-clearing/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${statusPill(entry.status)}`}');
  });

  it('uses shared money atoms for payment clearing amount cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/payment-clearing/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(entry.amount, entry.currency)}</strong>');
    expect(source).not.toContain(
      '<div className="muted">Payment {formatMoney(entry.payment.amount, entry.payment.currency)}</div>',
    );
  });

  it('uses shared date time atoms for payment clearing event cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/payment-clearing/page.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('formatDateTime(entry.occurredAt)');
    expect(source).not.toContain('formatDateTime(entry.clearedAt)');
  });

  it('uses shared inline fallback atoms for payment clearing missing relationship cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/payment-clearing/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain(
      '<div className="muted">{entry.booking?.status ?? \'Unknown booking\'}</div>',
    );
    expect(source).not.toContain("<strong>{entry.payment?.method ?? '-'}</strong>");
  });

  it.each([
    [
      'payment clearing',
      'app/finance-tax/payment-clearing/page.tsx',
      "entry.payment?.status ?? 'No payment row'",
    ],
    [
      'general ledger',
      'app/finance-tax/general-ledger/page.tsx',
      "batch.booking?.status ?? 'Unknown status'",
    ],
  ] as const)(
    'uses shared inline fallback atoms for %s optional relationship labels',
    (_name, sourcePath, fallbackExpression) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

      expect(source).toContain('AdminInlineFallback');
      expect(source).not.toContain(`<div className="muted">{${fallbackExpression}}</div>`);
    },
  );

  it.each([
    [
      'booking settlement audit',
      'app/finance-tax/booking-settlement-audit/page.tsx',
      ['formatDateTime(snapshot.postedAt)'],
    ],
    [
      'coupon finance',
      'app/finance-tax/coupon-finance/page.tsx',
      ['formatDateTime(snapshot.closedAt', 'formatDateTime(snapshot.postedAt)'],
    ],
    [
      'general ledger',
      'app/finance-tax/general-ledger/page.tsx',
      ['formatDateTime(batch.postedAt)', 'formatDateTime(batch.reversedAt)'],
    ],
    [
      'bank reconciliation',
      'app/finance-tax/bank-reconciliation/page.tsx',
      ['formatDateTime(transaction.occurredAt)', 'formatDateTime(transaction.valueDate)'],
    ],
    [
      'settlement reversals',
      'app/finance-tax/settlement-reversals/page.tsx',
      ['formatDateTime(reversal.occurredAt)'],
    ],
  ] as const)('uses shared date time atoms for %s event cells', (_name, sourcePath, directFormatCalls) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('DateTimeText');
    for (const directFormatCall of directFormatCalls) {
      expect(source).not.toContain(directFormatCall);
    }
  });

  it('uses the shared table footer atom for finance pagination controls', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/finance-table-pagination-footer.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('<div className="vuexy-booking-table-footer">');
  });

  it('keeps the finance table wrapper from re-passing the base Vuexy table class', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-data-table.tsx'), 'utf8');

    expect(source).toContain('AdminDataTable');
    expect(source).not.toContain('className="vuexy-booking-table"');
  });

  it('uses the shared KPI card surface for finance command cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-list-command-card.tsx'), 'utf8');

    expect(source).toContain('AdminKpiCard');
    expect(source).toContain('className={`finance-list-command-card is-${tone}`}');
    expect(source).toContain('icon={Icon}');
    expect(source).toContain('iconSize={18}');
    expect(source).toContain('baseClassName={financeListCommandBoardClassName}');
    expect(source).not.toContain('AdminLinkCard');
    expect(source).not.toContain('AdminOverviewCommandCard');
    expect(source).not.toContain('financeListCommandIconClassName');
    expect(source).not.toContain('usage-overview-command-icon');
    expect(source).not.toContain('<Link className={`card finance-list-command-card is-${tone}`}');
  });

  it('requires finance list command cards to declare an operating scope at the call site', () => {
    const financePageFiles = readdirSync(join(process.cwd(), 'app/finance-tax'), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name === 'page.tsx')
      .map((entry) => join(entry.parentPath, entry.name));

    for (const filePath of financePageFiles) {
      const source = readFileSync(filePath, 'utf8');
      const commandCardBlocks = source.matchAll(/<FinanceListCommandCard[\s\S]*?^\s*\/>\r?$/gm);

      for (const block of commandCardBlocks) {
        expect(block[0], `${filePath} FinanceListCommandCard missing scope`).toContain('scope=');
      }
    }
  });

  it('scopes finance command card metric overrides to the shared KPI card slots', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(css).toContain('.finance-list-command-card > .metric-card {');
    expect(css).toContain('.finance-list-command-card > .metric-card > .metric-card-icon {');
    expect(css).toContain(
      '.finance-list-command-card > .metric-card > .metric-card-content > .metric-card-value {',
    );
    expect(css).toContain('.finance-list-command-card > .metric-card > .metric-card-content > small {');
    expect(css).not.toContain('.finance-list-command-card .metric-card {');
    expect(css).not.toContain('.finance-list-command-card .metric-card-icon {');
    expect(css).not.toContain('.finance-list-command-card .metric-card h2 {');
    expect(css).not.toContain('.finance-list-command-card .metric-card small {');
  });

  it('scopes finance command card icon tones to direct KPI icon slots', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    for (const tone of ['primary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(css).toContain(`.finance-list-command-card.is-${tone} > .metric-card > .metric-card-icon`);
      expect(css).not.toContain(`.finance-list-command-card.is-${tone} .metric-card-icon`);
    }
  });

  it('uses shared badge atoms for bank reconciliation status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/bank-reconciliation/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${statusPill(transaction.status)}`}');
  });

  it('uses shared money atoms for bank reconciliation amount cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/bank-reconciliation/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(transaction.amount, transaction.currency)}</strong>');
  });

  it('uses shared inline fallback atoms for bank reconciliation missing relationship cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/bank-reconciliation/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('<div className="muted">{transaction.bankAccount?.bankName ?? \'-\'}</div>');
    expect(source).not.toContain(
      "{transaction.bankAccount?.accountNumberMasked ?? transaction.bankAccount?.accountNumberLast4 ?? '-'}",
    );
    expect(source).not.toContain("<strong>{transaction.counterpartyName ?? '-'}</strong>");
    expect(source).not.toContain('<div className="muted">{transaction.description ?? \'-\'}</div>');
  });

  it('uses shared badge atoms for general ledger status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/general-ledger/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${statusPill(batch.status)}`}');
  });

  it('uses shared money atoms for general ledger debit and credit cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/general-ledger/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(batch.totalDebit, batch.currency)}</strong>');
    expect(source).not.toContain(
      '<div className="muted">Credit {formatMoney(batch.totalCredit, batch.currency)}</div>',
    );
  });

  it('uses shared inline fallback atoms for general ledger missing relationship cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/general-ledger/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('<span className="muted">-</span>');
    expect(source).not.toContain(
      '<div className="muted">{batch.customerProfile?.user?.phone ?? \'-\'}</div>',
    );
    expect(source).not.toContain(
      '<div className="muted">{batch.providerProfile?.user?.phone ?? \'-\'}</div>',
    );
    expect(source).not.toContain("<strong>{batch.monthlyPeriod ?? '-'}</strong>");
  });

  it('uses shared badge atoms for booking settlement audit status pills', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/booking-settlement-audit/page.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('auditStateTone');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${statusPill(snapshot.taxStatus)}`}');
  });

  it('uses shared money atoms for booking settlement audit tax and fee cells', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/booking-settlement-audit/page.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain(
      '<strong>{formatMoney(snapshot.partnerWithholdingTotal, snapshot.currency)}</strong>',
    );
    expect(source).not.toContain(
      '<strong>{formatMoney(snapshot.platformFeeGross, snapshot.currency)}</strong>',
    );
  });

  it.each([
    [
      'coupon finance',
      'app/finance-tax/coupon-finance/page.tsx',
      [
        '<div className="muted">{snapshot.customerProfile?.user?.phone ?? \'-\'}</div>',
        '<div className="muted">{snapshot.providerProfile?.user?.phone ?? \'-\'}</div>',
      ],
    ],
    [
      'settlement reversals',
      'app/finance-tax/settlement-reversals/page.tsx',
      [
        '<div className="muted">{reversal.originalSettlementSnapshot?.customerProfile?.user?.phone ?? \'-\'}</div>',
        '<div className="muted">{reversal.originalSettlementSnapshot?.providerProfile?.user?.phone ?? \'-\'}</div>',
      ],
    ],
  ] as const)(
    'uses shared inline fallback atoms for %s participant phone cells',
    (_name, sourcePath, rawFallbacks) => {
      const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

      expect(source).toContain('AdminInlineFallback');
      for (const rawFallback of rawFallbacks) {
        expect(source).not.toContain(rawFallback);
      }
    },
  );

  it('keeps participant phone fields out of the compact booking settlement audit list', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/booking-settlement-audit/page.tsx'),
      'utf8',
    );

    expect(source).not.toContain('snapshot.customerProfile?.user?.phone');
    expect(source).not.toContain('snapshot.providerProfile?.user?.phone');
  });

  it('uses shared badge atoms for settlement reversal status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/settlement-reversals/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${statusPill(reversal.taxStatus)}`}');
    expect(source).not.toContain('className={`pill ${evidencePill(evidenceState.tone)}`}');
  });

  it('uses shared money atoms for settlement reversal amount cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/settlement-reversals/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain(
      '<strong>{formatMoney(reversal.customerPaymentAmount, reversal.currency)}</strong>',
    );
    expect(source).not.toContain(
      '<strong>{formatMoney(reversal.partnerWithholdingTotal, reversal.currency)}</strong>',
    );
  });

  it('uses shared badge atoms for coupon finance review pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/coupon-finance/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain("className={`pill ${coupon.reviewFlag ? 'pill-warn' : 'pill-success'}`}");
  });

  it('uses shared money atoms for coupon finance amount cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/coupon-finance/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain(
      '<div className="muted">Customer paid {formatMoney(coupon.customerPaid, snapshot.currency)}</div>',
    );
    expect(source).not.toContain(
      '<strong>Discount {formatMoney(coupon.discountAmount, snapshot.currency)}</strong>',
    );
    expect(source).not.toContain(
      '<div className="muted">Service {formatMoney(coupon.bookingServiceAmount, snapshot.currency)}</div>',
    );
    expect(source).not.toContain(
      '<div className="muted">Settlement {formatMoney(coupon.settlementBaseAmount, snapshot.currency)}</div>',
    );
    expect(source).not.toContain(
      '<div className="muted">Company expense {formatMoney(coupon.companyExpense, snapshot.currency)}</div>',
    );
  });

  it('uses shared badge atoms for platform VAT category pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/platform-vat/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${platformVatCategoryPill(row.category)}`}');
  });

  it('uses shared money atoms for monthly tax closing tax cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain(
      '<strong>{formatMoney(closing.companyOutputVatTotal, closing.currency)}</strong>',
    );
    expect(source).not.toContain(
      '<strong>{formatMoney(closing.partnerWithholdingTotal, closing.currency)}</strong>',
    );
    expect(source).not.toContain(
      '<div className="muted">Net {formatMoney(closing.platformFeeNetRevenueTotal, closing.currency)}</div>',
    );
    expect(source).not.toContain(
      '<div className="muted">VAT {formatMoney(closing.partnerVatWithheldTotal, closing.currency)}</div>',
    );
    expect(source).not.toContain(
      '<div className="muted">PIT {formatMoney(closing.partnerPitWithheldTotal, closing.currency)}</div>',
    );
    expect(source).not.toContain(
      '<td>{formatMoney(closing.paymentProcessingFeeTotal, closing.currency)}</td>',
    );
  });

  it('uses shared money atoms for partner withholding tax cells', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/partner-withholding-tax/page.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<td>{formatMoney(row.grossServiceRevenue, row.currency)}</td>');
    expect(source).not.toContain('<td>{formatMoney(row.partnerPayoutTotal, row.currency)}</td>');
    expect(source).not.toContain('<strong>{formatMoney(row.partnerVatWithheldTotal, row.currency)}</strong>');
    expect(source).not.toContain(
      '<div className="muted">PIT {formatMoney(row.partnerPitWithheldTotal, row.currency)}</div>',
    );
    expect(source).not.toContain('<strong>{formatMoney(row.totalPartnerTaxWithheld, row.currency)}</strong>');
  });

  it('uses shared money atoms for payment fee total cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/payment-fees/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain(
      '<td>{formatMoney(Number(row.customerPaymentAmountTotal ?? 0), currency)}</td>',
    );
    expect(source).not.toContain(
      '<strong>{formatMoney(Number(row.paymentProcessingFeeTotal ?? 0), currency)}</strong>',
    );
  });

  it('uses the shared overview command grid shell for finance command boards', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-list-command-card.tsx'), 'utf8');

    expect(source).toContain('AdminOverviewCommandGrid');
    expect(source).not.toContain('<section className="finance-list-command-board admin-mb-16"');
  });

  it('uses shared money atoms for platform VAT total cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/platform-vat/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<td>{formatMoney(row.platformFeeGrossTotal, summary.currency)}</td>');
    expect(source).not.toContain(
      '<strong>{formatMoney(row.companyOutputVatTotal, summary.currency)}</strong>',
    );
    expect(source).not.toContain('<td>{formatMoney(row.platformFeeNetRevenueTotal, summary.currency)}</td>');
  });

  it('uses a direct detail link for compact booking settlement audit rows', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/finance-tax/booking-settlement-audit/page.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTextLink');
    expect(source).toContain('bookingSettlementAuditDetailHref(snapshot.id, detailReturnTo)');
    expect(source).not.toContain('ActionMenu');
  });

  it.each([
    [
      'payment clearing',
      'app/finance-tax/payment-clearing/page.tsx',
      'paymentClearingDetailHref(entry.id, currentQueueHref)',
    ],
    [
      'general ledger',
      'app/finance-tax/general-ledger/page.tsx',
      'generalLedgerDetailHref(batch.id, detailReturnTo)',
    ],
    [
      'bank reconciliation',
      'app/finance-tax/bank-reconciliation/page.tsx',
      'bankReconciliationDetailHref(transaction.id, currentQueueHref)',
    ],
  ] as const)('uses direct detail links for compact %s rows', (_name, sourcePath, detailHref) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).toContain(detailHref);
    expect(source).not.toContain('ActionMenu');
  });

  it.each([
    ['booking settlement audit CSV', 'app/finance-tax/booking-settlement-audit/page.tsx'],
    ['coupon finance CSV', 'app/finance-tax/coupon-finance/page.tsx'],
    ['monthly tax closing CSV', 'app/finance-tax/monthly-tax-closing/page.tsx'],
    ['partner withholding tax CSV', 'app/finance-tax/partner-withholding-tax/page.tsx'],
    ['payment fees CSV', 'app/finance-tax/payment-fees/page.tsx'],
    ['platform VAT CSV', 'app/finance-tax/platform-vat/page.tsx'],
  ] as const)('uses shared StatusBadgeLink for %s downloads', (_name, sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toMatch(/<a\s+className="pill [^"]+"\s+download/s);
    expect(source).not.toMatch(/className="pill pill-success"/);
  });

  it.each([
    ['booking settlement audit', 'app/finance-tax/booking-settlement-audit/page.tsx'],
    ['coupon finance', 'app/finance-tax/coupon-finance/page.tsx'],
    ['finance approvers', 'app/finance-tax/finance-approvers/page.tsx'],
    ['payment clearing', 'app/finance-tax/payment-clearing/page.tsx'],
    ['general ledger', 'app/finance-tax/general-ledger/page.tsx'],
    ['bank reconciliation', 'app/finance-tax/bank-reconciliation/page.tsx'],
    ['monthly tax closing', 'app/finance-tax/monthly-tax-closing/page.tsx'],
    ['partner withholding tax', 'app/finance-tax/partner-withholding-tax/page.tsx'],
    ['payment fees', 'app/finance-tax/payment-fees/page.tsx'],
    ['platform VAT', 'app/finance-tax/platform-vat/page.tsx'],
    ['settlement reversals', 'app/finance-tax/settlement-reversals/page.tsx'],
  ] as const)('uses the shared FinanceDataTable shell for %s', (_name, sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('FinanceDataTable');
    expect(source).not.toContain('AdminTableScroll');
    expect(source).not.toContain('className="vuexy-booking-table"');
  });

  it('uses the shared table substack atom for settlement reversal evidence cells', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/settlement-reversals/page.tsx'), 'utf8');

    expect(source).toContain('AdminTableSubstack');
    expect(source).not.toContain('<div className="admin-table-substack"');
  });
});
