import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBookingPaymentClearingEntryDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, shortId } from '../../../../lib/admin-format';
import {
  buildBookingPaymentClearingDetailApiHref,
  buildFinanceSettlementTraceLinks,
  generalLedgerDetailHref,
  paymentClearingHref,
} from '../../tax-settlement-page-model';

type PaymentClearingDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
};

export default async function PaymentClearingDetailPage({ params }: PaymentClearingDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const entry = await adminGet<AdminBookingPaymentClearingEntryDetail | null>(
    buildBookingPaymentClearingDetailApiHref(id),
    null,
  );
  if (!entry) {
    notFound();
  }

  const matches = entry.bankReconciliationMatches ?? [];
  const settlementTraceLinks = buildFinanceSettlementTraceLinks(entry);

  return (
    <AdminPageTemplate
      actions={
        <Link className="button button-secondary" href={paymentClearingHref({ page: 1, range: '30d', review: 'open', take: 25 })}>
          Back to clearing
        </Link>
      }
      description="Evidence for one booking payment clearing row. Open this only when finance needs source, settlement, or bank matching detail."
      metrics={[
        { helper: 'Clearing state.', label: 'Status', value: entry.status },
        { helper: 'Clearing row amount.', label: 'Amount', value: formatMoney(entry.amount, entry.currency) },
        { helper: 'Bank reconciliation evidence linked to this row.', label: 'Matches', value: matches.length },
        { helper: 'Clearing source type.', label: 'Type', value: entry.type },
      ]}
      title="Payment Clearing Detail"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`${entry.type} / ${shortId(entry.sourceKey)} · Occurred ${formatDateTime(entry.occurredAt)}`}
          status={<span className={`pill ${statusPill(entry.status)}`}>{entry.status}</span>}
          title="Clearing overview"
        />
        <div className="detail-grid admin-mt-16">
          <InfoCard
            label="Booking"
            value={
              <Link className="text-link" href={`/bookings/${entry.bookingId}`}>
                {shortId(entry.bookingId)}
              </Link>
            }
          />
          <InfoCard label="Payment" value={entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : '-'} />
          <InfoCard
            label="Settlement trace"
            value={
              settlementTraceLinks.length > 0 ? (
                <div className="admin-table-substack">
                  {settlementTraceLinks.map((link) => (
                    <Link className="text-link" href={link.href} key={link.label}>
                      {link.label} <span className="muted">{link.value}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                '-'
              )
            }
          />
          <InfoCard label="Cleared at" value={entry.clearedAt ? formatDateTime(entry.clearedAt) : 'Waiting'} />
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Bank matches are loaded from this detail endpoint only. Open the bank transaction detail for full reconciliation evidence."
          title="Bank reconciliation matches"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No bank reconciliation matches are linked to this clearing row."
            headers={['Bank transaction', 'Journal entry', 'Counterparty', 'Amount', 'Matched', 'Status']}
            rowCount={matches.length}
          >
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  {match.bankTransactionId ? (
                    <Link className="text-link" href={`/finance-tax/bank-reconciliation/${match.bankTransactionId}`}>
                      {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{match.bankTransaction?.type ?? '-'}</div>
                </td>
                <td>
                  {match.accountingJournalEntry ? (
                    <Link className="text-link" href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                      {match.accountingJournalEntry.accountCode}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{match.accountingJournalEntry?.accountName ?? 'No journal link'}</div>
                </td>
                <td>{match.bankTransaction?.counterpartyName ?? '-'}</td>
                <td>
                  <strong>{formatMoney(match.amount, match.currency)}</strong>
                  {match.bankTransaction ? (
                    <div className="muted">Bank {formatMoney(match.bankTransaction.amount, match.bankTransaction.currency)}</div>
                  ) : null}
                </td>
                <td>{formatDateTime(match.matchedAt)}</td>
                <td>
                  <span className={`pill ${bankStatusPill(match.status)}`}>{match.status}</span>
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
  if (status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function bankStatusPill(status: string) {
  if (status === 'MATCHED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_MATCHED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
