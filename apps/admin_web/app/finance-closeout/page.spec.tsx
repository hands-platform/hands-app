import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type {
  AdminBookingSettlementGapDryRun,
  AdminBookingSettlementGapList,
  AdminBookingSettlementGapRepairPreview,
  AdminBookingSettlementRepairCheckpoint,
  AdminBookingSettlementGapSummary,
  AdminUser,
} from '../../lib/admin-api';
import { adminGet, adminGetResult } from '../../lib/admin-api';
import { financeCloseoutComparisonSelectionLabel } from './finance-closeout-settlement-selection-controls';
import FinanceCloseoutPage, { metadata } from './page';

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
    useRouter: () => ({ replace: vi.fn() }),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const repairDrawerSource = readFileSync(
  new URL('./finance-closeout-settlement-repair-drawer.tsx', import.meta.url),
  'utf8',
);
const financeOverviewPageSource = readFileSync(new URL('../finance-overview/page.tsx', import.meta.url), 'utf8');
const availableSettlementSummary: AdminBookingSettlementGapSummary = {
  age24To72Hours: 0,
  age3To7Days: 0,
  age7DaysPlus: 0,
  backlog: 0,
  canonical: 0,
  evidenceBlocked: 0,
  generatedAt: '2026-08-09T01:00:00.000Z',
  historicalReady: 0,
  manualReview: 0,
  oldestGapAt: null,
  recent: 0,
  total: 0,
};

