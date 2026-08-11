import { notFound } from 'next/navigation';

import type { AdminBookingSettlementSnapshot } from '../../../../lib/admin-api';
import { adminGetResult } from '../../../../lib/admin-api';
import { AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import {
  AdminDisclosure,
  AdminErrorState,
  AdminRowItem,
  AdminSurfaceBlock,
} from '../../../../components/admin-surface';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadge } from '../../../../components/status-badge';
import { shortId } from '../../../../lib/admin-format';
import { financePersonName } from '../../finance-participant-label';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { paymentFeeEvidenceState } from '../../payment-fee-evidence-model';
import { financeTaxCloseoutStatusTone } from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bookingSettlementReversalDetailHref,
  buildBookingSettlementSnapshotDetailApiHref,
  generalLedgerDetailHref,
  paymentClearingDetailHref,
  safeBookingSettlementAuditReturnTo,
} from '../../tax-settlement-page-model';
import {
  formatSettlementAuditTimestamp,
  settlementAuditBlockerLabel,
  settlementAuditDueLabel,
  settlementAuditFormulaLabel,
  settlementAuditOwnerLabel,
  settlementAuditRemediationLabel,
  settlementAuditWorkflowStateLabel,
  settlementAuditWorkflowUrgencyLabel,
  settlementAuditWorkflowUrgencyTone,
} from '../settlement-audit-copy';

type BookingSettlementAuditDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingSettlementAuditDetailPage({
  params,
  searchParams,
}: BookingSettlementAuditDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnToParam = resolvedSearchParams.returnTo;
  const returnTo = safeBookingSettlementAuditReturnTo(
    Array.isArray(returnToParam) ? returnToParam[0] : returnToParam,
  );
  const snapshotResult = await adminGetResult<AdminBookingSettlementSnapshot | null>(
    buildBookingSettlementSnapshotDetailApiHref(id),
    null,
  );
  if (!snapshotResult.ok && snapshotResult.status === 404) {
    notFound();
  }
  if (!snapshotResult.ok || !snapshotResult.data) {
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to results</AdminFormControlLink>}
        description="The settlement evidence could not be loaded. No audit conclusion has been inferred."
        title="Booking Settlement Audit Detail"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={returnTo}>Back to results</AdminFormControlLink>}
          message="Retry the record from the audit queue before making a finance or closeout decision."
          title="Settlement evidence unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const snapshot = snapshotResult.data;

  const coupon = couponSettlementInfo(snapshot);
  const paymentFee = paymentFeePolicyInfo(snapshot);
  const paymentFeeEvidence = paymentFeeEvidenceState(snapshot);
  const health = snapshot.settlementAuditHealth;
  const auditState = settlementAuditState(health.state);
  const primaryBlocker = health.blockers[0] ?? null;

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink
          className="button-secondary"
          href={returnTo}
        >
          Back to results
        </AdminFormControlLink>
      }
      description="Single posted booking settlement record for finance, tax, payment fee, coupon, and payout audit evidence."
      contentClassName="booking-settlement-audit-detail"
      title="Booking Settlement Audit Detail"
    >
      <AdminSurfaceBlock className="booking-settlement-audit-decision-strip" ariaLabel="Audit decision">
        <div>
          <span>Integrity decision</span>
          <strong>{auditState.label}</strong>
          <StatusBadge tone={auditState.tone}>{health.blockers.length} blocker(s)</StatusBadge>
        </div>
        <div>
          <span>Primary owner</span>
          <strong>{primaryBlocker ? settlementAuditOwnerLabel(primaryBlocker.owner ?? primaryBlocker.ownerTeam) : 'No integrity owner'}</strong>
          <small>{primaryBlocker ? settlementAuditDueLabel(primaryBlocker.dueAt, primaryBlocker.priority) : 'No integrity due date'}</small>
        </div>
        <div>
          <span>Amount at risk</span>
          <strong><MoneyText amount={snapshot.auditAmountAtRisk ?? 0} currency={snapshot.currency} /></strong>
          <small>Server-classified exposure</small>
        </div>
        <div>
          <span>Tax workflow</span>
          <strong>{settlementAuditWorkflowStateLabel(health.workflow?.state)}</strong>
          {health.workflow ? (
            <StatusBadge tone={settlementAuditWorkflowUrgencyTone(health.workflow.urgency)}>
              {settlementAuditWorkflowUrgencyLabel(health.workflow.urgency)}
            </StatusBadge>
          ) : null}
        </div>
      </AdminSurfaceBlock>

      <FinanceTablePanel
        description="Integrity blockers are sorted by server priority. Tax workflow status is tracked separately unless it blocks closeout."
        resultLabel={health.blockers.length > 0 ? `${health.blockers.length} blocker(s)` : 'No integrity blocker'}
        resultTone={health.blockers.length > 0 ? 'danger' : 'success'}
        title="Action checklist"
      >
        {health.blockers.length > 0 ? (
          <div className="booking-settlement-audit-blocker-list">
            {health.blockers.map((blocker) => (
              <AdminRowItem className="booking-settlement-audit-blocker" key={blocker.code}>
                <div>
                  <StatusBadge tone={blocker.blockingCloseout === false ? 'warning' : 'danger'}>
                    Priority {blocker.priority ?? 'not ranked'}
                  </StatusBadge>
                  <strong>{settlementAuditBlockerLabel(blocker.code)}</strong>
                  {blocker.blockingCloseout === false ? null : <span className="muted">Blocks closeout</span>}
                </div>
                <p>{blocker.nextAction}</p>
                <dl>
                  <div><dt>Owner</dt><dd>{settlementAuditOwnerLabel(blocker.owner ?? blocker.ownerTeam)}</dd></div>
                  <div><dt>Due</dt><dd>{settlementAuditDueLabel(blocker.dueAt, blocker.priority)}</dd></div>
                  <div><dt>Evidence amount</dt><dd>{blocker.amount == null ? 'Not amount-based' : <MoneyText amount={blocker.amount} currency={snapshot.currency} />}</dd></div>
                </dl>
                {blocker.remediationHref ? (
                  <AdminTextLink href={blocker.remediationHref}>{settlementAuditRemediationLabel(blocker.code)}</AdminTextLink>
                ) : null}
              </AdminRowItem>
            ))}
          </div>
        ) : (
          <p className="muted">No evidence or allocation integrity blocker was found for this record.</p>
        )}
      </FinanceTablePanel>

      <FinanceTablePanel
        description={
          <>
            Settlement record {shortId(snapshot.id)} · Posted <DateTimeText value={snapshot.postedAt} /> · Period{' '}
            {snapshot.monthlyPeriod}
          </>
        }
        resultLabel={snapshot.taxStatus}
        resultTone={financeTaxCloseoutStatusTone(snapshot.taxStatus)}
        title="Identity"
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

      <AccountingAllocationPanel snapshot={snapshot} />

      <FinanceTablePanel
        description={`${settlementAuditFormulaLabel()} · Checked ${formatSettlementAuditTimestamp(health.checkedAt)}.`}
        resultLabel={auditState.label}
        resultTone={auditState.tone}
        title="Canonical evidence"
      >
        <FinanceOperatingPath
          ariaLabel="Booking settlement operating path"
          steps={[
            {
              detail: settlementPaymentMethodLabel(snapshot.paymentMethod),
              label: 'Customer payment',
              value: <MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />,
            },
            {
              detail: (
                <>
                  Delta <MoneyText amount={health.allocation.delta} currency={snapshot.currency} />
                </>
              ),
              label: 'Settlement split',
              value: health.checks.allocation === 'PASS' ? 'Allocation verified' : 'Review required',
            },
            {
              detail: `Journal ${settlementAuditCheckLabel(health.checks.canonicalJournal)} · Clearing ${settlementAuditCheckLabel(health.checks.canonicalClearing)}`,
              label: 'Canonical evidence',
              value: `${health.evidence.canonicalJournal.count} journal · ${health.evidence.canonicalClearing.count} clearing`,
            },
            {
              detail: settlementNextAction(snapshot),
              label: health.evidence.reversal.lifecycle === 'NONE' ? 'Next action' : 'Reversal lifecycle',
              value:
                health.evidence.reversal.lifecycle === 'NONE'
                  ? settlementAuditWorkflowStateLabel(health.workflow?.state)
                  : reversalLifecycleLabel(health.evidence.reversal.lifecycle),
            },
          ]}
        />
        <FinanceDetailGrid>
          <SettlementJournalEvidence snapshot={snapshot} />
          <PaymentClearingEvidence snapshot={snapshot} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      {health.evidence.reversal.lifecycle !== 'NONE' ? (
        <FinanceTablePanel
          description="Reversal evidence is evaluated by payment method. Cash and customer wallet do not require external refund clearing."
          resultLabel={health.checks.reversal === 'PASS' ? 'Reversal evidence complete' : 'Reversal evidence incomplete'}
          resultTone={health.checks.reversal === 'PASS' ? 'success' : 'danger'}
          title="Reversal evidence"
        >
          <FinanceDetailGrid>
            <SettlementReversalEvidence snapshot={snapshot} />
          </FinanceDetailGrid>
        </FinanceTablePanel>
      ) : null}

      <FinanceTablePanel
        description={health.workflow?.reason ?? 'No tax workflow reason was recorded.'}
        resultLabel={health.workflow ? settlementAuditWorkflowUrgencyLabel(health.workflow.urgency) : 'Status unavailable'}
        resultTone={health.workflow ? settlementAuditWorkflowUrgencyTone(health.workflow.urgency) : 'warning'}
        title="Tax workflow"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Status" value={settlementAuditWorkflowStateLabel(health.workflow?.state)} />
          <FinanceDetailInfoItem label="Due" value={health.workflow?.dueAt ? formatSettlementAuditTimestamp(health.workflow.dueAt) : 'Due date not recorded'} />
          <FinanceDetailInfoItem label="Urgency" value={health.workflow ? settlementAuditWorkflowUrgencyLabel(health.workflow.urgency) : 'Unknown'} />
          <FinanceDetailInfoItem label="Accounting period" value={snapshot.monthlyPeriod} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Payment provider fee evidence is copied to the settlement record so method-specific CARD, MOMO, or VNPAY rules can be audited later."
        resultLabel={<StatusBadge tone={paymentFeeEvidence.tone}>{paymentFeeEvidence.label}</StatusBadge>}
        resultTone={paymentFeeEvidence.tone}
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
          <FinanceDetailInfoItem label="Evidence result" value={paymentFeeEvidence.detail} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Coupon values are copied from the booking settlement metadata so later coupon edits do not rewrite historical finance evidence."
        resultLabel={couponEvidenceLabel(health.checks.couponPolicy)}
        resultTone={health.checks.couponPolicy === 'FAIL' ? 'danger' : health.checks.couponPolicy === 'PASS' ? 'success' : 'info'}
        title="Coupon and policy record"
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

      <AdminDisclosure className="booking-settlement-audit-technical-evidence">
        <summary>Technical evidence</summary>
        <dl>
          <div><dt>Settlement ID</dt><dd><code>{snapshot.id}</code></dd></div>
          <div><dt>Booking ID</dt><dd><code>{snapshot.bookingId}</code></dd></div>
          {snapshot.accountingJournalBatches?.map((journal) => (
            <div key={journal.id}><dt>Journal source key</dt><dd><code>{journal.sourceKey}</code></dd></div>
          ))}
          {snapshot.paymentClearingEntries?.map((clearing) => (
            <div key={clearing.id}><dt>Clearing source key</dt><dd><code>{clearing.sourceKey}</code></dd></div>
          ))}
        </dl>
      </AdminDisclosure>
    </AdminPageTemplate>
  );
}

