import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

import type {
  AdminEarning,
  AdminOperationalPolicySetting,
  AdminPayoutBatch,
  AdminPayoutBatchSummary,
  AdminProviderWalletWithdrawalRequest,
} from '../../lib/admin-api';
import { adminGet, adminGetResult } from '../../lib/admin-api';
import PayoutsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const payoutPolicyHref =
  '/admin/operational-policy?keys=payout.batch_cycle_policy%2Ccash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters';

describe('PayoutsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
  });

  it('renders bounded server payout rows without applying a second local date filter', async () => {
    const batch = {
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'server-payout-row',
      providerProfile: {
        displayName: 'Server Trusted Payout',
        user: {
          fullName: 'Server Trusted Partner',
          phone: '+84900006666',
        },
      },
      providerProfileId: 'server-provider-row',
      status: 'DRAFT',
      totalNetAmount: 120000,
      transferRef: null,
      withholdingLogs: [],
    } as AdminPayoutBatch;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches?range=today&take=20&view=summary&queue=open') {
        return [batch];
      }
      if (href === '/admin/payout-batches/summary?range=today') {
        return null;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [] as AdminEarning[];
      }
      if (href === payoutPolicyHref) {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Payout');
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-date-range-card',
    );
    expect(markup).toContain('Payout batch list');
    expect(markup).not.toContain('Payout batch release policy desk');
  });

  it('keeps the default payout workspace focused and defers full evidence reads', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);
    const requestedHrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(requestedHrefs).not.toContain('/admin/earnings?range=today&take=10');
    expect(requestedHrefs).not.toContain(payoutPolicyHref);
    expect(markup).toContain('Payout views');
    expect(markup).toContain('Payout batches');
    expect(markup).toContain('Withdrawals');
    expect(markup).toContain('Reconciliation');
    expect(markup).not.toContain('Payout batch release policy desk');
    expect(markup).not.toContain('Payout inclusion audit');
    expect(markup).toContain('Created date range');
    expect(markup).toContain('aria-label="Payout created date range"');
  });

  it('keeps batch, withdrawal, and reconciliation row reads in separate views', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const auditPage = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today', view: 'reconciliation' }),
    });
    const auditMarkup = renderToStaticMarkup(auditPage);
    const auditHrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(auditMarkup).toContain('Payout money flow');
    expect(auditMarkup).toContain('Reconciliation queues');
    expect(auditMarkup).not.toContain('Partner wallet withdrawal requests');
    expect(auditMarkup).not.toContain('Payout batch list');
    expect(auditHrefs.some((href) => href.includes('/admin/payout-batches?'))).toBe(false);
    expect(auditHrefs.some((href) => href.includes('/admin/provider-wallet/withdrawal-requests?'))).toBe(false);

    mockedAdminGetResult.mockClear();
    await PayoutsPage({
      searchParams: Promise.resolve({
        range: 'today',
        recon: 'payout-closeout-repair',
        view: 'reconciliation',
      }),
    });
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/payout-batches?range=today&take=20&view=summary&queue=repair',
    );

    mockedAdminGetResult.mockClear();
    const recordsPage = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today', view: 'withdrawals' }),
    });
    const recordsMarkup = renderToStaticMarkup(recordsPage);
    const recordHrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(recordsMarkup).toContain('Partner wallet withdrawal requests');
    expect(recordsMarkup).not.toContain('Payout batch list');
    expect(recordsMarkup).not.toContain('Payout money flow');
    expect(recordHrefs.some((href) => href.includes('/admin/payout-batches?'))).toBe(false);
  });

  it('loads an off-page payout batch exactly when a confirmation URL is opened directly', async () => {
    const offPageBatch = {
      createdAt: '2026-08-10T01:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'off-page-payout-batch',
      providerProfile: {
        displayName: 'Off Page Partner',
        user: {
          fullName: 'Off Page Partner',
          phone: '+84900009999',
        },
      },
      providerProfileId: 'off-page-partner',
      status: 'DRAFT',
      totalNetAmount: 420000,
      transferRef: null,
      withholdingLogs: [],
    } as AdminPayoutBatch;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches/off-page-payout-batch') {
        return offPageBatch;
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({
        confirm: 'processing',
        payoutBatchId: offPageBatch.id,
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/payout-batches/off-page-payout-batch',
    );
    expect(markup).toContain('Start payout off-page processing?');
    expect(markup).toContain('Off Page Partner');
  });

  it('renders an off-page payout batch as the exact hash target without opening a confirmation', async () => {
    const offPageBatch = {
      createdAt: '2026-08-10T01:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'off-page-payout-evidence',
      providerProfile: {
        displayName: 'Exact Payout Partner',
        user: { fullName: 'Exact Payout Partner', phone: '+84900009999' },
      },
      providerProfileId: 'exact-payout-partner',
      status: 'PROCESSING',
      totalNetAmount: 420000,
      transferRef: 'VCB-EXACT-PAYOUT',
      withholdingLogs: [],
    } as AdminPayoutBatch;
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href === '/admin/payout-batches/off-page-payout-evidence' ? offPageBatch : fallback,
    );

    const markup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({ payoutBatchId: offPageBatch.id }),
    }));

    expect(markup).toContain('id="payout-batch-off-page-payout-evidence"');
    expect(markup).toContain('Exact Payout Partner');
    expect(markup).toContain('420.000 VND');
    expect(markup).not.toContain('No other batch was selected');
  });

  it('renders an off-page withdrawal as the exact hash target', async () => {
    const withdrawal = {
      amount: 310000,
      bankAccount: {
        accountHolderName: 'Exact Withdrawal Partner',
        accountNumberMasked: '****7788',
        bankName: 'VCB',
        id: 'bank-exact',
        isPrimary: true,
        status: 'APPROVED',
      },
      bankAccountId: 'bank-exact',
      createdAt: '2026-08-10T01:00:00.000Z',
      currency: 'VND',
      id: 'off-page-withdrawal-evidence',
      providerProfile: {
        displayName: 'Exact Withdrawal Partner',
        user: { phone: '+84900007788' },
      },
      providerProfileId: 'exact-withdrawal-partner',
      status: 'BANK_TRANSFER_PENDING',
    } as AdminProviderWalletWithdrawalRequest;
    const exactHref =
      '/admin/provider-wallet/withdrawal-requests?range=all&take=1&id=off-page-withdrawal-evidence';
    mockedAdminGet.mockImplementation(async (href, fallback) => href === exactHref ? [withdrawal] : fallback);

    const markup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({
        view: 'withdrawals',
        withdrawalId: withdrawal.id,
        withdrawalStatus: withdrawal.status,
      }),
    }));

    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(exactHref);
    expect(markup).toContain('id="withdrawal-off-page-withdrawal-evidence"');
    expect(markup).toContain('Exact Withdrawal Partner');
    expect(markup).toContain('310.000 VND');
    expect(markup).not.toContain('No other withdrawal was selected');
  });

  it('fails closed when an exact payout or withdrawal id is invalid or unavailable', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const invalidPayoutMarkup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({ payoutBatchId: '../bad' }),
    }));
    const missingWithdrawalMarkup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({ view: 'withdrawals', withdrawalId: 'missing-withdrawal' }),
    }));

    expect(invalidPayoutMarkup).toContain('No other batch was selected');
    expect(missingWithdrawalMarkup).toContain('No other withdrawal was selected');
  });

  it('uses the exact post-payment repair count for reconciliation pagination', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('const payoutBatchTotal = payoutSummary?.total ?? payoutBatchRows.length');
    expect(source).toContain(
      'buildPayoutServerPagination(payoutBatchRows, filters, payoutBatchTotal)',
    );
  });

  it('uses the payout summary endpoint for top-level payout metrics', async () => {
    const batch = {
      createdAt: '2026-06-27T00:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'sample-payout-row',
      providerProfile: {
        displayName: 'Visible Payout Row',
        user: {
          fullName: 'Visible Partner',
          phone: '+84900007777',
        },
      },
      providerProfileId: 'visible-provider-row',
      status: 'DRAFT',
      totalNetAmount: 120000,
      transferRef: null,
      withholdingLogs: [],
    } as AdminPayoutBatch;
    const summary = {
      currency: 'VND',
      generatedAt: '2026-06-27T00:00:00.000Z',
      inProgress: 7,
      missingTransferRefs: 8,
      needsReview: 6,
      open: 10,
      payoutHolds: 5,
      settled: 4,
      total: 99,
      totalNetAmount: 987654,
      withholdingAmount: 45678,
    } satisfies AdminPayoutBatchSummary;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches?range=today&take=20&view=summary&queue=open') {
        return [batch];
      }
      if (href === '/admin/payout-batches/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [] as AdminEarning[];
      }
      if (href === payoutPolicyHref) {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Needs review');
    expect(markup).toContain('6');
    expect(markup).toContain('Transfers in progress');
    expect(markup).toContain('7');
  });

  it('uses server payout preflight to block paid closeout while keeping warnings non-blocking', async () => {
    const sharedBatch = {
      currency: 'VND',
      earnings: [],
      providerProfile: {
        displayName: 'Preflight Partner',
        user: {
          fullName: 'Preflight Partner',
          phone: '+84900008888',
        },
      },
      providerProfileId: 'provider-preflight',
      status: 'PROCESSING',
      totalNetAmount: 380000,
      transferRef: 'BANK-PREFLIGHT',
      withholdingLogs: [],
    };
    const blockedBatch = {
      ...sharedBatch,
      createdAt: '2026-07-26T09:00:00.000Z',
      id: 'payout-preflight-blocked',
      preflight: {
        approvedBankAccountId: 'bank-preflight',
        blockers: [
          {
            code: 'INSUFFICIENT_WALLET_BALANCE',
            message: 'Partner wallet ledger balance cannot cover payout batch.',
          },
        ],
        canMarkFailed: true,
        canMarkPaid: false,
        canStartProcessing: false,
        independentApproverAvailable: true,
        paidLedgerAmount: 0,
        paidLedgerEntryCount: 0,
        payableAmount: 380000,
        payoutJournalPosted: false,
        ready: false,
        requiredAmount: 380000,
        walletBalance: 300000,
        warnings: [],
      },
    } as AdminPayoutBatch;
    const warningBatch = {
      ...sharedBatch,
      createdAt: '2026-07-26T08:00:00.000Z',
      id: 'payout-preflight-warning',
      preflight: {
        approvedBankAccountId: 'bank-preflight',
        blockers: [],
        canMarkFailed: true,
        canMarkPaid: true,
        canStartProcessing: false,
        independentApproverAvailable: true,
        paidLedgerAmount: 0,
        paidLedgerEntryCount: 0,
        payableAmount: 380000,
        payoutJournalPosted: false,
        ready: true,
        requiredAmount: 380000,
        walletBalance: 500000,
        warnings: [
          {
            code: 'PAYOUT_PAID_EVIDENCE_INCOMPLETE',
            message: 'Historical payout evidence needs reconciliation.',
          },
        ],
      },
    } as AdminPayoutBatch;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches?range=today&take=20&view=summary&queue=open') {
        return [blockedBatch, warningBatch];
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner wallet ledger balance cannot cover payout batch.');
    expect(markup).toContain('Historical payout evidence needs reconciliation.');
    expect(markup.match(/Resolve blockers before paid/g)).toHaveLength(1);
    expect(markup).toContain('aria-disabled="true"');
  });

  it('uses shared badge atoms for payout policy desk status labels', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('StatusBadgeLink');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="participant-list admin-mb-12">');
    expect(source).not.toContain(
      'className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-date-range-card"',
    );
    expect(source).not.toContain(
      'className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-release-policy-card"',
    );
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-14">');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-16">');
    expect(source).not.toContain('<span className="pill pill-info">Live policy default</span>');
    expect(source).not.toContain('<span className={`pill ${signal.pillClass}`}>{signal.status}</span>');
    expect(source).not.toContain('<span className={`pill ${item.pillClass}`}>{item.status}</span>');
  });

  it('uses the authenticated operator and server-side closeout evidence for paid reversal approval', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('The signed-in verified Finance operator is recorded as the reversal approver.');
    expect(source).toContain('The API blocks the');
    expect(source).toContain('operator who posted the paid closeout from reversing the same payout.');
    expect(source).not.toContain('finance-approver-directory');
    expect(source).not.toContain('buildFinanceApproverOptions');
    expect(source).not.toContain('approvalAdminId');
  });

  it('uses the shared Vuexy trace summary atom for applied payout policy cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('defaultKind="live"');
    expect(source).toContain('defaultScope="Live policy"');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the full selected-range evidence contract instead of sampled service copy', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('Full selected-range evidence was evaluated.');
    expect(source).not.toContain('Service option links are ready for finance review.');
    expect(source).not.toContain('Service trace is ready for finance review.');
    expect(source).not.toContain('Payout batches are traceable to service duration options');
  });

  it('uses shared money atoms for payout summary KPI amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('value: formatMoney(summary.totalNetAmount, summary.currency)');
    expect(source).not.toContain('value: formatMoney(summary.withholdingAmount, summary.currency)');
  });

  it('uses shared money atoms for payout inclusion audit amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('helper: `${formatMoney(sumEarnings');
    expect(source).not.toContain('title: `${providerLabel} / ${formatMoney');
  });

  it('uses shared money atoms for payout command signal amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('detail: formatMoney(');
  });

  it('uses shared money atoms for payout money flow check amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('Batch net versus service evidence gap: ${formatMoney');
    expect(source).not.toContain('${formatMoney(cashDebtEvidence, currency)} negative wallet amount');
  });

  it('uses shared money atoms for payout release and marketplace cash debt amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('${formatMoney(cashDebtAmount, currency)} partner cash-fee debt');
    expect(source).not.toContain('${formatMoney(cashDebtAmount, cashDebtCurrency)} unpaid HANDS fee');
  });

  it('uses shared money atoms for payout action execution withholding amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('function payoutActionExecutionMap');
    expect(source).toContain(
      '<MoneyText amount={withholdingAmount} currency={batch.currency} /> withholding exists without a',
    );
    expect(source).not.toContain('${formatMoney(withholdingAmount, batch.currency)} withholding exists');
    expect(source).not.toContain(
      'detail: `Withholding exists (${formatMoney(withholdingAmount, batch.currency)}) but no tax log is linked.`',
    );
  });

  it('scopes top-level payout KPI cards by selected range and release action state', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('const payoutRangeScope = dateRangeLabel(filters.range);');
    expect(source).toContain('scope: payoutRangeScope');
    expect(source).toContain("scope: 'Needs action'");
    expect(source).toContain("scope: 'Current queue'");
    expect(source).toContain("scope: 'All open evidence'");
    expect(source).toContain("kind: 'risk'");
    expect(source).toContain("label: 'Wallet / GL closeout repair'");
  });

  it('keeps reconciliation evidence rows out of the aggregate overview', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain("filters.recon === 'overview'");
    expect(source).toContain("filters.recon === 'bank-unmatched'");
    expect(source).toContain("filters.recon === 'payout-closeout-repair'");
  });

  it('offers only authoritative repair evidence filters with existing date and amount sorts', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const markup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({
        recon: 'payout-closeout-repair',
        view: 'reconciliation',
      }),
    }));

    expect(markup).toContain('name="evidence"');
    expect(markup).toContain('Missing transfer reference');
    expect(markup).toContain('Withholding incomplete');
    expect(markup).toContain('Wallet ledger mismatch');
    expect(markup).toContain('Posted GL journal missing');
    expect(markup).toContain('Oldest first');
    expect(markup).toContain('Highest amount');
  });

  it('does not mix a withdrawal saved view with payout batch rows', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'all', withdrawalStatus: 'REVIEW_REQUIRED' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No rows in selected filter');
    expect(markup).not.toContain('Payout batch list');
  });

  it('keeps a bank-transfer-pending saved view in the native Apply filters form', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const markup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({
        pageSize: '25',
        q: 'VCB pending',
        range: '7d',
        sort: 'amount-desc',
        view: 'withdrawals',
        withdrawalStatus: 'BANK_TRANSFER_PENDING',
      }),
    }));

    expect(markup).toContain('type="hidden" name="withdrawalStatus" value="BANK_TRANSFER_PENDING"');
    expect(markup).toContain('type="hidden" name="pageSize" value="25"');
    expect(markup).toContain('placeholder="Search records" type="search" name="q" value="VCB pending"');
    expect(markup).toContain('value="amount-desc" selected=""');
  });

  it('preserves withdrawal search, sort, saved scope, and page size across range and pagination links', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/provider-wallet/withdrawal-requests/summary?range=30d&q=VCB+123&providerProfileId=partner-1&reconciliation=unmatched&status=PAID') {
        return { filteredTotal: 51 } as never;
      }
      return fallback;
    });

    const markup = renderToStaticMarkup(await PayoutsPage({
      searchParams: Promise.resolve({
        pageSize: '25',
        q: 'VCB 123',
        range: '30d',
        sort: 'amount-desc',
        view: 'withdrawals',
        withdrawalPage: '2',
        withdrawalPartnerId: 'partner-1',
        withdrawalReconciliation: 'unmatched',
        withdrawalStatus: 'PAID',
      }),
    }));

    expect(markup).toContain(
      'href="/payouts?view=withdrawals&amp;q=VCB+123&amp;sort=amount-desc&amp;withdrawalStatus=PAID&amp;withdrawalPartnerId=partner-1&amp;withdrawalReconciliation=unmatched&amp;pageSize=25"',
    );
    expect(markup).toContain(
      'href="/payouts?view=withdrawals&amp;range=30d&amp;q=VCB+123&amp;sort=amount-desc&amp;withdrawalStatus=PAID&amp;withdrawalPartnerId=partner-1&amp;withdrawalReconciliation=unmatched&amp;withdrawalPage=3&amp;pageSize=25#partner-wallet-withdrawal-requests"',
    );
  });
});
