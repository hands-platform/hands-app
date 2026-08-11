import type {
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementSnapshotSummary,
  AdminPaymentMethod,
  AdminSettlementAuditCheckState,
  AdminSettlementAuditHealth,
} from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { AdminDisclosure, AdminErrorState, AdminSurfaceBlock } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  bookingSettlementAuditDetailHref,
  bookingSettlementAuditHref,
  buildBookingSettlementAuditExportHref,
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBookingSettlementSummary,
  readBookingSettlementAuditFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  reviewLabel,
} from '../tax-settlement-page-model';
import {
  formatSettlementAuditTimestamp,
  settlementAuditAgeLabel,
  settlementAuditBlockerLabel,
  settlementAuditBlockerShortLabel,
  settlementAuditDueLabel,
  settlementAuditOwnerLabel,
  settlementAuditRemediationLabel,
  settlementAuditWorkflowStateLabel,
  settlementAuditWorkflowUrgencyLabel,
  settlementAuditWorkflowUrgencyTone,
} from './settlement-audit-copy';

type BookingSettlementAuditPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingSettlementAuditPage({ searchParams }: BookingSettlementAuditPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readBookingSettlementAuditFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const globalFilters = {
    page: 1,
    range: 'all' as const,
    review: 'all' as const,
    sort: 'oldest' as const,
    take: 25,
  };
  const [queueSummaryResult, globalSummaryResult, snapshotsResult] = await Promise.all([
    adminGetResult<AdminBookingSettlementSnapshotSummary>(
      buildBookingSettlementSnapshotSummaryApiHref(filters),
      emptyBookingSettlementSummary(),
    ),
    adminGetResult<AdminBookingSettlementSnapshotSummary>(
      buildBookingSettlementSnapshotSummaryApiHref(globalFilters),
      emptyBookingSettlementSummary(),
    ),
    adminGetResult<AdminBookingSettlementSnapshot[]>(
      buildBookingSettlementSnapshotApiHref(filters),
      [],
    ),
  ]);
  const queueSummary = queueSummaryResult.data;
  const globalSummary = globalSummaryResult.data;
  const snapshots = snapshotsResult.data;
  const totalRows = queueSummaryResult.ok ? queueSummary.count : snapshots.length;
  const pagination = buildTaxSettlementServerPagination(snapshots, filters, totalRows);
  const currentHref = bookingSettlementAuditHref(filters);
  const detailReturnTo = currentHref;
  const csvHref = buildBookingSettlementAuditExportHref(filters);
  const clearSearchHref = bookingSettlementAuditHref({ ...filters, page: 1, q: undefined });
  const resetHref = bookingSettlementAuditHref({
    page: 1,
    range: 'all',
    review: 'integrity-exceptions',
    sort: 'oldest',
    take: 25,
  });
  const checkedAt = globalSummary.checkedAt || queueSummary.checkedAt;
  const globalQueueHref = (review: typeof filters.review) =>
    bookingSettlementAuditHref({ ...globalFilters, review });

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'booking-settlement-audit',
            monthlyFilters,
            settlementFilters: filters,
            withholdingFilters,
          })}
        >
          <StatusBadgeLink
            download={`hands-booking-settlement-audit-${filters.range}-${filters.review}.csv`}
            href={csvHref}
            tone="success"
          >
            Export filtered records
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Trace each posted booking from allocation through canonical journal, payment clearing, bank evidence, tax period, and reversal evidence."
      contentClassName="booking-settlement-audit-page"
      title="Booking Settlement Audit"
    >
      {globalSummaryResult.ok ? (
        <SettlementAuditCommandStrip
          integrityHref={globalQueueHref('integrity-exceptions')}
          paymentHref={globalQueueHref('payment-evidence')}
          summary={globalSummary}
          taxHref={globalQueueHref('tax-workflow')}
        />
      ) : (
        <AdminErrorState
          action={<AdminFormControlLink href={currentHref}>Retry</AdminFormControlLink>}
          className="admin-mb-16"
          message="Settlement audit totals could not be loaded. Retry before using queue counts for finance decisions."
          title="Settlement summary unavailable"
        />
      )}

      <AdminFilterPanel
        className="admin-mb-16 booking-settlement-audit-filter-panel"
        description={filterDescription(filters, pagination, checkedAt)}
        resultLabel={queueSummaryResult.ok ? `${pagination.totalRows} matching record(s)` : 'Count unavailable'}
        resultTone={queueSummaryResult.ok ? bookingSettlementResultTone(filters.review, pagination.totalRows) : 'danger'}
        title="Audit records"
      >
        <AdminFormShell
          action="/finance-tax/booking-settlement-audit"
          className="booking-settlement-audit-toolbar"
          method="get"
        >
          <div className="booking-settlement-audit-primary-filters">
            <AdminFormSearch
              className="booking-settlement-audit-search"
              defaultValue={filters.q ?? ''}
              label="Search records"
              labelVisibility="visible"
              name="q"
              placeholder="Name, booking, payment, settlement"
            />
            <AdminFormSelect
              defaultValue={filters.review}
              label="Queue"
              labelVisibility="visible"
              name="review"
              options={BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS.map((item) => ({
                label: item.label,
                value: item.review,
              }))}
            />
            <AdminFormSelect
              defaultValue={filters.owner ?? ''}
              label="Owner"
              labelVisibility="visible"
              name="owner"
              options={BOOKING_SETTLEMENT_OWNER_OPTIONS}
            />
            <AdminFormSelect
              defaultValue={filters.sort ?? 'oldest'}
              label="Sort"
              labelVisibility="visible"
              name="sort"
              options={BOOKING_SETTLEMENT_SORT_OPTIONS}
            />
            <AdminFormActionRow className="booking-settlement-audit-filter-actions" wide={false}>
              <AdminFormControlButton className="button-primary" type="submit">
                Apply
              </AdminFormControlButton>
              <AdminFormControlLink href={resetHref}>Reset</AdminFormControlLink>
            </AdminFormActionRow>
          </div>
          <AdminDisclosure className="booking-settlement-audit-advanced-filters">
            <summary>Advanced filters</summary>
            <div>
              <AdminFormSelect
                defaultValue={filters.range}
                label="Posted range"
                labelVisibility="visible"
                name="range"
                options={BOOKING_SETTLEMENT_RANGE_OPTIONS}
              />
              <AdminFormDate
                defaultValue={filters.period ?? ''}
                label="Accounting period"
                labelVisibility="visible"
                mode="month"
                name="period"
              />
              <AdminFormSelect
                defaultValue={filters.paymentMethod ?? ''}
                label="Payment method"
                labelVisibility="visible"
                name="paymentMethod"
                options={BOOKING_SETTLEMENT_PAYMENT_METHOD_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.reason ?? ''}
                label="Reason"
                labelVisibility="visible"
                name="reason"
                options={BOOKING_SETTLEMENT_REASON_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={filters.status ?? ''}
                label="Tax status"
                labelVisibility="visible"
                name="status"
                options={BOOKING_SETTLEMENT_STATUS_OPTIONS}
              />
              <AdminFormSelect
                defaultValue={String(filters.take)}
                label="Rows"
                labelVisibility="visible"
                name="take"
                options={FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                  label: String(take),
                  value: String(take),
                }))}
              />
            </div>
          </AdminDisclosure>
        </AdminFormShell>
        <AppliedAuditFilters filters={filters} resetHref={resetHref} />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description={bookingSettlementTableDescription(filters.review)}
        resultLabel={queueSummaryResult.ok ? `${pagination.totalRows} row(s)` : 'Total unavailable'}
        resultTone={queueSummaryResult.ok ? bookingSettlementResultTone(filters.review, pagination.totalRows) : 'danger'}
        title={reviewLabel(filters.review)}
      >
        {!snapshotsResult.ok || !queueSummaryResult.ok ? (
          <AdminErrorState
            action={<AdminFormControlLink href={currentHref}>Retry filtered records</AdminFormControlLink>}
            message="Settlement records or their queue total could not be loaded. No zero-count assumption has been made."
            title="Settlement audit records unavailable"
          />
        ) : (
          <>
            <FinanceDataTable
              ariaLabel="Booking settlement audit records"
              emptyMessage={
                <div className="booking-settlement-audit-empty-state">
                  <strong>
                    {filters.q
                      ? `No settlement records match "${filters.q}".`
                      : 'No settlement records match the current audit scope.'}
                  </strong>
                  <p className="muted">Clear the search or reset the audit filters to return to the action backlog.</p>
                  <AdminFormActionRow wide={false}>
                    {filters.q ? <AdminFormControlLink href={clearSearchHref}>Clear search</AdminFormControlLink> : null}
                    <AdminFormControlLink href={resetHref}>Reset filters</AdminFormControlLink>
                  </AdminFormActionRow>
                </div>
              }
              headers={[
                'Record & parties',
                'Exposure',
                'Evidence & blockers',
                'Owner / next action',
                'Review',
              ]}
              rowCount={pagination.rows.length}
              scrollClassName="booking-settlement-audit-table-scroll"
            >
              {pagination.rows.map((snapshot) => (
                <BookingSettlementAuditRow
                  detailReturnTo={detailReturnTo}
                  key={snapshot.id}
                  snapshot={snapshot}
                />
              ))}
            </FinanceDataTable>
            <FinanceTablePaginationFooter
              ariaLabel="Booking settlement audit pages"
              hrefForPage={(page) => bookingSettlementAuditHref({ ...filters, page })}
              pagination={pagination}
            />
          </>
        )}
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function BookingSettlementAuditRow({
  detailReturnTo,
  snapshot,
}: {
  readonly detailReturnTo: string;
  readonly snapshot: AdminBookingSettlementSnapshot;
}) {
  const health = snapshot.settlementAuditHealth;
  const blocker = health.blockers[0];
  const detailHref = bookingSettlementAuditDetailHref(snapshot.id, detailReturnTo);

  return (
    <tr>
      <td>
        <AdminTextLink href={detailHref}>Settlement {shortId(snapshot.id)}</AdminTextLink>
        <div className="admin-mt-6">
          <AdminTextLink href={`/bookings/${snapshot.bookingId}`}>Booking {shortId(snapshot.bookingId)}</AdminTextLink>
        </div>
        <div className="muted"><DateTimeText value={snapshot.postedAt} /></div>
        <div className="muted">{snapshot.paymentMethod} · {snapshot.monthlyPeriod}</div>
        <div className="booking-settlement-audit-party-line">
          <strong>{financePersonName(snapshot.customerProfile?.user, 'Unknown customer')}</strong>
          <span aria-hidden="true">→</span>
          <AdminTextLink href={`/partners/${snapshot.providerProfileId}?section=full`}>
            {snapshot.providerProfile?.displayName ??
              financePersonName(snapshot.providerProfile?.user, 'Unknown Partner')}
          </AdminTextLink>
        </div>
      </td>
      <td>
        <div className="booking-settlement-audit-exposure-line">
          <span>Customer amount</span>
          <strong><MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} /></strong>
        </div>
        <div className="booking-settlement-audit-exposure-line">
          <span>Allocation delta</span>
          <strong className={health.allocation.delta === 0 ? '' : 'text-danger'}>
            <MoneyText amount={health.allocation.delta} currency={snapshot.currency} />
          </strong>
        </div>
        <div className="booking-settlement-audit-exposure-line is-risk">
          <span>Amount at risk</span>
          <strong><MoneyText amount={snapshot.auditAmountAtRisk ?? 0} currency={snapshot.currency} /></strong>
        </div>
      </td>
      <td>
        {blocker ? (
          <>
            <strong>{settlementAuditBlockerLabel(blocker.code)}</strong>{' '}
            {health.blockers.length > 1 ? <span className="muted">+ {health.blockers.length - 1} more</span> : null}
            <div className="booking-settlement-audit-reason-chips" aria-label="Integrity reasons">
              {health.blockers.map((item) => (
                <StatusBadge key={item.code} tone={item.blockingCloseout === false ? 'warning' : 'danger'}>
                  {settlementAuditBlockerShortLabel(item.code)}
                </StatusBadge>
              ))}
            </div>
          </>
        ) : (
          <strong>No integrity blocker</strong>
        )}
        <div className="booking-settlement-audit-evidence-line">
          <AuditCheckLine label="Journal" state={health.checks.canonicalJournal} />
          <AuditCheckLine label="Clearing" state={health.checks.canonicalClearing} />
          <AuditCheckLine label="Reversal" state={health.checks.reversal} />
        </div>
      </td>
      <td>
        {blocker ? (
          <>
            <strong>{settlementAuditOwnerLabel(blocker.owner ?? blocker.ownerTeam)}</strong>
            <div className="muted">{settlementAuditDueLabel(blocker.dueAt, blocker.priority)}</div>
            <div className="muted">{blocker.nextAction}</div>
            {blocker.remediationHref ? (
              <div className="admin-mt-6">
                <AdminTextLink href={blocker.remediationHref}>{settlementAuditRemediationLabel(blocker.code)}</AdminTextLink>
              </div>
            ) : null}
          </>
        ) : health.workflow?.urgency === 'OVERDUE' || health.workflow?.urgency === 'UNKNOWN' ? (
          <>
            <strong>Tax &amp; Period Close</strong>
            <div className="muted">{settlementAuditWorkflowUrgencyLabel(health.workflow.urgency)}</div>
            <AdminTextLink href={`/finance-tax/monthly-tax-closing?period=${snapshot.monthlyPeriod}`}>
              Review tax period
            </AdminTextLink>
          </>
        ) : (
          <span className="muted">No operator action required.</span>
        )}
      </td>
      <td>
        <StatusBadge tone={auditStateTone(health.state)}>{auditStateLabel(health.state)}</StatusBadge>
        <div className="admin-mt-6 muted">{settlementAuditWorkflowStateLabel(health.workflow?.state)}</div>
        {health.workflow ? (
          <div className="admin-mt-6">
            <StatusBadge tone={settlementAuditWorkflowUrgencyTone(health.workflow.urgency)}>
              {settlementAuditWorkflowUrgencyLabel(health.workflow.urgency)}
            </StatusBadge>
          </div>
        ) : null}
        <div className="admin-mt-6">
          <AdminTextLink href={detailHref}>Open audit record</AdminTextLink>
        </div>
      </td>
    </tr>
  );
}

