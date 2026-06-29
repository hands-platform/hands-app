import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminPost } from '../../lib/admin-api';
import WalletAdjustmentsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminPost: vi.fn(),
  };
});

const mockedAdminPost = vi.mocked(adminPost);

describe('WalletAdjustmentsPage', () => {
  beforeEach(() => {
    mockedAdminPost.mockReset();
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
});
