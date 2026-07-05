import { notFound } from 'next/navigation';

import type { AdminBookingSettlementSnapshot } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { shortId } from '../../../../lib/admin-format';
import { financePersonName } from '../../finance-participant-label';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { financeTaxCloseoutStatusTone } from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bookingSettlementAuditHref,
  bookingSettlementReversalDetailHref,
  buildBookingSettlementSnapshotDetailApiHref,
  generalLedgerDetailHref,
  paymentClearingDetailHref,
} from '../../tax-settlement-page-model';

type BookingSettlementAuditDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
};

export default async function BookingSettlementAuditDetailPage({
  params,
}: BookingSettlementAuditDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const snapshot = await adminGet<AdminBookingSettlementSnapshot | null>(
    buildBookingSettlementSnapshotDetailApiHref(id),
    null,
  );
  if (!snapshot) {
    notFound();
  }

  const coupon = couponSettlementInfo(snapshot);
  const paymentFee = paymentFeePolicyInfo(snapshot);
  const evidenceStatus = settlementEvidenceStatus(snapshot);
  const allocationDelta = settlementAllocationDelta(snapshot);

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink
          className="button-secondary"
          href={bookingSettlementAuditHref({ page: 1, range: '30d', review: 'open', take: 25 })}
        >
          Back to audit
        </AdminFormControlLink>
      }
      description="Single immutable booking settlement snapshot for finance, tax, payment fee, coupon, and payout audit evidence."
      metrics={[
        { helper: 'Booking settlement state.', label: 'Settlement', value: snapshot.settlementStatus },
        { helper: 'Tax closeout state.', label: 'Tax status', value: snapshot.taxStatus },
        {
          helper: 'Customer amount captured or owed by payment method.',
          label: 'Customer paid',
          value: <MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />,
        },
        {
          helper: 'Partner VAT/PIT withheld from this booking.',
          label: 'Withheld',
          value: <MoneyText amount={snapshot.partnerWithholdingTotal} currency={snapshot.currency} />,
        },
      ]}
      title="Booking Settlement Audit Detail"
    >
      <FinanceTablePanel
        description={
          <>
            Snapshot {shortId(snapshot.id)} · Posted <DateTimeText value={snapshot.postedAt} /> · Period{' '}
            {snapshot.monthlyPeriod}
          </>
        }
        resultLabel={snapshot.taxStatus}
        resultTone={financeTaxCloseoutStatusTone(snapshot.taxStatus)}
        title="Settlement snapshot overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <AdminTextLink href={`/bookings/${snapshot.bookingId}`}>
                {shortId(snapshot.bookingId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Booking status" value={snapshot.booking?.status ?? '-'} />
          <FinanceDetailInfoItem label="Payment method" value={snapshot.paymentMethod} />
          <FinanceDetailInfoItem
            label="Payment"
            value={
              snapshot.paymentId ? (
                <AdminTextLink href={`/payments/${snapshot.paymentId}`}>
                  {shortId(snapshot.paymentId)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Customer"
            value={financePersonName(snapshot.customerProfile?.user, 'Unknown customer')}
          />
          <FinanceDetailInfoItem
            label="Partner"
            value={
              <AdminTextLink href={`/partners/${snapshot.providerProfileId}?section=full`}>
                {snapshot.providerProfile?.displayName ??
                  financePersonName(snapshot.providerProfile?.user, 'Unknown partner')}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Monthly period" value={snapshot.monthlyPeriod} />
          <FinanceDetailInfoItem
            label="Closed at"
            value={snapshot.closedAt ? <DateTimeText value={snapshot.closedAt} /> : 'Open'}
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Follow the posted journal, payment clearing, and refund reversal evidence linked to this immutable snapshot."
        resultLabel={evidenceStatus.label}
        resultTone={evidenceStatus.tone}
        title="Settlement evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="Booking settlement operating path"
          steps={[
            {
              detail: snapshot.paymentMethod,
              label: 'Customer payment',
              value: <MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />,
            },
            {
              detail: (
                <>
                  Delta <MoneyText amount={allocationDelta} currency={snapshot.currency} />
                </>
              ),
              label: 'Settlement split',
              value: allocationDelta === 0 ? 'Balanced' : 'Review required',
            },
            {
              detail: evidenceStatus.label,
              label: 'Journal / clearing',
              value: settlementEvidenceCountLabel(snapshot),
            },
            {
              detail: settlementNextAction(snapshot, allocationDelta, evidenceStatus.label),
              label: 'Tax closeout',
              value: snapshot.taxStatus,
            },
          ]}
        />
        <FinanceDetailGrid>
          <SettlementJournalEvidence snapshot={snapshot} />
          <PaymentClearingEvidence snapshot={snapshot} />
          <SettlementReversalEvidence snapshot={snapshot} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="These values must stay immutable after posting. Refunds and closed-period changes should create reversal entries instead."
        resultLabel={<MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />}
        resultTone="info"
        title="Accounting amount breakdown"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Customer payment"
            value={<MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Partner payout"
            value={<MoneyText amount={snapshot.partnerPayoutAmount} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Partner taxable revenue"
            value={<MoneyText amount={snapshot.partnerTaxableRevenue} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Partner VAT"
            value={<MoneyText amount={snapshot.partnerVatAmount} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Partner PIT"
            value={<MoneyText amount={snapshot.partnerPitAmount} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Total partner withholding"
            value={<MoneyText amount={snapshot.partnerWithholdingTotal} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Platform fee gross"
            value={<MoneyText amount={snapshot.platformFeeGross} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Platform net revenue"
            value={<MoneyText amount={snapshot.platformFeeNetRevenue} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Company output VAT"
            value={<MoneyText amount={snapshot.companyOutputVat} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Payment processing fee"
            value={<MoneyText amount={snapshot.paymentProcessingFee} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Allocation check"
            value={
              <>
                {allocationDelta === 0 ? 'Balanced' : 'Review required'}
                <span className="muted admin-block">
                  Delta <MoneyText amount={allocationDelta} currency={snapshot.currency} />
                </span>
              </>
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Payment provider fee evidence is copied to the settlement snapshot so method-specific CARD, MOMO, or VNPAY rules can be audited later."
        resultLabel={<MoneyText amount={snapshot.paymentProcessingFee} currency={snapshot.currency} />}
        resultTone={snapshot.paymentProcessingFee > 0 ? 'info' : 'success'}
        title="Payment fee policy evidence"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Policy name" value={paymentFee.policyName} />
          <FinanceDetailInfoItem label="Policy version" value={paymentFee.policyVersionId} />
          <FinanceDetailInfoItem label="Method" value={paymentFee.method} />
          <FinanceDetailInfoItem
            label="Rate / fixed fee"
            value={paymentFeeBasisLabel(paymentFee, snapshot.currency, snapshot.paymentProcessingFee)}
          />
          <FinanceDetailInfoItem label="Payer / treatment" value={`${paymentFee.payer} / ${paymentFee.treatment}`} />
          <FinanceDetailInfoItem label="Rule type" value={paymentFee.feeType} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Coupon values are copied from the booking settlement metadata so later coupon edits do not rewrite historical finance evidence."
        resultLabel={coupon.reviewFlag ?? 'Snapshot OK'}
        resultTone={coupon.reviewFlag ? 'warning' : 'success'}
        title="Coupon and policy snapshot"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Coupon code" value={coupon.code} />
          <FinanceDetailInfoItem label="Funding source" value={coupon.fundingSource} />
          <FinanceDetailInfoItem label="Accounting treatment" value={coupon.accountingTreatment} />
          <FinanceDetailInfoItem label="Settlement base" value={coupon.settlementBasePolicy} />
          <FinanceDetailInfoItem
            label="Discount"
            value={<MoneyText amount={coupon.discountAmount} currency={snapshot.currency} />}
          />
          <FinanceDetailInfoItem
            label="Company expense"
            value={<MoneyText amount={coupon.companyExpense} currency={snapshot.currency} />}
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function SettlementJournalEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const journal = snapshot.accountingJournalBatches?.[0] ?? null;
  const status = journal ? `Journal ${journal.status}` : 'Journal missing';

  return (
    <FinanceDetailInfoItem
      label="Settlement journal"
      value={
        journal ? (
          <>
            <AdminTextLink href={generalLedgerDetailHref(journal.id)}>
              {status}
            </AdminTextLink>
            <span className="muted admin-block">
              Debit <MoneyText amount={journal.totalDebit} currency={snapshot.currency} /> · Credit{' '}
              <MoneyText amount={journal.totalCredit} currency={snapshot.currency} />
            </span>
            <span className="muted admin-block">{journal.sourceKey}</span>
          </>
        ) : (
          status
        )
      }
    />
  );
}

function PaymentClearingEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const clearing = snapshot.paymentClearingEntries?.[0] ?? null;
  const status = clearing ? `Clearing ${clearing.status}` : 'Clearing missing';

  return (
    <FinanceDetailInfoItem
      label="Payment clearing"
      value={
        clearing ? (
          <>
            <AdminTextLink href={paymentClearingDetailHref(clearing.id)}>
              {status}
            </AdminTextLink>
            <span className="muted admin-block">
              {clearing.type} · <MoneyText amount={clearing.amount} currency={clearing.currency} />
            </span>
            <span className="muted admin-block">{clearing.sourceKey}</span>
          </>
        ) : (
          status
        )
      }
    />
  );
}

function SettlementReversalEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const reversal = snapshot.reversalEntries?.[0] ?? null;
  const journal = reversal?.accountingJournalBatches?.[0] ?? null;
  const clearing = reversal?.paymentClearingEntries?.[0] ?? null;

  if (!reversal) {
    return <FinanceDetailInfoItem label="Refund after payout reversal" value="No reversal" />;
  }

  return (
    <FinanceDetailInfoItem
      label="Refund after payout reversal"
      value={
        <>
          <AdminTextLink href={bookingSettlementReversalDetailHref(reversal.id)}>
            {reversal.reason ?? 'Settlement reversal'}
          </AdminTextLink>
          <span className="muted admin-block">
            Journal {journal?.status ?? 'missing'} · Clearing {clearing?.status ?? 'missing'}
          </span>
          <span className="muted admin-block">
            {reversal.taxStatus} · <DateTimeText value={reversal.occurredAt} />
          </span>
        </>
      }
    />
  );
}

function settlementEvidenceStatus(snapshot: AdminBookingSettlementSnapshot): {
  readonly label: string;
  readonly tone: 'danger' | 'info' | 'success' | 'warning';
} {
  const hasJournal = Boolean(snapshot.accountingJournalBatches?.length);
  const hasClearing = Boolean(snapshot.paymentClearingEntries?.length);
  const hasOpenReversalClearing = snapshot.reversalEntries?.some((entry) =>
    entry.paymentClearingEntries?.some((clearing) => clearing.status === 'OPEN' || clearing.status === 'PARTIALLY_CLEARED'),
  );

  if (!hasJournal || !hasClearing) {
    return { label: 'Evidence missing', tone: 'danger' };
  }
  if (hasOpenReversalClearing) {
    return { label: 'Reversal clearing open', tone: 'warning' };
  }
  if (snapshot.reversalEntries?.length) {
    return { label: 'Reversal linked', tone: 'info' };
  }
  return { label: 'Evidence retained', tone: 'success' };
}


function settlementEvidenceCountLabel(snapshot: AdminBookingSettlementSnapshot) {
  const journalCount = snapshot.accountingJournalBatches?.length ?? 0;
  const clearingCount = snapshot.paymentClearingEntries?.length ?? 0;
  const reversalCount = snapshot.reversalEntries?.length ?? 0;
  return `${journalCount} journal · ${clearingCount} clearing · ${reversalCount} reversal`;
}

function settlementNextAction(
  snapshot: AdminBookingSettlementSnapshot,
  allocationDelta: number,
  evidenceLabel: string,
) {
  if (allocationDelta !== 0) {
    return 'Review allocation delta';
  }
  if (evidenceLabel === 'Evidence missing') {
    return 'Attach missing evidence';
  }
  if (evidenceLabel === 'Reversal clearing open') {
    return 'Resolve reversal clearing';
  }
  if (snapshot.taxStatus === 'PAID' || snapshot.taxStatus === 'CLOSED') {
    return 'Closed for period';
  }
  return 'Ready for tax review';
}

function settlementAllocationDelta(snapshot: AdminBookingSettlementSnapshot) {
  return (
    snapshot.customerPaymentAmount -
    snapshot.partnerPayoutAmount -
    snapshot.partnerWithholdingTotal -
    snapshot.platformFeeGross
  );
}

function couponSettlementInfo(snapshot: AdminBookingSettlementSnapshot) {
  const metadata = jsonRecord(snapshot.metadata);
  return {
    accountingTreatment: stringValue(metadata?.couponAccountingTreatmentSnapshot) ?? '-',
    code: stringValue(metadata?.couponCodeSnapshot) ?? '-',
    companyExpense: numberValue(metadata?.companyCouponExpense),
    discountAmount: numberValue(metadata?.couponDiscountAmount),
    fundingSource: stringValue(metadata?.couponFundingSourceSnapshot) ?? '-',
    reviewFlag: stringValue(metadata?.couponReviewFlag),
    settlementBasePolicy: stringValue(metadata?.couponSettlementBasePolicySnapshot) ?? '-',
  };
}

function paymentFeePolicyInfo(snapshot: AdminBookingSettlementSnapshot) {
  const ruleSnapshot = jsonRecord(snapshot.paymentFeeRuleSnapshot);
  const hasPolicySnapshot = Boolean(
    snapshot.paymentFeePolicyVersionId ||
      stringValue(ruleSnapshot?.policyName) ||
      stringValue(ruleSnapshot?.feeType),
  );
  return {
    feeType: stringValue(ruleSnapshot?.feeType) ?? (hasPolicySnapshot ? '-' : 'Legacy/manual'),
    fixedAmount: snapshot.paymentFeeFixedAmount ?? 0,
    method: stringValue(ruleSnapshot?.method) ?? snapshot.paymentMethod,
    payer: snapshot.paymentFeePayer ?? '-',
    policyName: stringValue(ruleSnapshot?.policyName) ?? (hasPolicySnapshot ? '-' : 'Legacy/manual fee evidence'),
    policyVersionId: snapshot.paymentFeePolicyVersionId ?? (hasPolicySnapshot ? '-' : 'Policy snapshot missing'),
    rateBps: snapshot.paymentFeeRateBps ?? 0,
    treatment: snapshot.paymentFeeTreatment ?? '-',
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

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
