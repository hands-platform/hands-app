import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminCashSettlementDetail } from '../../lib/admin-api';
import { CashSettlementReviewDrawer } from './cash-settlement-review-drawer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('CashSettlementReviewDrawer', () => {
  it('shows authoritative debt amounts, permission state, audit timeline and evidence trace', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementReviewDrawer
        canAllocate={false}
        closeHref="/cash-settlements"
        detail={detail()}
        detailLoaded
        returnTo="/cash-settlements?review=earning-1"
      />,
    );

    expect(markup).toContain('Original debt');
    expect(markup).toContain('170.000 VND');
    expect(markup).toContain('Allocated');
    expect(markup).toContain('70.000 VND');
    expect(markup).toContain('Remaining exposure');
    expect(markup).toContain('100.000 VND');
    expect(markup).toContain('Review only');
    expect(markup).toContain('Approved deposit allocated');
    expect(markup).toContain('Finance Operator');
    expect(markup).toContain('/finance-tax/partner-bank-deposits/deposit-1');
    expect(markup).toContain('Ledger ledger-1');
    expect(markup).toContain('Journal journal-1');
    expect(markup).not.toContain('name="reasonCode"');
  });
});

function detail(): AdminCashSettlementDetail {
  return {
    allocatedAmount: 70_000,
    auditLogs: [
      {
        action: 'partner_bank_deposit.cash_debt_allocate',
        actor: { fullName: 'Finance Operator', id: 'admin-1' },
        createdAt: '2026-08-09T10:00:00.000Z',
        id: 'audit-1',
        metadata: {
          amount: 70_000,
          cashDebtFullyAllocated: false,
          currency: 'VND',
          reasonCode: 'PARTIAL_RECOVERY',
        },
        target: 'partner_bank_deposit_request:deposit-1',
      },
    ],
    availableDeposits: [],
    earning: {
      bankDepositCashDebtAllocations: [
        {
          amount: 70_000,
          createdAt: '2026-08-09T10:00:00.000Z',
          currency: 'VND',
          id: 'allocation-1',
          partnerBankDepositRequest: {
            bankTransactionId: 'VCB-1',
            id: 'deposit-1',
            journalBatchId: 'journal-1',
            ledgerEntryId: 'ledger-1',
            status: 'EXECUTED',
          },
        },
      ],
      bookingId: 'booking-1',
      createdAt: '2026-08-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 500_000,
      id: 'earning-1',
      netAmount: -170_000,
      platformFee: 150_000,
      providerProfile: { displayName: 'Partner One' },
      providerProfileId: 'partner-1',
      status: 'AVAILABLE',
      withholdingAmount: 20_000,
    },
    originalDebtAmount: 170_000,
    remainingDebtAmount: 100_000,
    walletBalance: -100_000,
  };
}
