import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type {
  AdminBookingSettlementGapDryRun,
  AdminBookingSettlementGapList,
  AdminBookingSettlementGapRepairPreview,
  AdminBookingSettlementRepairCheckpoint,
  AdminBookingSettlementGapSummary,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPaymentSummary,
  AdminPayoutBatch,
  AdminRefund,
  AdminRefundSummary,
  AdminUser,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import FinanceCloseoutPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('FinanceCloseoutPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('loads only daily operations APIs in the default closeout workspace', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({});
    const markup = renderToStaticMarkup(page);
    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('Operations closeout');
    expect(markup).not.toContain('Settlement gap filters');
    expect(hrefs).toContain('/admin/payments?range=today&take=10&review=needs-action');
    expect(hrefs).toContain('/admin/booking-settlement-gaps/summary');
    expect(hrefs.some((href) => href.startsWith('/admin/booking-settlement-gaps?'))).toBe(false);
  });

  it('loads only settlement repair APIs in the settlement workspace', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ view: 'settlement' }),
    });
    const markup = renderToStaticMarkup(page);
    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('Settlement gap filters');
    expect(markup).not.toContain('Closeout reconciliation board');
    expect(hrefs).toContain('/admin/booking-settlement-gaps/summary');
    expect(hrefs.some((href) => href.startsWith('/admin/payments?'))).toBe(false);
    expect(hrefs.some((href) => href.startsWith('/admin/earnings?'))).toBe(false);
  });

  it('shows blocking checkpoint codes when a repair write needs accounting review', async () => {
    const checkpoint: AdminBookingSettlementRepairCheckpoint = {
      blockingFailures: ['JOURNAL_BALANCED', 'PAYMENT_CLEARING_EXPECTATION'],
      bookingId: 'booking-checkpoint-1',
      checkedAt: '2026-07-13T12:00:00.000Z',
      checks: [
        {
          code: 'JOURNAL_BALANCED',
          message: 'Journal batch debit and credit totals are balanced.',
          passed: false,
        },
      ],
      passed: false,
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
      snapshotId: 'settlement-1',
      status: 'FAILED',
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href === '/admin/booking-settlement-gaps/booking-checkpoint-1/checkpoint'
        ? checkpoint
        : fallback,
    );

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({
        checkpointBookingId: 'booking-checkpoint-1',
        repairNotice: 'checkpoint-failed',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement recorded, accounting review required');
    expect(markup).toContain('Checkpoint FAILED');
    expect(markup).toContain('JOURNAL_BALANCED, PAYMENT_CLEARING_EXPECTATION');
  });

  it('renders bounded server closeout rows without applying second local date filters', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 0,
      count: 0,
      currency: 'VND',
      grossAmount: 0,
      netAmount: 0,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
    };
    const refund = {
      amount: 120000,
      bookingId: 'server-closeout-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      id: 'server-closeout-refund',
      paymentId: 'server-closeout-payment',
      status: 'REQUESTED',
    } as AdminRefund;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [refund];
      }
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Refund queue');
    expect(markup).toContain('1 OPEN');
  });

  it('uses the server earnings summary instead of recalculating from the bounded earnings sample', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 900000,
      count: 24,
      currency: 'VND',
      grossAmount: 1200000,
      netAmount: 900000,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 300000,
      withholdingAmount: 0,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [] as AdminRefund[];
      }
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Available payout');
    expect(markup).toContain('900.000 VND');
  });

  it('uses payment and refund summaries for closeout counts instead of bounded samples', async () => {
    const earningsSummary: AdminEarningSummary = {
      availableNetAmount: 0,
      count: 0,
      currency: 'VND',
      grossAmount: 0,
      netAmount: 0,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
    };
    const paymentSummary: AdminPaymentSummary = {
      authorized: 12,
      callbackReview: 0,
      callbackVerified: 0,
      captured: 0,
      cashDebt: 0,
      linkedRefunds: 0,
      needsAction: 15,
      pendingCash: 3,
      refunded: 0,
      totalCount: 15,
    };
    const refundSummary: AdminRefundSummary = {
      completedCount: 0,
      needsUpdateCount: 0,
      openCount: 4,
      outcomeLinkedCount: 0,
      refundedBookingCount: 0,
      requestedCount: 4,
      totalCount: 4,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/payments/summary?range=today') {
        return paymentSummary;
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [] as AdminRefund[];
      }
      if (href === '/admin/refunds/summary?range=today') {
        return refundSummary;
      }
      if (href === '/admin/earnings/summary?range=today') {
        return earningsSummary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('12 HOLD(S)');
    expect(markup).toContain('3 CASH');
    expect(markup).toContain('4 OPEN');
  });

  it('uses shared segmented controls for closeout range filters', () => {
    expect(pageSource).toContain('AdminFilterPanel');
    expect(pageSource).toContain('AdminFilterSummary');
    expect(pageSource).toContain('AdminSegmentedControl');
    expect(pageSource).not.toContain('AdminFilterChipGroup');
    expect(pageSource).not.toContain('StatusBadgeLink');
    expect(pageSource).not.toContain('<AdminSection');
    expect(pageSource).not.toContain('bodyClassName="filter-row admin-mt-12"');
    expect(pageSource).not.toContain('PillClassBadgeLink');
  });

  it('shows the active closeout range near the filter controls', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Active finance closeout filters');
    expect(markup).toContain('Range: Today');
  });

  it('uses the shared Vuexy text link atom for closeout audit links', () => {
    expect(pageSource).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(pageSource).toContain('<AdminTextLink');
    expect(pageSource).not.toContain('className="text-link"');
  });

  it('uses shared money atoms for closeout page KPI amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain('formatMoney(');
  });

  it('scopes closeout KPI cards by the selected range and action risk', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Last 7 days');
    expect(markup).toContain('Payment holds and cash rows to close for this range.');
    expect(markup).toContain('Refund cases still open for this range.');
    expect(markup).toContain('Partner cash-fee debt needing settlement evidence for this range.');
    expect(markup).toContain('Payout batches still waiting for release checks.');
    expect(markup).not.toContain('Authorization holds and pending cash rows.');
    expect(markup).not.toContain('Payout batches not yet paid or cancelled.');
  });

  it('renders the server-paginated settlement backlog with age summary and booking links', async () => {
    const gapList: AdminBookingSettlementGapList = {
      generatedAt: '2026-07-13T00:00:00.000Z',
      hasNext: true,
      items: [
        {
          ageBucket: '7_DAYS_PLUS',
          closedAt: null,
          createdAt: '2026-07-01T00:00:00.000Z',
          customerProfile: { id: 'customer-1', user: { fullName: 'Settlement Customer', phone: '0901' } },
          earning: { id: 'earning-1', status: 'AVAILABLE' },
          gapAt: '2026-07-01T00:00:00.000Z',
          id: 'booking-settlement-gap-11',
          payment: { amount: 500000, currency: 'VND', id: 'payment-1', method: 'CARD', status: 'CAPTURED' },
          repairTrack: 'historical-ready',
          selectedProvider: { id: 'partner-1', displayName: 'Settlement Partner' },
          status: 'COMPLETED',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      skip: 10,
      take: 10,
      total: 21,
    };
    const gapSummary: AdminBookingSettlementGapSummary = {
      age24To72Hours: 2,
      age3To7Days: 4,
      age7DaysPlus: 15,
      backlog: 21,
      canonical: 5,
      evidenceBlocked: 1,
      generatedAt: '2026-07-13T00:00:00.000Z',
      historicalReady: 15,
      manualReview: 1,
      oldestGapAt: '2026-06-01T00:00:00.000Z',
      recent: 1,
      total: 22,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href ===
        '/admin/booking-settlement-gaps?age=7d-plus&skip=10&take=10&track=historical-ready&q=Settlement&period=2026-07&paymentMethod=CARD'
      ) {
        return gapList;
      }
      if (href === '/admin/booking-settlement-gaps/summary') {
        return gapSummary;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({
        q: 'Settlement',
        range: 'today',
        settlementAge: '7d-plus',
        settlementPage: '2',
        settlementPaymentMethod: 'CARD',
        settlementPeriod: '2026-07',
        settlementTrack: 'historical-ready',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement backlog');
    expect(markup).toContain('Settlement Customer');
    expect(markup).toContain('Settlement Partner');
    expect(markup).toContain('booking-settlement-gap-11');
    expect(markup).toContain('500.000 VND');
    expect(markup).toContain('/bookings/booking-settlement-gap-11');
    expect(markup).toContain('repairBookingId=booking-settlement-gap-11');
    expect(markup).toContain('Preview repair');
    expect(markup).toContain('Showing 11 to 11 of 21 bookings');
    expect(markup).toContain('Settlement backlog pagination');
    expect(markup).toContain('7d+: 15');
    expect(markup).toContain('Historical evidence ready');
    expect(markup).toContain('Historical ready');
    expect(markup).toContain('Evidence blocked: 1');
    expect(markup).toContain('Month: 2026-07');
    expect(markup).toContain('Payment: Card');
    expect(markup).toContain('Review selected');
    expect(markup).toContain('Select booking-settlement-gap-11');
  });

  it('loads at most ten selected gaps into a read-only comparison queue', async () => {
    const selectedIds = Array.from({ length: 12 }, (_, index) => `selected-gap-${index + 1}`);

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      const match = href.match(/^\/admin\/booking-settlement-gaps\/(selected-gap-\d+)\/preview$/);
      if (match) return settlementPreviewFixture(match[1]);
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ reviewBookingId: selectedIds }),
    });
    const markup = renderToStaticMarkup(page);
    const selectedPreviewCalls = mockedAdminGet.mock.calls.filter(([href]) => href.endsWith('/preview'));

    expect(selectedPreviewCalls).toHaveLength(10);
    expect(markup).toContain('Selected settlement review (10)');
    expect(markup).toContain('Read-only comparison for the selected settlement gaps.');
    expect(markup).toContain('Open governed repair');
    expect(markup).toContain('Full preview passed.');
    expect(markup).not.toContain('selected-gap-11');
    expect(markup).not.toContain('selected-gap-12');
  });

  it('loads the bounded historical dry-run only when explicitly requested', async () => {
    const dryRun: AdminBookingSettlementGapDryRun = {
      blockerCodes: {},
      counts: {
        blocked: 0,
        companyOutputVatPositive: 0,
        companyOutputVatZero: 66,
        eligible: 66,
        journalBalanced: 66,
        paymentFeeDefaulted: 66,
        paymentFeePolicyMatched: 0,
        platformVatEvidenceReady: 66,
        platformVatExplicitZeroServiceRule: 66,
        platformVatUnexplainedZero: 0,
        platformVatZeroFromPolicy: 0,
        reconciliationReview: 0,
      },
      evaluated: 66,
      generatedAt: '2026-07-13T00:00:00.000Z',
      items: [],
      paymentMethods: { CASH: 34, MOMO: 32 },
      policyGate: {
        issues: [
          {
            code: 'PAYMENT_FEE_POLICY_DEFAULTED',
            count: 66,
            message: 'Historical payment fee evidence defaulted to zero without a matched policy rule.',
          },
        ],
        status: 'REVIEW_REQUIRED',
      },
      periodStatuses: { OPEN_OR_UNLINKED: 66 },
      recoveryBatches: [
        {
          batchKey: 'momo-1',
          bookingIds: ['historical-gap-1', 'historical-gap-2'],
          counts: {
            blocked: 0,
            companyOutputVatPositive: 0,
            companyOutputVatZero: 2,
            eligible: 2,
            journalBalanced: 2,
            paymentFeeDefaulted: 2,
            paymentFeePolicyMatched: 0,
            platformVatEvidenceReady: 2,
            platformVatExplicitZeroServiceRule: 2,
            platformVatUnexplainedZero: 0,
            platformVatZeroFromPolicy: 0,
            reconciliationReview: 0,
          },
          executionStatus: 'REVIEW_REQUIRED',
          paymentMethod: 'MOMO',
          recordCount: 2,
          totals: {
            companyOutputVat: 0,
            customerPaymentAmount: 800_000,
            journalReconciliationDelta: 0,
            journalTotalCredit: 800_000,
            journalTotalDebit: 800_000,
            partnerPayoutAmount: 600_000,
            partnerWithholdingTotal: 40_000,
            paymentProcessingFee: 0,
            platformFeeGross: 160_000,
            platformFeeNetRevenue: 160_000,
          },
        },
      ],
      totalMatched: 66,
      totals: {
        companyOutputVat: 0,
        customerPaymentAmount: 26_400_000,
        journalReconciliationDelta: 0,
        journalTotalCredit: 26_400_000,
        journalTotalDebit: 26_400_000,
        partnerPayoutAmount: 19_800_000,
        partnerWithholdingTotal: 1_320_000,
        paymentProcessingFee: 0,
        platformFeeGross: 5_280_000,
        platformFeeNetRevenue: 5_280_000,
      },
      truncated: false,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-settlement-gaps/dry-run?take=100&period=2026-06&paymentMethod=MOMO') {
        return dryRun;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({
        settlementDryRun: '1',
        settlementPaymentMethod: 'MOMO',
        settlementPeriod: '2026-06',
        settlementTrack: 'historical-ready',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Historical settlement dry-run (66)');
    expect(markup).toContain('66 of 66');
    expect(markup).toContain('66 eligible · 0 blocked');
    expect(markup).toContain('66 balanced · 0 delta review');
    expect(markup).toContain('0 policy · 66 defaulted');
    expect(markup).toContain('Retained service VAT rule 66 · Policy zero 0 · Unexplained zero 0');
    expect(markup).toContain('2 fee default · 0 unexplained VAT · 0 delta');
    expect(markup).toContain('CASH: 34 · MOMO: 32');
    expect(markup).toContain('Finance policy gate');
    expect(markup).toContain('Review required');
    expect(markup).toContain('Review payment fee policy and activation blockers');
    expect(markup).toContain('href="/finance-tax/payment-fees"');
    expect(markup).toContain('Prepared review batches');
    expect(markup).toContain('momo-1');
    expect(markup).toContain('Review 2');
    expect(markup).toContain('reviewBookingId=historical-gap-1');
    expect(markup).toContain('reviewBookingId=historical-gap-2');
    expect(markup).toContain('No finance record is written by this report.');
  });

  it('renders a read-only repair preview before exposing the dual-approval form', async () => {
    const preview: AdminBookingSettlementGapRepairPreview = {
      blockers: [],
      bookingId: 'booking-settlement-gap-11',
      bookingStatus: 'COMPLETED',
      canRepair: true,
      completedAt: '2026-07-01T00:00:00.000Z',
      currency: 'VND',
      customer: { id: 'customer-1', user: { fullName: 'Settlement Customer' } },
      earning: {
        currency: 'VND',
        grossAmount: 500000,
        id: 'earning-1',
        netAmount: 365000,
        payoutBatchId: null,
        paidAt: null,
        platformFee: 100000,
        status: 'AVAILABLE',
        withholdingAmount: 35000,
      },
      monthlyClosingStatus: 'REVIEWED',
      monthlyPeriod: '2026-07',
      partner: { id: 'partner-1', displayName: 'Settlement Partner' },
      payment: { amount: 500000, currency: 'VND', id: 'payment-1', method: 'CARD', status: 'CAPTURED' },
      preservesExistingEarningLifecycle: true,
      repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
      serviceCount: 1,
      settlementSnapshotId: null,
    };
    const approver = {
      email: 'finance@example.com',
      fullName: 'Finance Approver',
      id: 'finance-admin-2',
      phone: '0902',
      roles: ['ADMIN', 'FINANCE_APPROVER'],
    } as AdminUser;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-settlement-gaps/booking-settlement-gap-11/preview') return preview;
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') return [approver];
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ repairBookingId: 'booking-settlement-gap-11' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Settlement repair preview');
    expect(markup).toContain('Eligible for controlled repair');
    expect(markup).toContain('Dual approval required');
    expect(markup).toContain('Finance Approver · finance-admin-2');
    expect(markup).toContain('Confirm booking ID');
    expect(markup).toContain('Create missing settlement');
    expect(markup).toContain('Existing status preserved');
  });

  it('labels paid evidence reconstruction separately from canonical settlement repair', async () => {
    const preview: AdminBookingSettlementGapRepairPreview = {
      blockers: [],
      bookingId: 'booking-settlement-paid-gap',
      bookingStatus: 'COMPLETED',
      canRepair: true,
      completedAt: '2026-06-10T00:00:00.000Z',
      currency: 'VND',
      customer: { id: 'customer-1', user: { fullName: 'Settlement Customer' } },
      earning: {
        currency: 'VND',
        grossAmount: 400000,
        id: 'earning-paid-1',
        netAmount: 300000,
        payoutBatchId: 'payout-1',
        paidAt: '2026-06-11T00:00:00.000Z',
        platformFee: 80000,
        status: 'PAID',
        withholdingAmount: 20000,
      },
      historicalEvidenceSummary: {
        platformFeeLogCount: 1,
        taxLogCount: 1,
        walletLedgerEntryCount: 2,
      },
      monthlyClosingStatus: null,
      monthlyPeriod: '2026-06',
      partner: { id: 'partner-1', displayName: 'Settlement Partner' },
      payment: { amount: 400000, currency: 'VND', id: 'payment-1', method: 'MOMO', status: 'CAPTURED' },
      preservesExistingEarningLifecycle: true,
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
      serviceCount: 1,
      settlementSnapshotId: null,
    };
    const approver = {
      email: 'finance@example.com',
      fullName: 'Finance Approver',
      id: 'finance-admin-2',
      phone: '0902',
      roles: ['ADMIN', 'FINANCE_APPROVER'],
    } as AdminUser;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-settlement-gaps/booking-settlement-paid-gap/preview') return preview;
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') return [approver];
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ repairBookingId: 'booking-settlement-paid-gap' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Historical paid evidence');
    expect(markup).toContain('1 fee · 1 tax · 2 wallet');
    expect(markup).toContain('Reconstruct historical settlement');
    expect(markup).toContain('preserves the paid earning and wallet lifecycle');
  });
});

function settlementPreviewFixture(bookingId: string): AdminBookingSettlementGapRepairPreview {
  return {
    blockers: [],
    bookingId,
    bookingStatus: 'COMPLETED',
    canRepair: true,
    completedAt: '2026-07-01T00:00:00.000Z',
    currency: 'VND',
    customer: { id: 'customer-1', user: { fullName: 'Settlement Customer' } },
    earning: {
      currency: 'VND',
      grossAmount: 500000,
      id: `${bookingId}-earning`,
      netAmount: 365000,
      payoutBatchId: null,
      paidAt: null,
      platformFee: 100000,
      status: 'AVAILABLE',
      withholdingAmount: 35000,
    },
    monthlyClosingStatus: 'REVIEWED',
    monthlyPeriod: '2026-07',
    partner: { id: 'partner-1', displayName: 'Settlement Partner' },
    payment: {
      amount: 500000,
      currency: 'VND',
      id: `${bookingId}-payment`,
      method: 'CARD',
      status: 'CAPTURED',
    },
    preservesExistingEarningLifecycle: true,
    repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
    serviceCount: 1,
    settlementSnapshotId: null,
  };
}
