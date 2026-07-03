import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBookingSettlementReversalEntry } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bookingSettlementAuditDetailHref,
  bookingSettlementReversalHref,
  buildBookingSettlementReversalDetailApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalTraceLinks,
  monthlyTaxClosingHref,
  TAX_SETTLEMENT_DEFAULT_TAKE,
} from '../../tax-settlement-page-model';

type SettlementReversalDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
};

export default async function SettlementReversalDetailPage({ params }: SettlementReversalDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const reversal = await adminGet<AdminBookingSettlementReversalEntry | null>(
    buildBookingSettlementReversalDetailApiHref(id),
    null,
  );
  if (!reversal) {
    notFound();
  }

  const evidenceState = buildBookingSettlementReversalEvidenceState(reversal);
  const traceLinks = buildBookingSettlementReversalTraceLinks(reversal);
  const originalSettlement = reversal.originalSettlementSnapshot ?? null;
  const reversalJournal = reversal.accountingJournalBatches?.[0] ?? null;
  const journalBalanceDelta = reversalJournal
    ? Math.abs(reversalJournal.totalDebit - reversalJournal.totalCredit)
    : null;
  const reversalClearing = reversal.paymentClearingEntries?.[0] ?? null;
  const bankClearing = bankClearingEvidence(reversalClearing, reversal.currency);
  const allocationDelta = reversalAllocationDelta(reversal);
  const payoutRefundEvidence = payoutRefundReceivableEvidence(reversal);
  const originalMonthlyClosingHref = monthlyTaxClosingHref({
    page: 1,
    period: reversal.originalMonthlyPeriod,
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  });
  const reversalMonthlyClosingHref = monthlyTaxClosingHref({
    page: 1,
    period: reversal.monthlyPeriod,
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  });

  return (
    <AdminPageTemplate
      actions={
        <Link
          className="button button-secondary"
          href={bookingSettlementReversalHref({ page: 1, range: '30d', review: 'all', take: 25 })}
        >
          Back to reversals
        </Link>
      }
      description="Single closed-period settlement reversal record with refund, journal, clearing, and original settlement evidence."
      metrics={[
        { helper: 'Reversal settlement state.', label: 'Settlement', value: reversal.settlementStatus },
        { helper: 'Tax reversal state.', label: 'Tax status', value: reversal.taxStatus },
        {
          helper: 'Customer payment amount reversed by this record.',
          label: 'Customer reversal',
          value: formatMoney(reversal.customerPaymentAmount, reversal.currency),
        },
        {
          helper: 'Partner payout amount reversed by this record.',
          label: 'Partner reversal',
          value: formatMoney(reversal.partnerPayoutAmount, reversal.currency),
        },
      ]}
      title="Settlement Reversal Detail"
    >
      <FinanceTablePanel
        description={`Reversal ID ${shortId(reversal.id)} · Occurred ${formatDateTime(reversal.occurredAt)} · Period ${reversal.monthlyPeriod}`}
        resultLabel={evidenceState.label}
        resultTone={evidenceState.tone}
        title="Refund after payout evidence"
      >
        <FinanceOperatingPath
          ariaLabel="Settlement reversal operating path"
          steps={[
            {
              detail: originalSettlement?.settlementStatus ?? 'Snapshot retained',
              label: 'Original settlement',
              value: shortId(reversal.originalSettlementSnapshotId),
            },
            {
              detail: `Delta ${formatMoney(allocationDelta, reversal.currency)}`,
              label: 'Reversal impact',
              value: allocationDelta === 0 ? 'Balanced' : 'Review required',
            },
            {
              detail: evidenceState.detail,
              label: 'Journal / clearing',
              value: evidenceState.label,
            },
            {
              detail: payoutRefundEvidence.treatment,
              label: 'Closeout action',
              value: reversalCloseoutLabel(reversal, allocationDelta, evidenceState.label),
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <Link className="text-link" href={`/bookings/${reversal.bookingId}`}>
                {shortId(reversal.bookingId)}
              </Link>
            }
          />
          <FinanceDetailInfoItem
            label="Original settlement"
            value={
              <Link className="text-link" href={bookingSettlementAuditDetailHref(reversal.originalSettlementSnapshotId)}>
                {shortId(reversal.originalSettlementSnapshotId)}
              </Link>
            }
          />
          <FinanceDetailInfoItem label="Payment method" value={reversal.paymentMethod} />
          <FinanceDetailInfoItem
            label="Payment"
            value={
              reversal.paymentId ? (
                <Link className="text-link" href={`/payments/${reversal.paymentId}`}>
                  {shortId(reversal.paymentId)}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Customer"
            value={personName(originalSettlement?.customerProfile?.user, 'Unknown customer')}
          />
          <FinanceDetailInfoItem
            label="Partner"
            value={
              <Link className="text-link" href={`/partners/${reversal.providerProfileId}?section=full`}>
                {originalSettlement?.providerProfile?.displayName ??
                  personName(originalSettlement?.providerProfile?.user, 'Unknown partner')}
              </Link>
            }
          />
          <FinanceDetailInfoItem label="Evidence state" value={evidenceState.detail} />
          <FinanceDetailInfoItem
            label="Paid payout refund"
            value={payoutRefundEvidence.refundAfterPaidPayout ? 'Yes' : 'No'}
          />
          <FinanceDetailInfoItem
            label="Partner receivable treatment"
            value={payoutRefundEvidence.treatment}
          />
          <FinanceDetailInfoItem
            label="Receivable amount"
            value={formatMoney(payoutRefundEvidence.receivableAmount, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Bank clearing check"
            value={
              reversalClearing ? (
                <>
                  {bankClearing.label}
                  <span className="muted admin-block">
                    Matched {formatMoney(bankClearing.matchedAmount, bankClearing.currency)}
                  </span>
                  <span className="muted admin-block">
                    Remaining {formatMoney(bankClearing.remainingAmount, bankClearing.currency)}
                  </span>
                  {bankClearing.latestActiveMatch ? (
                    <Link
                      className="text-link admin-block"
                      href={`/finance-tax/bank-reconciliation/${bankClearing.latestActiveMatch.bankTransactionId}`}
                    >
                      {bankClearing.latestActiveMatch.bankTransaction?.transferRef ??
                        shortId(bankClearing.latestActiveMatch.bankTransactionId)}
                    </Link>
                  ) : null}
                </>
              ) : (
                'No clearing'
              )
            }
          />
          <FinanceDetailInfoItem label="Reason" value={reversal.reason ?? 'Payment refund'} />
          <FinanceDetailInfoItem label="Source key" value={reversal.sourceKey} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Amounts below are the reversal entry values. They should offset the original posted settlement through journal and clearing evidence, not by editing the closed snapshot."
        resultLabel={formatMoney(reversal.customerPaymentAmount, reversal.currency)}
        resultTone="warning"
        title="Reversal accounting impact"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Customer payment reversal"
            value={formatMoney(reversal.customerPaymentAmount, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner payout reversal"
            value={formatMoney(reversal.partnerPayoutAmount, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner taxable revenue"
            value={formatMoney(reversal.partnerTaxableRevenue, reversal.currency)}
          />
          <FinanceDetailInfoItem label="Partner VAT" value={formatMoney(reversal.partnerVatAmount, reversal.currency)} />
          <FinanceDetailInfoItem label="Partner PIT" value={formatMoney(reversal.partnerPitAmount, reversal.currency)} />
          <FinanceDetailInfoItem
            label="Total partner withholding"
            value={formatMoney(reversal.partnerWithholdingTotal, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Platform fee gross"
            value={formatMoney(reversal.platformFeeGross, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Platform net revenue"
            value={formatMoney(reversal.platformFeeNetRevenue, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Company output VAT"
            value={formatMoney(reversal.companyOutputVat, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Payment processing fee"
            value={formatMoney(reversal.paymentProcessingFee, reversal.currency)}
          />
          <FinanceDetailInfoItem
            label="Reversal allocation check"
            value={
              <>
                {allocationDelta === 0 ? 'Balanced' : 'Review required'}
                <span className="muted admin-block">
                  Delta {formatMoney(allocationDelta, reversal.currency)}
                </span>
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Journal balance check"
            value={
              reversalJournal ? (
                <>
                  {journalBalanceDelta === 0 ? 'Balanced' : 'Review required'}
                  <span className="muted admin-block">
                    Debit {formatMoney(reversalJournal.totalDebit, reversal.currency)}
                  </span>
                  <span className="muted admin-block">
                    Credit {formatMoney(reversalJournal.totalCredit, reversal.currency)}
                  </span>
                  {journalBalanceDelta ? (
                    <span className="muted admin-block">
                      Delta {formatMoney(journalBalanceDelta, reversal.currency)}
                    </span>
                  ) : null}
                </>
              ) : (
                'No journal'
              )
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="The original monthly close is read-only. Finance should use this reversal record and its evidence links for correction review."
        resultLabel={`Original tax ${originalSettlement?.taxStatus ?? '-'} lock`}
        resultTone={originalSettlement?.settlementStatus === 'POSTED' ? 'success' : 'info'}
        title="Original settlement lock"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Original period"
            value={
              <Link className="text-link" href={originalMonthlyClosingHref}>
                {reversal.originalMonthlyPeriod}
              </Link>
            }
          />
          <FinanceDetailInfoItem
            label="Reversal period"
            value={
              <Link className="text-link" href={reversalMonthlyClosingHref}>
                {reversal.monthlyPeriod}
              </Link>
            }
          />
          <FinanceDetailInfoItem
            label="Original closing"
            value={
              <Link className="text-link" href={originalMonthlyClosingHref}>
                {shortId(reversal.originalMonthlyClosingId)}
              </Link>
            }
          />
          <FinanceDetailInfoItem
            label="Original posted"
            value={originalSettlement?.postedAt ? formatDateTime(originalSettlement.postedAt) : '-'}
          />
          <FinanceDetailInfoItem label="Original tax status" value={originalSettlement?.taxStatus ?? '-'} />
          <FinanceDetailInfoItem label="Original booking status" value={originalSettlement?.booking?.status ?? '-'} />
          <FinanceDetailInfoItem label="Correction method" value="Reversal entry only" />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Open each evidence record to compare the original monthly close, reversal monthly close, journal, clearing, bank match, and immutable original settlement snapshot."
        resultLabel={`${traceLinks.length} link(s)`}
        resultTone="info"
        title="Reversal evidence links"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No reversal evidence links are available."
            headers={['Evidence', 'Record', 'Status', 'Source']}
            rowCount={traceLinks.length}
          >
            {traceLinks.map((link) => (
              <tr key={link.label}>
                <td>
                  <Link className="text-link" href={link.href}>
                    {link.label}
                  </Link>
                </td>
                <td>{link.value}</td>
                <td>{evidenceStatusForLink(link.label, reversal)}</td>
                <td>{evidenceSourceForLink(link.label, reversal)}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function personName(user: { fullName?: string | null; phone?: string | null } | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? fallback;
}

function reversalAllocationDelta(reversal: AdminBookingSettlementReversalEntry) {
  return (
    reversal.customerPaymentAmount -
    reversal.partnerPayoutAmount -
    reversal.partnerWithholdingTotal -
    reversal.platformFeeGross
  );
}

function evidenceStatusForLink(label: string, reversal: AdminBookingSettlementReversalEntry) {
  if (label === 'Original monthly close') {
    return `Original tax ${reversal.originalSettlementSnapshot?.taxStatus ?? '-'}`;
  }
  if (label === 'Reversal monthly close') {
    return `Reversal tax ${reversal.taxStatus}`;
  }
  if (label === 'Reversal journal') {
    return reversal.accountingJournalBatches?.[0]?.status ?? '-';
  }
  if (label === 'Payment clearing') {
    return reversal.paymentClearingEntries?.[0]?.status ?? '-';
  }
  if (label === 'Bank match') {
    return latestActiveBankMatch(reversal)?.status ?? '-';
  }
  return reversal.originalSettlementSnapshot?.settlementStatus ?? reversal.settlementStatus;
}

function evidenceSourceForLink(label: string, reversal: AdminBookingSettlementReversalEntry) {
  if (label === 'Original monthly close') {
    return `Monthly closing ${reversal.originalMonthlyClosingId}`;
  }
  if (label === 'Reversal monthly close') {
    return `Reversal source ${reversal.sourceKey}`;
  }
  if (label === 'Reversal journal') {
    return reversal.accountingJournalBatches?.[0]?.sourceKey ?? '-';
  }
  if (label === 'Payment clearing') {
    return reversal.paymentClearingEntries?.[0]?.sourceKey ?? '-';
  }
  if (label === 'Bank match') {
    return latestActiveBankMatch(reversal)?.sourceKey ?? '-';
  }
  return reversal.originalSettlementSnapshotId;
}

function reversalCloseoutLabel(
  reversal: AdminBookingSettlementReversalEntry,
  allocationDelta: number,
  evidenceLabel: string,
) {
  if (allocationDelta !== 0) {
    return 'Review allocation delta';
  }
  if (evidenceLabel !== 'Evidence complete') {
    return evidenceLabel;
  }
  if (reversal.taxStatus === 'PAID' || reversal.taxStatus === 'CLOSED') {
    return 'Closed for period';
  }
  return 'Ready for closeout review';
}

function payoutRefundReceivableEvidence(reversal: AdminBookingSettlementReversalEntry) {
  const reversalMetadata = readPlainRecord(reversal.metadata);
  const journalMetadata = readPlainRecord(reversal.accountingJournalBatches?.[0]?.metadata);
  const refundAfterPaidPayout =
    booleanMetadata(journalMetadata, 'refundAfterPartnerPayout') ||
    booleanMetadata(reversalMetadata, 'refundAfterPartnerPayout') ||
    booleanMetadata(reversalMetadata, 'refundAfterPayout') ||
    booleanMetadata(reversalMetadata, 'reversalAffectsPartnerReceivable');
  const receivableAmount =
    numberMetadata(journalMetadata, 'partnerRefundReceivableAmount') ??
    numberMetadata(reversalMetadata, 'partnerRefundReceivableAmount') ??
    (refundAfterPaidPayout ? Math.abs(reversal.partnerPayoutAmount) : 0);

  return {
    receivableAmount,
    refundAfterPaidPayout,
    treatment: refundAfterPaidPayout
      ? 'Partner receivable / negative wallet'
      : 'Partner wallet liability reversal',
  };
}

type ReversalClearingEntry = NonNullable<AdminBookingSettlementReversalEntry['paymentClearingEntries']>[number];

function bankClearingEvidence(clearing: ReversalClearingEntry | null, fallbackCurrency: string) {
  const matches = clearing?.bankReconciliationMatches ?? [];
  const latestActiveMatch = latestActiveClearingMatch(clearing);
  const matchedAmount = matches.reduce((total, match) => {
    return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
  }, 0);
  const remainingAmount = clearing ? Math.max(0, Math.abs(clearing.amount) - matchedAmount) : 0;

  return {
    currency: clearing?.currency ?? fallbackCurrency,
    label: clearing
      ? remainingAmount <= 0
        ? 'Fully matched'
        : matchedAmount > 0
          ? 'Partially matched'
          : 'Needs bank match'
      : 'No clearing',
    latestActiveMatch,
    matchedAmount,
    remainingAmount,
  };
}

function latestActiveBankMatch(reversal: AdminBookingSettlementReversalEntry) {
  return latestActiveClearingMatch(reversal.paymentClearingEntries?.[0] ?? null);
}

function latestActiveClearingMatch(clearing: ReversalClearingEntry | null) {
  return clearing?.bankReconciliationMatches?.find((match) => match.status !== 'REVERSED') ?? null;
}

function booleanMetadata(record: Record<string, unknown> | null, key: string) {
  return record?.[key] === true;
}

function numberMetadata(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
