import type { ReactNode } from 'react';

import { AdminTableSubstack } from '../../components/admin-data-table';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { shortId } from '../../lib/admin-format';
import { bankReconciliationDetailHref, generalLedgerDetailHref, paymentClearingDetailHref } from './tax-settlement-page-model';

type FinanceBankMatchEvidenceMatch = {
  readonly id: string;
  readonly bankTransactionId?: string | null;
  readonly paymentClearingEntryId?: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly accountingJournalEntry?: {
    readonly batchId: string;
    readonly accountCode: string;
  } | null;
  readonly bankTransaction?: {
    readonly id: string;
    readonly transferRef?: string | null;
  } | null;
};

type FinanceBankMatchEvidenceProps = {
  readonly className?: string;
  readonly emptyLabel?: ReactNode;
  readonly matches: readonly FinanceBankMatchEvidenceMatch[];
  readonly showAmount?: boolean;
  readonly showJournalLink?: boolean;
  readonly showPaymentClearingLink?: boolean;
};

export function FinanceBankMatchEvidence({
  className,
  emptyLabel = 'No bank match',
  matches,
  showAmount = true,
  showJournalLink = false,
  showPaymentClearingLink = true,
}: FinanceBankMatchEvidenceProps) {
  if (matches.length === 0) {
    return typeof emptyLabel === 'string' ? <AdminInlineFallback>{emptyLabel}</AdminInlineFallback> : <>{emptyLabel}</>;
  }

  return (
    <AdminTableSubstack className={className}>
      {matches.map((match) => (
        <div key={match.id}>
          {match.bankTransactionId ? (
            <AdminTextLink href={bankReconciliationDetailHref(match.bankTransactionId)}>
              Bank {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
            </AdminTextLink>
          ) : (
            <AdminInlineFallback>No bank transaction</AdminInlineFallback>
          )}
          {showJournalLink ? (
            match.accountingJournalEntry ? (
              <AdminTextLink href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                Journal {match.accountingJournalEntry.accountCode}
              </AdminTextLink>
            ) : (
              <AdminInlineFallback>No journal entry</AdminInlineFallback>
            )
          ) : null}
          {showAmount ? (
            <div className="muted">
              <MoneyText amount={match.amount} currency={match.currency} /> · {match.status}
            </div>
          ) : (
            <span className="muted">{match.status}</span>
          )}
          {showPaymentClearingLink && match.paymentClearingEntryId ? (
            <AdminTextLink href={paymentClearingDetailHref(match.paymentClearingEntryId)}>
              Clearing {shortId(match.paymentClearingEntryId)}
            </AdminTextLink>
          ) : null}
        </div>
      ))}
    </AdminTableSubstack>
  );
}
