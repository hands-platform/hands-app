import { buildPartnerWalletSummary } from './partner-detail-wallet-model';

describe('buildPartnerWalletSummary', () => {
  it('summarizes partner bank deposits, allocations, and cash-service deductions from visible wallet ledger rows', () => {
    const provider = {
      activitySummary: {
        availablePayout: 0,
        completedWorkCount: 3,
        grossRevenue: 1_200_000,
        pendingPayout: 0,
        platformFee: 118_519,
        walletBalance: 830_000,
      },
      earnings: [
        {
          id: 'earning-1',
          walletLedgerEntries: [
            {
              id: 'deposit-1',
              type: 'PARTNER_BANK_DEPOSIT_RECEIVED',
              sourceKey: 'partner-bank-deposit:provider-1:bank-1',
              amount: 1_000_000,
              currency: 'VND',
              metadata: {
                allocation: {
                  amountAppliedToNegativeWallet: 170_000,
                  amountRecordedAsPrepaidBalance: 830_000,
                },
              },
              createdAt: '2026-06-20T04:00:00.000Z',
            },
            {
              id: 'fee-1',
              type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
              sourceKey: 'cash-booking-fee:booking-1',
              amount: -118_519,
              currency: 'VND',
              createdAt: '2026-06-18T04:00:00.000Z',
            },
          ],
        },
        {
          id: 'earning-2',
          walletLedgerEntries: [
            {
              id: 'vat-1',
              type: 'CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED',
              sourceKey: 'cash-booking-vat:booking-1',
              amount: -9_481,
              currency: 'VND',
              createdAt: '2026-06-18T04:00:00.000Z',
            },
            {
              id: 'tax-1',
              type: 'CASH_BOOKING_PARTNER_TAX_DEDUCTED',
              sourceKey: 'cash-booking-tax:booking-1',
              amount: -42_000,
              currency: 'VND',
              createdAt: '2026-06-18T04:00:00.000Z',
            },
            {
              id: 'deposit-1',
              type: 'PARTNER_BANK_DEPOSIT_RECEIVED',
              sourceKey: 'partner-bank-deposit:provider-1:bank-1',
              amount: 1_000_000,
              currency: 'VND',
              metadata: {
                allocation: {
                  amountAppliedToNegativeWallet: 170_000,
                  amountRecordedAsPrepaidBalance: 830_000,
                },
              },
              createdAt: '2026-06-20T04:00:00.000Z',
            },
          ],
        },
      ],
    };

    const summary = buildPartnerWalletSummary(provider);

    expect(summary.currentBalance).toBe(830_000);
    expect(summary.partnerWalletLiability).toBe(830_000);
    expect(summary.negativeWalletReceivable).toBe(0);
    expect(summary.manualBankDeposits).toBe(1_000_000);
    expect(summary.appliedToNegativeWallet).toBe(170_000);
    expect(summary.recordedAsPrepaidBalance).toBe(830_000);
    expect(summary.cashPlatformFeeDeductions).toBe(118_519);
    expect(summary.cashCompanyVatDeductions).toBe(9_481);
    expect(summary.cashPartnerTaxDeductions).toBe(42_000);
    expect(summary.visibleLedgerRows).toHaveLength(4);
    expect(summary.reviewTone).toBe('success');
  });

  it('flags negative wallet balances as receivable follow-up for finance', () => {
    const summary = buildPartnerWalletSummary({
      activitySummary: {
        availablePayout: 0,
        completedWorkCount: 1,
        grossRevenue: 400_000,
        pendingPayout: 0,
        platformFee: 40_000,
        walletBalance: -40_000,
      },
      earnings: [],
    });

    expect(summary.partnerWalletLiability).toBe(0);
    expect(summary.negativeWalletReceivable).toBe(40_000);
    expect(summary.reviewTone).toBe('danger');
  });
});