function AccountingAllocationPanel({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const health = snapshot.settlementAuditHealth;
  return (
    <FinanceTablePanel
      description="Posted values are immutable. Refunds and closed-period changes create reversal evidence instead."
      resultLabel={health.checks.allocation === 'PASS' ? 'Allocation verified' : 'Review allocation'}
      resultTone={health.checks.allocation === 'PASS' ? 'success' : 'danger'}
      title="Allocation equation"
    >
      <div className="booking-settlement-audit-equation">
        <span>Customer payment <strong><MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} /></strong></span>
        <span aria-hidden="true">+</span>
        <span>HANDS-funded coupon <strong><MoneyText amount={health.allocation.companyCouponExpense} currency={snapshot.currency} /></strong></span>
        <span aria-hidden="true">=</span>
        <span>Partner payout <strong><MoneyText amount={snapshot.partnerPayoutAmount} currency={snapshot.currency} /></strong></span>
        <span aria-hidden="true">+</span>
        <span>Withholding <strong><MoneyText amount={snapshot.partnerWithholdingTotal} currency={snapshot.currency} /></strong></span>
        <span aria-hidden="true">+</span>
        <span>Platform fee <strong><MoneyText amount={snapshot.platformFeeGross} currency={snapshot.currency} /></strong></span>
      </div>
      <FinanceDetailGrid>
        <FinanceDetailInfoItem label="Allocation delta" value={<MoneyText amount={health.allocation.delta} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Partner taxable revenue" value={<MoneyText amount={snapshot.partnerTaxableRevenue} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Partner VAT" value={<MoneyText amount={snapshot.partnerVatAmount} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Partner PIT" value={<MoneyText amount={snapshot.partnerPitAmount} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Platform net revenue" value={<MoneyText amount={snapshot.platformFeeNetRevenue} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Company output VAT" value={<MoneyText amount={snapshot.companyOutputVat} currency={snapshot.currency} />} />
        <FinanceDetailInfoItem label="Payment processing fee" value={<MoneyText amount={snapshot.paymentProcessingFee} currency={snapshot.currency} />} />
      </FinanceDetailGrid>
    </FinanceTablePanel>
  );
}

function SettlementJournalEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const journal = snapshot.accountingJournalBatches?.find((entry) => entry.sourceType === 'BOOKING_SETTLEMENT') ?? null;
  const status = journal ? settlementJournalStatusLabel(journal.status) : 'Journal missing';

  return (
    <FinanceDetailInfoItem
      label="Canonical settlement journal"
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
          </>
        ) : (
          status
        )
      }
    />
  );
}

function PaymentClearingEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const clearing = snapshot.paymentClearingEntries?.find(
    (entry) => entry.type === 'SETTLEMENT_POSTED' || entry.type === 'CUSTOMER_PAYMENT_CAPTURED',
  ) ?? null;
  const health = snapshot.settlementAuditHealth.evidence.canonicalClearing;
  const status = clearing
    ? settlementClearingStatusLabel(clearing.status)
    : health.required
      ? 'Clearing missing'
      : 'External clearing not applicable';

  return (
    <FinanceDetailInfoItem
      label="Canonical payment clearing"
      value={
        clearing ? (
          <>
            <AdminTextLink href={paymentClearingDetailHref(clearing.id)}>
              {status}
            </AdminTextLink>
            <span className="muted admin-block">
              {clearing.type} · <MoneyText amount={clearing.amount} currency={clearing.currency} />
            </span>
            <span className="muted admin-block">
              Bank matched <MoneyText amount={health.matchedAmount} currency={clearing.currency} /> · Unmatched{' '}
              <MoneyText amount={health.unmatchedAmount} currency={clearing.currency} />
            </span>
          </>
        ) : (
          status
        )
      }
    />
  );
}

function SettlementReversalEvidence({ snapshot }: { readonly snapshot: AdminBookingSettlementSnapshot }) {
  const health = snapshot.settlementAuditHealth.evidence.reversal;
  const reversal = snapshot.reversalEntries?.[0] ?? null;
  const journal = snapshot.accountingJournalBatches?.find(
    (entry) => entry.sourceType === 'BOOKING_SETTLEMENT_REVERSAL',
  ) ?? null;
  const clearing = snapshot.paymentClearingEntries?.find((entry) => entry.type === 'REFUND_REVERSAL') ?? null;

  if (health.lifecycle === 'NONE') {
    return <FinanceDetailInfoItem label="Reversal evidence" value="No reversal recorded" />;
  }

  return (
    <FinanceDetailInfoItem
      label="Reversal evidence"
      value={
        <>
          <strong>{reversalLifecycleLabel(health.lifecycle)}</strong>
          <span className="muted admin-block">{health.reason ?? snapshot.reversalReason ?? 'Reason not retained'}</span>
          {reversal ? (
            <AdminTextLink href={bookingSettlementReversalDetailHref(reversal.id)}>
              Open closed-period reversal record
            </AdminTextLink>
          ) : null}
          <span className="muted admin-block">
            {journal ? settlementJournalStatusLabel(journal.status) : 'Reversal journal missing'} ·{' '}
            {clearing ? settlementClearingStatusLabel(clearing.status) : 'Refund clearing missing'}
          </span>
          <span className="muted admin-block">
            Original period {reversal?.originalMonthlyPeriod ?? snapshot.monthlyPeriod} · Reversal period{' '}
            {health.reversalPeriod ?? 'same open period'}
          </span>
          {health.reversedAt ? (
            <span className="muted admin-block"><DateTimeText value={health.reversedAt} /></span>
          ) : null}
          {journal ? <AdminTextLink href={generalLedgerDetailHref(journal.id)}>View reversal journal</AdminTextLink> : null}
          {clearing ? <AdminTextLink href={paymentClearingDetailHref(clearing.id)}>View refund clearing</AdminTextLink> : null}
        </>
      }
    />
  );
}

