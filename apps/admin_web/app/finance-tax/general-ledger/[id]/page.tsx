import { notFound } from 'next/navigation';

import type { AdminAccountingJournalBatchDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadge } from '../../../../components/status-badge';
import { readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceBankMatchEvidence } from '../../finance-bank-match-evidence';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { financeJournalBatchStatusTone } from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  buildAccountingJournalBatchDetailApiHref,
  buildFinanceSettlementTraceLinks,
  generalLedgerHref,
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
  const settlementPaymentFee = paymentFeePolicyInfo(batch.settlementSnapshot, batch.currency);

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href={generalLedgerHref({ page: 1, range: '30d', review: 'posted', take: 25 })}>
          Back to ledger
        </AdminFormControlLink>
      }
      description="Entry-level accounting evidence for a single finance source record. Lists stay light; this page loads journal entries only when opened."
      metrics={[
        { helper: 'Journal batch status.', label: 'Status', value: batch.status },
        { helper: 'Monthly tax/accounting period.', label: 'Period', value: batch.monthlyPeriod ?? '-' },
        { helper: 'Batch debit total.', label: 'Debit', value: <MoneyText amount={batch.totalDebit} currency={batch.currency} /> },
        { helper: 'Batch credit total.', label: 'Credit', value: <MoneyText amount={batch.totalCredit} currency={batch.currency} /> },
      ]}
      title="General Ledger Detail"
    >
      <FinanceTablePanel
        description={
          <>
            {batch.sourceType} / {shortId(batch.sourceId)} · Posted <DateTimeText value={batch.postedAt} />
          </>
        }
        resultLabel={batch.status}
        resultTone={financeJournalBatchStatusTone(batch.status)}
        title="Journal batch overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Source key" value={batch.sourceKey} />
          <FinanceDetailInfoItem label="Double-entry check" value={journalBalanceLabel(batch)} />
          <FinanceDetailInfoItem
            label="Monthly close blocker"
            value={
              formulaDelta === 0 ? (
                'No formula delta'
              ) : (
                <>
                  Formula delta <MoneyText amount={formulaDelta} currency={batch.currency} />
                </>
              )
            }
          />
          <FinanceDetailInfoItem label="Debit total" value={<MoneyText amount={batch.totalDebit} currency={batch.currency} />} />
          <FinanceDetailInfoItem label="Credit total" value={<MoneyText amount={batch.totalCredit} currency={batch.currency} />} />
          <FinanceDetailInfoItem label="Balance delta" value={<MoneyText amount={balanceDelta} currency={batch.currency} />} />
          <FinanceDetailInfoItem
            label="Booking"
            value={
              batch.bookingId ? (
                <AdminTextLink href={`/bookings/${batch.bookingId}`}>
                  {shortId(batch.bookingId)}
                </AdminTextLink>
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
                <AdminTableSubstack>
                  {settlementTraceLinks.map((link) => (
                    <AdminTextLink href={link.href} key={link.label}>
                      {link.label} <span className="muted">{link.value}</span>
                    </AdminTextLink>
                  ))}
                </AdminTableSubstack>
              ) : (
                '-'
              )
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Quick route from this journal batch back to the source record, settlement snapshot, clearing row, and bank evidence."
        resultLabel={balanceDelta === 0 ? 'Balanced' : 'Unbalanced'}
        resultTone={balanceDelta === 0 ? 'success' : 'danger'}
        title="Journal evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="General ledger operating path"
          steps={[
            {
              detail: batch.sourceType,
              label: 'Finance source',
              value: journalSourceLabel(batch, settlementTraceLinks.length),
            },
            {
              detail: batch.monthlyPeriod ?? 'No monthly period',
              label: 'Journal batch',
              value: batch.status,
            },
            {
              detail: `${batch.entries.length} journal row(s)`,
              label: 'Double-entry',
              value: journalBalanceLabel(batch),
            },
            {
              detail: journalNextAction(balanceDelta, formulaDelta),
              label: 'Monthly close',
              value: journalCloseoutLabel(balanceDelta, formulaDelta, batch.currency),
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Source record"
            value={
              <AdminTableSubstack>
                <strong>{batch.sourceType}</strong>
                <span className="muted">{batch.sourceKey}</span>
              </AdminTableSubstack>
            }
          />
          <FinanceDetailInfoItem
            label="Linked settlement"
            value={
              settlementTraceLinks.length > 0 ? (
                <AdminTableSubstack>
                  {settlementTraceLinks.map((link) => (
                    <AdminTextLink href={link.href} key={link.label}>
                      {link.label} <span className="muted">{link.value}</span>
                    </AdminTextLink>
                  ))}
                </AdminTableSubstack>
              ) : (
                'No settlement link'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Settlement payment fee"
            value={
              batch.settlementSnapshot ? (
                <>
                  <MoneyText
                    amount={batch.settlementSnapshot.paymentProcessingFee}
                    currency={batch.settlementSnapshot.currency}
                  />
                  <span className="muted admin-block">
                    {paymentFeeBasisLabel(
                      settlementPaymentFee,
                      batch.settlementSnapshot.currency,
                      batch.settlementSnapshot.paymentProcessingFee,
                    )}
                  </span>
                  <span className="muted admin-block">
                    {settlementPaymentFee.policyVersionId}
                  </span>
                  <span className="muted admin-block">
                    {settlementPaymentFee.payer} / {settlementPaymentFee.treatment}
                  </span>
                </>
              ) : (
                '-'
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
            value={<FinanceBankMatchEvidence className="stack" matches={bankMatches[0] ? [bankMatches[0]] : []} />}
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Debits and credits posted by the source record. Bank match count is shown without loading unrelated bank transaction lists."
        resultLabel={`${batch.entries.length} entry row(s)`}
        resultTone="info"
        title="Journal entries"
      >
        <FinanceDataTable
            emptyMessage="No journal entries were recorded for this batch."
            headers={['Side', 'Account', 'Amount', 'Memo', 'Source', 'Bank match']}
            rowCount={batch.entries.length}
          >
            {batch.entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <StatusBadge tone={entry.side === 'DEBIT' ? 'info' : 'success'}>
                    {entry.side}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{entry.accountCode}</strong>
                  <div className="muted">{entry.accountName}</div>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={entry.amount} currency={entry.currency} />
                  </strong>
                  <div className="muted">
                    <DateTimeText value={entry.createdAt} />
                  </div>
                </td>
                <td>{entry.memo ?? '-'}</td>
                <td>
                  <strong>{entry.sourceType ?? batch.sourceType}</strong>
                  <div className="muted">{shortId(entry.sourceId ?? batch.sourceId)}</div>
                </td>
                <td>
                  <FinanceBankMatchEvidence className="stack" matches={entry.bankReconciliationMatches ?? []} />
                </td>
              </tr>
            ))}
          </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function journalSourceLabel(batch: AdminAccountingJournalBatchDetail, settlementTraceCount: number) {
  if (batch.settlementSnapshot) {
    return `Settlement ${shortId(batch.settlementSnapshot.id)}`;
  }
  if (batch.settlementReversalEntry) {
    return `Reversal ${shortId(batch.settlementReversalEntry.id)}`;
  }
  if (batch.payment) {
    return `Payment ${batch.payment.method} · ${batch.payment.status}`;
  }
  if (settlementTraceCount > 0) {
    return `${settlementTraceCount} linked trace(s)`;
  }
  return shortId(batch.sourceId);
}

function journalCloseoutLabel(balanceDelta: number, formulaDelta: number, currency: string) {
  if (balanceDelta > 0) {
    return (
      <>
        Balance delta <MoneyText amount={balanceDelta} currency={currency} />
      </>
    );
  }
  if (formulaDelta > 0) {
    return (
      <>
        Formula delta <MoneyText amount={formulaDelta} currency={currency} />
      </>
    );
  }
  return 'Clear';
}

function journalNextAction(balanceDelta: number, formulaDelta: number) {
  if (balanceDelta > 0) {
    return 'Fix debit/credit delta';
  }
  if (formulaDelta > 0) {
    return 'Resolve formula delta';
  }
  return 'Ready for monthly close checks';
}

function journalBalanceLabel(batch: AdminAccountingJournalBatchDetail) {
  const delta = batch.totalDebit - batch.totalCredit;
  if (delta === 0) {
    return 'Balanced';
  }

  return (
    <>
      Delta <MoneyText amount={Math.abs(delta)} currency={batch.currency} />
    </>
  );
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

function paymentFeePolicyInfo(
  settlement: AdminAccountingJournalBatchDetail['settlementSnapshot'] | null | undefined,
  fallbackCurrency: string,
) {
  const ruleSnapshot = readPlainRecord(settlement?.paymentFeeRuleSnapshot);
  const hasPolicySnapshot = Boolean(
    settlement?.paymentFeePolicyVersionId ||
      stringValue(ruleSnapshot?.policyName) ||
      stringValue(ruleSnapshot?.feeType),
  );
  return {
    fixedAmount: settlement?.paymentFeeFixedAmount ?? 0,
    method: stringValue(ruleSnapshot?.method) ?? settlement?.paymentMethod ?? '-',
    payer: settlement?.paymentFeePayer ?? '-',
    policyVersionId: settlement?.paymentFeePolicyVersionId ?? (hasPolicySnapshot ? '-' : 'Policy snapshot missing'),
    rateBps: settlement?.paymentFeeRateBps ?? 0,
    treatment: settlement?.paymentFeeTreatment ?? '-',
    currency: settlement?.currency ?? fallbackCurrency,
  };
}

function paymentFeeBasisLabel(
  paymentFee: ReturnType<typeof paymentFeePolicyInfo>,
  currency: string,
  recordedFee: number,
) {
  if (recordedFee > 0 && paymentFee.rateBps === 0 && paymentFee.fixedAmount === 0) {
    return `${paymentFee.method} · legacy/manual fee evidence`;
  }
  return (
    <>
      {paymentFee.method} · {paymentFee.rateBps} bps +{' '}
      <MoneyText amount={paymentFee.fixedAmount} currency={currency} />
    </>
  );
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