function AuditCheckLine({ label, state }: { readonly label: string; readonly state: AdminSettlementAuditCheckState }) {
  return (
    <div className="booking-settlement-audit-check">
      <span>{label}</span>
      <StatusBadge tone={auditCheckTone(state)}>{auditCheckLabel(state)}</StatusBadge>
    </div>
  );
}

function SettlementAuditCommandStrip({
  integrityHref,
  paymentHref,
  summary,
  taxHref,
}: {
  readonly integrityHref: string;
  readonly paymentHref: string;
  readonly summary: AdminBookingSettlementSnapshotSummary;
  readonly taxHref: string;
}) {
  const oldestAge = settlementAuditAgeLabel(summary.oldestActionRequiredAt, summary.checkedAt);
  return (
    <AdminSurfaceBlock className="booking-settlement-audit-command-strip" ariaLabel="Global settlement backlog">
      <AdminTextLink href={integrityHref}>
        <span>Global action required</span>
        <strong>{summary.actionRequiredCount}</strong>
        <small>{summary.integrityReasonCount ?? summary.actionRequiredCount} overlapping reason signal(s)</small>
      </AdminTextLink>
      <AdminTextLink href={taxHref}>
        <span>Overdue tax workflow</span>
        <strong>{summary.overdueTaxCount ?? 0}</strong>
        <small>{summary.taxDueDateUnknownCount ?? 0} due date(s) unknown</small>
      </AdminTextLink>
      <AdminTextLink href={paymentHref}>
        <span>Payment evidence</span>
        <strong>{summary.paymentEvidenceCount ?? summary.clearingEvidenceIssueCount}</strong>
        <small>Unique records · Finance Operations</small>
      </AdminTextLink>
      <AdminTextLink href={integrityHref}>
        <span>Amount at risk · global</span>
        <strong><MoneyText amount={summary.amountAtRisk} currency={summary.currency} /></strong>
        <small>{oldestAge ? `Oldest action ${oldestAge}` : 'No unresolved integrity age'}</small>
      </AdminTextLink>
      <p>
        Generated {formatSettlementAuditTimestamp(summary.checkedAt)} · Asia/Ho_Chi_Minh · cards ignore table search and facets
      </p>
    </AdminSurfaceBlock>
  );
}

