import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBookingPaymentClearingEntryDetail } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, shortId } from '../../../../lib/admin-format';
import { FinanceDetailInfoItem } from '../../finance-detail-info-item';
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
  const matchedAmount = matches.reduce((total, match) => {
    return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
  }, 0);
  const remainingAmount = Math.max(0, Math.abs(entry.amount) - matchedAmount);
  const settlementTraceLinks = buildFinanceSettlementTraceLinks(entry);
  const settlementPaymentFee = paymentFeePolicyInfo(entry.settlementSnapshot, entry.currency);

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
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description={`${entry.type} / ${shortId(entry.sourceKey)} · Occurred ${formatDateTime(entry.occurredAt)}`}
        resultLabel={entry.status}
        resultTone={statusTone(entry.status)}
        title="Clearing overview"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <Link className="text-link" href={`/bookings/${entry.bookingId}`}>
                {shortId(entry.bookingId)}
              </Link>
            }
          />
          <FinanceDetailInfoItem label="Payment" value={entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : '-'} />
          <FinanceDetailInfoItem label="Source key" value={entry.sourceKey} />
          <FinanceDetailInfoItem
            label="Settlement payment fee"
            value={
              entry.settlementSnapshot ? (
                <>
                  {formatMoney(entry.settlementSnapshot.paymentProcessingFee, entry.settlementSnapshot.currency ?? entry.currency)}
                  <span className="muted admin-block">
                    {settlementPaymentFee.method} · {settlementPaymentFee.rateBps} bps +{' '}
                    {formatMoney(settlementPaymentFee.fixedAmount, entry.settlementSnapshot.currency ?? entry.currency)}
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
                <Link className="text-link" href={`/payments/${entry.paymentId}`}>
                  {shortId(entry.paymentId)}
                </Link>
              ) : (
                '-'
              )
            }
          />
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
          <FinanceDetailInfoItem label="Cleared at" value={entry.clearedAt ? formatDateTime(entry.clearedAt) : 'Waiting'} />
          <FinanceDetailInfoItem label="Matched amount" value={formatMoney(matchedAmount, entry.currency)} />
          <FinanceDetailInfoItem label="Remaining amount" value={formatMoney(remainingAmount, entry.currency)} />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="Quick links from this clearing row to the payment source, settlement snapshot, journal, and bank match evidence."
        resultLabel={remainingAmount > 0 ? 'Needs match' : 'Fully matched'}
        resultTone={remainingAmount > 0 ? 'warning' : 'success'}
        title="Clearing evidence hub"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem
            label="Source payment"
            value={
              <div className="admin-table-substack">
                {entry.paymentId ? (
                  <Link className="text-link" href={`/payments/${entry.paymentId}`}>
                    Payment {shortId(entry.paymentId)}
                  </Link>
                ) : (
                  <span className="muted">No payment record</span>
                )}
                <Link className="text-link" href={`/bookings/${entry.bookingId}`}>
                  Booking {shortId(entry.bookingId)}
                </Link>
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
          <FinanceDetailInfoItem label="Bank match status" value={`${matches.length} match(es) · ${formatMoney(remainingAmount, entry.currency)} remaining`} />
          <FinanceDetailInfoItem
            label="Latest bank match"
            value={matches[0] ? <BankMatchSummary match={matches[0]} /> : 'No bank match'}
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Bank matches are loaded from this detail endpoint only. Open the bank transaction detail for full reconciliation evidence."
        resultLabel={`${matches.length} match(es)`}
        resultTone="info"
        title="Bank reconciliation matches"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
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
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

function BankMatchSummary({
  match,
}: {
  readonly match: NonNullable<AdminBookingPaymentClearingEntryDetail['bankReconciliationMatches']>[number];
}) {
  return (
    <div className="admin-table-substack">
      {match.bankTransactionId ? (
        <Link className="text-link" href={`/finance-tax/bank-reconciliation/${match.bankTransactionId}`}>
          Bank {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
        </Link>
      ) : (
        <span className="muted">No bank transaction</span>
      )}
      {match.accountingJournalEntry ? (
        <Link className="text-link" href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
          Journal {match.accountingJournalEntry.accountCode}
        </Link>
      ) : (
        <span className="muted">No journal entry</span>
      )}
      <span className="muted">{match.status}</span>
    </div>
  );
}

function statusTone(status: string): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'CLEARED') {
    return 'success';
  }
  if (status === 'PARTIALLY_CLEARED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
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

function paymentFeePolicyInfo(
  settlement: AdminBookingPaymentClearingEntryDetail['settlementSnapshot'] | null | undefined,
  fallbackCurrency: string,
) {
  const ruleSnapshot = jsonRecord(settlement?.paymentFeeRuleSnapshot);
  return {
    fixedAmount: settlement?.paymentFeeFixedAmount ?? 0,
    method: stringValue(ruleSnapshot?.method) ?? settlement?.paymentMethod ?? '-',
    payer: settlement?.paymentFeePayer ?? '-',
    policyName: stringValue(ruleSnapshot?.policyName) ?? '-',
    rateBps: settlement?.paymentFeeRateBps ?? 0,
    treatment: settlement?.paymentFeeTreatment ?? '-',
    currency: settlement?.currency ?? fallbackCurrency,
  };
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
