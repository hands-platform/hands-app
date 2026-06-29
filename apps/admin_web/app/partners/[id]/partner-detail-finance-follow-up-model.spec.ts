import { buildPartnerFinanceFollowUpRows } from './partner-detail-finance-follow-up-model';
import type { PartnerWalletSummary } from './partner-detail-wallet-model';

describe('buildPartnerFinanceFollowUpRows', () => {
  it('prioritizes negative wallet, rejected bank correction, and manual deposit evidence', () => {
    const rows = buildPartnerFinanceFollowUpRows({
      bankAccounts: [
        {
          id: 'bank-1',
          bankName: 'Vietcombank',
          accountHolderName: 'Smoke Partner',
          status: 'REJECTED',
          rejectionReason: 'Account number does not match the bank proof.',
          isPrimary: true,
        },
      ],
      walletSummary: walletSummary({
        manualBankDeposits: 1_000_000,
        negativeWalletReceivable: 250_000,
        visibleLedgerRows: [
          {
            amount: 1_000_000,
            createdAt: '2026-06-29T03:00:00.000Z',
            currency: 'VND',
            id: 'deposit-1',
            reference: 'VCB-001',
            type: 'PARTNER_BANK_DEPOSIT_RECEIVED',
          },
        ],
      }),
    });

    expect(rows.map((row) => row.id)).toEqual([
      'negative-wallet-receivable',
      'bank-correction-requested',
      'manual-bank-deposit-history',
    ]);
    expect(rows[0]).toMatchObject({
      actionLabel: 'Collect deposit or approved offset',
      amountLabel: '250.000 VND',
      tone: 'danger',
    });
    expect(rows[1].detail).toContain('Account number does not match');
    expect(rows[2]).toMatchObject({
      amountLabel: '1.000.000 VND',
      evidenceLabel: '1 deposit row(s)',
      href: '#partner-wallet-detail',
      tone: 'success',
    });
  });

  it('surfaces withdrawal readiness when wallet is positive and approved bank exists', () => {
    const rows = buildPartnerFinanceFollowUpRows({
      bankAccounts: [
        {
          id: 'bank-1',
          bankName: 'BIDV',
          accountHolderName: 'Ready Partner',
          status: 'APPROVED',
          isPrimary: true,
        },
      ],
      walletSummary: walletSummary({
        currentBalance: 830_000,
        partnerWalletLiability: 830_000,
      }),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'withdrawal-ready',
        amountLabel: '830.000 VND',
        evidenceLabel: 'Approved bank details',
        tone: 'success',
      }),
    ]);
  });

  it('asks for withdrawal details when a positive wallet has no approved bank account', () => {
    const rows = buildPartnerFinanceFollowUpRows({
      bankAccounts: [],
      walletSummary: walletSummary({
        currentBalance: 500_000,
        partnerWalletLiability: 500_000,
      }),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'withdrawal-details-missing',
        actionLabel: 'Ask Partner to add bank details',
        amountLabel: '500.000 VND',
        tone: 'warning',
      }),
    ]);
  });
});

function walletSummary(overrides: Partial<PartnerWalletSummary>): PartnerWalletSummary {
  return {
    appliedToNegativeWallet: 0,
    cashCompanyVatDeductions: 0,
    cashPartnerTaxDeductions: 0,
    cashPlatformFeeDeductions: 0,
    currency: 'VND',
    currentBalance: 0,
    manualAdjustmentCount: 0,
    manualBankDeposits: 0,
    negativeWalletReceivable: 0,
    partnerWalletLiability: 0,
    recordedAsPrepaidBalance: 0,
    reviewTone: 'success',
    visibleLedgerRows: [],
    ...overrides,
  };
}
