import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AdminBookingSettlementReversalEntry } from '../../../../lib/admin-api';
import { adminGetResult } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { AdminErrorState } from '../../../../components/admin-surface';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDataTable } from '../../finance-data-table';
import { financePersonName } from '../../finance-participant-label';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bookingSettlementAuditDetailHref,
  buildBookingSettlementReversalDetailApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalTraceLinks,
  generalLedgerDetailHref,
  monthlyTaxClosingHref,
  paymentClearingDetailHref,
  safeBookingSettlementReversalReturnTo,
  TAX_SETTLEMENT_DEFAULT_TAKE,
} from '../../tax-settlement-page-model';

type SettlementReversalDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettlementReversalDetailPage({
  params,
  searchParams,
}: SettlementReversalDetailPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params ?? Promise.resolve<{ readonly id?: string }>({}),
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const id = resolvedParams.id;
  if (!id) {
    notFound();
  }
  const returnToParam = resolvedSearchParams.returnTo;
  const returnTo = safeBookingSettlementReversalReturnTo(
    Array.isArray(returnToParam) ? returnToParam[0] : returnToParam,
  );

  const reversalResult = await adminGetResult<AdminBookingSettlementReversalEntry | null>(
    buildBookingSettlementReversalDetailApiHref(id),
    null,
  );
  if (!reversalResult.ok && reversalResult.status === 404) {
    notFound();
  }
  if (!reversalResult.ok || !reversalResult.data) {
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to reversals</AdminFormControlLink>}
        description="The settlement reversal evidence could not be loaded. No closeout conclusion has been inferred."
        title="Settlement Reversal Detail"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={returnTo}>Back to reversals</AdminFormControlLink>}
          message="Retry the reversal record before making an accounting or closeout decision."
          title="Settlement reversal evidence unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const reversal = reversalResult.data;

  const evidenceState = buildBookingSettlementReversalEvidenceState(reversal);
  const evidenceLinks = buildBookingSettlementReversalTraceLinks(reversal);
  const originalSettlement = reversal.originalSettlementSnapshot ?? null;
  const reversalJournal = reversal.accountingJournalBatches?.[0] ?? null;
  const journalIntegrity = reversalJournal?.integrity ?? null;
  const reversalClearing = reversal.paymentClearingEntries?.[0] ?? null;
  const bankClearing = bankClearingEvidence(reversalClearing, reversal.currency);
  const allocationDelta = reversalAllocationDelta(reversal);
  const payoutRefundEvidence = payoutRefundReceivableEvidence(reversal);
  const nextCloseoutAction = reversalCloseoutLabel(reversal, allocationDelta, evidenceState.label);
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
        <AdminFormControlLink className="button-secondary" href={returnTo}>
          Back to reversals
        </AdminFormControlLink>
      }
      description="Single closed-period settlement reversal record with refund, journal, clearing, and original settlement evidence."
      metrics={[
        {
          helper: 'Reversal settlement state.',
          kind: 'record',
          label: 'Settlement',
          scope: 'Reversal record',
          value: reversal.settlementStatus,
        },
        {
          helper: 'Tax reversal state.',
          kind: 'record',
          label: 'Tax status',
          scope: 'Reversal record',
          value: reversal.taxStatus,
        },
        {
          helper: 'Customer payment amount reversed by this record.',
          kind: 'record',
          label: 'Customer reversal',
          scope: 'Reversal record',
          value: (
            <>
              <MoneyText amount={Math.abs(reversal.customerPaymentAmount)} currency={reversal.currency} />{' '}
              reversed
            </>
          ),
        },
        {
          helper: 'Partner payout amount reversed by this record.',
          kind: 'record',
          label: 'Partner reversal',
          scope: 'Reversal record',
          value: (
            <>
              <MoneyText amount={Math.abs(reversal.partnerPayoutAmount)} currency={reversal.currency} />{' '}
              offset
            </>
          ),
        },
      ]}
      title="Settlement Reversal Detail"
    >
      <FinanceTablePanel
        description={
          <>
            Reversal ID {shortId(reversal.id)} · Occurred <DateTimeText value={reversal.occurredAt} /> ·
            Period {reversal.monthlyPeriod}
          </>
        }
        resultLabel={evidenceState.label}
        resultTone={evidenceState.tone}
        title="Settlement reversal evidence"
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
              detail: (
                <>
                  Delta <MoneyText amount={allocationDelta} currency={reversal.currency} />
                </>
              ),
              label: 'Reversal impact',
              value: allocationDelta === 0 ? 'Amounts offset' : 'Review required',
            },
            {
              detail: evidenceState.detail,
              label: 'Journal / clearing',
              value: evidenceState.label,
            },
            {
              detail: payoutRefundEvidence.treatment,
              label: 'Closeout action',
              value: nextCloseoutAction,
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <AdminTextLink href={`/bookings/${reversal.bookingId}`}>
                {shortId(reversal.bookingId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem
            label="Original settlement"
            value={
              <AdminTextLink href={bookingSettlementAuditDetailHref(reversal.originalSettlementSnapshotId)}>
                {shortId(reversal.originalSettlementSnapshotId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Payment method" value={reversal.paymentMethod} />
          <FinanceDetailInfoItem
            label="Payment"
            value={
              reversal.paymentId ? (
                <AdminTextLink href={`/payments/${reversal.paymentId}`}>
                  {shortId(reversal.paymentId)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Customer"
            value={financePersonName(originalSettlement?.customerProfile?.user, 'Unknown customer')}
          />
          <FinanceDetailInfoItem
            label="Partner"
            value={
              <AdminTextLink href={`/partners/${reversal.providerProfileId}?section=full`}>
                {originalSettlement?.providerProfile?.displayName ??
                  financePersonName(originalSettlement?.providerProfile?.user, 'Unknown partner')}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Evidence state" value={evidenceState.detail} />
          <FinanceDetailInfoItem label="Next closeout action" value={nextCloseoutAction} />
          <FinanceDetailInfoItem
            label="Paid payout refund"
            value={
              payoutRefundEvidence.refundAfterPaidPayout === null
                ? 'Review required'
                : payoutRefundEvidence.refundAfterPaidPayout
                  ? 'Yes'
                  : 'No'
            }
          />
          <FinanceDetailInfoItem
            label="Partner receivable treatment"
            value={payoutRefundEvidence.treatment}
          />
          <FinanceDetailInfoItem
            label="Receivable amount"
            value={
              payoutRefundEvidence.receivableAmount === null ? (
                'Evidence unavailable'
              ) : (
                <MoneyText amount={payoutRefundEvidence.receivableAmount} currency={reversal.currency} />
              )
            }
          />
          <FinanceDetailInfoItem label="Receivable evidence" value={payoutRefundEvidence.evidenceLabel} />
          <FinanceDetailInfoItem
            label="Bank clearing check"
            value={
              reversalClearing ? (
                <EvidenceBreakdown
                  headline={bankClearing.label}
                  items={[
                    {
                      label: 'Matched',
                      value: (
                        <MoneyText amount={bankClearing.matchedAmount} currency={bankClearing.currency} />
                      ),
                    },
                    {
                      label: 'Remaining',
                      value: (
                        <MoneyText amount={bankClearing.remainingAmount} currency={bankClearing.currency} />
                      ),
                    },
                  ]}
                >
                  {bankClearing.latestActiveMatch ? (
                    <AdminTextLink
                      href={`/finance-tax/bank-reconciliation/${bankClearing.latestActiveMatch.bankTransactionId}`}
                    >
                      {bankClearing.latestActiveMatch.bankTransaction?.transferRef ??
                        shortId(bankClearing.latestActiveMatch.bankTransactionId)}
                    </AdminTextLink>
                  ) : null}
                </EvidenceBreakdown>
              ) : reversal.reversalEvidence?.policy.externalClearingRequired === false ? (
                'External clearing not required'
              ) : (
                'Clearing evidence missing'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Reversal journal record"
            value={
              reversalJournal ? (
                <AdminTextLink href={generalLedgerDetailHref(reversalJournal.id)}>
                  {shortId(reversalJournal.id)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Payment clearing record"
            value={
              reversalClearing ? (
                <AdminTextLink href={paymentClearingDetailHref(reversalClearing.id)}>
                  {shortId(reversalClearing.id)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem label="Reason" value={reversal.reason ?? 'Payment refund'} />
          <FinanceDetailInfoItem label="Record key" value={reversal.sourceKey} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Amounts below are the reversal entry values. They should offset the original posted settlement through journal and clearing evidence, not by editing the closed record."
        resultLabel={
          <>
            <MoneyText amount={Math.abs(reversal.customerPaymentAmount)} currency={reversal.currency} />{' '}
            reversed
          </>
        }
        resultTone={evidenceState.tone}
        title="Reversal accounting impact"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Customer payment reversal"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.customerPaymentAmount)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Partner payout reversal"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.partnerPayoutAmount)} currency={reversal.currency} />{' '}
                offset
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Partner taxable revenue"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.partnerTaxableRevenue)} currency={reversal.currency} />{' '}
                offset
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Partner VAT"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.partnerVatAmount)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Partner PIT"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.partnerPitAmount)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Total partner withholding"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.partnerWithholdingTotal)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Platform fee gross"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.platformFeeGross)} currency={reversal.currency} /> offset
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Platform net revenue"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.platformFeeNetRevenue)} currency={reversal.currency} />{' '}
                offset
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Company output VAT"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.companyOutputVat)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Payment processing fee"
            value={
              <>
                <MoneyText amount={Math.abs(reversal.paymentProcessingFee)} currency={reversal.currency} />{' '}
                reversed
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Reversal allocation check"
            value={
              <>
                {allocationDelta === 0 ? 'Amounts offset' : 'Review required'}
                <span className="muted admin-block">
                  Delta <MoneyText amount={allocationDelta} currency={reversal.currency} />
                </span>
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Journal integrity check"
            value={
              reversalJournal && journalIntegrity ? (
                <EvidenceBreakdown
                  headline={
                    journalIntegrity.state === 'CLEAR'
                      ? 'Clear'
                      : journalIntegrity.state === 'BLOCKED'
                        ? 'Review required'
                        : 'Evidence unavailable'
                  }
                  items={[
                    {
                      label: 'Header debit',
                      value: <MoneyText amount={reversalJournal.totalDebit} currency={reversal.currency} />,
                    },
                    {
                      label: 'Header credit',
                      value: <MoneyText amount={reversalJournal.totalCredit} currency={reversal.currency} />,
                    },
                    {
                      label: 'Entry debit',
                      value: <MoneyText amount={journalIntegrity.entryDebit} currency={reversal.currency} />,
                    },
                    {
                      label: 'Entry credit',
                      value: <MoneyText amount={journalIntegrity.entryCredit} currency={reversal.currency} />,
                    },
                    ...(journalIntegrity.discrepancyAmount > 0
                      ? [
                          {
                            label: 'Maximum discrepancy',
                            value: (
                              <MoneyText
                                amount={journalIntegrity.discrepancyAmount}
                                currency={reversal.currency}
                              />
                            ),
                          },
                        ]
                      : []),
                    ...(journalIntegrity.formulaDelta != null
                      ? [
                          {
                            label: 'Formula delta',
                            value: (
                              <MoneyText
                                amount={journalIntegrity.formulaDelta}
                                currency={reversal.currency}
                              />
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : reversalJournal ? (
                'Integrity unavailable'
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
              <AdminTextLink href={originalMonthlyClosingHref}>
                {reversal.originalMonthlyPeriod}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem
            label="Reversal period"
            value={<AdminTextLink href={reversalMonthlyClosingHref}>{reversal.monthlyPeriod}</AdminTextLink>}
          />
          <FinanceDetailInfoItem
            label="Original closing"
            value={
              <AdminTextLink href={originalMonthlyClosingHref}>
                {shortId(reversal.originalMonthlyClosingId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem
            label="Original posted"
            value={originalSettlement?.postedAt ? <DateTimeText value={originalSettlement.postedAt} /> : '-'}
          />
          <FinanceDetailInfoItem label="Original tax status" value={originalSettlement?.taxStatus ?? '-'} />
          <FinanceDetailInfoItem
            label="Original booking status"
            value={originalSettlement?.booking?.status ?? '-'}
          />
          <FinanceDetailInfoItem label="Correction method" value="Reversal entry only" />
          <FinanceDetailInfoItem label="Direct edit allowed" value="No" />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Open each evidence record to compare the original monthly close, reversal monthly close, journal, clearing, bank match, and original settlement record."
        resultLabel={`${evidenceLinks.length} link(s)`}
        resultTone="info"
        title="Reversal evidence links"
      >
        <FinanceDataTable
          emptyMessage="No reversal evidence links are available."
          headers={['Evidence', 'Record', 'Status', 'Record key']}
          rowCount={evidenceLinks.length}
        >
          {evidenceLinks.map((link) => (
            <tr key={link.label}>
              <td>
                <AdminTextLink href={link.href}>{link.label}</AdminTextLink>
              </td>
              <td>{link.value}</td>
              <td>{evidenceStatusForLink(link.label, reversal)}</td>
              <td>{evidenceSourceForLink(link.label, reversal)}</td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function EvidenceBreakdown({
  children,
  headline,
  items,
}: {
  readonly children?: ReactNode;
  readonly headline: ReactNode;
  readonly items: readonly { readonly label: string; readonly value: ReactNode }[];
}) {
  return (
    <div className="finance-evidence-breakdown">
      <strong>{headline}</strong>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="admin-mt-8">{children}</div> : null}
    </div>
  );
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
    return `Reversal record ${reversal.sourceKey}`;
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

export function payoutRefundReceivableEvidence(reversal: AdminBookingSettlementReversalEntry) {
  const reversalMetadata = readPlainRecord(reversal.metadata);
  const journalMetadata = readPlainRecord(reversal.accountingJournalBatches?.[0]?.metadata);
  const journalPaidPayout = booleanMetadata(journalMetadata, 'refundAfterPartnerPayout');
  const reversalPaidPayout =
    booleanMetadata(reversalMetadata, 'refundAfterPartnerPayout') ??
    booleanMetadata(reversalMetadata, 'refundAfterPayout');
  const retainedAmount =
    numberMetadata(journalMetadata, 'partnerRefundReceivableAmount') ??
    numberMetadata(reversalMetadata, 'partnerRefundReceivableAmount');
  const contradictory =
    (journalPaidPayout !== null && reversalPaidPayout !== null && journalPaidPayout !== reversalPaidPayout) ||
    ((journalPaidPayout === false || reversalPaidPayout === false) && (retainedAmount ?? 0) > 0);

  if (contradictory) {
    return {
      evidenceLabel: 'Contradictory retained payout evidence — review required',
      receivableAmount: null,
      refundAfterPaidPayout: null,
      treatment: 'Partner receivable treatment unknown',
    };
  }

  const refundAfterPaidPayout = journalPaidPayout ?? reversalPaidPayout;
  if (refundAfterPaidPayout === true) {
    return {
      evidenceLabel: 'Paid payout and receivable evidence retained',
      receivableAmount: retainedAmount ?? Math.abs(reversal.partnerPayoutAmount),
      refundAfterPaidPayout: true,
      treatment: 'Partner receivable / negative wallet',
    };
  }
  if (refundAfterPaidPayout === false) {
    return {
      evidenceLabel: 'Unpaid payout liability reversal retained',
      receivableAmount: 0,
      refundAfterPaidPayout: false,
      treatment: 'Partner wallet liability reversal',
    };
  }

  return {
    evidenceLabel: 'Retained payout evidence unavailable — review required',
    receivableAmount: null,
    refundAfterPaidPayout: null,
    treatment: 'Partner receivable treatment unknown',
  };
}

type ReversalClearingEntry = NonNullable<
  AdminBookingSettlementReversalEntry['paymentClearingEntries']
>[number];

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
  const value = record?.[key];
  return typeof value === 'boolean' ? value : null;
}

function numberMetadata(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
