import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { AdminBookingSettlementSnapshot } from '../../../../lib/admin-api';
import { adminGet } from '../../../../lib/admin-api';
import { AdminFilterPanel } from '../../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, shortId } from '../../../../lib/admin-format';
import { FinanceDetailInfoItem } from '../../finance-detail-info-item';
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
  const evidenceStatus = settlementEvidenceStatus(snapshot);
  const allocationDelta = settlementAllocationDelta(snapshot);

  return (
    <AdminPageTemplate
      actions={
        <Link
          className="button button-secondary"
          href={bookingSettlementAuditHref({ page: 1, range: '30d', review: 'open', take: 25 })}
        >
          Back to audit
        </Link>
      }
      description="Single immutable booking settlement snapshot for finance, tax, payment fee, coupon, and payout audit evidence."
      metrics={[
        { helper: 'Booking settlement state.', label: 'Settlement', value: snapshot.settlementStatus },
        { helper: 'Tax closeout state.', label: 'Tax status', value: snapshot.taxStatus },
        {
          helper: 'Customer amount captured or owed by payment method.',
          label: 'Customer paid',
          value: formatMoney(snapshot.customerPaymentAmount, snapshot.currency),
        },
        {
          helper: 'Partner VAT/PIT withheld from this booking.',
          label: 'Withheld',
          value: formatMoney(snapshot.partnerWithholdingTotal, snapshot.currency),
        },
      ]}
      title="Booking Settlement Audit Detail"
    >
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description={`Snapshot ${shortId(snapshot.id)} · Posted ${formatDateTime(snapshot.postedAt)} · Period ${snapshot.monthlyPeriod}`}
        resultLabel={snapshot.taxStatus}
        resultTone={taxStatusTone(snapshot.taxStatus)}
        title="Settlement snapshot overview"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <Link className="text-link" href={`/bookings/${snapshot.bookingId}`}>
                {shortId(snapshot.bookingId)}
              </Link>
            }
          />
          <FinanceDetailInfoItem label="Booking status" value={snapshot.booking?.status ?? '-'} />
          <FinanceDetailInfoItem label="Payment method" value={snapshot.paymentMethod} />
          <FinanceDetailInfoItem
            label="Payment"
            value={
              snapshot.paymentId ? (
                <Link className="text-link" href={`/payments/${snapshot.paymentId}`}>
                  {shortId(snapshot.paymentId)}
                </Link>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Customer"
            value={personName(snapshot.customerProfile?.user, 'Unknown customer')}
          />
          <FinanceDetailInfoItem
            label="Partner"
            value={
              <Link className="text-link" href={`/partners/${snapshot.providerProfileId}?section=full`}>
                {snapshot.providerProfile?.displayName ??
                  personName(snapshot.providerProfile?.user, 'Unknown partner')}
              </Link>
            }
          />
          <FinanceDetailInfoItem label="Monthly period" value={snapshot.monthlyPeriod} />
          <FinanceDetailInfoItem label="Closed at" value={snapshot.closedAt ? formatDateTime(snapshot.closedAt) : 'Open'} />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="Follow the posted journal, payment clearing, and refund reversal evidence linked to this immutable snapshot."
        resultLabel={evidenceStatus.label}
        resultTone={evidenceStatus.tone}
        title="Settlement evidence hub"
      >
        <div className="detail-grid admin-mt-16">
          <SettlementJournalEvidence snapshot={snapshot} />
          <PaymentClearingEvidence snapshot={snapshot} />
          <SettlementReversalEvidence snapshot={snapshot} />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="These values must stay immutable after posting. Refunds and closed-period changes should create reversal entries instead."
        resultLabel={formatMoney(snapshot.customerPaymentAmount, snapshot.currency)}
        resultTone="info"
        title="Accounting amount breakdown"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem
            label="Customer payment"
            value={formatMoney(snapshot.customerPaymentAmount, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner payout"
            value={formatMoney(snapshot.partnerPayoutAmount, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner taxable revenue"
            value={formatMoney(snapshot.partnerTaxableRevenue, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner VAT"
            value={formatMoney(snapshot.partnerVatAmount, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Partner PIT"
            value={formatMoney(snapshot.partnerPitAmount, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Total partner withholding"
            value={formatMoney(snapshot.partnerWithholdingTotal, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Platform fee gross"
            value={formatMoney(snapshot.platformFeeGross, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Platform net revenue"
            value={formatMoney(snapshot.platformFeeNetRevenue, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Company output VAT"
            value={formatMoney(snapshot.companyOutputVat, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Payment processing fee"
            value={formatMoney(snapshot.paymentProcessingFee, snapshot.currency)}
          />
          <FinanceDetailInfoItem
            label="Allocation check"
            value={
              <>
                {allocationDelta === 0 ? 'Balanced' : 'Review required'}
                <span className="muted admin-block">
                  Delta {formatMoney(allocationDelta, snapshot.currency)}
                </span>
              </>
            }
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
        description="Coupon values are copied from the booking settlement metadata so later coupon edits do not rewrite historical finance evidence."
        resultLabel={coupon.reviewFlag ?? 'Snapshot OK'}
        resultTone={coupon.reviewFlag ? 'warning' : 'success'}
        title="Coupon and policy snapshot"
      >
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem label="Coupon code" value={coupon.code} />
          <FinanceDetailInfoItem label="Funding source" value={coupon.fundingSource} />
          <FinanceDetailInfoItem label="Accounting treatment" value={coupon.accountingTreatment} />
          <FinanceDetailInfoItem label="Settlement base" value={coupon.settlementBasePolicy} />
          <FinanceDetailInfoItem label="Discount" value={formatMoney(coupon.discountAmount, snapshot.currency)} />
          <FinanceDetailInfoItem
            label="Company expense"
            value={formatMoney(coupon.companyExpense, snapshot.currency)}
          />
        </div>
      </AdminFilterPanel>
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
            <Link className="text-link" href={generalLedgerDetailHref(journal.id)}>
              {status}
            </Link>
            <span className="muted admin-block">
              Debit {formatMoney(journal.totalDebit, snapshot.currency)} · Credit{' '}
              {formatMoney(journal.totalCredit, snapshot.currency)}
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
            <Link className="text-link" href={paymentClearingDetailHref(clearing.id)}>
              {status}
            </Link>
            <span className="muted admin-block">
              {clearing.type} · {formatMoney(clearing.amount, clearing.currency)}
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
          <Link className="text-link" href={bookingSettlementReversalDetailHref(reversal.id)}>
            {reversal.reason ?? 'Settlement reversal'}
          </Link>
          <span className="muted admin-block">
            Journal {journal?.status ?? 'missing'} · Clearing {clearing?.status ?? 'missing'}
          </span>
          <span className="muted admin-block">
            {reversal.taxStatus} · {formatDateTime(reversal.occurredAt)}
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

function personName(user: { fullName?: string | null; phone?: string | null } | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? fallback;
}

function taxStatusTone(status: string): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'success';
  }
  if (status === 'DECLARED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
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