describe('FinanceCloseoutPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      const data = await mockedAdminGet(href, fallback);
      return {
        data:
          href.startsWith('/admin/booking-settlement-gaps/summary') && data == null
            ? availableSettlementSummary
            : data,
        ok: true,
        status: 200,
      };
    });
  });

  it('loads only settlement repair APIs in the default closeout workspace', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({});
    const markup = renderToStaticMarkup(page);
    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('Repair queue filters');
    expect(markup).toContain('Batch evidence');
    expect(markup).not.toContain('Settlement review mode');
    expect(markup).toContain('Settlement backlog');
    expect(markup).toContain('Settlement comparison action at table end');
    expect(markup.match(/id="settlement-comparison-selection-status"/gu) ?? []).toHaveLength(1);
    expect(markup.match(/id="settlement-comparison-selection-status-footer"/gu) ?? []).toHaveLength(1);
    expect(hrefs).toContain('/admin/booking-settlement-gaps/summary?age=backlog&track=canonical');
    expect(hrefs).toContain('/admin/booking-settlement-gaps?age=backlog&skip=0&take=10&track=canonical');
    expect(hrefs.some((href) => href.startsWith('/admin/payments?'))).toBe(false);
  });

  it('scopes the shared drawer grid to explicit wrappers across all four callers', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');
    const cashDrawerSource = readFileSync(
      new URL('../cash-settlements/cash-settlement-review-drawer.tsx', import.meta.url),
      'utf8',
    );
    const payoutDrawerSource = readFileSync(
      new URL('../payouts/payout-transfer-evidence-drawer.tsx', import.meta.url),
      'utf8',
    );
    const serviceDrawerSource = readFileSync(
      new URL('../services/service-catalog-drawer-shell.tsx', import.meta.url),
      'utf8',
    );

    expect(css).toMatch(
      /\.service-menu-dialog > \.service-menu-dialog-shell \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/s,
    );
    expect(css).not.toContain('.service-menu-dialog > div {');
    expect(repairDrawerSource).toContain(
      'finance-closeout-settlement-repair-drawer-shell service-menu-dialog-shell',
    );
    expect(cashDrawerSource).toContain('cash-settlement-review-drawer-shell service-menu-dialog-shell');
    expect(payoutDrawerSource).toContain('className="service-menu-dialog-shell"');
    expect(serviceDrawerSource).toContain('className="service-menu-dialog-shell"');
  });

  it('reserves readable desktop widths for selection and repair actions inside table scroll regions', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');
    const backlogSource = readFileSync(
      new URL('./finance-closeout-settlement-backlog-section.tsx', import.meta.url),
      'utf8',
    );

    expect(css).toMatch(/\.finance-closeout-settlement-table \{[^}]*min-width: 960px;/s);
    expect(css).toMatch(
      /\.finance-closeout-settlement-table :is\(th, td\):nth-child\(1\) \{[^}]*width: 9%;/s,
    );
    expect(css).toMatch(
      /\.finance-closeout-settlement-table :is\(th, td\):nth-child\(6\) \{[^}]*width: 15%;/s,
    );
    expect(css).toMatch(/\.finance-closeout-comparison-table \{[^}]*min-width: 1080px;/s);
    expect(css).toMatch(
      /\.finance-closeout-comparison-table :is\(th, td\):nth-child\(5\) \{[^}]*width: 15%;/s,
    );
    expect(backlogSource).toContain('className="finance-closeout-settlement-action"');
  });

  it.each([401, 403, 429, 500, null])(
    'fails closed when a required settlement source returns %s',
    async (status) => {
      mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
        data: fallback,
        ok: false,
        status,
      }));

      const page = await FinanceCloseoutPage({});
      const markup = renderToStaticMarkup(page);

      expect(markup).toContain('Data unavailable — do not close or repair');
      expect(markup).toContain('A failed source is not an empty queue.');
      expect(markup).not.toContain('No settlement gaps match this queue.');
      expect(markup).not.toContain('0 booking(s)');
    },
  );

  it('fails closed when a required source returns a successful null payload', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: href.startsWith('/admin/booking-settlement-gaps/summary') ? null : fallback,
      ok: true,
      status: 200,
    }));

    const page = await FinanceCloseoutPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Data unavailable — do not close or repair');
    expect(markup).toContain('Settlement summary: Invalid response');
    expect(markup).not.toContain('No settlement gaps match this queue.');
  });

  it('keeps a successful empty queue distinct from a source failure', async () => {
    const emptySummary: AdminBookingSettlementGapSummary = {
      age24To72Hours: 0,
      age3To7Days: 0,
      age7DaysPlus: 0,
      backlog: 0,
      canonical: 0,
      evidenceBlocked: 0,
      generatedAt: '2026-08-09T01:00:00.000Z',
      historicalReady: 0,
      manualReview: 0,
      oldestGapAt: null,
      recent: 0,
      total: 0,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href === '/admin/booking-settlement-gaps/summary?age=backlog&track=canonical'
        ? emptySummary
        : fallback,
    );

    const page = await FinanceCloseoutPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Required finance sources loaded');
    expect(markup).toContain('0 booking(s)');
    expect(markup).toContain('No settlement gaps match this queue.');
    expect(markup).not.toContain('Data unavailable — do not close or repair');
  });

  it('redirects the former operations view to the authoritative Finance Overview', async () => {
    await expect(
      FinanceCloseoutPage({ searchParams: Promise.resolve({ range: '7d', view: 'operations' }) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining('/finance-overview?range=7d'),
    });
    expect(financeOverviewPageSource).toContain('title="Finance Overview"');
  });

  it('loads the historical batch workspace without fetching the settlement backlog', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ settlementMode: 'batch', view: 'settlement' }),
    });
    const markup = renderToStaticMarkup(page);
    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(markup).toContain('Historical batch filters');
    expect(markup).toContain('Batch safety check (read-only)');
    expect(markup).not.toContain('Repair queue filters');
    expect(markup).not.toContain('Settlement backlog');
    expect(hrefs).toContain('/admin/booking-settlement-gaps/summary');
    expect(hrefs.some((href) => href.startsWith('/admin/booking-settlement-gaps?'))).toBe(false);
    expect(hrefs.some((href) => href.includes('/dry-run?'))).toBe(false);
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
      href === '/admin/booking-settlement-gaps/booking-checkpoint-1/checkpoint' ? checkpoint : fallback,
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

  it('links the completed repair to its booking, settlement, earning, and audit evidence', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({
        checkpointBookingId: 'booking-repaired-1',
        repairActorId: 'admin-actor-1',
        repairApprovalAdminId: 'admin-approver-2',
        repairAuditLogId: 'audit-repair-1',
        repairCompletedAt: '2026-07-13T12:00:00.000Z',
        repairEarningId: 'earning-repair-1',
        repairNotice: 'repaired',
        repairSnapshotId: 'snapshot-repair-1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('/bookings/booking-repaired-1');
    expect(markup).toContain('/finance-tax/booking-settlement-audit?q=snapshot-repair-1');
    expect(markup).toContain('/earnings?q=earning-repair-1');
    expect(markup).toContain('/audit-log?q=audit-repair-1');
    expect(markup).toContain('Actor admin-actor-1');
    expect(markup).toContain('Approver admin-approver-2');
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

  it('uses the shared Vuexy text link atom for closeout audit links', () => {
    expect(pageSource).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(pageSource).toContain('<AdminTextLink');
    expect(pageSource).not.toContain('className="text-link"');
  });

  it('does not retain the moved operations-closeout fetch and KPI implementation', () => {
    expect(pageSource).not.toContain('AdminEarningSummary');
    expect(pageSource).not.toContain('buildReconciliation(');
    expect(pageSource).not.toContain('MoneyText');
    expect(pageSource).not.toContain('/admin/payments?');
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
      age24To72Hours: 0,
      age3To7Days: 0,
      age7DaysPlus: 21,
      backlog: 21,
      canonical: 0,
      evidenceBlocked: 0,
      generatedAt: '2026-07-13T00:00:00.000Z',
      historicalReady: 21,
      manualReview: 0,
      oldestGapAt: '2026-06-01T00:00:00.000Z',
      recent: 0,
      total: 21,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href ===
        '/admin/booking-settlement-gaps?age=7d-plus&skip=10&take=10&track=historical-ready&q=Settlement&period=2026-07&paymentMethod=CARD'
      ) {
        return gapList;
      }
      if (
      href ===
        '/admin/booking-settlement-gaps/summary?age=7d-plus&track=historical-ready&q=Settlement&period=2026-07&paymentMethod=CARD'
      ) {
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
    expect(markup).toContain('Gap age: 7+ days');
    expect(markup).toContain('Repair track: Historical policy review');
    expect(markup).toContain('<p>Evidence blocked</p>');
    expect(markup).toContain('<span class="sr-only">Evidence blocked: </span>0');
    expect(markup).toContain('Month: 2026-07');
    expect(markup).toContain('Payment: Card');
    expect(markup).toContain('Matching bookings: 21');
    expect(markup).toMatch(/Oldest: \d+d ago/);
    expect(markup).toContain('Compare selected (0)');
    expect(markup).toContain('Select up to 10 records. 0 selected.');
    expect(markup).toContain('Select booking-settlement-gap-11');
  });

  it('loads at most ten selected gaps into a read-only comparison queue', async () => {
    const selectedIds = Array.from({ length: 12 }, (_, index) => `selected-gap-${index + 1}`);

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/booking-settlement-gaps/preview-batch?bookingIds=')) {
        return {
          generatedAt: '2026-07-13T00:00:00.000Z',
          items: selectedIds.slice(0, 10).map(settlementPreviewFixture),
          requested: 10,
        };
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ reviewBookingId: selectedIds }),
    });
    const markup = renderToStaticMarkup(page);
    const selectedPreviewCalls = mockedAdminGet.mock.calls.filter(([href]) =>
      href.startsWith('/admin/booking-settlement-gaps/preview-batch?bookingIds='),
    );

    expect(selectedPreviewCalls).toHaveLength(1);
    expect(markup).toContain('Selected settlement review (10)');
    expect(markup).toContain('Read-only comparison using the same technical and policy gate');
    expect(markup).toContain('Review &amp; repair');
    expect(markup).toContain('Technical and policy preview passed.');
    expect(markup).not.toContain('<strong>selected-gap-11</strong>');
    expect(markup).not.toContain('<strong>selected-gap-12</strong>');
  });

  it('loads the bounded historical dry-run only when explicitly requested', async () => {
    const dryRun: AdminBookingSettlementGapDryRun = {
      blockerCodes: {},
      counts: {
        blocked: 0,
        companyOutputVatPositive: 0,
        companyOutputVatZero: 66,
        eligible: 0,
        expectedAvailable: 66,
        expectedUnavailable: 0,
        journalBalanced: 66,
        paymentFeeDefaulted: 66,
        paymentFeePolicyMatched: 0,
        platformVatEvidenceReady: 66,
        platformVatExplicitZeroServiceRule: 66,
        platformVatUnexplainedZero: 0,
        platformVatZeroFromPolicy: 0,
        reconciliationReview: 0,
        reviewRequired: 66,
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
            eligible: 0,
            expectedAvailable: 2,
            expectedUnavailable: 0,
            journalBalanced: 2,
            paymentFeeDefaulted: 2,
            paymentFeePolicyMatched: 0,
            platformVatEvidenceReady: 2,
            platformVatExplicitZeroServiceRule: 2,
            platformVatUnexplainedZero: 0,
            platformVatZeroFromPolicy: 0,
            reconciliationReview: 0,
            reviewRequired: 2,
          },
          executionStatus: 'REVIEW_REQUIRED',
          paymentMethod: 'MOMO',
          recordCount: 2,
          totals: {
            availability: 'ALL_AVAILABLE',
            companyOutputVat: 0,
            computedCount: 2,
            customerPaymentAmount: 800_000,
            journalReconciliationDelta: 0,
            journalTotalCredit: 800_000,
            journalTotalDebit: 800_000,
            partnerPayoutAmount: 600_000,
            partnerWithholdingTotal: 40_000,
            paymentProcessingFee: 0,
            platformFeeGross: 160_000,
            platformFeeNetRevenue: 160_000,
            totalCount: 2,
          },
        },
      ],
      totalMatched: 66,
      totals: {
        availability: 'ALL_AVAILABLE',
        companyOutputVat: 0,
        computedCount: 66,
        customerPaymentAmount: 26_400_000,
        journalReconciliationDelta: 0,
        journalTotalCredit: 26_400_000,
        journalTotalDebit: 26_400_000,
        partnerPayoutAmount: 19_800_000,
        partnerWithholdingTotal: 1_320_000,
        paymentProcessingFee: 0,
        platformFeeGross: 5_280_000,
        platformFeeNetRevenue: 5_280_000,
        totalCount: 66,
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

    expect(markup).toContain('Batch safety check (read-only) · 66 evaluated');
    expect(markup).toContain('66 of 66');
    expect(markup).toContain('0 approved · 66 review · 0 blocked');
    expect(markup).toContain('66 balanced · 0 delta review');
    expect(markup).toContain('0 policy · 66 defaulted');
    expect(markup).toContain('Retained service VAT rule 66 · Policy zero 0 · Unexplained zero 0');
    expect(markup).toContain('2 fee default · 0 unexplained VAT · 0 delta');
    expect(markup).toContain('CASH: 34 · MOMO: 32');
    expect(markup).toContain('Monthly close: Open or not linked: 66');
    expect(markup).not.toContain('OPEN_OR_UNLINKED');
    expect(markup).toContain('Finance policy gate');
    expect(markup).toContain('Payment-fee policy evidence needs review: 66');
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
      generatedAt: '2026-07-13T00:00:00.000Z',
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
      evidenceVersion: 'preview-version-1',
      monthlyClosingStatus: 'REVIEWED',
      monthlyPeriod: '2026-07',
      partner: { id: 'partner-1', displayName: 'Settlement Partner' },
      payment: { amount: 500000, currency: 'VND', id: 'payment-1', method: 'CARD', status: 'CAPTURED' },
      policyDecision: 'APPROVED',
      policyExceptionCodes: [],
      policyReasons: [],
      policyVersion: 'CANONICAL_COMPLETION_SETTLEMENT_V1',
      preservesExistingEarningLifecycle: true,
      repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
      serviceCount: 1,
      settlementSnapshotId: null,
      sourceVersion: 'preview-version-1',
      technicalEligibility: true,
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
    expect(markup).toContain('Approved for controlled repair');
    expect(markup).toContain('Dual approval required');
    expect(markup).toContain('Two verified Finance operators are required');
    expect(markup).not.toContain('name="approvalAdminId"');
    expect(markup).toContain('Confirm booking ID');
    expect(markup).toContain('Request / approve settlement repair');
    expect(markup).toContain('Existing status preserved');
  });

  it('locks repair when technical evidence passes but finance policy requires review', async () => {
    const preview = {
      ...settlementPreviewFixture('booking-policy-review'),
      canRepair: false,
      policyDecision: 'REVIEW_REQUIRED' as const,
      policyExceptionCodes: ['PAYMENT_FEE_POLICY_DEFAULTED'],
      policyReasons: ['Historical payment fee evidence defaulted without a matched policy rule.'],
      policyVersion: 'HISTORICAL_SETTLEMENT_POLICY_V1',
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION' as const,
      technicalEligibility: true,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-settlement-gaps/booking-policy-review/preview') return preview;
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') return [];
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ repairBookingId: 'booking-policy-review' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Policy review required — repair locked');
    expect(markup).toContain('Historical payment fee evidence defaulted without a matched policy rule.');
    expect(markup).toContain('Review payment fee policy evidence');
    expect(markup).not.toContain('name="approvalAdminId"');
    expect(markup).not.toContain('Reconstruct historical settlement');
  });

  it('turns technical blockers into assigned remediation without repeating policy text', async () => {
    const repeatedMessage = 'Captured payment evidence is missing.';
    const preview = {
      ...settlementPreviewFixture('booking-payment-blocked'),
      blockers: [{ code: 'PAYMENT_MISSING', message: repeatedMessage }],
      canRepair: false,
      payment: null,
      policyDecision: 'BLOCKED' as const,
      policyExceptionCodes: ['TECHNICAL_EVIDENCE_BLOCKED'],
      policyReasons: [repeatedMessage],
      technicalEligibility: false,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-settlement-gaps/booking-payment-blocked/preview') return preview;
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') return [];
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ repairBookingId: 'booking-payment-blocked' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Blocker remediation');
    expect(markup).toContain('Responsible team');
    expect(markup).toContain('Payments Operations');
    expect(markup).toContain('Missing evidence');
    expect(markup).toContain('Next action');
    expect(markup).toContain('Open booking payment evidence');
    expect(markup).toContain('Recheck evidence');
    expect(markup).toContain('PAYMENT_MISSING');
    expect(markup.match(new RegExp(repeatedMessage, 'g'))).toHaveLength(1);
    expect(markup).not.toContain('name="approvalAdminId"');
  });

  it('labels paid evidence reconstruction separately from canonical settlement repair', async () => {
    const preview: AdminBookingSettlementGapRepairPreview = {
      blockers: [],
      bookingId: 'booking-settlement-paid-gap',
      bookingStatus: 'COMPLETED',
      canRepair: true,
      completedAt: '2026-06-10T00:00:00.000Z',
      currency: 'VND',
      generatedAt: '2026-07-13T00:00:00.000Z',
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
      policyDecision: 'APPROVED',
      policyExceptionCodes: [],
      policyReasons: [],
      policyVersion: 'historical-policy-1',
      preservesExistingEarningLifecycle: true,
      repairMode: 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION',
      serviceCount: 1,
      settlementSnapshotId: null,
      sourceVersion: 'preview-version-2',
      evidenceVersion: 'preview-version-2',
      technicalEligibility: true,
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
    expect(markup).toContain('Request / approve reconstruction');
    expect(markup).toContain('preserves the paid earning and wallet lifecycle');
  });

  it.each([
    [0, 'Compare selected (0)'],
    [1, 'Compare selected (1)'],
    [10, 'Compare selected (10)'],
    [11, 'Compare selected (10)'],
  ])('bounds the comparison selection label at ten records', (count, label) => {
    expect(financeCloseoutComparisonSelectionLabel(count)).toBe(label);
  });

  it('lets the root metadata template append the Admin title exactly once', () => {
    expect(metadata).toEqual({ title: 'Settlement Repair' });
  });

  it('closes the repair drawer without a document navigation so focus can return to its trigger', () => {
    expect(repairDrawerSource).toContain("router.replace(closeHref, { scroll: false })");
    expect(repairDrawerSource).not.toContain('window.location.assign(closeHref)');
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
    generatedAt: '2026-07-13T00:00:00.000Z',
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
    evidenceVersion: `${bookingId}-version`,
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
    policyDecision: 'APPROVED',
    policyExceptionCodes: [],
    policyReasons: [],
    policyVersion: 'CANONICAL_COMPLETION_SETTLEMENT_V1',
    preservesExistingEarningLifecycle: true,
    repairMode: 'CANONICAL_COMPLETION_SETTLEMENT',
    serviceCount: 1,
    settlementSnapshotId: null,
    sourceVersion: `${bookingId}-version`,
    technicalEligibility: true,
  };
}
