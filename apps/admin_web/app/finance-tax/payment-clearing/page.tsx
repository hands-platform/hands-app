import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type {
  AdminBookingPaymentClearingEntry,
  AdminBookingPaymentClearingSummary,
  AdminBankReconciliationSummary,
  AdminFinanceReviewOwnerWorkloadSummary,
  AdminUser,
} from '../../../lib/admin-api';
import { adminGet, adminGetResult, adminPostOrThrow } from '../../../lib/admin-api';
import { AdminTableSubstack } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminMiniMetricStrip } from '../../../components/admin-overview-card';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminErrorState } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { formatMoney, shortId } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePaymentClearingStatusPill } from '../finance-status-badge-model';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceReviewOwnerWorkloadPanel } from '../finance-review-owner-workload-panel';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { paymentMatchingTabLabel } from '../payment-matching-tab-label';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { buildPaymentClearingReviewOwnerOptions } from '../bank-reconciliation/bank-reconciliation-review-owner-model';
import { PaymentClearingSelectionControls } from './payment-clearing-selection-controls';
import { paymentClearingStateModel } from './payment-clearing-state-model';
import {
  PAYMENT_CLEARING_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  buildBookingPaymentClearingApiHref,
  buildBookingPaymentClearingReviewOwnerSummaryApiHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildBankReconciliationSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBookingPaymentClearingSummary,
  emptyBankReconciliationSummary,
  emptyFinanceReviewOwnerWorkloadSummary,
  financeAccountingReviewLabel,
  paymentClearingDetailHref,
  paymentClearingHref,
  readBookingSettlementFilters,
  readPaymentClearingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PaymentClearingPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type ReviewOwnerFilter = 'all' | 'assigned' | 'mine' | 'unassigned';

export async function generateMetadata({ searchParams }: PaymentClearingPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const filters = readPaymentClearingFilters(params, 'unresolved');
  return { title: paymentClearingDocumentTitle(filters.review) };
}

export default async function PaymentClearingPage({ searchParams }: PaymentClearingPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readPaymentClearingFilters(params, 'unresolved');
  const reviewOwner = paymentClearingOwnerForReview(
    filters.review,
    reviewOwnerFilter(readParam(params, 'owner')),
  );
  const assignmentNotice = readParam(params, 'assignmentNotice');
  const requestedOwnerConfirmation = readParam(params, 'confirm') === 'review-owner';
  const requestedClearingEntryId = readParam(params, 'clearingEntryId');
  const currentQueueHref = paymentClearingQueueHref(filters, reviewOwner);
  const overviewFilters = {
    ...filters,
    assigneeAdminId: undefined,
    assignment: undefined,
    paymentClearingAge: undefined,
    page: 1,
    q: undefined,
    range: 'all' as const,
    review: 'all' as const,
  };
  const overviewSummaryPromise = adminGetResult<AdminBookingPaymentClearingSummary>(
    buildBookingPaymentClearingSummaryApiHref(overviewFilters),
    emptyBookingPaymentClearingSummary(),
  );
  const bankOverviewSummaryPromise = adminGetResult<AdminBankReconciliationSummary>(
    buildBankReconciliationSummaryApiHref({ ...overviewFilters, review: 'all' }),
    emptyBankReconciliationSummary(),
  );
  const adminUsersPromise = requestedOwnerConfirmation
    ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
    : Promise.resolve([]);
  const currentOperatorAccess = paymentClearingReviewNeedsOwner(filters.review) || requestedOwnerConfirmation
    ? await getCurrentAdminOperatorAccess()
    : null;
  const currentOperatorId = currentOperatorAccess?.id ?? null;
  const apiFilters = paymentClearingApiFilters(filters, reviewOwner, currentOperatorId);
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [
    queueSummaryResult,
    overviewSummaryResult,
    reviewOwnerSummaryResult,
    entriesResult,
    bankOverviewSummaryResult,
    adminUsers,
  ] = await Promise.all([
    adminGetResult<AdminBookingPaymentClearingSummary>(
      buildBookingPaymentClearingSummaryApiHref(apiFilters),
      emptyBookingPaymentClearingSummary(),
    ),
    overviewSummaryPromise,
    paymentClearingReviewNeedsOwner(filters.review)
      ? adminGetResult<AdminFinanceReviewOwnerWorkloadSummary>(
          buildBookingPaymentClearingReviewOwnerSummaryApiHref(apiFilters),
          emptyFinanceReviewOwnerWorkloadSummary(),
        )
      : Promise.resolve({
          data: emptyFinanceReviewOwnerWorkloadSummary(),
          errorCode: null,
          ok: true,
          requestId: null,
          status: 200,
        }),
    adminGetResult<AdminBookingPaymentClearingEntry[]>(buildBookingPaymentClearingApiHref(apiFilters), []),
    bankOverviewSummaryPromise,
    adminUsersPromise,
  ]);
  const failedResult = [
    queueSummaryResult,
    overviewSummaryResult,
    reviewOwnerSummaryResult,
    entriesResult,
    bankOverviewSummaryResult,
  ].find((result) => !result.ok);
  if (failedResult) {
    const supportReference = failedResult.requestId ? ` Support reference: ${failedResult.requestId}.` : '';
    return (
      <AdminPageTemplate
        description="Payment clearing data could not be loaded from the authoritative Finance API."
        title="Payment Matching"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={currentQueueHref}>Retry</AdminFormControlLink>}
          message={`Retry before assigning reviews or making reconciliation decisions.${supportReference}`}
          title="Payment clearing data unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const queueSummary = queueSummaryResult.data;
  const overviewSummary = overviewSummaryResult.data;
  const reviewOwnerSummary = reviewOwnerSummaryResult.data;
  const entries = entriesResult.data;
  const bankOverviewSummary = bankOverviewSummaryResult.data;
  const pagination = buildTaxSettlementServerPagination(entries, filters, queueSummary.count);
  const requestedEntry = requestedOwnerConfirmation
    ? entries.find((entry) => entry.id === requestedClearingEntryId) ?? null
    : null;
  const requestedOwnerOptions = withExplicitOwnerChoice(buildPaymentClearingReviewOwnerOptions(
    adminUsers,
    requestedEntry?.reviewAssignment?.assigneeAdminId ?? null,
    currentOperatorId,
  ));
  const showBulkReviewAssignment =
    paymentClearingReviewNeedsOwner(filters.review) &&
    pagination.rows.some((entry) => ['OPEN', 'PARTIALLY_CLEARED'].includes(entry.status));
  const showTerminalOutcome = ['cleared', 'reversed', 'terminal'].includes(filters.review);
  const showOwnerConfirmation =
    requestedOwnerConfirmation &&
    Boolean(requestedEntry && ['OPEN', 'PARTIALLY_CLEARED'].includes(requestedEntry.status)) &&
    requestedOwnerOptions.length > 1;
  const unresolvedAmount = overviewSummary.openAmount + overviewSummary.partiallyClearedAmount;
  const oldestUnresolvedAt = earliestIsoDate(
    overviewSummary.oldestOpenAt,
    overviewSummary.oldestPartiallyClearedAt,
  );
  const allUnresolvedCount = overviewSummary.openCount + overviewSummary.partiallyClearedCount;
  const showCrossRangeBacklog =
    filters.range !== 'all' &&
    !filters.q &&
    !filters.paymentClearingAge &&
    reviewOwner === 'all' &&
    paymentClearingReviewNeedsOwner(filters.review) &&
    queueSummary.count === 0 &&
    allUnresolvedCount > 0;
  const showPartialEmpty = filters.review === 'partial' && queueSummary.count === 0;
  const partialQueueIsGloballyEmpty = overviewSummary.partiallyClearedCount === 0;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters: filters,
            current: 'payment-clearing',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Resolve unmatched customer payment evidence first, then use cleared and reversed views as retained accounting records."
      title="Payment Matching"
    >
      {showOwnerConfirmation && requestedEntry ? (
        <ConfirmDialog
          action={assignPaymentClearingReviewAction}
          cancelHref={currentQueueHref}
          confirmLabel={requestedEntry.reviewAssignment ? 'Reassign owner' : 'Assign owner'}
          description={
            <>
              {requestedEntry.reviewAssignment
                ? 'Transfer this unresolved payment evidence to another eligible Finance operator. The status and original age do not change.'
                : 'Assign this unresolved payment evidence without changing payment, settlement, bank, or ledger state.'}
              {' '}Target: clearing {requestedEntry.id}, booking {requestedEntry.bookingId},{' '}
              {formatMoney(requestedEntry.remainingAmount ?? Math.abs(requestedEntry.amount), requestedEntry.currency)}.
              {' '}Payment: {requestedEntry.paymentId ?? 'Not linked'}. Event:{' '}
              {paymentClearingLabel(requestedEntry.type)}. Waiting:{' '}
              {paymentClearingSlaLabel(requestedEntry.occurredAt, requestedEntry.status)}. Bank matches:{' '}
              {requestedEntry._count?.bankReconciliationMatches ?? 0}.
              Current owner:{' '}
              {requestedEntry.reviewAssignment?.assignee?.fullName ??
                requestedEntry.reviewAssignment?.assignee?.email ??
                'Unassigned'}.
            </>
          }
          hiddenInputs={[
            { name: 'clearingEntryId', value: requestedEntry.id },
            { name: 'redirectTo', value: currentQueueHref },
          ]}
          id={`payment-clearing-owner-${requestedEntry.id}`}
          selectInputs={[
            {
              defaultValue: '',
              label: 'Review owner',
              name: 'assigneeAdminId',
              options: requestedOwnerOptions,
              required: true,
            },
          ]}
          requireValidForm
          textInputs={[
            {
              label: 'Assignment reason',
              maxLength: 500,
              minLength: 12,
              name: 'reason',
              placeholder: 'Why should this operator own the clearing review?',
              required: true,
            },
          ]}
          title={`${requestedEntry.reviewAssignment ? 'Reassign' : 'Assign'} payment clearing review?`}
          tone="warning"
        />
      ) : requestedOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          This clearing review is no longer available on the current page, or no eligible Finance operator can receive it.
        </AdminInlineNotice>
      ) : null}

      {assignmentNotice === 'notification-warning' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          Review assignment was saved, but notification delivery needs retry. The audit record remains the
          source of truth.
        </AdminInlineNotice>
      ) : assignmentNotice === 'unchanged' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="info">
          The selected payment evidence was already assigned to that operator. No duplicate assignment or
          notification was created.
        </AdminInlineNotice>
      ) : null}

      <AdminSegmentedControl
        activeValue={paymentClearingWorkspaceValue(filters.review)}
        ariaLabel="Payment matching workspace"
        className="admin-mb-16 payment-matching-workspace-tabs"
        options={[
          {
            href: '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched',
            label: paymentMatchingTabLabel(
              'Bank transactions',
              bankOverviewSummary.unmatchedCount + bankOverviewSummary.partiallyMatchedCount,
            ),
            value: 'bank',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest',
            label: paymentMatchingTabLabel('Unmatched payment evidence', overviewSummary.openCount),
            value: 'unmatched',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=partial&sort=oldest',
            label: paymentMatchingTabLabel('Partial matches', overviewSummary.partiallyClearedCount),
            value: 'partial',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=terminal&sort=recent',
            label: paymentMatchingTabLabel(
              'Cleared & reversed history',
              overviewSummary.clearedCount + overviewSummary.reversedCount,
            ),
            value: 'history',
          },
        ]}
        semantics="navigation"
      />

      {paymentClearingReviewNeedsOwner(filters.review) ? (
        <AdminMiniMetricStrip
          ariaLabel="Clearing command board"
          className="admin-mb-16 payment-clearing-command-strip"
          metrics={[
          {
            href: paymentClearingQueueHref(
              {
                ...filters,
                page: 1,
                paymentClearingAge: undefined,
                q: undefined,
                range: 'all',
                review: 'open',
                sort: 'oldest',
              },
              'unassigned',
            ),
            label: `Unassigned · ${paymentClearingOldestScope(
              overviewSummary.oldestUnassignedOpenAt,
              overviewSummary.unassignedCount,
            )}`,
            tone: overviewSummary.unassignedCount > 0 ? 'danger' : 'success',
            value: String(overviewSummary.unassignedCount),
          },
          {
            href: paymentClearingQueueHref({
              ...filters,
              page: 1,
              paymentClearingAge: undefined,
              q: undefined,
              range: 'all',
              review: 'unresolved',
              sort: 'oldest',
            }, 'all'),
            label: 'Open exposure · All dates',
            tone: unresolvedAmount > 0 ? 'warning' : 'success',
            value: <MoneyText amount={unresolvedAmount} currency={overviewSummary.currency} />,
          },
          {
            href: paymentClearingQueueHref(
              {
                ...filters,
                page: 1,
                paymentClearingAge: '48h',
                q: undefined,
                range: 'all',
                review: 'unresolved',
                sort: 'oldest',
              },
              'all',
            ),
            label: `Over 48h · ${paymentClearingOldestScope(
              oldestUnresolvedAt,
              overviewSummary.openCount + overviewSummary.partiallyClearedCount,
            )}`,
            tone: overviewSummary.over48hCount > 0 ? 'danger' : 'success',
            value: String(overviewSummary.over48hCount),
          },
          {
            href: paymentClearingQueueHref({
              ...filters,
              page: 1,
              paymentClearingAge: undefined,
              q: undefined,
              range: 'all',
              review: 'terminal',
              sort: 'recent',
            }, 'all'),
            label: 'Cleared / reversed · All dates',
            tone: 'info',
            value: `${overviewSummary.clearedCount} / ${overviewSummary.reversedCount}`,
          },
          ]}
        />
      ) : (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="info">
          Payment matching history retains {overviewSummary.clearedCount} cleared and {overviewSummary.reversedCount}{' '}
          reversed record(s).{' '}
          <AdminTextLink href="/finance-tax/payment-clearing?range=all&review=cleared&sort=recent">
            Cleared evidence
          </AdminTextLink>{' '}
          ·{' '}
          <AdminTextLink href="/finance-tax/payment-clearing?range=all&review=reversed&sort=recent">
            Reversed evidence
          </AdminTextLink>
        </AdminInlineNotice>
      )}

      {showCrossRangeBacklog ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          No unresolved payment evidence is in {dateRangeLabel(filters.range)}, but {allUnresolvedCount}{' '}
          unresolved record(s) remain across all dates.{' '}
          <AdminTextLink
            href={paymentClearingQueueHref({
              ...filters,
              page: 1,
              paymentClearingAge: undefined,
              q: undefined,
              range: 'all',
              review: 'unresolved',
              sort: 'oldest',
            }, 'all')}
          >
            Review all unresolved evidence
          </AdminTextLink>
        </AdminInlineNotice>
      ) : null}

      <AdminFilterPanel
        className="admin-mb-16 finance-matching-operations-filter payment-clearing-operations-filter"
        description={paymentClearingFilterDescription(
          filters.review,
          reviewOwner,
          pagination.page,
          pagination.totalPages,
          filters.range,
          filters.paymentClearingAge,
        )}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Payment clearing filters"
      >
        <AdminFormShell
          action="/finance-tax/payment-clearing"
          className="filter-form admin-mb-16"
          key={JSON.stringify([
            filters.review,
            filters.sort,
            filters.range,
            filters.q,
            filters.take,
            reviewOwner,
            filters.paymentClearingAge,
          ])}
          method="get"
        >
          <input name="review" type="hidden" value={filters.review} />
          <input name="range" type="hidden" value={filters.range} />
          <input name="take" type="hidden" value={filters.take} />
          {reviewOwner !== 'all' ? <input name="owner" type="hidden" value={reviewOwner} /> : null}
          {filters.paymentClearingAge ? (
            <input name="age" type="hidden" value={filters.paymentClearingAge} />
          ) : null}
          <AdminFormSearch
            defaultValue={filters.q}
            label="Search payment evidence"
            name="q"
            placeholder="Booking, payment, clearing, or source ID"
          />
          <AdminFormSelect
            defaultValue={filters.sort ?? 'oldest'}
            label="Sort"
            labelVisibility="visible"
            name="sort"
            options={[
              { label: 'Oldest first', value: 'oldest' },
              { label: 'Highest remaining amount', value: 'highest-remaining' },
              { label: 'Recently occurred', value: 'recent' },
            ]}
          />
          <AdminFormActionRow>
            <AdminFormControlButton className="button-primary" type="submit">
              Apply search
            </AdminFormControlButton>
            {filters.q ? (
              <AdminTextLink href={paymentClearingQueueHref({ ...filters, page: 1, q: undefined }, reviewOwner)}>
                Clear search
              </AdminTextLink>
            ) : null}
          </AdminFormActionRow>
        </AdminFormShell>
        <FinanceListFilterLinks
          compact
          groups={[
            {
              className: 'finance-list-filter-group-wide',
              defaultId: 'unresolved',
              id: 'review',
              links: PAYMENT_CLEARING_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: paymentClearingQueueHref(
                  { ...filters, page: 1, review: item.review },
                  paymentClearingOwnerForReview(item.review, reviewOwner),
                ),
                id: item.review,
                label: item.label,
              })),
            },
            ...(paymentClearingReviewNeedsOwner(filters.review)
              ? [{
                  defaultId: 'all',
                  id: 'review-owner',
                  links: (['all', 'mine', 'unassigned', 'assigned'] as const).map((owner) => ({
                    active: reviewOwner === owner,
                    activePillClassName: owner === 'unassigned' ? 'pill-warn' as const : 'pill-info' as const,
                    href: paymentClearingQueueHref({ ...filters, page: 1 }, owner),
                    id: owner,
                    label: reviewOwnerFilterLabel(owner),
                  })),
                }]
              : []),
            ...(paymentClearingReviewNeedsOwner(filters.review)
              ? [{
                  defaultId: 'all',
                  id: 'age',
                  links: [
                    {
                      active: !filters.paymentClearingAge,
                      activePillClassName: 'pill-info' as const,
                      href: paymentClearingQueueHref(
                        { ...filters, page: 1, paymentClearingAge: undefined },
                        reviewOwner,
                      ),
                      id: 'all',
                      label: 'All ages',
                    },
                    {
                      active: filters.paymentClearingAge === '48h',
                      activePillClassName: 'pill-warn' as const,
                      href: paymentClearingQueueHref(
                        { ...filters, page: 1, paymentClearingAge: '48h' },
                        reviewOwner,
                      ),
                      id: '48h',
                      label: '48h+',
                    },
                  ],
                }]
              : []),
            {
              defaultId: 'all',
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: paymentClearingQueueHref({ ...filters, page: 1, range }, reviewOwner),
                id: range,
                label,
              })),
            },
            {
              defaultId: 10,
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: paymentClearingQueueHref({ ...filters, page: 1, take }, reviewOwner),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      {showPartialEmpty ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="info">
          <strong>No partial matches.</strong>{' '}
          {partialQueueIsGloballyEmpty
            ? 'Open exposure remains in Unmatched payment evidence.'
            : 'No partial matches meet the current filters.'}{' '}
          <AdminTextLink
            href={
              partialQueueIsGloballyEmpty
                ? '/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest'
                : paymentClearingQueueHref(
                    {
                      ...filters,
                      page: 1,
                      paymentClearingAge: undefined,
                      q: undefined,
                      range: 'all',
                    },
                    'all',
                  )
            }
          >
            {partialQueueIsGloballyEmpty ? 'Open unmatched evidence' : 'Clear filters'}
          </AdminTextLink>
        </AdminInlineNotice>
      ) : (
      <AdminFormShell
        action={assignPaymentClearingReviewsAction}
        data-has-selection="false"
        data-payment-clearing-selection
      >
        <input name="redirectTo" type="hidden" value={currentQueueHref} />
      <FinanceTablePanel
        className="payment-clearing-results-panel"
        grouped
        description={
          assignmentNotice === 'bulk-assigned'
            ? 'Selected reviews were assigned. Every clearing row remains open until retained finance evidence explicitly clears it.'
            : assignmentNotice === 'assigned'
            ? 'Review owner assigned. The clearing row remains open until retained finance evidence explicitly clears it.'
            : assignmentNotice === 'notification-warning'
              ? 'Assignment saved. Notification delivery needs retry; the assignment audit record remains authoritative.'
              : assignmentNotice === 'unchanged'
                ? 'No assignment changed because every selected record already had that owner.'
            : assignmentNotice === 'failed'
              ? 'Review assignment failed. Confirm the operator has Payment Clearing access and is not already assigned.'
              : paymentClearingTableDescription(filters.review)
        }
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone={paymentClearingResultTone(filters.review, pagination.totalRows)}
        title={paymentClearingTableTitle(filters.review)}
      >
        {showBulkReviewAssignment ? (
          <PaymentClearingSelectionControls
            loadOwnerOptions={loadPaymentClearingReviewOwnerOptions}
            visibleCount={pagination.rows.length}
          />
        ) : null}
        <FinanceDataTable
          ariaLabel="Payment clearing evidence table"
          emptyMessage="No payment clearing rows match the current filters."
          headers={[
            ...(showBulkReviewAssignment ? ['Select'] : []),
            'Booking & payment',
            'Event & evidence',
            'Remaining & original',
            showTerminalOutcome ? 'Outcome & time' : 'Owner & SLA',
            'Next action',
          ]}
          rowCount={pagination.rows.length}
          scrollClassName={`payment-clearing-evidence-table${showBulkReviewAssignment ? ' has-selection-column' : ''}`}
        >
          {pagination.rows.map((entry) => {
            const remainingAmount = entry.remainingAmount ?? Math.abs(entry.amount);
            const clearingState = paymentClearingStateModel(entry.status, remainingAmount);
            return (
            <tr key={entry.id}>
              {showBulkReviewAssignment ? (
                <td>
                  {clearingState.isOpen ? (
                    <AdminFormCheckbox
                      label={`Select payment clearing ${entry.id}, booking ${entry.bookingId}, ${formatMoney(
                        entry.remainingAmount ?? Math.abs(entry.amount),
                        entry.currency,
                      )}`}
                      name="clearingEntryIds"
                      value={entry.id}
                    />
                  ) : (
                    <span className="muted">Closed</span>
                  )}
                </td>
              ) : null}
              <td>
                <AdminTextLink href={`/bookings/${entry.bookingId}`}>
                  {shortId(entry.bookingId)}
                </AdminTextLink>
                <div>
                  <AdminInlineFallback>
                    {entry.booking?.status ? paymentClearingLabel(entry.booking.status) : 'Unknown booking'}
                  </AdminInlineFallback>
                </div>
                {entry.payment?.method ? (
                  <div className="muted">
                    {paymentClearingLabel(entry.payment.method)} · {paymentClearingLabel(entry.payment.status)}
                  </div>
                ) : (
                  <AdminInlineFallback>No payment method</AdminInlineFallback>
                )}
              </td>
              <td>
                <AdminTextLink href={paymentClearingDetailHref(entry.id, currentQueueHref)}>
                  <strong>{paymentClearingLabel(entry.type)}</strong>
                </AdminTextLink>
                <div className="muted">Clearing {shortId(entry.id)}</div>
                <div className="muted">Payment {entry.paymentId ? shortId(entry.paymentId) : 'not linked'}</div>
                <div className="muted">Bank matches {entry._count?.bankReconciliationMatches ?? 0}</div>
              </td>
              <td>
                <strong>
                  {clearingState.isTerminal ? (
                    <MoneyText amount={Math.abs(entry.amount)} currency={entry.currency} />
                  ) : (
                    <MoneyText amount={remainingAmount} currency={entry.currency} />
                  )}
                </strong>
                <div className="muted">
                  {clearingState.isTerminal ? 'Original evidence' : 'Remaining amount'}
                </div>
                <div className="muted">
                  Matched <MoneyText amount={entry.matchedAmount ?? 0} currency={entry.currency} />
                </div>
              </td>
              <td className="payment-clearing-owner-sla-cell">
                {showTerminalOutcome ? (
                  <AdminTableSubstack>
                    <StatusBadgeFromPillClass pillClass={financePaymentClearingStatusPill(entry.status)}>
                      {paymentClearingLabel(entry.status)}
                    </StatusBadgeFromPillClass>
                    <span className="muted">
                      Occurred <DateTimeText value={entry.occurredAt} />
                    </span>
                    <span className="muted">
                      {entry.clearedAt ? (
                        <>{clearingState.closedAtLabel} <DateTimeText value={entry.clearedAt} /></>
                      ) : (
                        `${clearingState.closedAtLabel} not recorded`
                      )}
                    </span>
                  </AdminTableSubstack>
                ) : entry.reviewAssignment ? (
                  <>
                    <strong>
                      {entry.reviewAssignment.assignee?.fullName ??
                        entry.reviewAssignment.assignee?.email ??
                        shortId(entry.reviewAssignment.assigneeAdminId)}
                    </strong>
                    <div className="muted">
                      <DateTimeText value={entry.reviewAssignment.assignedAt} />
                    </div>
                  </>
                ) : clearingState.isOpen ? (
                  <AdminInlineFallback>Unassigned</AdminInlineFallback>
                ) : (
                  <span className="muted">Closed</span>
                )}
                {!showTerminalOutcome && clearingState.isOpen ? (
                  <div className="admin-mt-6">
                    <AdminTextLink
                      href={appendQueryParam(
                        appendQueryParam(currentQueueHref, 'confirm', 'review-owner'),
                        'clearingEntryId',
                        entry.id,
                      )}
                    >
                      {entry.reviewAssignment ? 'Reassign owner' : 'Assign owner'}
                    </AdminTextLink>
                  </div>
                ) : null}
                {!showTerminalOutcome ? <div className="admin-mt-10">
                  <StatusBadgeFromPillClass pillClass={paymentClearingSlaPill(entry.occurredAt, entry.status)}>
                    {paymentClearingSlaLabel(entry.occurredAt, entry.status)}
                  </StatusBadgeFromPillClass>
                  <div className="muted"><DateTimeText value={entry.occurredAt} /></div>
                  {entry.clearedAt ? (
                    <div className="muted">
                      {entry.status === 'REVERSED' ? 'Closed' : 'Cleared'} <DateTimeText value={entry.clearedAt} />
                    </div>
                  ) : null}
                  <div className="admin-mt-6">
                    <StatusBadgeFromPillClass pillClass={financePaymentClearingStatusPill(entry.status)}>
                      {paymentClearingLabel(entry.status)}
                    </StatusBadgeFromPillClass>
                  </div>
                </div> : null}
              </td>
              <td>
                <AdminTextLink href={paymentClearingDetailHref(entry.id, currentQueueHref)}>
                  {clearingState.isMatchable ? 'Review and match' : 'View evidence'}
                </AdminTextLink>
                <div className="muted admin-mt-6">{clearingState.closeoutLabel}</div>
              </td>
            </tr>
            );
          })}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Payment clearing pages"
          hrefForPage={(page) => paymentClearingQueueHref({ ...filters, page }, reviewOwner)}
          pagination={pagination}
        />
      </FinanceTablePanel>
      </AdminFormShell>
      )}
      {paymentClearingReviewNeedsOwner(filters.review) && queueSummary.count > 0 ? (
        <FinanceReviewOwnerWorkloadPanel
          ariaLabel="Payment clearing owner workload table"
          currentOperatorId={currentOperatorId}
          description="Workload uses every unresolved clearing row in the current range and review state, not only the visible page. Ownership comes from the latest review-assignment audit record."
          hrefForOwner={(owner) => paymentClearingQueueHref({ ...filters, page: 1 }, owner)}
          summary={reviewOwnerSummary}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

async function loadPaymentClearingReviewOwnerOptions() {
  'use server';

  const currentOperatorId = (await getCurrentAdminOperatorAccess())?.id ?? null;
  const adminUsers = await adminGet<AdminUser[]>(
    '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
    [],
  );
  return withExplicitOwnerChoice(
    buildPaymentClearingReviewOwnerOptions(adminUsers, null, currentOperatorId),
  );
}

async function assignPaymentClearingReviewAction(formData: FormData) {
  'use server';

  const clearingEntryId = String(formData.get('clearingEntryId') ?? '').trim();
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const redirectTo = safePaymentClearingReturnTo(formData.get('redirectTo'));
  if (!clearingEntryId || !assigneeAdminId || reason.length < 12) {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }

  let assignmentNotice: 'assigned' | 'notification-warning' | 'unchanged' = 'assigned';
  try {
    const result = await adminPostOrThrow<PaymentClearingAssignmentResult>(
      `/admin/booking-payment-clearing/${encodeURIComponent(clearingEntryId)}/review-assignment`,
      { assigneeAdminId, reason },
    );
    if (result.notification.failedCount > 0) {
      assignmentNotice = 'notification-warning';
    } else if (result.assignedCount === 0) {
      assignmentNotice = 'unchanged';
    }
  } catch {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }
  redirect(appendQueryParam(redirectTo, 'assignmentNotice', assignmentNotice));
}

async function assignPaymentClearingReviewsAction(formData: FormData) {
  'use server';

  const clearingEntryIds = Array.from(
    new Set(
      formData
        .getAll('clearingEntryIds')
        .map((clearingEntryId) => String(clearingEntryId).trim())
        .filter(Boolean),
    ),
  );
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const redirectTo = safePaymentClearingReturnTo(formData.get('redirectTo'));
  if (
    clearingEntryIds.length === 0 ||
    clearingEntryIds.length > 50 ||
    !assigneeAdminId ||
    reason.length < 12
  ) {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }

  let assignmentNotice: 'bulk-assigned' | 'notification-warning' | 'unchanged' = 'bulk-assigned';
  try {
    const result = await adminPostOrThrow<PaymentClearingAssignmentResult>(
      '/admin/booking-payment-clearing/review-assignments', {
      assigneeAdminId,
      clearingEntryIds,
      reason,
      },
    );
    if (result.notification.failedCount > 0) {
      assignmentNotice = 'notification-warning';
    } else if (result.assignedCount === 0) {
      assignmentNotice = 'unchanged';
    }
  } catch {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }
  redirect(appendQueryParam(redirectTo, 'assignmentNotice', assignmentNotice));
}

function paymentClearingApiFilters(
  filters: ReturnType<typeof readPaymentClearingFilters>,
  owner: ReviewOwnerFilter,
  currentOperatorId: string | null,
) {
  const base = { ...filters, assigneeAdminId: undefined, assignment: undefined };
  if (owner === 'mine' && currentOperatorId) {
    return { ...base, assigneeAdminId: currentOperatorId, assignment: 'assigned' as const };
  }
  if (owner === 'assigned') return { ...base, assignment: 'assigned' as const };
  if (owner === 'unassigned') return { ...base, assignment: 'unassigned' as const };
  return base;
}

function paymentClearingQueueHref(
  filters: ReturnType<typeof readPaymentClearingFilters>,
  owner: ReviewOwnerFilter,
) {
  const href = paymentClearingHref({ ...filters, assigneeAdminId: undefined, assignment: undefined });
  return owner === 'all' ? href : appendQueryParam(href, 'owner', owner);
}

function reviewOwnerFilter(value: string): ReviewOwnerFilter {
  return value === 'mine' || value === 'assigned' || value === 'unassigned' ? value : 'all';
}

function reviewOwnerFilterLabel(owner: ReviewOwnerFilter) {
  if (owner === 'mine') return 'My reviews';
  if (owner === 'unassigned') return 'Unassigned';
  if (owner === 'assigned') return 'All assigned';
  return 'All owners';
}

function paymentClearingOwnerForReview(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
  owner: ReviewOwnerFilter,
) {
  return paymentClearingReviewNeedsOwner(review) ? owner : 'all';
}

function paymentClearingReviewNeedsOwner(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
) {
  return review === 'unresolved' || review === 'open' || review === 'partial';
}

function paymentClearingDocumentTitle(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
) {
  if (review === 'partial') return 'Partial Matches';
  if (review === 'cleared' || review === 'reversed' || review === 'terminal') {
    return 'Cleared & Reversed History';
  }
  return 'Unmatched Payment Evidence';
}

function paymentClearingTableTitle(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
) {
  if (review === 'unresolved') return 'All unresolved payment evidence';
  if (review === 'open') return 'Needs action';
  if (review === 'partial') return 'Partially cleared evidence';
  if (review === 'cleared') return 'Cleared records';
  if (review === 'reversed') return 'Reversal records';
  if (review === 'terminal') return 'Cleared & reversed history';
  return 'All payment clearing records';
}

function paymentClearingFilterDescription(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
  owner: ReviewOwnerFilter,
  page: number,
  totalPages: number,
  range: ReturnType<typeof readPaymentClearingFilters>['range'],
  age: ReturnType<typeof readPaymentClearingFilters>['paymentClearingAge'],
) {
  const ageScope = age === '48h' ? ' SLA age: 48h+.' : '';
  const base = `Showing page ${page} of ${totalPages}. Range: ${dateRangeLabel(range)}. Queue: ${financeAccountingReviewLabel(review, PAYMENT_CLEARING_REVIEW_LINKS)}.${ageScope}`;
  return paymentClearingReviewNeedsOwner(review)
    ? `${base} Review owner: ${reviewOwnerFilterLabel(owner)}.`
    : base;
}

function paymentClearingTableDescription(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
) {
  if (review === 'open') {
    return 'Oldest first. Assign an owner, verify evidence, then reconcile.';
  }
  if (review === 'unresolved') {
    return 'Open and partially matched payment evidence is ordered by the selected global sort. Review the remaining amount, owner, and bank evidence before matching.';
  }
  if (review === 'partial') {
    return 'These rows are only partly matched. Review the remaining amount and supporting bank evidence before treating them as cleared.';
  }
  if (review === 'cleared') {
    return 'Completed clearing evidence is retained here for accounting review. No operator action is expected.';
  }
  if (review === 'reversed') {
    return 'Reversed payment evidence is retained as immutable history and should be changed only through another controlled entry.';
  }
  if (review === 'terminal') {
    return 'Cleared and reversed payment evidence is retained together for accounting history. No unresolved work is included.';
  }
  return 'Use this records view for historical lookup. Current operational work remains in Needs action and Partially cleared.';
}

function paymentClearingResultTone(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
  count: number,
) {
  if (review === 'unresolved' || review === 'open' || review === 'partial') {
    return count > 0 ? 'warning' as const : 'success' as const;
  }
  if (review === 'cleared') return 'success' as const;
  return 'neutral' as const;
}

function paymentClearingWorkspaceValue(
  review: (typeof PAYMENT_CLEARING_REVIEW_LINKS)[number]['review'],
) {
  if (review === 'partial') return 'partial';
  if (review === 'cleared' || review === 'reversed' || review === 'terminal') return 'history';
  return 'unmatched';
}

function paymentClearingLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function paymentClearingWaitingHours(value: string) {
  const occurredAt = new Date(value).getTime();
  if (!Number.isFinite(occurredAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - occurredAt) / 3_600_000));
}

function paymentClearingSlaLabel(value: string, status: AdminBookingPaymentClearingEntry['status']) {
  if (!['OPEN', 'PARTIALLY_CLEARED'].includes(status)) return 'Closed';
  const waitingHours = paymentClearingWaitingHours(value);
  const age = paymentClearingAgeLabel(waitingHours);
  if (waitingHours >= 48) return `${age} · Escalate`;
  if (waitingHours >= 24) return `${age} · Over 24h`;
  return `${age} · Current`;
}

function paymentClearingSlaPill(value: string, status: AdminBookingPaymentClearingEntry['status']) {
  if (!['OPEN', 'PARTIALLY_CLEARED'].includes(status)) return 'pill-neutral';
  const waitingHours = paymentClearingWaitingHours(value);
  if (waitingHours >= 48) return 'pill-danger';
  if (waitingHours >= 24) return 'pill-warn';
  return 'pill-success';
}

function paymentClearingOldestScope(value: string | null | undefined, count: number) {
  if (!value || count === 0) return 'Queue clear';
  const waitingHours = paymentClearingWaitingHours(value);
  return `Oldest ${paymentClearingAgeLabel(waitingHours)}`;
}

function paymentClearingAgeLabel(hours: number) {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days === 0) return `${remainingHours}h`;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function earliestIsoDate(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;
}

function withExplicitOwnerChoice(options: Array<{ label: string; value: string }>) {
  return [{ label: 'Select an eligible Finance operator', value: '' }, ...options];
}

type PaymentClearingAssignmentResult = {
  readonly assignedCount: number;
  readonly notification: {
    readonly deliveredCount: number;
    readonly failedCount: number;
    readonly warning: string | null;
  };
  readonly unchangedCount: number;
};

function safePaymentClearingReturnTo(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '/finance-tax/payment-clearing';
  const url = new URL(normalized, 'http://localhost');
  return url.origin === 'http://localhost' && url.pathname === '/finance-tax/payment-clearing'
    ? `${url.pathname}${url.search}`
    : '/finance-tax/payment-clearing';
}

function appendQueryParam(href: string, key: string, value: string) {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
