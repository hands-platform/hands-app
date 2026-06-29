import type { PartnerBankReviewTimelineItem } from './partner-detail-finance-gate-section';
import { formatDate } from './partner-detail-format';

type PartnerBankTimelineAccount = {
  readonly createdAt?: string | null;
  readonly id: string;
  readonly rejectionReason?: string | null;
  readonly status: string;
};

type PartnerBankTimelineLog = {
  readonly action: string;
  readonly actor?: { readonly fullName?: string | null; readonly phone?: string | null } | null;
  readonly createdAt: string;
  readonly fromStatus?: string | null;
  readonly id: string;
  readonly metadata?: unknown;
  readonly toStatus?: string | null;
};

export function buildPartnerBankReviewTimeline({
  bank,
  bankAccounts,
  logs,
}: {
  readonly bank: PartnerBankTimelineAccount | null;
  readonly bankAccounts?: readonly PartnerBankTimelineAccount[] | null;
  readonly logs?: readonly PartnerBankTimelineLog[] | null;
}): PartnerBankReviewTimelineItem[] {
  if (!bank) return [];

  const accountsById = new Map((bankAccounts ?? []).map((account) => [account.id, account]));
  const relevantBankIds = new Set([bank.id]);
  const hasRejectedHistory = bank.status === 'PENDING_REVIEW' && hasRejectedBankHistory(bank.id, bankAccounts);

  if (hasRejectedHistory) {
    for (const account of bankAccounts ?? []) {
      if (account.status === 'REJECTED') {
        relevantBankIds.add(account.id);
      }
    }
  }

  return (logs ?? [])
    .filter((log) => log.action.startsWith('bank_account.'))
    .filter((log) => {
      const bankAccountId = readString(readRecord(log.metadata).bankAccountId);
      return bankAccountId ? relevantBankIds.has(bankAccountId) : false;
    })
    .sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt))
    .map((log) => {
      const metadata = readRecord(log.metadata);
      const bankAccountId = readString(metadata.bankAccountId);
      const account = bankAccountId ? accountsById.get(bankAccountId) : null;
      return bankReviewTimelineItem(log, {
        hasRejectedHistory,
        rejectionReason: readString(metadata.reason) ?? account?.rejectionReason ?? bank.rejectionReason,
      });
    })
    .slice(0, 5);
}

function bankReviewTimelineItem(
  log: PartnerBankTimelineLog,
  context: { readonly hasRejectedHistory: boolean; readonly rejectionReason?: string | null },
): PartnerBankReviewTimelineItem {
  if (log.action === 'bank_account.submit') {
    return {
      actorLabel: actorLabel(log, 'Partner app'),
      atLabel: formatDate(log.createdAt),
      detail: context.hasRejectedHistory
        ? 'Partner submitted corrected bank details.'
        : 'Partner submitted bank details for payout review.',
      id: log.id,
      title: context.hasRejectedHistory ? 'Bank correction submitted' : 'Bank details submitted',
      tone: 'info',
    };
  }

  if (log.action === 'bank_account.rejected' || log.toStatus === 'REJECTED') {
    return {
      actorLabel: actorLabel(log),
      atLabel: formatDate(log.createdAt),
      detail: `Reason: ${context.rejectionReason?.trim() || 'Bank details require correction.'}`,
      id: log.id,
      title: 'Correction requested',
      tone: 'danger',
    };
  }

  if (log.action === 'bank_account.approved' || log.toStatus === 'APPROVED') {
    return {
      actorLabel: actorLabel(log),
      atLabel: formatDate(log.createdAt),
      detail: 'Bank account approved for manual payout.',
      id: log.id,
      title: 'Bank details approved',
      tone: 'success',
    };
  }

  return {
    actorLabel: actorLabel(log),
    atLabel: formatDate(log.createdAt),
    detail: `${log.fromStatus ?? 'New'} -> ${log.toStatus ?? 'Unknown'}`,
    id: log.id,
    title: 'Bank review updated',
    tone: 'warning',
  };
}

function hasRejectedBankHistory(
  currentBankAccountId: string,
  bankAccounts?: readonly PartnerBankTimelineAccount[] | null,
) {
  return (bankAccounts ?? []).some(
    (account) => account.id !== currentBankAccountId && account.status === 'REJECTED',
  );
}

function actorLabel(log: PartnerBankTimelineLog, fallback = 'System') {
  return log.actor?.fullName ?? log.actor?.phone ?? fallback;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
