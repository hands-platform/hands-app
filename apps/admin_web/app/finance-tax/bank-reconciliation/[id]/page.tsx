import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBankReconciliationTransactionDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, shortId } from '../../../../lib/admin-format';
import {
  bankReconciliationHref,
  buildBankReconciliationDetailApiHref,
} from '../../tax-settlement-page-model';

type BankReconciliationDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
};

export default async function BankReconciliationDetailPage({ params }: BankReconciliationDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const transaction = await adminGet<AdminBankReconciliationTransactionDetail | null>(
    buildBankReconciliationDetailApiHref(id),
    null,
  );
  if (!transaction) {
    notFound();
  }

  const matches = transaction.reconciliationMatches ?? [];

  return (
    <AdminPageTemplate
      actions={
        <Link className="button button-secondary" href={bankReconciliationHref({ page: 1, range: '30d', review: 'unmatched', take: 25 })}>
          Back to bank reconciliation
        </Link>
      }
      description="Bank transaction evidence for manual reconciliation against payment clearing, journal, withdrawal, and payout records."
      metrics={[
        { helper: 'Bank transaction state.', label: 'Status', value: transaction.status },
        { helper: 'Bank transaction amount.', label: 'Amount', value: formatMoney(transaction.amount, transaction.currency) },
        { helper: 'Linked reconciliation matches.', label: 'Matches', value: matches.length },
        { helper: 'Bank flow direction.', label: 'Type', value: transaction.type },
      ]}
      title="Bank Reconciliation Detail"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`${transaction.transferRef ?? shortId(transaction.sourceKey)} · Occurred ${formatDateTime(transaction.occurredAt)}`}
          status={<span className={`pill ${statusPill(transaction.status)}`}>{transaction.status}</span>}
          title="Bank transaction overview"
        />
        <div className="detail-grid admin-mt-16">
          <InfoCard label="Bank account" value={transaction.bankAccount?.name ?? 'Unknown account'} />
          <InfoCard label="Bank" value={transaction.bankAccount?.bankName ?? '-'} />
          <InfoCard label="Counterparty" value={transaction.counterpartyName ?? '-'} />
          <InfoCard label="Value date" value={transaction.valueDate ? formatDateTime(transaction.valueDate) : '-'} />
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Each match points to the finance source used to reconcile this bank row."
          title="Reconciliation matches"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No reconciliation matches are linked to this bank transaction."
            headers={['Matched source', 'Accounting entry', 'Payment clearing', 'Withdrawal / payout', 'Amount', 'Status']}
            rowCount={matches.length}
          >
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  <strong>{shortId(match.sourceKey)}</strong>
                  <div className="muted">{formatDateTime(match.matchedAt)}</div>
                </td>
                <td>
                  {match.accountingJournalEntry ? (
                    <>
                      <strong>{match.accountingJournalEntry.accountCode}</strong>
                      <div className="muted">{match.accountingJournalEntry.accountName}</div>
                    </>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {match.paymentClearingEntry ? (
                    <Link className="text-link" href={`/finance-tax/payment-clearing/${match.paymentClearingEntry.id}`}>
                      {match.paymentClearingEntry.type}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{match.paymentClearingEntry?.bookingId ? shortId(match.paymentClearingEntry.bookingId) : '-'}</div>
                </td>
                <td>
                  {match.withdrawalRequest ? <strong>Withdrawal {shortId(match.withdrawalRequest.id)}</strong> : null}
                  {match.payoutBatch ? <strong>Payout {shortId(match.payoutBatch.id)}</strong> : null}
                  {!match.withdrawalRequest && !match.payoutBatch ? <span className="muted">-</span> : null}
                </td>
                <td>
                  <strong>{formatMoney(match.amount, match.currency)}</strong>
                </td>
                <td>
                  <span className={`pill ${statusPill(match.status)}`}>{match.status}</span>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
    </AdminPageTemplate>
  );
}

function InfoCard({ label, value }: { readonly label: string; readonly value: React.ReactNode }) {
  return (
    <div className="card">
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function statusPill(status: string) {
  if (status === 'MATCHED' || status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_MATCHED' || status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
