import type { AdminPayoutBatch, AdminProviderSanction } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';

type PayoutPartnerBankAccount = NonNullable<NonNullable<AdminPayoutBatch['providerProfile']>['bankAccounts']>[number];
type PayoutPartnerFinanceTone = 'danger' | 'success' | 'warning';

export type PayoutPartnerFinanceQueueRow = {
  readonly actionLabel: string;
  readonly amount: number;
  readonly batchId: string;
  readonly currency: string;
  readonly detail: string;
  readonly evidenceLabel: string;
  readonly href: string;
  readonly id: string;
  readonly partnerLabel: string;
  readonly tone: PayoutPartnerFinanceTone;
  readonly title: string;
};

export function buildPayoutPartnerFinanceQueueRows(
  batches: readonly AdminPayoutBatch[],
): PayoutPartnerFinanceQueueRow[] {
  return batches.flatMap((batch) => payoutPartnerFinanceRows(batch));
}

function payoutPartnerFinanceRows(batch: AdminPayoutBatch): PayoutPartnerFinanceQueueRow[] {
  const rows: PayoutPartnerFinanceQueueRow[] = [];
  const partnerLabel = batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown partner';
  const amount = batch.totalNetAmount;
  const currency = batch.currency;
  const activeHold = activePayoutHold(batch.providerProfile?.sanctions ?? []);
  const approvedBank = firstBankByStatus(batch, 'APPROVED');
  const rejectedBank = firstBankByStatus(batch, 'REJECTED');
  const pendingBank = firstBankByStatus(batch, 'PENDING_REVIEW');
  const recentWalletMovement = recentWalletMovementAmount(batch);
  const isTerminal = batch.status === 'PAID' || batch.status === 'CANCELLED';

  if (rejectedBank) {
    rows.push({
      actionLabel: 'Open partner bank correction',
      amount,
      batchId: batch.id,
      currency,
      detail:
        rejectedBank.rejectionReason ??
        'Partner must correct bank details in the Partner app before finance can release payout.',
      evidenceLabel: bankEvidenceLabel(rejectedBank),
      href: `/partners/${batch.providerProfileId}#bank`,
      id: `${batch.id}-bank-correction`,
      partnerLabel,
      title: 'Partner correction pending',
      tone: 'danger',
    });
  } else if (pendingBank) {
    rows.push({
      actionLabel: 'Review bank details',
      amount,
      batchId: batch.id,
      currency,
      detail: 'Corrected bank details are waiting for admin review. Approve them before manual payout release.',
      evidenceLabel: bankEvidenceLabel(pendingBank),
      href: `/partners/${batch.providerProfileId}#bank`,
      id: `${batch.id}-bank-review`,
      partnerLabel,
      title: 'Bank review needed',
      tone: 'warning',
    });
  } else if (!approvedBank && !isTerminal) {
    rows.push({
      actionLabel: 'Ask Partner to add bank details',
      amount,
      batchId: batch.id,
      currency,
      detail: 'No approved withdrawal bank details are loaded for this partner payout batch.',
      evidenceLabel: 'Missing approved bank',
      href: `/partners/${batch.providerProfileId}#bank`,
      id: `${batch.id}-bank-missing`,
      partnerLabel,
      title: 'Bank details missing',
      tone: 'warning',
    });
  }

  if (activeHold) {
    rows.push({
      actionLabel: 'Open partner controls',
      amount,
      batchId: batch.id,
      currency,
      detail: activeHold.reason ?? 'Partner has an active payout hold.',
      evidenceLabel: 'Active payout hold',
      href: `/partner-controls?q=${encodeURIComponent(batch.providerProfileId)}`,
      id: `${batch.id}-payout-hold`,
      partnerLabel,
      title: 'Payout hold',
      tone: 'danger',
    });
  }

  if (recentWalletMovement < 0) {
    rows.push({
      actionLabel: 'Open cash settlements',
      amount,
      batchId: batch.id,
      currency,
      detail:
        'Recent partner wallet impact evidence is negative. Confirm deposit or admin offset before payout release.',
      evidenceLabel: `Recent wallet movement ${formatMoney(recentWalletMovement, batch.currency)}`,
      href: '/cash-settlements',
      id: `${batch.id}-wallet-negative`,
      partnerLabel,
      title: 'Wallet recovery check',
      tone: 'danger',
    });
  }

  if (!isTerminal && !batch.transferRef) {
    rows.push({
      actionLabel: 'Save transfer reference',
      amount,
      batchId: batch.id,
      currency,
      detail: 'A bank transfer reference must be saved before this batch can be marked paid.',
      evidenceLabel: 'Missing transfer ref',
      href: `#${batch.id}`,
      id: `${batch.id}-transfer-ref`,
      partnerLabel,
      title: 'Transfer reference needed',
      tone: 'warning',
    });
  }

  if (!rows.length && approvedBank && !isTerminal) {
    rows.push({
      actionLabel: 'Review manual payout',
      amount,
      batchId: batch.id,
      currency,
      detail:
        'Approved bank details and transfer reference are available. Finance can complete the manual payout review.',
      evidenceLabel: 'Approved bank details',
      href: `#${batch.id}`,
      id: `${batch.id}-withdrawal-ready`,
      partnerLabel,
      title: 'Ready for manual payout',
      tone: 'success',
    });
  }

  return rows;
}

function firstBankByStatus(batch: AdminPayoutBatch, status: string) {
  const bankAccounts = batch.providerProfile?.bankAccounts ?? [];
  return bankAccounts.find((account) => account.status === status && account.isPrimary) ??
    bankAccounts.find((account) => account.status === status);
}

function bankEvidenceLabel(bank: PayoutPartnerBankAccount) {
  return `${bank.bankName || 'Bank missing'} / ${bank.accountHolderName || 'Holder missing'}`;
}

function activePayoutHold(sanctions: readonly AdminProviderSanction[]) {
  const now = Date.now();
  return sanctions.find((sanction) => {
    if (sanction.type !== 'PAYOUT_HOLD' || sanction.status !== 'ACTIVE') return false;
    if (!sanction.expiresAt) return true;
    const expiresAt = Date.parse(sanction.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function recentWalletMovementAmount(batch: AdminPayoutBatch) {
  return (batch.providerProfile?.walletLedgerEntries ?? [])
    .slice(0, 5)
    .reduce((total, row) => total + row.amount, 0);
}
