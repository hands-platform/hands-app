import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, adminPost } from '../../lib/admin-api';
import WalletAdjustmentsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminPost: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminPost = vi.mocked(adminPost);

describe('WalletAdjustmentsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockResolvedValue([]);
    mockedAdminPost.mockReset();
  });

  it('explains approval and attachment gates before operators create an adjustment', async () => {
    const page = await WalletAdjustmentsPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Approval id is required for every creation');
    expect(markup).toContain('Evidence is required from 10.000.000 VND or more');
    expect(markup).toContain('Receivable write-off always needs evidence');
  });

  it('renders wallet adjustment action notices from query params', async () => {
    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ adjustmentNotice: 'created' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Manual adjustment created');
    expect(markup).toContain('Wallet ledger and admin audit log were written through the Admin API.');
  });

  it('renders a clear notice when attachment evidence URL is invalid', async () => {
    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ adjustmentNotice: 'attachment-invalid' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Attachment URL is invalid');
    expect(markup).toContain('Attachment evidence must be a valid http or https URL.');
  });

  it('renders a clear notice when monthly period format is invalid', async () => {
    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ adjustmentNotice: 'monthly-period-invalid' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Monthly period is invalid');
    expect(markup).toContain('Monthly period must use YYYY-MM before the wallet ledger can be written.');
  });

  it('renders the accounting preview returned by the Admin API', async () => {
    mockedAdminPost.mockResolvedValue({
      accountingEntries: [
        {
          accountDebit: 'partner_bonus_expense',
          accountCredit: 'partner_wallet_liability',
          amount: 200000,
        },
      ],
      adjustmentType: 'PARTNER_BONUS',
      afterBalance: 200000,
      affects: {
        bankCash: false,
        expense: true,
        partnerReceivable: false,
        revenue: false,
        taxPayable: false,
        walletLiability: true,
      },
      amount: 200000,
      approvalId: 'approval-1',
      bankCashAmount: 0,
      beforeBalance: 0,
      companyOutputVat: 0,
      currency: 'VND',
      direction: 'CREDIT',
      expenseAmount: 200000,
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      platformRevenueAmount: 0,
      reason: 'Completed launch bonus',
      requiresApproval: true,
      requiresAttachment: false,
      revenueAmount: 0,
      walletDelta: 200000,
      walletLiabilityIncrease: 200000,
    });

    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        adjustmentType: 'PARTNER_BONUS',
        amount: '200000',
        approvalId: 'approval-1',
        direction: 'CREDIT',
        intent: 'preview',
        ownerId: 'provider-1',
        ownerType: 'PARTNER',
        reason: 'Completed launch bonus',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/wallet-adjustments/preview',
      expect.objectContaining({
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        ownerId: 'provider-1',
        ownerType: 'PARTNER',
      }),
      null,
    );
    expect(markup).toContain('Accounting preview');
    expect(markup).toContain('Partner Bonus Expense');
    expect(markup).toContain('Partner Wallet Liability');
    expect(markup).toContain('No bank/cash movement');
    expect(markup).toContain('No output VAT');
    expect(markup).toContain('200.000 VND');
  });

  it('keeps create disabled when preview requires an attachment that is not present', async () => {
    mockedAdminPost.mockResolvedValue({
      accountingEntries: [
        {
          accountDebit: 'partner_bonus_expense',
          accountCredit: 'partner_wallet_liability',
          amount: 10000000,
        },
      ],
      adjustmentType: 'PARTNER_BONUS',
      afterBalance: 10000000,
      affects: {
        bankCash: false,
        expense: true,
        partnerReceivable: false,
        revenue: false,
        taxPayable: false,
        walletLiability: true,
      },
      amount: 10000000,
      approvalId: 'approval-1',
      bankCashAmount: 0,
      beforeBalance: 0,
      companyOutputVat: 0,
      currency: 'VND',
      direction: 'CREDIT',
      expenseAmount: 10000000,
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      platformRevenueAmount: 0,
      reason: 'High amount correction',
      requiresApproval: true,
      requiresAttachment: true,
      revenueAmount: 0,
      walletDelta: 10000000,
      walletLiabilityIncrease: 10000000,
    });

    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        adjustmentType: 'PARTNER_BONUS',
        amount: '10000000',
        approvalId: 'approval-1',
        direction: 'CREDIT',
        intent: 'preview',
        ownerId: 'provider-1',
        ownerType: 'PARTNER',
        reason: 'High amount correction',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Attachment required');
    expect(markup).toContain('disabled="" type="submit">Create manual adjustment');
  });

  it('keeps create disabled when preview shows booking settlement accounting impact', async () => {
    mockedAdminPost.mockResolvedValue({
      accountingEntries: [
        {
          accountDebit: 'partner_wallet_liability',
          accountCredit: 'platform_fee_net_revenue',
          amount: 200000,
        },
      ],
      adjustmentType: 'CASH_BOOKING_DEDUCTION',
      afterBalance: 300000,
      affects: {
        bankCash: false,
        expense: false,
        partnerReceivable: false,
        revenue: true,
        taxPayable: true,
        walletLiability: true,
      },
      amount: 200000,
      approvalId: 'approval-1',
      bankCashAmount: 0,
      beforeBalance: 500000,
      companyOutputVat: 16000,
      currency: 'VND',
      direction: 'DEBIT',
      expenseAmount: 0,
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      platformRevenueAmount: 184000,
      reason: 'Cash booking settlement attempt',
      requiresApproval: true,
      requiresAttachment: false,
      revenueAmount: 184000,
      walletDelta: -200000,
      walletLiabilityDecrease: 200000,
    });

    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        adjustmentType: 'CASH_BOOKING_DEDUCTION',
        amount: '200000',
        approvalId: 'approval-1',
        direction: 'DEBIT',
        intent: 'preview',
        ownerId: 'provider-1',
        ownerType: 'PARTNER',
        reason: 'Cash booking settlement attempt',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Use booking settlement');
    expect(markup).toContain('Blocked accounting impact');
    expect(markup).toContain('disabled="" type="submit">Create manual adjustment');
  });

  it('renders recent manual wallet adjustment history from the Admin API', async () => {
    mockedAdminGet.mockResolvedValueOnce([
      {
        id: 'provider-ledger-1',
        adjustmentType: 'PARTNER_BONUS',
        afterBalance: 200000,
        amount: 200000,
        approvalId: 'approval-partner-1',
        beforeBalance: 0,
        createdAt: '2026-06-29T09:00:00.000Z',
        currency: 'VND',
        direction: 'CREDIT',
        ledgerType: 'MANUAL_ADJUSTMENT_CREDIT',
        ownerId: 'provider-1',
        ownerLabel: 'Smoke Partner',
        ownerPhone: '+84222222222',
        ownerType: 'PARTNER',
        reason: 'Launch bonus',
        sourceKey: 'manual-wallet-adjustment:PARTNER:provider-1:approval-partner-1',
        walletDelta: 200000,
      },
    ]);

    const page = await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ ownerId: 'provider-1', ownerType: 'PARTNER' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/wallet-adjustments?ownerType=PARTNER&ownerId=provider-1&take=25',
      [],
    );
    expect(markup).toContain('Manual adjustment history');
    expect(markup).toContain('Smoke Partner');
    expect(markup).toContain('PARTNER_BONUS');
    expect(markup).toContain('approval-partner-1');
    expect(markup).toContain('Launch bonus');
  });
});
