import { notFound } from 'next/navigation';

import type {
  AdminAccountingJournalBatchDetail,
  AdminAccountingJournalIntegrity,
} from '../../../../lib/admin-api';
import { adminGetResult } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { AdminErrorState } from '../../../../components/admin-surface';
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
  safeGeneralLedgerReturnTo,
} from '../../tax-settlement-page-model';

type GeneralLedgerDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GeneralLedgerDetailPage({ params, searchParams }: GeneralLedgerDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const query = searchParams ? await searchParams : {};
  const returnTo = safeGeneralLedgerReturnTo(readParam(query, 'returnTo'));
  const batchResult = await adminGetResult<AdminAccountingJournalBatchDetail | null>(
    buildAccountingJournalBatchDetailApiHref(id),
    null,
  );
  if (!batchResult.ok && batchResult.status === 404) {
    notFound();
  }
  if (!batchResult.ok || !batchResult.data) {
    const errorCopy = journalDetailErrorCopy(batchResult.status);
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to results</AdminFormControlLink>}
        description="The journal batch API did not return authoritative accounting evidence."
        title="Journal Batch Detail"
      >
        <AdminErrorState
          action={
            <AdminFormControlLink
              href={`/finance-tax/general-ledger/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(returnTo)}`}
            >
              Retry
            </AdminFormControlLink>
          }
          message={errorCopy.message}
          title={errorCopy.title}
        />
      </AdminPageTemplate>
    );
  }
  const batch = batchResult.data;
  const settlementRecordLinks = buildFinanceSettlementTraceLinks(batch);
  const integrity = batch.integrity;
  const bankMatches = batch.entries.flatMap((entry) => entry.bankReconciliationMatches ?? []);
  const settlementPaymentFee = paymentFeePolicyInfo(batch.settlementSnapshot, batch.currency);
  const reversalEvidence = batch.settlementReversalEntry;

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href={returnTo}>
          Back to results
        </AdminFormControlLink>
      }
      description="Entry-level accounting evidence for a single finance record. Lists stay light; this page loads journal entries only when opened."
      metrics={[
        { helper: 'Server-authoritative integrity state.', kind: 'record', label: 'Integrity', scope: 'Journal batch', value: integrity?.state ?? 'UNKNOWN' },
        { helper: integrity?.blockerCodes[0] ? journalBlockerLabel(integrity.blockerCodes[0]) : integrity?.state === 'CLEAR' ? 'No integrity blockers.' : 'Evidence could not be evaluated.', kind: 'record', label: 'Blockers', scope: integrity?.state === 'BLOCKED' ? 'Action required' : 'Journal batch', value: integrity?.blockerCodes.length ?? 'Unknown' },
        { helper: journalNextAction(integrity?.state), kind: 'record', label: 'Maximum discrepancy', scope: 'Integrity evidence', value: integrity ? <MoneyText amount={integrity.discrepancyAmount} currency={batch.currency} /> : 'Unavailable' },
        { helper: 'One server evaluation is reused by detail, list, closeout, and export.', kind: 'record', label: 'Checked at', scope: 'Integrity evidence', value: integrity ? <DateTimeText value={integrity.checkedAt} /> : 'Unavailable' },
      ]}
      title="Journal Batch Detail"
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
          <FinanceDetailInfoItem label="Record key" value={batch.sourceKey} />
          <FinanceDetailInfoItem
            label="Integrity result"
            value={
              <StatusBadge tone={journalIntegrityTone(integrity?.state)}>
                {integrity?.state ?? 'UNKNOWN'}
              </StatusBadge>
            }
          />
          <FinanceDetailInfoItem label="Header debit" value={<MoneyText amount={batch.totalDebit} currency={batch.currency} />} />
          <FinanceDetailInfoItem label="Header credit" value={<MoneyText amount={batch.totalCredit} currency={batch.currency} />} />
          <FinanceDetailInfoItem label="Entry debit" value={integrity ? <MoneyText amount={integrity.entryDebit} currency={batch.currency} /> : 'Unavailable'} />
          <FinanceDetailInfoItem label="Entry credit" value={integrity ? <MoneyText amount={integrity.entryCredit} currency={batch.currency} /> : 'Unavailable'} />
          <FinanceDetailInfoItem label="Entry count" value={integrity ? integrity.entryCount : 'Unavailable'} />
          <FinanceDetailInfoItem
            label="Formula delta"
            value={
              integrity?.formulaDelta === null || integrity?.formulaDelta === undefined
                ? 'Evidence unavailable or not applicable'
                : <MoneyText amount={integrity.formulaDelta} currency={batch.currency} />
            }
          />
          <FinanceDetailInfoItem
            label="Maximum discrepancy"
            value={integrity ? <MoneyText amount={integrity.discrepancyAmount} currency={batch.currency} /> : 'Unavailable'}
          />
          <FinanceDetailInfoItem
            label="Closeout blockers"
            value={
              integrity?.blockerCodes.length
                ? integrity.blockerCodes.map(journalBlockerLabel).join(' · ')
                : integrity?.state === 'CLEAR'
                  ? 'None'
                  : 'Integrity evidence unavailable'
            }
          />
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
          {reversalEvidence ? (
            <>
              <FinanceDetailInfoItem
                label="Original settlement"
                value={
                  <AdminTextLink href={`/finance-tax/booking-settlement-audit/${reversalEvidence.originalSettlementSnapshotId}`}>
                    {shortId(reversalEvidence.originalSettlementSnapshotId)}
                  </AdminTextLink>
                }
              />
              <FinanceDetailInfoItem
                label="Reversal reason"
                value={reversalEvidence.reason ?? '-'}
              />
              <FinanceDetailInfoItem
                label="Reversal posted"
                value={
                  <DateTimeText value={reversalEvidence.occurredAt} />
                }
              />
              <FinanceDetailInfoItem
                label="Reversal recorded by"
                value={reversalEvidence.createdById ?? 'System or historical record'}
              />
              <FinanceDetailInfoItem
                label="Approval evidence"
                value="No canonical approval field is recorded on this reversal."
              />
            </>
          ) : null}
          <FinanceDetailInfoItem
            label="Settlement links"
            value={
              settlementRecordLinks.length > 0 ? (
                <AdminTableSubstack>
                  {settlementRecordLinks.map((link) => (
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
        description="Quick route from this journal batch back to the finance record, settlement record, clearing row, and bank evidence."
        resultLabel={integrity?.state ?? 'Integrity unavailable'}
        resultTone={journalIntegrityTone(integrity?.state)}
        title="Journal evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="Journal batch operating path"
          steps={[
            {
              detail: batch.sourceType,
              label: 'Finance record',
              value: journalSourceLabel(batch, settlementRecordLinks.length),
            },
            {
              detail: batch.monthlyPeriod ?? 'No monthly period',
              label: 'Journal batch',
              value: batch.status,
            },
            {
              detail: `${batch.entries.length} journal row(s)`,
              label: 'Double-entry',
              value: integrity?.checks.entriesBalanced ?? 'UNKNOWN',
            },
            {
              detail: journalNextAction(integrity?.state),
              label: 'Monthly close',
              value: journalCloseoutLabel(batch),
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Finance record"
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
              settlementRecordLinks.length > 0 ? (
                <AdminTableSubstack>
                  {settlementRecordLinks.map((link) => (
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
            label="Monthly close status"
            value={
              integrity?.state === 'CLEAR'
                ? 'Ready for monthly close checks'
                : integrity?.state === 'BLOCKED'
                  ? 'Blocked until integrity discrepancies are resolved'
                  : 'Blocked until integrity evidence is available'
            }
          />
          <FinanceDetailInfoItem
            label="Latest bank evidence"
            value={<FinanceBankMatchEvidence className="stack" matches={bankMatches[0] ? [bankMatches[0]] : []} />}
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Debits and credits posted by the finance record. Bank match count is shown without loading unrelated bank transaction lists."
        resultLabel={`${batch.entries.length} entry row(s)`}
        resultTone="info"
        title="Journal batch entries"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Entry debit total"
            value={integrity ? <MoneyText amount={integrity.entryDebit} currency={batch.currency} /> : 'Unavailable'}
          />
          <FinanceDetailInfoItem
            label="Entry credit total"
            value={integrity ? <MoneyText amount={integrity.entryCredit} currency={batch.currency} /> : 'Unavailable'}
          />
          <FinanceDetailInfoItem
            label="Entry balance delta"
            value={integrity ? <MoneyText amount={Math.abs(integrity.entryDebit - integrity.entryCredit)} currency={batch.currency} /> : 'Unavailable'}
          />
          <FinanceDetailInfoItem
            label="Header debit difference"
            value={integrity ? <MoneyText amount={Math.abs(batch.totalDebit - integrity.entryDebit)} currency={batch.currency} /> : 'Unavailable'}
          />
          <FinanceDetailInfoItem
            label="Header credit difference"
            value={integrity ? <MoneyText amount={Math.abs(batch.totalCredit - integrity.entryCredit)} currency={batch.currency} /> : 'Unavailable'}
          />
        </FinanceDetailGrid>
        <FinanceDataTable
          ariaLabel="Journal batch accounting entries"
            emptyMessage="No journal entries were recorded for this batch."
            headers={['Side', 'Account', 'Amount', 'Memo', 'Record', 'Bank match']}
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

function journalSourceLabel(batch: AdminAccountingJournalBatchDetail, settlementRecordLinkCount: number) {
  if (batch.settlementSnapshot) {
    return `Settlement ${shortId(batch.settlementSnapshot.id)}`;
  }
  if (batch.settlementReversalEntry) {
    return `Reversal ${shortId(batch.settlementReversalEntry.id)}`;
  }
  if (batch.payment) {
    return `Payment ${batch.payment.method} · ${batch.payment.status}`;
  }
  if (settlementRecordLinkCount > 0) {
    return `${settlementRecordLinkCount} linked record(s)`;
  }
  return shortId(batch.sourceId);
}

function journalCloseoutLabel(batch: AdminAccountingJournalBatchDetail) {
  if (batch.integrity?.state === 'BLOCKED') {
    return (
      <>
        Blocked · max discrepancy{' '}
        <MoneyText amount={batch.integrity.discrepancyAmount} currency={batch.currency} />
      </>
    );
  }
  return batch.integrity?.state === 'CLEAR' ? 'Clear' : 'Evidence unknown';
}

function journalNextAction(state: AdminAccountingJournalIntegrity['state'] | undefined) {
  if (state === 'BLOCKED') return 'Resolve recorded integrity blockers';
  if (state === 'UNKNOWN') return 'Recover missing source evidence';
  return state === 'CLEAR' ? 'Ready for monthly close checks' : 'Retry integrity evaluation';
}

function journalIntegrityTone(state: 'BLOCKED' | 'CLEAR' | 'UNKNOWN' | undefined) {
  if (state === 'CLEAR') return 'success' as const;
  if (state === 'BLOCKED') return 'danger' as const;
  return 'warning' as const;
}

function journalBlockerLabel(
  code: NonNullable<AdminAccountingJournalBatchDetail['integrity']>['blockerCodes'][number],
) {
  const labels: Record<typeof code, string> = {
    ENTRY_UNBALANCED: 'Entry debit/credit mismatch',
    FORMULA_DELTA: 'Formula delta',
    FORMULA_EVIDENCE_MISSING: 'Formula evidence missing',
    HEADER_ENTRY_MISMATCH: 'Header/entry mismatch',
    HEADER_UNBALANCED: 'Header debit/credit mismatch',
    PERIOD_EVIDENCE_MISSING: 'Period evidence missing',
    PERIOD_MISMATCH: 'Accounting period mismatch',
    POSTED_WITHOUT_ENTRIES: 'Posted without entries',
  };
  return labels[code];
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
    policyVersionId: settlement?.paymentFeePolicyVersionId ?? (hasPolicySnapshot ? '-' : 'Policy record missing'),
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

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function journalDetailErrorCopy(status: number | null) {
  if (status === 401 || status === 403) {
    return {
      message: 'Your Admin session does not have permission to view this journal batch. Sign in with Finance access or ask an administrator to review your role.',
      title: 'Journal batch permission required',
    };
  }
  return {
    message: 'This journal batch could not be loaded. No integrity or zero-balance assumption has been made.',
    title: 'Journal batch unavailable',
  };
}
