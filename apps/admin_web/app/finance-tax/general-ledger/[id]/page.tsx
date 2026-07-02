import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminAccountingJournalBatchDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDetailInfoItem } from '../../finance-detail-info-item';
import {
  bankReconciliationDetailHref,
  buildAccountingJournalBatchDetailApiHref,
  buildFinanceSettlementTraceLinks,
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
  const settlementTraceLinks = buildFinanceSettlementTraceLinks(batch);
  const balanceDelta = Math.abs(batch.totalDebit - batch.totalCredit);
  const formulaDelta = journalFormulaDelta(batch);
  const bankMatches = batch.entries.flatMap((entry) => entry.bankReconciliationMatches ?? []);

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
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description={`${batch.sourceType} / ${shortId(batch.sourceId)} · Posted ${formatDateTime(batch.postedAt)}`}
        resultLabel={batch.status}
        resultTone={statusTone(batch.status)}
        title="Journal batch overview"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem label="Source key" value={batch.sourceKey} />
          <FinanceDetailInfoItem label="Double-entry check" value={journalBalanceLabel(batch)} />
          <FinanceDetailInfoItem
            label="Monthly close blocker"
            value={formulaDelta === 0 ? 'No formula delta' : `Formula delta ${formatMoney(formulaDelta, batch.currency)}`}
          />
          <FinanceDetailInfoItem label="Debit total" value={formatMoney(batch.totalDebit, batch.currency)} />
          <FinanceDetailInfoItem label="Credit total" value={formatMoney(batch.totalCredit, batch.currency)} />
          <FinanceDetailInfoItem label="Balance delta" value={formatMoney(balanceDelta, batch.currency)} />
          <FinanceDetailInfoItem
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
          <FinanceDetailInfoItem label="Payment" value={batch.payment ? `${batch.payment.method} · ${batch.payment.status}` : '-'} />
          <FinanceDetailInfoItem label="Entries" value={`${batch.entries.length} journal rows`} />
          <FinanceDetailInfoItem
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
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="Quick route from this journal batch back to the source record, settlement snapshot, clearing row, and bank evidence."
        resultLabel={balanceDelta === 0 ? 'Balanced' : 'Unbalanced'}
        resultTone={balanceDelta === 0 ? 'success' : 'danger'}
        title="Journal evidence hub"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem
            label="Source record"
            value={
              <div className="admin-table-substack">
                <strong>{batch.sourceType}</strong>
                <span className="muted">{batch.sourceKey}</span>
              </div>
            }
          />
          <FinanceDetailInfoItem
            label="Linked settlement"
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
                'No settlement link'
              )
            }
          />
          <FinanceDetailInfoItem label="Bank reconciliation evidence" value={`${bankMatches.length} match(es)`} />
          <FinanceDetailInfoItem
            label="Closeout readiness"
            value={formulaDelta === 0 ? 'Ready for monthly close checks' : 'Resolve formula delta before monthly close'}
          />
          <FinanceDetailInfoItem
            label="Latest bank evidence"
            value={bankMatches[0] ? <BankMatchEvidence matches={[bankMatches[0]]} /> : 'No bank match'}
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Debits and credits posted by the source record. Bank match count is shown without loading unrelated bank transaction lists."
        resultLabel={`${batch.entries.length} entry row(s)`}
        resultTone="info"
        title="Journal entries"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
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
      </AdminFilterPanel>
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

function statusTone(status: string): 'danger' | 'success' | 'warning' {
  if (status === 'POSTED') {
    return 'success';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

function journalBalanceLabel(batch: AdminAccountingJournalBatchDetail) {
  const delta = batch.totalDebit - batch.totalCredit;
  if (delta === 0) {
    return 'Balanced';
  }

  return `Delta ${formatMoney(Math.abs(delta), batch.currency)}`;
}

function journalFormulaDelta(batch: AdminAccountingJournalBatchDetail) {
  const metadata = readPlainRecord(batch.metadata);
  const delta = metadata?.reconciliationDelta;
  if (typeof delta === 'number' && Number.isFinite(delta)) {
    return Math.abs(delta);
  }

  const settlementDelta = batch.settlementSnapshot
    ? settlementFormulaDelta(batch.settlementSnapshot)
    : batch.settlementReversalEntry
      ? settlementFormulaDelta(batch.settlementReversalEntry)
      : 0;

  return Math.abs(settlementDelta);
}

function settlementFormulaDelta(
  settlement: Pick<
    NonNullable<AdminAccountingJournalBatchDetail['settlementSnapshot']>,
    | 'companyOutputVat'
    | 'customerPaymentAmount'
    | 'partnerPayoutAmount'
    | 'partnerWithholdingTotal'
    | 'paymentProcessingFee'
    | 'platformFeeNetRevenue'
  >,
) {
  const platformFeeGross = settlement.platformFeeNetRevenue + settlement.companyOutputVat;

  return (
    settlement.customerPaymentAmount -
    settlement.partnerPayoutAmount -
    settlement.partnerWithholdingTotal -
    settlement.paymentProcessingFee -
    platformFeeGross
  );
}
