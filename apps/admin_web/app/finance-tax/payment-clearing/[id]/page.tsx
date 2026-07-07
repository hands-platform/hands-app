import { notFound } from 'next/navigation';

import type { AdminBookingPaymentClearingEntryDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../../components/status-badge';
import { shortId } from '../../../../lib/admin-format';
import { FinanceBankMatchEvidence } from '../../finance-bank-match-evidence';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import {
  financeBankReconciliationStatusPill,
  financePaymentClearingStatusTone,
} from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
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
  const latestActiveMatch = matches.find((match) => match.status !== 'REVERSED') ?? null;
  const matchedAmount = matches.reduce((total, match) => {
    return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
  }, 0);
  const remainingAmount = Math.max(0, Math.abs(entry.amount) - matchedAmount);
  const settlementTraceLinks = buildFinanceSettlementTraceLinks(entry);
  const settlementPaymentFee = paymentFeePolicyInfo(entry.settlementSnapshot, entry.currency);

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href={paymentClearingHref({ page: 1, range: '30d', review: 'open', take: 25 })}>
          Back to clearing
        </AdminFormControlLink>
      }
      description="Evidence for one booking payment clearing row. Open this only when finance needs source, settlement, or bank matching detail."
      metrics={[
        { helper: 'Clearing state.', label: 'Status', value: entry.status },
        { helper: 'Clearing row amount.', label: 'Amount', value: <MoneyText amount={entry.amount} currency={entry.currency} /> },
        { helper: 'Bank reconciliation evidence linked to this row.', label: 'Matches', value: matches.length },
        { helper: 'Clearing source type.', label: 'Type', value: entry.type },
      ]}
      title="Payment Clearing Detail"
    >
      <FinanceTablePanel
        description={
          <>
            {entry.type} / {shortId(entry.sourceKey)} · Occurred <DateTimeText value={entry.occurredAt} />
          </>
        }
        resultLabel={entry.status}
        resultTone={financePaymentClearingStatusTone(entry.status)}
        title="Clearing overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <AdminTextLink href={`/bookings/${entry.bookingId}`}>
                {shortId(entry.bookingId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Payment" value={entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : '-'} />
          <FinanceDetailInfoItem label="Source key" value={entry.sourceKey} />
          <FinanceDetailInfoItem
            label="Settlement payment fee"
            value={
              entry.settlementSnapshot ? (
                <>
                  <MoneyText
                    amount={entry.settlementSnapshot.paymentProcessingFee}
                    currency={entry.settlementSnapshot.currency ?? entry.currency}
                  />
                  <span className="muted admin-block">
                    {paymentFeeBasisLabel(
                      settlementPaymentFee,
                      entry.settlementSnapshot.currency ?? entry.currency,
                      entry.settlementSnapshot.paymentProcessingFee,
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
          <FinanceDetailInfoItem
            label="Payment record"
            value={
              entry.paymentId ? (
                <AdminTextLink href={`/payments/${entry.paymentId}`}>
                  {shortId(entry.paymentId)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
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
          <FinanceDetailInfoItem
            label="Cleared at"
            value={entry.clearedAt ? <DateTimeText value={entry.clearedAt} /> : 'Waiting'}
          />
          <FinanceDetailInfoItem label="Matched amount" value={<MoneyText amount={matchedAmount} currency={entry.currency} />} />
          <FinanceDetailInfoItem label="Remaining amount" value={<MoneyText amount={remainingAmount} currency={entry.currency} />} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Quick links from this clearing row to the payment source, settlement snapshot, journal, and bank match evidence."
        resultLabel={remainingAmount > 0 ? 'Needs match' : 'Fully matched'}
        resultTone={remainingAmount > 0 ? 'warning' : 'success'}
        title="Clearing evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="Payment clearing operating path"
          steps={[
            {
              detail: `Booking ${shortId(entry.bookingId)}`,
              label: 'Payment source',
              value: entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : entry.type,
            },
            {
              detail: entry.status,
              label: 'Clearing row',
              value: <MoneyText amount={entry.amount} currency={entry.currency} />,
            },
            {
              detail: settlementPaymentFee.policyVersionId,
              label: 'Settlement evidence',
              value: paymentClearingSettlementLabel(entry, settlementTraceLinks.length),
            },
            {
              detail: paymentClearingNextAction(entry.status, remainingAmount, latestActiveMatch),
              label: 'Bank closeout',
              value: paymentClearingBankMatchLabel(latestActiveMatch, remainingAmount, entry.currency),
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Source payment"
            value={
              <AdminTableSubstack>
                {entry.paymentId ? (
                  <AdminTextLink href={`/payments/${entry.paymentId}`}>
                    Payment {shortId(entry.paymentId)}
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>No payment record</AdminInlineFallback>
                )}
                <AdminTextLink href={`/bookings/${entry.bookingId}`}>
                  Booking {shortId(entry.bookingId)}
                </AdminTextLink>
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
            label="Bank match status"
            value={
              <>
                {matches.length} match(es) · <MoneyText amount={remainingAmount} currency={entry.currency} /> remaining
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Latest bank match"
            value={
              <FinanceBankMatchEvidence
                matches={matches[0] ? [matches[0]] : []}
                showAmount={false}
                showJournalLink
                showPaymentClearingLink={false}
              />
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Bank matches are loaded from this detail endpoint only. Open the bank transaction detail for full reconciliation evidence."
        resultLabel={`${matches.length} match(es)`}
        resultTone="info"
        title="Bank reconciliation matches"
      >
        <FinanceDataTable
            emptyMessage="No bank reconciliation matches are linked to this clearing row."
            headers={['Bank transaction', 'Journal entry', 'Counterparty', 'Amount', 'Matched', 'Status']}
            rowCount={matches.length}
          >
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  {match.bankTransactionId ? (
                    <AdminTextLink href={`/finance-tax/bank-reconciliation/${match.bankTransactionId}`}>
                      {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
                    </AdminTextLink>
                  ) : (
                    <AdminInlineFallback>No bank transaction</AdminInlineFallback>
                  )}
                  {match.bankTransaction?.type ? (
                    <div className="muted">{match.bankTransaction.type}</div>
                  ) : (
                    <AdminInlineFallback className="admin-mt-6">No bank type</AdminInlineFallback>
                  )}
                </td>
                <td>
                  {match.accountingJournalEntry ? (
                    <>
                      <AdminTextLink href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                        {match.accountingJournalEntry.accountCode}
                      </AdminTextLink>
                      <div className="muted">{match.accountingJournalEntry.accountName}</div>
                    </>
                  ) : (
                    <AdminInlineFallback>No journal entry</AdminInlineFallback>
                  )}
                </td>
                <td>
                  {match.bankTransaction?.counterpartyName ? (
                    match.bankTransaction.counterpartyName
                  ) : (
                    <AdminInlineFallback>No counterparty</AdminInlineFallback>
                  )}
                </td>
                <td>
                  <strong>
                    <MoneyText amount={match.amount} currency={match.currency} />
                  </strong>
                  {match.bankTransaction ? (
                    <div className="muted">
                      Bank{' '}
                      <MoneyText
                        amount={match.bankTransaction.amount}
                        currency={match.bankTransaction.currency}
                      />
                    </div>
                  ) : null}
                </td>
                <td>
                  <DateTimeText value={match.matchedAt} />
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={financeBankReconciliationStatusPill(match.status)}>
                    {match.status}
                  </StatusBadgeFromPillClass>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function paymentClearingSettlementLabel(entry: AdminBookingPaymentClearingEntryDetail, settlementTraceCount: number) {
  if (entry.settlementSnapshot) {
    return `Settlement ${shortId(entry.settlementSnapshot.id)}`;
  }
  if (entry.settlementReversalEntry) {
    return `Reversal ${shortId(entry.settlementReversalEntry.id)}`;
  }
  if (settlementTraceCount > 0) {
    return `${settlementTraceCount} linked trace(s)`;
  }
  return 'No settlement trace';
}

function paymentClearingBankMatchLabel(
  match: NonNullable<AdminBookingPaymentClearingEntryDetail['bankReconciliationMatches']>[number] | null,
  remainingAmount: number,
  currency: string,
) {
  if (match?.bankTransaction) {
    return match.bankTransaction.transferRef ?? `Bank ${shortId(match.bankTransaction.id)}`;
  }
  if (remainingAmount <= 0) {
    return 'Fully matched';
  }
  return <MoneyText amount={remainingAmount} currency={currency} />;
}

function paymentClearingNextAction(
  status: string,
  remainingAmount: number,
  match: NonNullable<AdminBookingPaymentClearingEntryDetail['bankReconciliationMatches']>[number] | null,
) {
  if (remainingAmount <= 0 || status === 'CLEARED') {
    return 'Ready for closeout';
  }
  if (match?.status === 'PARTIALLY_MATCHED') {
    return 'Match remaining amount';
  }
  return 'Match bank transaction';
}

function paymentFeePolicyInfo(
  settlement: AdminBookingPaymentClearingEntryDetail['settlementSnapshot'] | null | undefined,
  fallbackCurrency: string,
) {
  const ruleSnapshot = jsonRecord(settlement?.paymentFeeRuleSnapshot);
  const hasPolicySnapshot = Boolean(
    settlement?.paymentFeePolicyVersionId ||
      stringValue(ruleSnapshot?.policyName) ||
      stringValue(ruleSnapshot?.feeType),
  );
  return {
    fixedAmount: settlement?.paymentFeeFixedAmount ?? 0,
    method: stringValue(ruleSnapshot?.method) ?? settlement?.paymentMethod ?? '-',
    payer: settlement?.paymentFeePayer ?? '-',
    policyName: stringValue(ruleSnapshot?.policyName) ?? (hasPolicySnapshot ? '-' : 'Legacy/manual fee evidence'),
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

function jsonRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
