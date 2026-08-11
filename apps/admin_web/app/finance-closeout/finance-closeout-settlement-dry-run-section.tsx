import type { AdminBookingSettlementGapDryRun } from '../../lib/admin-api';
import { AdminDataTable, AdminTableSubstack } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';

type FinanceCloseoutSettlementDryRunSectionProps = {
  readonly clearHref: string;
  readonly hrefForBatch: (bookingIds: readonly string[]) => string;
  readonly report: AdminBookingSettlementGapDryRun | null;
  readonly runHref: string;
};

export function FinanceCloseoutSettlementDryRunSection({
  clearHref,
  hrefForBatch,
  report,
  runHref,
}: FinanceCloseoutSettlementDryRunSectionProps) {
  if (!report) {
    return (
      <AdminTableSection
        actions={<AdminTextLink href={runHref}>Run safety check</AdminTextLink>}
        description="Evaluate up to 100 historical paid-evidence gaps with the production settlement calculator and journal builder. This creates no snapshot, journal, clearing entry, or audit write."
        title="Batch safety check (read-only)"
      >
        <p className="muted">
          Run this report after selecting a settlement month or payment method. Individual repairs remain separate
          dual-approval actions.
        </p>
      </AdminTableSection>
    );
  }

  const currency = 'VND';
  const allBalanced = report.counts.journalBalanced === report.evaluated;
  const allEvaluated = report.evaluated === report.totalMatched && !report.truncated;

  return (
    <AdminTableSection
      actions={
        <>
          <AdminTextLink href={runHref}>Run safety check again</AdminTextLink>
          <AdminTextLink href={clearHref}>Close report</AdminTextLink>
        </>
      }
      bodyClassName="admin-table-section-body"
      description="Read-only expected accounting for the current settlement month and payment-method filters. No finance record is written by this report."
      scrollable
      title={`Batch safety check (read-only) · ${report.evaluated} evaluated`}
    >
      <AdminDataTable
        emptyMessage="No historical settlement gaps matched this dry-run scope."
        headers={['Check', 'Result', 'Expected accounting / operator meaning']}
        rowCount={report.evaluated ? 8 : 0}
      >
        {report.evaluated ? (
          <>
            <tr>
              <td>Evaluation coverage</td>
              <td>
                <StatusBadge tone={allEvaluated ? 'success' : 'warning'}>
                  {report.evaluated} of {report.totalMatched}
                </StatusBadge>
              </td>
              <td>
                {report.truncated
                  ? 'The 100-record safety limit was reached. Narrow the settlement month or payment method.'
                  : 'Every matching historical policy-review gap was evaluated.'}
              </td>
            </tr>
            <tr>
              <td>Repair eligibility</td>
              <td>
                <StatusBadge
                  tone={report.counts.blocked ? 'danger' : report.counts.reviewRequired ? 'warning' : 'success'}
                >
                  {report.counts.eligible} approved · {report.counts.reviewRequired ?? 0} review ·{' '}
                  {report.counts.blocked} blocked
                </StatusBadge>
              </td>
              <td>{operatorGroupedCounts(report.blockerCodes, 'No preview blockers')}</td>
            </tr>
            <tr>
              <td>Finance policy gate</td>
              <td>
                <StatusBadge tone={report.policyGate.status === 'REVIEW_REQUIRED' ? 'warning' : 'success'}>
                  {report.policyGate.status === 'REVIEW_REQUIRED' ? 'Review required' : 'Ready for approval'}
                </StatusBadge>
              </td>
              <td>
                {report.policyGate.issues.length
                  ? report.policyGate.issues
                      .map(
                        (issue) =>
                          `${operatorCodeLabel(issue.code)}: ${issue.count} · ${issue.message}`,
                      )
                      .join(' ')
                  : 'No accounting policy exception was detected.'}
              </td>
            </tr>
            <tr>
              <td>Journal balance</td>
              <td>
                <StatusBadge tone={allBalanced && !report.counts.reconciliationReview ? 'success' : 'danger'}>
                  {report.counts.journalBalanced} balanced · {report.counts.reconciliationReview} delta review
                </StatusBadge>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>
                    Debit <MoneyText amount={report.totals.journalTotalDebit} currency={currency} /> · Credit{' '}
                    <MoneyText amount={report.totals.journalTotalCredit} currency={currency} />
                  </span>
                  <span className="muted">
                    A non-zero reconstruction delta is posted to an explicit review account and must block monthly close.
                  </span>
                </AdminTableSubstack>
              </td>
            </tr>
            <tr>
              <td>Payment fee evidence</td>
              <td>
                <StatusBadge tone={report.counts.paymentFeeDefaulted ? 'warning' : 'success'}>
                  {report.counts.paymentFeePolicyMatched} policy · {report.counts.paymentFeeDefaulted} defaulted
                </StatusBadge>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>
                    Expected processing fee <MoneyText amount={report.totals.paymentProcessingFee} currency={currency} />.
                  </span>
                  {report.counts.paymentFeeDefaulted ? (
                    <AdminTextLink href="/finance-tax/payment-fees">
                      Review payment fee policy and activation blockers
                    </AdminTextLink>
                  ) : (
                    <span className="muted">Every evaluated record matched retained payment fee policy evidence.</span>
                  )}
                </AdminTableSubstack>
              </td>
            </tr>
            <tr>
              <td>Company output VAT</td>
              <td>
                <StatusBadge tone={report.counts.platformVatUnexplainedZero ? 'warning' : 'success'}>
                  {report.counts.companyOutputVatPositive} positive · {report.counts.companyOutputVatZero} zero
                </StatusBadge>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>
                    Expected output VAT <MoneyText amount={report.totals.companyOutputVat} currency={currency} /> from
                    retained historical platform-fee evidence.
                  </span>
                  <span className="muted">
                    Retained service VAT rule {report.counts.platformVatExplicitZeroServiceRule} · Policy zero{' '}
                    {report.counts.platformVatZeroFromPolicy} · Unexplained zero{' '}
                    {report.counts.platformVatUnexplainedZero}
                  </span>
                </AdminTableSubstack>
              </td>
            </tr>
            <tr>
              <td>Expected money flow</td>
              <td>
                <StatusBadge tone="info">Read only</StatusBadge>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>
                    Customer payment <MoneyText amount={report.totals.customerPaymentAmount} currency={currency} /> · Partner
                    payout <MoneyText amount={report.totals.partnerPayoutAmount} currency={currency} />
                  </span>
                  <span className="muted">
                    Withholding <MoneyText amount={report.totals.partnerWithholdingTotal} currency={currency} /> · Platform
                    gross <MoneyText amount={report.totals.platformFeeGross} currency={currency} /> · Net revenue{' '}
                    <MoneyText amount={report.totals.platformFeeNetRevenue} currency={currency} />
                  </span>
                </AdminTableSubstack>
              </td>
            </tr>
            <tr>
              <td>Scope distribution</td>
              <td>
                <StatusBadge tone="neutral">Historical records</StatusBadge>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>Payment: {groupedCounts(report.paymentMethods, 'None')}</span>
                  <span className="muted">Monthly close: {groupedCounts(report.periodStatuses, 'None')}</span>
                </AdminTableSubstack>
              </td>
            </tr>
          </>
        ) : null}
      </AdminDataTable>
      {report.recoveryBatches.length ? (
        <>
          <h3>Prepared review batches</h3>
          <p className="muted">
            Each batch contains at most 10 records. Opening a batch only loads the existing read-only comparison;
            every repair still requires a separate dual-approval action.
          </p>
          <AdminDataTable
            emptyMessage="No review batches were prepared."
            headers={['Batch', 'Records', 'Expected flow', 'Policy checks', 'Review']}
            rowCount={report.recoveryBatches.length}
          >
            {report.recoveryBatches.map((batch) => (
              <tr key={batch.batchKey}>
                <td>
                  <strong>{batch.paymentMethod}</strong>
                  <br />
                  <span className="muted">{batch.batchKey}</span>
                </td>
                <td>
                  {batch.recordCount} record(s)
                  <br />
                  <span className="muted">
                    {batch.counts.eligible} approved · {batch.counts.reviewRequired ?? 0} review ·{' '}
                    {batch.counts.blocked} blocked
                  </span>
                </td>
                <td>
                  <AdminTableSubstack>
                    <span>
                      Customer <MoneyText amount={batch.totals.customerPaymentAmount} currency={currency} /> · Partner{' '}
                      <MoneyText amount={batch.totals.partnerPayoutAmount} currency={currency} />
                    </span>
                    <span className="muted">
                      Fee gross <MoneyText amount={batch.totals.platformFeeGross} currency={currency} /> · Withholding{' '}
                      <MoneyText amount={batch.totals.partnerWithholdingTotal} currency={currency} />
                    </span>
                  </AdminTableSubstack>
                </td>
                <td>
                  <StatusBadge tone={batch.executionStatus === 'REVIEW_REQUIRED' ? 'warning' : 'success'}>
                    {batch.executionStatus === 'REVIEW_REQUIRED' ? 'Policy review' : 'Ready'}
                  </StatusBadge>
                  <br />
                  <span className="muted">
                    {batch.counts.paymentFeeDefaulted} fee default · {batch.counts.platformVatUnexplainedZero} unexplained
                    VAT · {batch.counts.reconciliationReview} delta
                  </span>
                </td>
                <td>
                  <AdminTextLink href={hrefForBatch(batch.bookingIds)}>Review {batch.recordCount}</AdminTextLink>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </>
      ) : null}
    </AdminTableSection>
  );
}

function groupedCounts(groups: Record<string, number>, emptyLabel: string) {
  const entries = Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([label, count]) => `${label}: ${count}`).join(' · ') : emptyLabel;
}

function operatorGroupedCounts(groups: Record<string, number>, emptyLabel: string) {
  const entries = Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([label, count]) => `${operatorCodeLabel(label)}: ${count}`).join(' · ')
    : emptyLabel;
}

function operatorCodeLabel(code: string) {
  switch (code) {
    case 'OPEN_OR_UNLINKED':
      return 'Monthly close is open or not linked';
    case 'PAYMENT_FEE_POLICY_DEFAULTED':
      return 'Payment-fee policy evidence needs review';
    case 'PREVIEW_BLOCKED':
      return 'Missing evidence blocks one or more records';
    case 'JOURNAL_RECONCILIATION_REVIEW':
      return 'Journal reconciliation needs review';
    case 'PLATFORM_VAT_EVIDENCE_UNEXPLAINED':
      return 'Platform VAT evidence needs review';
    case 'MONTHLY_PERIOD_FINALIZED':
      return 'Monthly close is finalized';
    default:
      return code
        .toLowerCase()
        .split('_')
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(' ');
  }
}
