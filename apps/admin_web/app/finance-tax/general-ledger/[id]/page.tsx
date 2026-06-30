import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminAccountingJournalBatchDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, shortId } from '../../../../lib/admin-format';
import {
  bankReconciliationDetailHref,
  buildAccountingJournalBatchDetailApiHref,
  generalLedgerHref,
  paymentClearingDetailHref,
} from '../../tax-settlement-page-model';

type GeneralLedgerDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
};

export default async function GeneralLedgerDetailPage({ params }: GeneralLedgerDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const batch = await adminGet<AdminAccountingJournalBatchDetail | null>(
    buildAccountingJournalBatchDetailApiHref(id),
    null,
  );
  if (!batch) {
    notFound();
  }

  return (
    <AdminPageTemplate
      actions={
        <Link className="button button-secondary" href={generalLedgerHref({ page: 1, range: '30d', review: 'posted', take: 25 })}>
          Back to ledger
        </Link>
      }
      description="Entry-level accounting evidence for a single finance source record. Lists stay light; this page loads journal entries only when opened."
      metrics={[
        { helper: 'Journal batch status.', label: 'Status', value: batch.status },
        { helper: 'Monthly tax/accounting period.', label: 'Period', value: batch.monthlyPeriod ?? '-' },
        { helper: 'Batch debit total.', label: 'Debit', value: formatMoney(batch.totalDebit, batch.currency) },
        { helper: 'Batch credit total.', label: 'Credit', value: formatMoney(batch.totalCredit, batch.currency) },
      ]}
      title="General Ledger Detail"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`${batch.sourceType} / ${shortId(batch.sourceId)} · Posted ${formatDateTime(batch.postedAt)}`}
          status={<span className={`pill ${statusPill(batch.status)}`}>{batch.status}</span>}
          title="Journal batch overview"
        />
        <div className="detail-grid admin-mt-16">
          <InfoCard label="Source key" value={batch.sourceKey} />
          <InfoCard
            label="Booking"
            value={
              batch.bookingId ? (
                <Link className="text-link" href={`/bookings/${batch.bookingId}`}>
                  {shortId(batch.bookingId)}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <InfoCard label="Payment" value={batch.payment ? `${batch.payment.method} · ${batch.payment.status}` : '-'} />
          <InfoCard label="Entries" value={`${batch.entries.length} journal rows`} />
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Debits and credits posted by the source record. Bank match count is shown without loading unrelated bank transaction lists."
          title="Journal entries"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No journal entries were recorded for this batch."
            headers={['Side', 'Account', 'Amount', 'Memo', 'Source', 'Bank match']}
            rowCount={batch.entries.length}
          >
            {batch.entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className={`pill ${entry.side === 'DEBIT' ? 'pill-info' : 'pill-success'}`}>{entry.side}</span>
                </td>
                <td>
                  <strong>{entry.accountCode}</strong>
                  <div className="muted">{entry.accountName}</div>
                </td>
                <td>
                  <strong>{formatMoney(entry.amount, entry.currency)}</strong>
                  <div className="muted">{formatDateTime(entry.createdAt)}</div>
                </td>
                <td>{entry.memo ?? '-'}</td>
                <td>
                  <strong>{entry.sourceType ?? batch.sourceType}</strong>
                  <div className="muted">{shortId(entry.sourceId ?? batch.sourceId)}</div>
                </td>
                <td>
                  <BankMatchEvidence matches={entry.bankReconciliationMatches ?? []} />
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
    </AdminPageTemplate>
  );
}

function BankMatchEvidence({
  matches,
}: {
  readonly matches: NonNullable<AdminAccountingJournalBatchDetail['entries'][number]['bankReconciliationMatches']>;
}) {
  if (matches.length === 0) {
    return <span className="muted">No bank match</span>;
  }

  return (
    <div className="stack">
      {matches.map((match) => (
        <div key={match.id}>
          <Link className="text-link" href={bankReconciliationDetailHref(match.bankTransactionId)}>
            Bank {shortId(match.bankTransactionId)}
          </Link>
          <div className="muted">
            {formatMoney(match.amount, match.currency)} · {match.status}
          </div>
          {match.paymentClearingEntryId ? (
            <Link className="text-link" href={paymentClearingDetailHref(match.paymentClearingEntryId)}>
              Clearing {shortId(match.paymentClearingEntryId)}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
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
  if (status === 'POSTED') {
    return 'pill-success';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
