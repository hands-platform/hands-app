import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type { AdminEarning, AdminEarningSummary, AdminPayoutBatch } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import EarningsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('EarningsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server earning rows without applying a second local date filter', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 120000,
      count: 1,
      currency: 'VND',
      grossAmount: 300000,
      netAmount: 120000,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 150000,
      withholdingAmount: 30000,
    };
    const earning = {
      booking: {
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CARD',
          status: 'CAPTURED',
        },
        services: [],
        status: 'COMPLETED',
      },
      bookingId: 'server-earning-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 300000,
      id: 'server-earning-row',
      netAmount: 120000,
      platformFee: 150000,
      providerProfile: {
        displayName: 'Server Trusted Earning',
        user: {
          fullName: 'Server Trusted Partner',
          phone: '+84900005555',
        },
      },
      providerProfileId: 'server-provider-row',
      status: 'AVAILABLE',
      withholdingAmount: 30000,
    } as AdminEarning;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [earning];
      }
      if (href === '/admin/payout-batches?range=today&take=10') {
        return [] as AdminPayoutBatch[];
      }
      return fallback;
    });

    const page = await EarningsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('Active earnings filters');
    expect(markup).toContain('Range: Today');
    expect(markup).toContain('vuexy-booking-table-card vuexy-booking-table-group');
    expect(markup).toContain('Server Trusted Earning');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/earnings/summary?range=today', expect.any(Object));
  });

  it('renders cash debt accounting preview in the fee settlement confirmation', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 0,
      count: 1,
      currency: 'VND',
      grossAmount: 120000,
      netAmount: -30000,
      paidNetAmount: 0,
      pendingNetAmount: -30000,
      platformFee: 25000,
      withholdingAmount: 5000,
    };
    const earning = {
      booking: {
        payment: {
          amount: 120000,
          currency: 'VND',
          method: 'CASH',
          status: 'PENDING',
        },
        services: [],
        status: 'COMPLETED',
      },
      bookingId: 'cash-debt-booking',
      createdAt: '2026-06-10T08:00:00.000Z',
      currency: 'VND',
      grossAmount: 120000,
      id: 'cash-debt-earning',
      netAmount: -30000,
      platformFee: 25000,
      providerProfile: {
        displayName: 'Cash Debt Partner',
        user: {
          fullName: 'Cash Partner',
          phone: '+84900006666',
        },
      },
      providerProfileId: 'cash-debt-provider',
      status: 'PENDING',
      walletLedgerEntries: [
        {
          amount: -30000,
          currency: 'VND',
          id: 'cash-debt-ledger',
          metadata: {
            totalPartnerDueToCompany: 30000,
            walletDeductionCompanyOutputVat: 5000,
            walletDeductionPartnerTaxPayable: 5000,
            walletDeductionPlatformFeeNetRevenue: 20000,
          },
          reference: 'LEDGER-CASH-1',
          sourceKey: 'earning:cash-debt-earning:cash-platform-fee-net',
          type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
        },
      ],
      withholdingAmount: 5000,
    } as AdminEarning;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [earning];
      }
      if (href === '/admin/payout-batches?range=today&take=10') {
        return [] as AdminPayoutBatch[];
      }
      return fallback;
    });

    const page = await EarningsPage({
      searchParams: Promise.resolve({
        confirm: 'mark-paid',
        earningId: earning.id,
        range: 'today',
        settlementRef: 'BANK-CASH-1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      'Accounting preview: Dr Partner receivable 30.000 VND / Cr Platform fee net revenue 20.000 VND / Cr Company output VAT payable 5.000 VND / Cr Partner withholding tax payable 5.000 VND.',
    );
  });

  it('uses shared segmented controls for earnings range filters', () => {
    expect(pageSource).toContain('AdminFilterSummary');
    expect(pageSource).not.toContain('AdminFilterChipGroup');
    expect(pageSource).toContain('AdminSegmentedControl');
    expect(pageSource).not.toContain('StatusBadgeLink');
    expect(pageSource).not.toContain('<div className="participant-list');
    expect(pageSource).not.toContain('PillClassBadgeLink');
  });

  it('uses the shared Vuexy text link atom for closeout navigation', () => {
    expect(pageSource).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(pageSource).toContain('<AdminTextLink');
    expect(pageSource).not.toContain('className="text-link"');
  });

  it('uses shared money atoms for summary KPI amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain('value: formatMoney(summary.grossAmount, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.platformFee, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.withholdingAmount, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.netAmount, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.pendingNetAmount, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.availableNetAmount, summary.currency)');
    expect(pageSource).not.toContain('value: formatMoney(summary.paidNetAmount, summary.currency)');
  });

  it('scopes top-level earnings KPI cards by selected range and payout action state', () => {
    expect(pageSource).toContain('const earningsRangeScope = dateRangeLabel(filters.range);');
    expect(pageSource).toContain('scope: earningsRangeScope');
    expect(pageSource).toContain("scope: 'Pending'");
    expect(pageSource).toContain("scope: 'Payout records'");
    expect(pageSource).toContain("kind: 'period'");
    expect(pageSource).toContain("kind: 'action'");
    expect(pageSource).toContain("kind: 'record'");
  });
});