function AppliedAuditFilters({
  filters,
  resetHref,
}: {
  readonly filters: ReturnType<typeof readBookingSettlementAuditFilters>;
  readonly resetHref: string;
}) {
  const labels = [
    filters.q ? `Search: ${filters.q}` : null,
    filters.owner ? `Owner: ${settlementAuditOwnerLabel(filters.owner)}` : null,
    filters.reason ? `Reason: ${filters.reason.replaceAll('-', ' ')}` : null,
    filters.status ? `Tax status: ${filters.status}` : null,
    filters.paymentMethod ? `Method: ${filters.paymentMethod}` : null,
    filters.period ? `Period: ${filters.period}` : null,
    filters.range !== 'all' ? `Range: ${dateRangeLabel(filters.range)}` : null,
  ].filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;

  return (
    <div className="booking-settlement-audit-applied-filters" aria-label="Applied audit filters">
      {labels.map((label) => <StatusBadge key={label} tone="neutral">{label}</StatusBadge>)}
      <AdminTextLink href={resetHref}>Clear filters</AdminTextLink>
    </div>
  );
}

const BOOKING_SETTLEMENT_RANGE_OPTIONS = [
  { label: 'All dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
] as const;

const BOOKING_SETTLEMENT_PAYMENT_METHOD_OPTIONS: readonly {
  readonly label: string;
  readonly value: AdminPaymentMethod | '';
}[] = [
  { label: 'All methods', value: '' },
  { label: 'Card', value: 'CARD' },
  { label: 'MoMo', value: 'MOMO' },
  { label: 'VNPay', value: 'VNPAY' },
  { label: 'Customer wallet', value: 'CUSTOMER_WALLET' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Manual', value: 'MANUAL' },
];

const BOOKING_SETTLEMENT_OWNER_OPTIONS = [
  { label: 'All owners', value: '' },
  { label: 'Accounting', value: 'accounting' },
  { label: 'Finance Operations', value: 'finance-operations' },
  { label: 'Tax & Period Close', value: 'tax-period-close' },
] as const;

const BOOKING_SETTLEMENT_REASON_OPTIONS = [
  { label: 'All reasons', value: '' },
  { label: 'Allocation', value: 'allocation' },
  { label: 'Journal', value: 'journal' },
  { label: 'Clearing', value: 'clearing' },
  { label: 'Bank match', value: 'bank-match' },
  { label: 'Fee policy', value: 'fee-policy' },
  { label: 'Coupon', value: 'coupon' },
  { label: 'Tax period', value: 'tax-period' },
  { label: 'Reversal', value: 'reversal' },
  { label: 'Unknown', value: 'unknown' },
] as const;

const BOOKING_SETTLEMENT_STATUS_OPTIONS = [
  { label: 'All tax statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Declared', value: 'declared' },
  { label: 'Paid', value: 'paid' },
  { label: 'Closed', value: 'closed' },
  { label: 'Reversed', value: 'reversed' },
] as const;

const BOOKING_SETTLEMENT_SORT_OPTIONS = [
  { label: 'Oldest action first', value: 'oldest' },
  { label: 'Largest discrepancy first', value: 'largest-discrepancy' },
  { label: 'Newest first', value: 'newest' },
] as const;

function filterDescription(
  filters: ReturnType<typeof readBookingSettlementAuditFilters>,
  pagination: ReturnType<typeof buildTaxSettlementServerPagination<AdminBookingSettlementSnapshot>>,
  checkedAt: string,
) {
  const pieces = [
    `Posted range: ${dateRangeLabel(filters.range)}`,
    `Queue: ${reviewLabel(filters.review)}`,
    `Sort: ${filters.sort === 'newest' ? 'newest first' : filters.sort === 'largest-discrepancy' ? 'largest discrepancy first' : 'oldest action first'}`,
    `Page ${pagination.page} of ${pagination.totalPages}`,
  ];
  if (filters.period) pieces.push(`Accounting period: ${filters.period}`);
  if (filters.q) pieces.push(`Search: ${filters.q}`);
  if (checkedAt) pieces.push(`Server checked: ${new Date(checkedAt).toLocaleString('en-GB')}`);
  return `${pieces.join(' · ')}.`;
}

function bookingSettlementTableDescription(review: typeof BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS[number]['review']) {
  if (review === 'integrity-exceptions') return 'Unique records with allocation or evidence integrity blockers. Reason chips may overlap.';
  if (review === 'payment-evidence') return 'Unique records with clearing, bank match, or payment fee evidence work.';
  if (review === 'tax-workflow') return 'Tax workflow records, including normal, unknown, due soon, overdue, and blocked states.';
  if (review === 'reversals') return 'All reversal signals, separated by evidence completeness and other integrity blockers.';
  if (review === 'allocation-mismatch') return 'Records whose customer payment plus company coupon expense does not equal payout, withholding, and platform fee.';
  if (review === 'journal-evidence') return 'Canonical settlement journal evidence that is missing, duplicate, unposted, or unbalanced.';
  if (review === 'clearing-evidence') return 'Canonical clearing or bank reconciliation evidence that is missing, open, or amount-mismatched.';
  if (review === 'reversal-incomplete') return 'Reversed records missing required reversal journal, clearing, or closed-period evidence.';
  if (review === 'tax-evidence') return 'Tax workflow or accounting-period evidence that requires finance review.';
  if (review === 'coupon-evidence') return 'Coupon-funded settlement allocation without the policy evidence required for audit.';
  if (review === 'unknown') return 'Records whose available evidence is insufficient for a clear server decision.';
  if (review === 'resolved') return 'Server-classified clear and reversal-evidenced records.';
  if (review === 'reversed') return 'All reversed records, including evidenced and incomplete reversal lifecycles.';
  return 'Posted settlement records in the selected scope.';
}

function bookingSettlementResultTone(review: typeof BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS[number]['review'], count: number) {
  if (review === 'resolved') return 'success' as const;
  if (review === 'all' || review === 'reversed') return 'info' as const;
  return count > 0 ? 'warning' as const : 'success' as const;
}

function auditStateTone(state: AdminSettlementAuditHealth['state']) {
  if (state === 'CLEAR' || state === 'REVERSED_CLEAR') return 'success' as const;
  if (state === 'ACTION_REQUIRED') return 'danger' as const;
  return 'warning' as const;
}

function auditStateLabel(state: AdminSettlementAuditHealth['state']) {
  if (state === 'REVERSED_CLEAR') return 'Reversal evidenced';
  if (state === 'ACTION_REQUIRED') return 'Action required';
  if (state === 'UNKNOWN') return 'Evidence unknown';
  return 'Clear';
}

function auditCheckTone(state: AdminSettlementAuditCheckState) {
  if (state === 'PASS') return 'success' as const;
  if (state === 'FAIL') return 'danger' as const;
  return state === 'UNKNOWN' ? 'warning' as const : 'neutral' as const;
}

function auditCheckLabel(state: AdminSettlementAuditCheckState) {
  if (state === 'NOT_APPLICABLE') return 'N/A';
  if (state === 'UNKNOWN') return 'Unknown';
  return state === 'PASS' ? 'Pass' : 'Fail';
}
