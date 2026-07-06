import { formatCurrency } from './partner-detail-format';
import type { PartnerWalletSummary } from './partner-detail-wallet-model';

type PartnerFinanceFollowUpBankAccount = {
  readonly accountHolderName?: string | null;
  readonly bankName?: string | null;
  readonly id: string;
  readonly isPrimary?: boolean | null;
  readonly rejectionReason?: string | null;
  readonly status: string;
};

export type PartnerFinanceFollowUpTone = 'danger' | 'success' | 'warning';

export type PartnerFinanceFollowUpRow = {
  readonly actionLabel: string;
  readonly amount: number | null;
  readonly amountLabel: string;
  readonly currency: string;
  readonly detail: string;
  readonly evidenceLabel: string;
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly tone: PartnerFinanceFollowUpTone;
};

type PartnerFinanceFollowUpInput = {
  readonly bankAccounts?: readonly PartnerFinanceFollowUpBankAccount[] | null;
  readonly providerProfileId?: string | null;
  readonly walletSummary: PartnerWalletSummary;
};

export function buildPartnerFinanceFollowUpRows({
  bankAccounts,
  providerProfileId,
  walletSummary,
}: PartnerFinanceFollowUpInput): PartnerFinanceFollowUpRow[] {
  const rows: PartnerFinanceFollowUpRow[] = [];
  const accounts = bankAccounts ?? [];
  const approvedBank = firstBankByStatus(accounts, 'APPROVED');
  const rejectedBank = firstBankByStatus(accounts, 'REJECTED');
  const pendingBank = firstBankByStatus(accounts, 'PENDING_REVIEW');
  const depositRowCount = walletSummary.visibleLedgerRows.filter(
    (row) => row.type === 'PARTNER_BANK_DEPOSIT_RECEIVED',
  ).length;

  if (walletSummary.negativeWalletReceivable > 0) {
    rows.push({
      actionLabel: 'Collect deposit or approved offset',
      amount: walletSummary.negativeWalletReceivable,
      amountLabel: formatCurrency(walletSummary.negativeWalletReceivable, walletSummary.currency),
      currency: walletSummary.currency,
      detail:
        'Partner still owes HANDS from cash-service fee/tax settlement. Keep payout release, final acceptance, and service start blocked until evidence clears this receivable.',
      evidenceLabel: 'Negative wallet receivable',
      href: '/cash-settlements',
      id: 'negative-wallet-receivable',
      title: 'Negative wallet recovery',
      tone: 'danger',
    });
  }

  if (rejectedBank) {
    rows.push({
      actionLabel: 'Wait for corrected bank details',
      amount: null,
      amountLabel: '-',
      currency: walletSummary.currency,
      detail:
        rejectedBank.rejectionReason ??
        'Bank details were rejected. Partner app should ask for corrected withdrawal information.',
      evidenceLabel: bankAccountLabel(rejectedBank),
      href: '#bank',
      id: 'bank-correction-requested',
      title: 'Bank correction requested',
      tone: 'danger',
    });
  } else if (pendingBank) {
    rows.push({
      actionLabel: 'Approve or reject details',
      amount: null,
      amountLabel: '-',
      currency: walletSummary.currency,
      detail:
        'Partner submitted withdrawal details. Operator should review account holder, bank name, and proof before manual withdrawal.',
      evidenceLabel: bankAccountLabel(pendingBank),
      href: '#bank',
      id: 'bank-pending-review',
      title: 'Withdrawal details pending review',
      tone: 'warning',
    });
  }

  if (depositRowCount > 0) {
    rows.push({
      actionLabel: 'Verify allocation',
      amount: walletSummary.manualBankDeposits,
      amountLabel: formatCurrency(walletSummary.manualBankDeposits, walletSummary.currency),
      currency: walletSummary.currency,
      detail:
        'Manual partner bank deposit evidence is visible in the wallet ledger. Check bank reference, allocation to negative wallet, and prepaid balance.',
      evidenceLabel: `${depositRowCount} deposit row(s)`,
      href: '#partner-wallet-detail',
      id: 'manual-bank-deposit-history',
      title: 'Manual deposit history',
      tone: 'success',
    });
  }

  if (walletSummary.partnerWalletLiability > 0) {
    rows.push(
      approvedBank
        ? {
            actionLabel: 'Ready for withdrawal review',
            amount: walletSummary.partnerWalletLiability,
            amountLabel: formatCurrency(walletSummary.partnerWalletLiability, walletSummary.currency),
            currency: walletSummary.currency,
            detail:
              'Positive wallet balance is available for admin-reviewed manual withdrawal or future prepaid deduction.',
            evidenceLabel: 'Approved bank details',
            href: '#bank',
            id: 'withdrawal-ready',
            title: 'Withdrawal readiness',
            tone: 'success',
          }
        : {
            actionLabel: 'Ask Partner to add bank details',
            amount: walletSummary.partnerWalletLiability,
            amountLabel: formatCurrency(walletSummary.partnerWalletLiability, walletSummary.currency),
            currency: walletSummary.currency,
            detail:
              'Partner has positive wallet value, but no approved withdrawal bank details are available for manual payout.',
            evidenceLabel: 'Missing approved bank',
            href: '#bank',
            id: 'withdrawal-details-missing',
            title: 'Withdrawal details needed',
            tone: 'warning',
          },
    );
  }

  if (walletSummary.manualAdjustmentCount > 0) {
    rows.push({
      actionLabel: 'Review or create adjustment',
      amount: null,
      amountLabel: '-',
      currency: walletSummary.currency,
      detail:
        'Manual wallet adjustments are visible. Review operator notes and audit log before payout release.',
      evidenceLabel: `${walletSummary.manualAdjustmentCount} adjustment row(s)`,
      href: partnerWalletAdjustmentHref(providerProfileId),
      id: 'manual-adjustment-review',
      title: 'Manual adjustment review',
      tone: 'warning',
    });
  }

  return rows;
}

function firstBankByStatus(
  accounts: readonly PartnerFinanceFollowUpBankAccount[],
  status: string,
) {
  return accounts.find((account) => account.status === status && account.isPrimary) ??
    accounts.find((account) => account.status === status);
}

function bankAccountLabel(account: PartnerFinanceFollowUpBankAccount) {
  const bank = account.bankName?.trim() || 'Bank missing';
  const holder = account.accountHolderName?.trim() || 'Holder missing';
  return `${bank} / ${holder}`;
}

function partnerWalletAdjustmentHref(providerProfileId?: string | null) {
  const normalized = providerProfileId?.trim();
  if (!normalized) {
    return '/wallet-adjustments?ownerType=PARTNER';
  }

  const params = new URLSearchParams({
    ownerType: 'PARTNER',
    ownerId: normalized,
  });
  return `/wallet-adjustments?${params.toString()}`;
}
