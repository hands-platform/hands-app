import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminInlineFallback } from '../../components/admin-inline-fallback';
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
  className = 'admin-table-substack',
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
    <div className={className}>
      {matches.map((match) => (
        <div key={match.id}>
          {match.bankTransactionId ? (
            <Link className="text-link" href={bankReconciliationDetailHref(match.bankTransactionId)}>
              Bank {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
            </Link>
          ) : (
            <AdminInlineFallback>No bank transaction</AdminInlineFallback>
          )}
          {showJournalLink ? (
            match.accountingJournalEntry ? (
              <Link className="text-link" href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                Journal {match.accountingJournalEntry.accountCode}
              </Link>
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
            <Link className="text-link" href={paymentClearingDetailHref(match.paymentClearingEntryId)}>
              Clearing {shortId(match.paymentClearingEntryId)}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