function settlementNextAction(snapshot: AdminBookingSettlementSnapshot) {
  const health = snapshot.settlementAuditHealth;
  if (health.blockers[0]) return health.blockers[0].nextAction;
  if (health.state === 'REVERSED_CLEAR') return 'Reversal evidence complete';
  if (health.state === 'CLEAR') return 'No integrity action required';
  return 'Evidence could not be fully checked';
}

function settlementAuditState(state: AdminBookingSettlementSnapshot['settlementAuditHealth']['state']): {
  readonly label: string;
  readonly tone: 'danger' | 'info' | 'success' | 'warning';
} {
  if (state === 'ACTION_REQUIRED') return { label: 'Action required', tone: 'danger' };
  if (state === 'REVERSED_CLEAR') return { label: 'Reversal evidenced', tone: 'info' };
  if (state === 'CLEAR') return { label: 'Integrity clear', tone: 'success' };
  return { label: 'Audit state unknown', tone: 'warning' };
}

function settlementAuditCheckLabel(state: AdminBookingSettlementSnapshot['settlementAuditHealth']['checks']['allocation']) {
  if (state === 'PASS') return 'complete';
  if (state === 'FAIL') return 'needs review';
  if (state === 'NOT_APPLICABLE') return 'not applicable';
  return 'unknown';
}

function settlementJournalStatusLabel(status: string) {
  if (status === 'POSTED') return 'Journal posted';
  if (status === 'REVERSED') return 'Journal reversed';
  if (status === 'DRAFT') return 'Journal draft';
  return 'Journal status unknown';
}

function settlementClearingStatusLabel(status: string) {
  if (status === 'CLEARED') return 'Clearing complete';
  if (status === 'REVERSED') return 'Clearing reversed';
  if (status === 'PARTIALLY_CLEARED') return 'Clearing partially complete';
  if (status === 'OPEN') return 'Clearing open';
  return 'Clearing status unknown';
}

function settlementPaymentMethodLabel(method: AdminBookingSettlementSnapshot['paymentMethod']) {
  if (method === 'CUSTOMER_WALLET') return 'Customer wallet';
  if (method === 'BANK_TRANSFER') return 'Bank transfer';
  if (method === 'VNPAY') return 'VNPay';
  if (method === 'MOMO') return 'MoMo';
  return method.charAt(0) + method.slice(1).toLowerCase();
}

function reversalLifecycleLabel(lifecycle: 'NONE' | 'OPEN_PERIOD' | 'CLOSED_PERIOD') {
  if (lifecycle === 'OPEN_PERIOD') return 'Open-period reversal';
  if (lifecycle === 'CLOSED_PERIOD') return 'Closed-period reversal';
  return 'No reversal';
}

function couponEvidenceLabel(state: AdminBookingSettlementSnapshot['settlementAuditHealth']['checks']['couponPolicy']) {
  if (state === 'NOT_APPLICABLE') return 'No coupon applied';
  if (state === 'PASS') return 'Coupon evidence complete';
  if (state === 'FAIL') return 'Coupon evidence missing';
  return 'Coupon evidence unknown';
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
    settlementBasePolicy: stringValue(metadata?.settlementBasePolicySnapshot) ?? '-',
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
    policyVersionId: snapshot.paymentFeePolicyVersionId ?? (hasPolicySnapshot ? '-' : 'Policy record missing'),
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
