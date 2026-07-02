import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBookingSettlementReversalEntry } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDetailInfoItem } from '../../finance-detail-info-item';
import {
  bookingSettlementAuditDetailHref,
  bookingSettlementReversalHref,
  buildBookingSettlementReversalDetailApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalTraceLinks,
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
  const allocationDelta = reversalAllocationDelta(reversal);
  const payoutRefundEvidence = payoutRefundReceivableEvidence(reversal);

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
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description={`Reversal ${shortId(reversal.id)} · Occurred ${formatDateTime(reversal.occurredAt)} · Period ${reversal.monthlyPeriod}`}
        resultLabel={evidenceState.label}
        resultTone={evidenceState.tone}
        title="Refund after payout evidence"
      >
        <div className="finance-reconciliation-path admin-mt-16" aria-label="Settlement reversal operating path">
          <div className="finance-reconciliation-path-node">
            <span>Original settlement</span>
            <strong>{shortId(reversal.originalSettlementSnapshotId)}</strong>
            <small>{originalSettlement?.settlementStatus ?? 'Snapshot retained'}</small>
          </div>
          <span className="finance-reconciliation-path-connector" aria-hidden="true">
            -&gt;
          </span>
          <div className="finance-reconciliation-path-node">
            <span>Reversal impact</span>
            <strong>{allocationDelta === 0 ? 'Balanced' : 'Review required'}</strong>
            <small>Delta {formatMoney(allocationDelta, reversal.currency)}</small>
          </div>
          <span className="finance-reconciliation-path-connector" aria-hidden="true">
            -&gt;
          </span>
          <div className="finance-reconciliation-path-node">
            <span>Journal / clearing</span>
            <strong>{evidenceState.label}</strong>
            <small>{evidenceState.detail}</small>
          </div>
          <span className="finance-reconciliation-path-connector" aria-hidden="true">
            -&gt;
          </span>
          <div className="finance-reconciliation-path-node">
            <span>Closeout action</span>
            <strong>{reversalCloseoutLabel(reversal, allocationDelta, evidenceState.label)}</strong>
            <small>{payoutRefundEvidence.treatment}</small>
          </div>
        </div>
        <div className="detail-grid admin-mt-16">
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
          <FinanceDetailInfoItem label="Reason" value={reversal.reason ?? 'Payment refund'} />
          <FinanceDetailInfoItem label="Source key" value={reversal.sourceKey} />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="Amounts below are the reversal entry values. They should offset the original posted settlement through journal and clearing evidence, not by editing the closed snapshot."
        resultLabel={formatMoney(reversal.customerPaymentAmount, reversal.currency)}
        resultTone="warning"
        title="Reversal accounting impact"
      >
        <div className="detail-grid admin-mt-16">
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
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="The original monthly close is read-only. Finance should use this reversal record and its evidence links for correction review."
        resultLabel={originalSettlement?.settlementStatus ?? 'Original snapshot'}
        resultTone={originalSettlement?.settlementStatus === 'POSTED' ? 'success' : 'info'}
        title="Original settlement lock"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem label="Original period" value={reversal.originalMonthlyPeriod} />
          <FinanceDetailInfoItem label="Reversal period" value={reversal.monthlyPeriod} />
          <FinanceDetailInfoItem label="Original closing" value={shortId(reversal.originalMonthlyClosingId)} />
          <FinanceDetailInfoItem
            label="Original posted"
            value={originalSettlement?.postedAt ? formatDateTime(originalSettlement.postedAt) : '-'}
          />
          <FinanceDetailInfoItem label="Original tax status" value={originalSettlement?.taxStatus ?? '-'} />
          <FinanceDetailInfoItem label="Original booking status" value={originalSettlement?.booking?.status ?? '-'} />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Open each evidence record to confirm the reversal journal, payment clearing row, and immutable original settlement snapshot."
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
      </AdminFilterPanel>
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
  if (label === 'Reversal journal') {
    return reversal.accountingJournalBatches?.[0]?.status ?? '-';
  }
  if (label === 'Payment clearing') {
    return reversal.paymentClearingEntries?.[0]?.status ?? '-';
  }
  return reversal.originalSettlementSnapshot?.settlementStatus ?? reversal.settlementStatus;
}

function evidenceSourceForLink(label: string, reversal: AdminBookingSettlementReversalEntry) {
  if (label === 'Reversal journal') {
    return reversal.accountingJournalBatches?.[0]?.sourceKey ?? '-';
  }
  if (label === 'Payment clearing') {
    return reversal.paymentClearingEntries?.[0]?.sourceKey ?? '-';
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

function booleanMetadata(record: Record<string, unknown> | null, key: string) {
  return record?.[key] === true;
}

function numberMetadata(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
