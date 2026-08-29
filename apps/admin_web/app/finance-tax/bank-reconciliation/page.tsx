import { AlertTriangle, CheckCircle2, Landmark, UserRoundX } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type {
  AdminBankReconciliationEvidenceSourceSummary,
  AdminBankReconciliationReviewOwnerSummary,
  AdminBankReconciliationSummary,
  AdminBookingPaymentClearingSummary,
  AdminCompanyBankAccount,
  AdminCompanyBankTransaction,
  AdminCompanyBankTransactionImportBatchHistory,
  AdminUser,
} from '../../../lib/admin-api';
import { AdminApiRequestError, adminGet, adminPostOrThrow } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import {
  AdminFormControlButton,
  AdminFormCheckbox,
  AdminFormActionRow,
  AdminFormDate,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminDisclosure, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { formatMoney, shortId } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import {
  FinanceListCommandBoard,
  FinanceListCommandCard,
  formatFinancePercent,
} from '../finance-list-command-card';
import { FinanceReviewOwnerWorkloadPanel } from '../finance-review-owner-workload-panel';
import {
  financeBankReconciliationStatusModel,
  financeBankReconciliationStatusPill,
} from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { paymentMatchingTabLabel } from '../payment-matching-tab-label';
import { BankStatementBatchImport } from './bank-statement-batch-import';
import {
  BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH,
  MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT,
  isConfirmedManualBankTransactionImport,
} from './bank-reconciliation-action-validation';
import { BankReconciliationConfirmationDisclosure } from './bank-reconciliation-confirmation-disclosure';
import { buildBankReconciliationReviewOwnerOptions } from './bank-reconciliation-review-owner-model';
import { BankReconciliationSelectionSummary } from './bank-reconciliation-selection-summary';
import {
  bankReconciliationWorkspaceHref,
  readBankReconciliationWorkspace,
} from './bank-reconciliation-workspace-model';
import {
  BANK_RECONCILIATION_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  bankReconciliationDetailHref,
  bankReconciliationHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildBankReconciliationApiHref,
  buildBankReconciliationEvidenceSourceSummaryApiHref,
  buildBankReconciliationReviewOwnerSummaryApiHref,
  buildBankReconciliationSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBankReconciliationEvidenceSourceSummary,
  emptyBankReconciliationReviewOwnerSummary,
  emptyBankReconciliationSummary,
  emptyBookingPaymentClearingSummary,
  financeAccountingReviewLabel,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  type BankReconciliationEvidenceSource,
} from '../tax-settlement-page-model';

type BankReconciliationPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type ReviewOwnerFilter = 'all' | 'assigned' | 'mine' | 'unassigned';
type BankReconciliationAgeFilter = 'all' | '48h';
type BankTransactionDirection = 'all' | 'INFLOW' | 'OUTFLOW';
type BankReconciliationSourceFilter = 'all' | BankReconciliationEvidenceSource;
type WithdrawalCandidateFilter = 'all' | 'eligible' | 'none' | 'review' | 'strong';

export async function generateMetadata({ searchParams }: BankReconciliationPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const workspace = readBankReconciliationWorkspace(params);
  return {
    title:
      workspace === 'imports'
        ? 'Bank Statement Imports'
        : workspace === 'manual'
          ? 'Manual Bank Entry'
          : 'Bank Transactions',
  };
}

export default async function BankReconciliationPage({ searchParams }: BankReconciliationPageProps) {
  const params = searchParams ? await searchParams : {};
  const workspace = readBankReconciliationWorkspace(params);
  const parsedFilters = readFinanceAccountingFilters(params, 'unmatched');
  const filters = readParam(params, 'range') ? parsedFilters : { ...parsedFilters, range: 'all' as const };
  const bankReconciliationAge = filters.bankReconciliationAge ?? 'all';
  const bankTransactionDirection = filters.bankTransactionType ?? 'all';
  const bankReconciliationSource = filters.bankReconciliationSource ?? 'all';
  const transactionQuery = readParam(params, 'q').trim();
  const withdrawalCandidate = withdrawalCandidateForDirection(
    bankTransactionDirection,
    withdrawalCandidateFilter(readParam(params, 'candidate')),
  );
  const reviewOwner = reviewOwnerForReview(filters.review, reviewOwnerFilter(readParam(params, 'owner')));
  const importNotice = readParam(params, 'bankImported');
  const importError = readParam(params, 'bankImportError');
  const duplicateCandidateIds = readDuplicateCandidateIdsParam(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const importHistoryPage = positivePage(readParam(params, 'importPage'));
  const importHistoryTake = 10;
  const importHistoryQuery = readParam(params, 'importQ').trim();
  const importHistoryRange = importHistoryRangeValue(readParam(params, 'importRange'));
  const importHistoryReview = importHistoryReviewValue(readParam(params, 'importReview'));
  const assignmentNotice = readParam(params, 'assignmentNotice');
  const reviewAssignmentNotice = readParam(params, 'reviewAssignmentNotice');
  const requestedReviewOwnerConfirmation = readParam(params, 'confirm') === 'review-owner';
  const requestedBatchOwnerConfirmation = readParam(params, 'confirm') === 'batch-owner';
  const needsAdminDirectory = requestedReviewOwnerConfirmation || requestedBatchOwnerConfirmation;
  const requestedBankTransactionId = readParam(params, 'bankTransactionId');
  const requestedBatchImportId = readParam(params, 'batchImportId');
  const isReviewWorkspace = workspace === 'operations';
  const isImportWorkspace = workspace === 'imports';
  const isManualWorkspace = workspace === 'manual';
  const overviewFilters = {
    ...filters,
    assigneeAdminId: undefined,
    assignment: undefined,
    page: 1,
    q: undefined,
    range: 'all' as const,
    review: 'all' as const,
  };
  const overviewSummaryPromise = isReviewWorkspace
    ? adminGet<AdminBankReconciliationSummary>(
        buildBankReconciliationSummaryApiHref(overviewFilters),
        emptyBankReconciliationSummary(),
      )
    : Promise.resolve(emptyBankReconciliationSummary());
  const companyBankAccountsPromise = isImportWorkspace || isManualWorkspace
    ? adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ACTIVE', [])
    : Promise.resolve([]);
  const importHistoryPromise = isImportWorkspace
    ? adminGet<AdminCompanyBankTransactionImportBatchHistory>(
        buildImportHistoryApiHref({
          page: importHistoryPage,
          q: importHistoryQuery,
          range: importHistoryRange,
          review: importHistoryReview,
          take: importHistoryTake,
        }),
        { items: [], pagination: { skip: 0, take: importHistoryTake, total: 0 } },
      )
    : Promise.resolve({ items: [], pagination: { skip: 0, take: importHistoryTake, total: 0 } });
  const paymentClearingOverviewPromise = adminGet<AdminBookingPaymentClearingSummary>(
    buildBookingPaymentClearingSummaryApiHref({ ...overviewFilters, review: 'all' }),
    emptyBookingPaymentClearingSummary(),
  );
  const adminUsersPromise = needsAdminDirectory
    ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
    : Promise.resolve([]);
  const currentOperatorAccess = await getCurrentAdminOperatorAccess();
  const currentOperatorId = currentOperatorAccess?.id ?? null;
  const apiFilters = { ...filters, q: undefined };
  const [
    queueSummary,
    overviewSummary,
    evidenceSourceSummary,
    reviewOwnerSummary,
    transactions,
    companyBankAccounts,
    importHistory,
    paymentClearingOverview,
    adminUsers,
  ] = await Promise.all([
    isReviewWorkspace
      ? adminGet<AdminBankReconciliationSummary>(
          bankReconciliationApiHref(
            buildBankReconciliationSummaryApiHref(apiFilters),
            transactionQuery,
            withdrawalCandidate,
            reviewOwner,
            currentOperatorId,
          ),
          emptyBankReconciliationSummary(),
        )
      : Promise.resolve(emptyBankReconciliationSummary()),
    overviewSummaryPromise,
    isReviewWorkspace
      ? adminGet<AdminBankReconciliationEvidenceSourceSummary>(
          bankReconciliationApiHref(
            buildBankReconciliationEvidenceSourceSummaryApiHref(apiFilters),
            transactionQuery,
            withdrawalCandidate,
            reviewOwner,
            currentOperatorId,
          ),
          emptyBankReconciliationEvidenceSourceSummary(),
        )
      : Promise.resolve(emptyBankReconciliationEvidenceSourceSummary()),
    isReviewWorkspace && bankReconciliationReviewNeedsOwner(filters.review)
      ? adminGet<AdminBankReconciliationReviewOwnerSummary>(
          bankReconciliationApiHref(
            buildBankReconciliationReviewOwnerSummaryApiHref(apiFilters),
            transactionQuery,
            withdrawalCandidate,
            'all',
            currentOperatorId,
          ),
          emptyBankReconciliationReviewOwnerSummary(),
        )
      : Promise.resolve(emptyBankReconciliationReviewOwnerSummary()),
    isReviewWorkspace
      ? adminGet<AdminCompanyBankTransaction[]>(
          bankReconciliationApiHref(
            buildBankReconciliationApiHref(apiFilters),
            transactionQuery,
            withdrawalCandidate,
            reviewOwner,
            currentOperatorId,
          ),
          [],
        )
      : Promise.resolve([]),
    companyBankAccountsPromise,
    importHistoryPromise,
    paymentClearingOverviewPromise,
    adminUsersPromise,
  ]);
  const hasBulkAssignableTransactions =
    !requestedReviewOwnerConfirmation &&
    bankReconciliationReviewNeedsOwner(filters.review) &&
    transactions.some((transaction) => ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(transaction.status));
  const pagination = buildTaxSettlementServerPagination(transactions, filters, queueSummary.count);
  const showBulkReviewAssignment =
    hasBulkAssignableTransactions &&
    pagination.rows.some((transaction) => ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(transaction.status));
  const queueHref = (
    nextFilters = filters,
    nextQuery = transactionQuery,
    nextCandidate = withdrawalCandidate,
    nextOwner = reviewOwner,
  ) => bankReconciliationQueueHref(
    nextQuery ? nextFilters : { ...nextFilters, q: undefined },
    nextQuery,
    nextCandidate,
    nextOwner,
  );
  const currentQueueHref = queueHref();
  const currentImportHistoryHref = importHistoryHref(params, importHistoryPage);
  const requestedBankTransaction = requestedReviewOwnerConfirmation
    ? (transactions.find((transaction) => transaction.id === requestedBankTransactionId) ?? null)
    : null;
  const requestedCurrentAssignment = requestedBankTransaction
    ? bankTransactionReviewAssignment(requestedBankTransaction)
    : null;
  const requestedReviewOwnerOptions = withExplicitBankOwnerChoice(buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    requestedCurrentAssignment?.assigneeAdminId ?? null,
    currentOperatorId,
  ));
  const showReviewOwnerConfirmation =
    requestedReviewOwnerConfirmation &&
    Boolean(
      requestedBankTransaction &&
      ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(requestedBankTransaction.status),
    ) &&
    requestedReviewOwnerOptions.length > 1;
  const requestedImportBatch = requestedBatchOwnerConfirmation
    ? (importHistory.items.find((batch) => batch.batchImportId === requestedBatchImportId) ?? null)
    : null;
  const requestedBatchOwnerOptions = withExplicitBankOwnerChoice(buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    requestedImportBatch?.assigneeAdminId ?? null,
    currentOperatorId,
  ));
  const showBatchOwnerConfirmation =
    requestedBatchOwnerConfirmation &&
    Boolean(requestedImportBatch?.reconciliationNeedsActionCount) &&
    requestedBatchOwnerOptions.length > 1;
  const shouldOpenImportDisclosure = importNotice === '1' || Boolean(importError);
  const bankAccountOptions = companyBankAccounts.length
    ? companyBankAccounts.map((account) => ({
        label: companyBankAccountOptionLabel(account),
        value: account.id,
      }))
    : [{ label: 'No active company bank account', value: '' }];

  return (
    <AdminPageTemplate
      actions={
        <div className="actions">
          <TaxFinanceWorkflowActions
            links={buildTaxFinanceWorkflowLinks({
              accountingFilters: filters,
              current: 'bank-reconciliation',
              monthlyFilters,
              settlementFilters,
              withholdingFilters,
            })}
          />
          {!isReviewWorkspace ? (
            <StatusBadgeLink href={bankReconciliationWorkspaceHref('operations')} tone="neutral">
              Bank transactions
            </StatusBadgeLink>
          ) : null}
          {!isImportWorkspace ? (
            <StatusBadgeLink href={bankReconciliationWorkspaceHref('imports')} tone="neutral">
              Statement imports
            </StatusBadgeLink>
          ) : null}
          {!isManualWorkspace ? (
            <StatusBadgeLink href={bankReconciliationWorkspaceHref('manual')} tone="neutral">
              Manual bank entry
            </StatusBadgeLink>
          ) : null}
        </div>
      }
      description="Resolve open company bank movements against retained payment, withdrawal, payout, and accounting evidence."
      title="Payment Matching"
    >
      {showReviewOwnerConfirmation && requestedBankTransaction ? (
        <ConfirmDialog
          action={assignBankTransactionReviewAction}
          cancelHref={currentQueueHref}
          confirmLabel={requestedCurrentAssignment ? 'Reassign owner' : 'Assign owner'}
          description={
            requestedCurrentAssignment
              ? 'Transfer this open bank reconciliation review to another eligible Finance operator. Existing ownership and SLA evidence remains in the audit history.'
              : 'Assign this open bank transaction to an eligible Finance operator without changing its reconciliation status.'
          }
          hiddenInputs={[
            { name: 'bankTransactionId', value: requestedBankTransaction.id },
            { name: 'redirectTo', value: currentQueueHref },
          ]}
          id={`bank-review-owner-${requestedBankTransaction.id}`}
          selectInputs={[
            {
              defaultValue: '',
              label: 'Review owner',
              name: 'assigneeAdminId',
              options: requestedReviewOwnerOptions,
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
              placeholder: 'Why should this operator own the reconciliation review?',
              required: true,
            },
          ]}
          title={`${requestedCurrentAssignment ? 'Reassign' : 'Assign'} bank reconciliation review?`}
          tone="warning"
        />
      ) : requestedReviewOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          This review assignment is no longer available on the current page, or no eligible Finance operator
          can receive it.
        </AdminInlineNotice>
      ) : null}

      {reviewAssignmentNotice === 'notification-warning' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          Review ownership was saved, but one or more in-app notifications need retry. The assignment audit
          record remains the source of truth.
        </AdminInlineNotice>
      ) : null}

      <AdminSegmentedControl
        activeValue="bank"
        ariaLabel="Payment matching workspace"
        className="admin-mb-16 payment-matching-workspace-tabs"
        options={[
          {
            href: '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched',
            label: paymentMatchingTabLabel(
              'Bank transactions',
              overviewSummary.unmatchedCount + overviewSummary.partiallyMatchedCount,
            ),
            value: 'bank',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest',
            label: paymentMatchingTabLabel('Unmatched payment evidence', paymentClearingOverview.openCount),
            value: 'unmatched',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=partial&sort=oldest',
            label: paymentMatchingTabLabel('Partial matches', paymentClearingOverview.partiallyClearedCount),
            value: 'partial',
          },
          {
            href: '/finance-tax/payment-clearing?range=all&review=terminal&sort=recent',
            label: paymentMatchingTabLabel(
              'Cleared & reversed history',
              paymentClearingOverview.clearedCount + paymentClearingOverview.reversedCount,
            ),
            value: 'history',
          },
        ]}
        semantics="navigation"
      />

      {showBatchOwnerConfirmation && requestedImportBatch ? (
        <ConfirmDialog
          action={assignImportBatchOwnerAction}
          cancelHref={currentImportHistoryHref}
          confirmLabel={requestedImportBatch.assigneeAdminId ? 'Reassign owner' : 'Assign owner'}
          description={`${requestedImportBatch.sourceFileName ?? shortId(requestedImportBatch.batchImportId)} has ${requestedImportBatch.reconciliationNeedsActionCount} open transaction(s). Assign one eligible Finance operator to own the remaining reconciliation review.`}
          hiddenInputs={[
            { name: 'batchImportId', value: requestedImportBatch.batchImportId },
            { name: 'redirectTo', value: currentImportHistoryHref },
          ]}
          id={`bank-import-review-owner-${requestedImportBatch.batchImportId}`}
          selectInputs={[
            {
              defaultValue: '',
              label: 'Reconciliation owner',
              name: 'assigneeAdminId',
              options: requestedBatchOwnerOptions,
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
              placeholder: 'Why should this operator own the remaining batch review?',
              required: true,
            },
          ]}
          title={`${requestedImportBatch.assigneeAdminId ? 'Reassign' : 'Assign'} bank statement batch review?`}
          tone="warning"
        />
      ) : requestedBatchOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          This import batch assignment is no longer available on the current page, has no open review work, or
          no eligible Finance operator can receive it.
        </AdminInlineNotice>
      ) : null}

      {isReviewWorkspace ? (
        <FinanceListCommandBoard ariaLabel="Bank command board">
          <FinanceListCommandCard
            detail={`${overviewSummary.unassignedCount} total unassigned review(s); ${formatMoney(
              overviewSummary.unassignedOver48hAmount,
              overviewSummary.currency,
            )} has waited at least 48 hours.`}
            href={queueHref(
              {
                ...filters,
                bankReconciliationAge: '48h',
                page: 1,
                range: 'all',
                review: 'unmatched',
              },
              '',
              'all',
              'unassigned',
            )}
            icon={UserRoundX}
            label="48h+ unassigned"
            scope={bankReconciliationOldestScope(
              overviewSummary.oldestUnassignedAt,
              overviewSummary.unassignedCount,
            )}
            tone={
              overviewSummary.unassignedOver48hCount > 0
                ? 'danger'
                : overviewSummary.unassignedCount > 0
                  ? 'warning'
                  : 'success'
            }
            value={overviewSummary.unassignedOver48hCount}
          />
          <FinanceListCommandCard
            detail={`${formatMoney(
              overviewSummary.partiallyMatchedAmount,
              overviewSummary.currency,
            )} is only partly connected to retained evidence.`}
            href={queueHref({ ...filters, page: 1, range: 'all', review: 'partial' }, '', 'all', 'all')}
            icon={CheckCircle2}
            label="Partially matched"
            scope={bankReconciliationOldestScope(
              overviewSummary.oldestPartiallyMatchedAt,
              overviewSummary.partiallyMatchedCount,
            )}
            tone={overviewSummary.partiallyMatchedCount > 0 ? 'warning' : 'success'}
            value={overviewSummary.partiallyMatchedCount}
          />
          <FinanceListCommandCard
            detail={`${overviewSummary.unmatchedCount + overviewSummary.partiallyMatchedCount} open bank transaction(s) still have an unmatched remainder.`}
            href={queueHref({ ...filters, page: 1, range: 'all', review: 'unmatched' }, '', 'all', 'all')}
            icon={AlertTriangle}
            label="Open exposure"
            scope="All open records"
            tone={overviewSummary.openExposureAmount > 0 ? 'danger' : 'success'}
            value={
              <MoneyText amount={overviewSummary.openExposureAmount} currency={overviewSummary.currency} />
            }
          />
          <FinanceListCommandCard
            detail={`${overviewSummary.matchedCount} matched · ${overviewSummary.ignoredCount} ignored · ${overviewSummary.reversedCount} reversed of ${overviewSummary.count} retained bank records.`}
            href={queueHref({ ...filters, page: 1, range: 'all', review: 'all' }, '', 'all', 'all')}
            icon={Landmark}
            label="Resolved rate"
            scope="All retained records"
            tone={
              overviewSummary.matchedCount + overviewSummary.ignoredCount + overviewSummary.reversedCount ===
                overviewSummary.count && overviewSummary.count > 0
                ? 'success'
                : 'info'
            }
            value={formatFinancePercent(
              overviewSummary.matchedCount + overviewSummary.ignoredCount + overviewSummary.reversedCount,
              overviewSummary.count,
            )}
          />
        </FinanceListCommandBoard>
      ) : null}

      {isReviewWorkspace ? (
        <AdminFilterPanel
          className="admin-mb-16 finance-matching-operations-filter"
          description={bankReconciliationFilterDescription({
            age: bankReconciliationAge,
            candidate: withdrawalCandidate,
            direction: bankTransactionDirection,
            owner: reviewOwner,
            page: pagination.page,
            q: transactionQuery,
            range: filters.range,
            review: filters.review,
            source: bankReconciliationSource,
            totalPages: pagination.totalPages,
          })}
          resultLabel={`${pagination.pageSize} per page`}
          resultTone="success"
          id="bank-reconciliation-operations"
          title="Bank reconciliation filters"
        >
          <AdminFormShell
            action="/finance-tax/bank-reconciliation"
            className="filter-form admin-mb-12 bank-reconciliation-search-form"
            key={JSON.stringify([
              filters.range,
              filters.review,
              filters.take,
              transactionQuery,
              bankTransactionDirection,
              bankReconciliationSource,
              bankReconciliationAge,
              withdrawalCandidate,
              reviewOwner,
            ])}
            method="get"
          >
            <input name="range" type="hidden" value={filters.range} />
            <input name="review" type="hidden" value={filters.review} />
            <input name="take" type="hidden" value={filters.take} />
            {filters.bankTransactionType ? (
              <input name="type" type="hidden" value={filters.bankTransactionType} />
            ) : null}
            {filters.bankReconciliationSource ? (
              <input name="source" type="hidden" value={filters.bankReconciliationSource} />
            ) : null}
            {filters.bankReconciliationAge ? (
              <input name="age" type="hidden" value={filters.bankReconciliationAge} />
            ) : null}
            {withdrawalCandidate !== 'all' ? (
              <input name="candidate" type="hidden" value={withdrawalCandidate} />
            ) : null}
            {reviewOwner !== 'all' ? <input name="owner" type="hidden" value={reviewOwner} /> : null}
            <AdminFormSearch
              defaultValue={transactionQuery}
              label="Search bank transactions"
              name="q"
              placeholder="Transfer reference, counterparty, description"
            />
            <AdminFormActionRow>
              <AdminFormControlButton className="button-primary" type="submit">
                Search
              </AdminFormControlButton>
              {transactionQuery ? (
                <AdminTextLink href={queueHref({ ...filters, page: 1 }, '', withdrawalCandidate)}>
                  Clear
                </AdminTextLink>
              ) : null}
            </AdminFormActionRow>
          </AdminFormShell>
          <FinanceListFilterLinks
            compact
            groups={[
              {
                defaultId: 'all',
                id: 'direction',
                links: (
                  [
                    ['All', 'all'],
                    ['Inflow', 'INFLOW'],
                    ['Outflow', 'OUTFLOW'],
                  ] as const
                ).map(([label, direction]) => ({
                  active: bankTransactionDirection === direction,
                  activePillClassName:
                    direction === 'INFLOW'
                      ? ('pill-success' as const)
                      : direction === 'OUTFLOW'
                        ? ('pill-warn' as const)
                        : ('pill-info' as const),
                  href: queueHref(
                    bankReconciliationFiltersForDirection(filters, direction),
                    transactionQuery,
                    direction === 'OUTFLOW' ? withdrawalCandidate : 'all',
                    reviewOwner,
                  ),
                  id: direction,
                  label,
                })),
              },
              {
                defaultId: 'all',
                id: 'evidence-source',
                links: (
                  [
                    ['All evidence', 'all'],
                    ['Payment clearing', 'PAYMENT_CLEARING'],
                    ['Partner deposit', 'PARTNER_DEPOSIT'],
                    ['Withdrawal', 'WITHDRAWAL'],
                    ['Payout', 'PAYOUT'],
                    ['Refund', 'REFUND'],
                    ['Other journal', 'OTHER_JOURNAL'],
                    ['Not linked', 'UNCLASSIFIED'],
                  ] as const
                ).map(([label, source]) => ({
                  active: bankReconciliationSource === source,
                  activePillClassName: bankReconciliationEvidenceSourceFilterPill(source),
                  href: queueHref(
                    bankReconciliationFiltersForSource(filters, source),
                    transactionQuery,
                    withdrawalCandidate,
                    reviewOwner,
                  ),
                  id: source,
                  label: bankReconciliationEvidenceSourceFilterLabel(label, source, evidenceSourceSummary),
                })),
              },
              {
                className: 'finance-list-filter-group-wide',
                defaultId: 'unmatched',
                id: 'review',
                links: BANK_RECONCILIATION_REVIEW_LINKS.map((item) => ({
                  active: filters.review === item.review,
                  activePillClassName: 'pill-warn',
                  href: queueHref(
                    { ...filters, page: 1, review: item.review },
                    transactionQuery,
                    withdrawalCandidateForDirection(bankTransactionDirection, withdrawalCandidate),
                    reviewOwnerForReview(item.review, reviewOwner),
                  ),
                  id: item.review,
                  label: item.label,
                })),
              },
              ...(bankTransactionDirection === 'OUTFLOW'
                ? [
                    {
                      defaultId: 'all',
                      id: 'withdrawal-candidate',
                      links: (['all', 'eligible', 'strong', 'review', 'none'] as const).map((candidate) => ({
                        active: withdrawalCandidate === candidate,
                        activePillClassName:
                          candidate === 'strong'
                            ? ('pill-success' as const)
                            : candidate === 'review'
                              ? ('pill-warn' as const)
                              : ('pill-info' as const),
                        href: queueHref(
                          { ...filters, page: 1 },
                          transactionQuery,
                          candidate,
                          candidate === 'all' ? 'all' : reviewOwner,
                        ),
                        id: candidate,
                        label: withdrawalCandidateFilterLabel(candidate),
                      })),
                    },
                  ]
                : []),
              ...(bankReconciliationReviewNeedsOwner(filters.review)
                ? [
                    {
                      defaultId: 'all',
                      id: 'review-owner',
                      links: (['all', 'mine', 'unassigned', 'assigned'] as const).map((owner) => ({
                        active: reviewOwner === owner,
                        activePillClassName:
                          owner === 'unassigned' || owner === 'mine'
                            ? ('pill-warn' as const)
                            : ('pill-info' as const),
                        href: queueHref(
                          { ...filters, page: 1 },
                          transactionQuery,
                          withdrawalCandidate,
                          owner,
                        ),
                        id: owner,
                        label: reviewOwnerFilterLabel(owner),
                      })),
                    },
                  ]
                : []),
              ...(bankReconciliationReviewNeedsOwner(filters.review)
                ? [
                    {
                      defaultId: 'all',
                      id: 'age',
                      links: (['all', '48h'] as const).map((age) => ({
                        active: bankReconciliationAge === age,
                        activePillClassName: age === '48h' ? ('pill-warn' as const) : ('pill-info' as const),
                        href: queueHref(
                          bankReconciliationFiltersForAge(filters, age),
                          transactionQuery,
                          withdrawalCandidate,
                          reviewOwner,
                        ),
                        id: age,
                        label: bankReconciliationAgeLabel(age),
                      })),
                    },
                  ]
                : []),
              {
                defaultId: 'all',
                id: 'range',
                links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                  active: filters.range === range,
                  activePillClassName: 'pill-info',
                  href: queueHref({ ...filters, page: 1, range }, transactionQuery, withdrawalCandidate),
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
                  href: queueHref({ ...filters, page: 1, take }, transactionQuery, withdrawalCandidate),
                  id: take,
                  label: `${take} rows`,
                })),
              },
            ]}
          />
        </AdminFilterPanel>
      ) : null}

      {isImportWorkspace ? (
        <>
          <AdminSection
            className="admin-mb-16"
            description="Review a CSV statement before any row is saved. Exact duplicates and invalid rows stay blocked; potential duplicates require explicit row selection."
            id="bank-reconciliation-imports"
            title="CSV bank statement review"
          >
            <AdminDisclosure className="finance-reconciliation-import-disclosure">
              <summary>
                <span>Upload and review statement</span>
                <small>
                  Classify up to 50 rows, import reviewed evidence, then assign reconciliation to a separate
                  review stage.
                </small>
              </summary>
              <div className="admin-mt-16">
                <BankStatementBatchImport companyBankAccounts={companyBankAccounts} />
              </div>
            </AdminDisclosure>
          </AdminSection>

          <AdminFilterPanel
            className="admin-mb-16"
            description={
              assignmentNotice === 'assigned'
                ? 'Owner assigned and an in-app operations notification was created.'
                : assignmentNotice === 'failed'
                  ? 'Owner assignment failed. Confirm the operator has Bank Reconciliation access and try again.'
                  : 'Search by batch ID, source filename, or importing operator. Date range and reconciliation queue are applied on the server.'
            }
            resultLabel={`${importHistory.pagination.total} batch(es)`}
            resultTone="info"
            title="Statement import history filters"
          >
            <AdminFormShell action="/finance-tax/bank-reconciliation" className="filter-form" method="get">
              <input name="workspace" type="hidden" value="imports" />
              {bankReconciliationFilterHiddenInputs(params)}
              <AdminFormSearch
                defaultValue={importHistoryQuery}
                label="Search import history"
                name="importQ"
                placeholder="Batch, filename, operator"
              />
              <AdminFormSelect
                defaultValue={importHistoryRange}
                label="Import date range"
                name="importRange"
                options={FINANCE_LIST_DATE_RANGE_LINKS.map(([label, value]) => ({ label, value }))}
              />
              <AdminFormSelect
                defaultValue={importHistoryReview}
                label="Reconciliation queue"
                name="importReview"
                options={[
                  { label: 'All batches', value: 'all' },
                  { label: 'Needs reconciliation', value: 'needs-reconciliation' },
                  { label: 'Over 24 hours', value: 'stale' },
                  { label: 'Over 48 hours', value: 'escalated' },
                  { label: 'Reconciled', value: 'reconciled' },
                ]}
              />
              <AdminFormActionRow>
                <AdminFormControlButton className="button-primary" type="submit">
                  Apply filters
                </AdminFormControlButton>
                <AdminTextLink href={clearImportHistoryHref(params)}>Clear</AdminTextLink>
              </AdminFormActionRow>
            </AdminFormShell>
          </AdminFilterPanel>

          <FinanceTablePanel
            className="admin-mb-16"
            grouped
            description="Read-only audit provenance for reviewed CSV imports. File contents are not retained."
            resultLabel={`${importHistory.pagination.total} batch(es)`}
            resultTone="info"
            title="Bank statement import history"
          >
            <FinanceDataTable
              emptyMessage="No reviewed bank statement imports have been recorded."
              headers={[
                'Batch',
                'Source file',
                'Mapping',
                'Import result',
                'Reconciliation',
                'Import owner',
                'Approval stage',
                'Imported at',
              ]}
              rowCount={importHistory.items.length}
            >
              {importHistory.items.map((batch) => (
                <tr key={batch.batchImportId}>
                  <td>
                    <AdminTextLink
                      href={`/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(batch.batchImportId)}`}
                    >
                      <strong>{shortId(batch.batchImportId)}</strong>
                    </AdminTextLink>
                    <div className="muted" title={batch.batchImportId}>
                      {batch.batchImportId}
                    </div>
                  </td>
                  <td>
                    <strong>{batch.sourceFileName ?? 'Legacy import record'}</strong>
                    <div className="muted">
                      {batch.sourceFileSha256
                        ? `SHA-256 ${batch.sourceFileSha256.slice(0, 12)}...`
                        : 'No retained file hash'}
                    </div>
                  </td>
                  <td>{batch.mappingPreset ?? 'Legacy'}</td>
                  <td>
                    <StatusBadgeFromPillClass
                      pillClass={batch.skippedCount > 0 ? 'pill-warn' : 'pill-success'}
                    >
                      {batch.importedCount} imported
                    </StatusBadgeFromPillClass>
                    <div className="muted">
                      {batch.skippedCount} skipped / {batch.requestedCount} reviewed
                    </div>
                  </td>
                  <td>
                    <StatusBadgeFromPillClass
                      pillClass={importBatchReconciliationPillClass(batch.reconciliationSlaStatus)}
                    >
                      {importBatchReconciliationStatusLabel(batch)}
                    </StatusBadgeFromPillClass>
                    <div className="muted">
                      {batch.reconciliationProgressPercent == null
                        ? 'No imported transactions'
                        : `${batch.reconciliationProgressPercent}% complete · ${batch.reconciledTransactionCount}/${batch.reconciliationTransactionCount}`}
                    </div>
                    {batch.reconciliationWaitingHours != null ? (
                      <div className="muted">{batch.reconciliationWaitingHours}h waiting</div>
                    ) : null}
                  </td>
                  <td>
                    <strong>{adminIdentityLabel(batch.assignee, 'Unassigned')}</strong>
                    <div className="muted">
                      Imported by {adminIdentityLabel(batch.operator, 'Unknown operator')}
                    </div>
                    {batch.reconciliationNeedsActionCount > 0 ? (
                      <div className="admin-mt-6">
                        <AdminTextLink
                          href={appendQueryParam(
                            appendQueryParam(currentImportHistoryHref, 'confirm', 'batch-owner'),
                            'batchImportId',
                            batch.batchImportId,
                          )}
                        >
                          {batch.assigneeAdminId ? 'Reassign owner' : 'Assign owner'}
                        </AdminTextLink>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {batch.approvalAdminId
                      ? `Legacy import: ${adminIdentityLabel(batch.approver, batch.approvalAdminId)}`
                      : 'Required at reconciliation'}
                  </td>
                  <td>
                    <DateTimeText value={batch.createdAt} />
                  </td>
                </tr>
              ))}
            </FinanceDataTable>
            <FinanceTablePaginationFooter
              ariaLabel="Bank statement import history pages"
              hrefForPage={(page) => importHistoryHref(params, page)}
              pagination={importHistoryPagination(importHistory, importHistoryPage)}
            />
          </FinanceTablePanel>
        </>
      ) : null}

      {isManualWorkspace ? (
        <AdminSection
          className="admin-mb-16"
          description="Create one bank statement row from manual evidence. Imported rows start unmatched and can be reconciled from the transaction detail page."
          id="bank-reconciliation-manual-entry"
          statusLabel={
            importNotice === '1' ? 'Bank transaction imported' : importError ? 'Import failed' : undefined
          }
          statusTone={importNotice === '1' ? 'success' : importError ? 'danger' : 'info'}
          title="Manual bank transaction import"
        >
          <AdminDisclosure
            className="finance-reconciliation-import-disclosure"
            open={shouldOpenImportDisclosure}
          >
            <summary>
              <span>Bank import form</span>
              <small>Open only when a bank statement row is missing from the reconciliation list.</small>
            </summary>
            {importError ? (
              <div className="admin-mt-8">
                <p className="muted">
                  {importError === 'duplicate'
                    ? 'Potential duplicate found. Review the existing transaction list first, then confirm the duplicate review only when this is a distinct bank row.'
                    : importError === 'confirmation-required'
                      ? 'Bank transaction import was blocked. Review all statement fields and provide at least 12 characters of import evidence before confirming.'
                      : 'Bank transaction import failed. Check the bank account, type, amount, occurred date, and import evidence before trying again.'}
                </p>
                {duplicateCandidateIds.length > 0 ? (
                  <div
                    className="admin-inline-link-list admin-mt-8"
                    aria-label="Potential duplicate bank transactions"
                  >
                    {duplicateCandidateIds.map((candidateId) => (
                      <AdminTextLink href={bankReconciliationDetailHref(candidateId)} key={candidateId}>
                        Review {shortId(candidateId)}
                      </AdminTextLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <AdminFormGrid action={createCompanyBankTransactionAction} className="compact-form admin-mt-16">
              <input
                name="confirmationIntent"
                type="hidden"
                value={MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT}
              />
              <input name="redirectTo" type="hidden" value={bankReconciliationWorkspaceHref('manual')} />
              <AdminFormSelect
                defaultValue={bankAccountOptions[0]?.value ?? ''}
                disabled={!companyBankAccounts.length}
                label="Bank account"
                labelVisibility="visible"
                name="bankAccountId"
                options={bankAccountOptions}
                required
              />
              <AdminFormSelect
                defaultValue="INFLOW"
                label="Type"
                labelVisibility="visible"
                name="type"
                options={[
                  { label: 'Inflow', value: 'INFLOW' },
                  { label: 'Outflow', value: 'OUTFLOW' },
                ]}
              />
              <AdminFormInput
                label="Amount"
                labelVisibility="visible"
                min={1}
                name="amount"
                required
                step={1}
                type="number"
              />
              <AdminFormDateTime label="Occurred at" labelVisibility="visible" name="occurredAt" required />
              <AdminFormDate label="Value date" labelVisibility="visible" name="valueDate" />
              <AdminFormInput label="Transfer reference" labelVisibility="visible" name="transferRef" />
              <AdminFormInput label="Counterparty" labelVisibility="visible" name="counterpartyName" />
              <AdminFormTextarea
                className="admin-grid-span-2"
                label="Description"
                labelVisibility="visible"
                name="description"
                rows={2}
              />
              <AdminFormTextarea
                className="admin-grid-span-2"
                label="Import evidence"
                labelVisibility="visible"
                maxLength={500}
                minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
                name="operatorReason"
                placeholder="Why this bank statement row must be created manually"
                required
                rows={2}
              />
              <AdminFormCheckbox
                className="admin-grid-span-2"
                label="Potential duplicate review"
                name="confirmPotentialDuplicate"
              >
                I reviewed existing bank rows and confirm this is a distinct transaction.
              </AdminFormCheckbox>
              <BankReconciliationConfirmationDisclosure
                auditDetail="Submitting creates one unmatched evidence row and records the signed-in importing operator, duplicate decision, and import evidence. Matching or ignoring it later requires an assigned review owner and a different signed-in Finance approver."
                className="admin-grid-span-2"
                confirmLabel="Confirm bank transaction import"
                detail="Verify the original statement, bank account, direction, amount, occurrence time, and duplicate review before creating this unmatched row."
                disabled={!companyBankAccounts.length}
                title="Review manual bank transaction"
                tone="danger"
              />
            </AdminFormGrid>
          </AdminDisclosure>
        </AdminSection>
      ) : null}

      {isReviewWorkspace ? (
        <AdminFormShell
          action={assignBankTransactionReviewsAction}
          className="finance-bank-reconciliation-assignment-form"
          data-has-selection="false"
          id="bank-reconciliation-assignment-form"
        >
          <input name="redirectTo" type="hidden" value={currentQueueHref} />
          <FinanceTablePanel
            grouped
            description={
              reviewAssignmentNotice === 'bulk-assigned'
                ? 'Selected reviews were assigned. Every transaction remains open until explicit matching or approved ignore is completed.'
                : reviewAssignmentNotice === 'assigned'
                  ? 'Review owner assigned. The bank transaction remains open until explicit matching or approved ignore is completed.'
                  : reviewAssignmentNotice === 'notification-warning'
                    ? 'Review ownership was saved, but notification delivery needs retry. Use the retained assignment audit as the source of truth.'
                  : reviewAssignmentNotice === 'failed'
                    ? 'Review assignment failed. Confirm the operator has Bank Reconciliation access and is not already assigned.'
                    : bankReconciliationTableDescription(
                        filters.review,
                        withdrawalCandidate,
                        bankTransactionDirection,
                      )
            }
            resultLabel={`${pagination.totalRows} transaction(s)`}
            resultTone={bankReconciliationResultTone(filters.review, pagination.totalRows)}
            id="bank-reconciliation-records"
            title={bankReconciliationTableTitle(filters.review, bankTransactionDirection)}
          >
            {showBulkReviewAssignment ? (
              <BankReconciliationSelectionSummary
                formId="bank-reconciliation-assignment-form"
                loadOwnerOptions={loadBankReconciliationReviewOwnerOptions}
                visibleCount={pagination.rows.length}
              />
            ) : null}
            <FinanceDataTable
              ariaLabel="Bank reconciliation records"
              emptyMessage="No bank transactions match the current filters."
              headers={[
                ...(showBulkReviewAssignment ? ['Select'] : []),
                'Transaction',
                'Amount & status',
                'Owner & age',
                'Evidence',
                'Next action',
              ]}
              rowCount={pagination.rows.length}
              scrollClassName="finance-bank-reconciliation-table"
            >
              {pagination.rows.map((transaction) => {
                const matchedAmount = bankReconciliationMatchedAmount(transaction);
                const remainingAmount = bankReconciliationRemainingAmount(transaction);
                const reviewSla = bankReconciliationReviewSla(transaction.status, transaction.occurredAt);
                const statusModel = financeBankReconciliationStatusModel(transaction.status);
                return (
                  <tr key={transaction.id}>
                    {showBulkReviewAssignment ? (
                      <td>
                        {['UNMATCHED', 'PARTIALLY_MATCHED'].includes(transaction.status) ? (
                          <div
                            data-bank-selection-amount={transaction.amount}
                            data-bank-selection-currency={transaction.currency}
                            data-bank-selection-overdue={reviewSla?.status === 'OVER_48H' ? 'true' : 'false'}
                            data-bank-selection-row
                          >
                            <AdminFormCheckbox
                              label={`Select ${transaction.transferRef ?? shortId(transaction.sourceKey)}`}
                              name="bankTransactionIds"
                              value={transaction.id}
                            />
                          </div>
                        ) : (
                          <span className="muted">Closed</span>
                        )}
                      </td>
                    ) : null}
                    <td>
                      <AdminTextLink href={bankReconciliationDetailHref(transaction.id, currentQueueHref)}>
                        <strong>{transaction.transferRef ?? shortId(transaction.sourceKey)}</strong>
                      </AdminTextLink>
                      <div className="muted">{bankReconciliationLabel(transaction.type)}</div>
                      <div className="muted">
                        <DateTimeText value={transaction.occurredAt} />
                      </div>
                      {transaction.valueDate ? (
                        <div className="muted">
                          Value <DateTimeText value={transaction.valueDate} />
                        </div>
                      ) : null}
                      <div className="admin-mt-6">
                        <strong>{transaction.bankAccount?.name ?? 'Unknown account'}</strong>
                      </div>
                      {transaction.bankAccount?.bankName ? (
                        <div className="muted">{transaction.bankAccount.bankName}</div>
                      ) : (
                        <AdminInlineFallback className="admin-mt-6">No bank name</AdminInlineFallback>
                      )}
                      {bankAccountNumberLabel(transaction) ? (
                        <div className="muted">{bankAccountNumberLabel(transaction)}</div>
                      ) : (
                        <AdminInlineFallback className="admin-mt-6">No account number</AdminInlineFallback>
                      )}
                      {transaction.counterpartyName ? (
                        <div>{transaction.counterpartyName}</div>
                      ) : (
                        <AdminInlineFallback>No counterparty</AdminInlineFallback>
                      )}
                      {transaction.description ? (
                        <div className="muted">{transaction.description}</div>
                      ) : (
                        <AdminInlineFallback className="admin-mt-6">No description</AdminInlineFallback>
                      )}
                    </td>
                    <td>
                      <strong>
                        <MoneyText amount={transaction.amount} currency={transaction.currency} />
                      </strong>
                      <div className="muted">
                        {transaction.type === 'INFLOW' ? 'Bank inflow' : 'Bank outflow'}
                      </div>
                      <StatusBadgeFromPillClass
                        pillClass={financeBankReconciliationStatusPill(transaction.status)}
                      >
                        {statusModel.label}
                      </StatusBadgeFromPillClass>
                      {['IGNORED', 'REVERSED'].includes(transaction.status) ? (
                        <div className="muted">No active matching required</div>
                      ) : (
                        <>
                          <div className="muted">
                            Matched <MoneyText amount={matchedAmount} currency={transaction.currency} />
                            {' of '}
                            <MoneyText amount={transaction.amount} currency={transaction.currency} />
                          </div>
                          <div className="muted">
                            {remainingAmount < 0 ? 'Overmatched' : 'Remaining'}{' '}
                            <MoneyText amount={Math.abs(remainingAmount)} currency={transaction.currency} />
                          </div>
                        </>
                      )}
                      <div className="muted">
                        {transaction.reconciliationActiveMatchCount ?? 0} active match(es)
                        {transaction.reconciliationReversedMatchCount
                          ? ` · ${transaction.reconciliationReversedMatchCount} reversed`
                          : ''}
                      </div>
                    </td>
                    <td>
                      {bankTransactionReviewAssignment(transaction) ? (
                        <>
                          <strong>
                            {adminFinanceReviewAssigneeLabel(
                              bankTransactionReviewAssignment(transaction)?.assignee,
                              bankTransactionReviewAssignment(transaction)?.assigneeAdminId ??
                                'Unknown operator',
                            )}
                          </strong>
                          <div className="muted">
                            <DateTimeText value={bankTransactionReviewAssignment(transaction)?.assignedAt} />
                          </div>
                        </>
                      ) : ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(transaction.status) ? (
                        <AdminInlineFallback>Unassigned</AdminInlineFallback>
                      ) : (
                        <span className="muted">Closed</span>
                      )}
                      {['UNMATCHED', 'PARTIALLY_MATCHED'].includes(transaction.status) ? (
                        <div className="admin-mt-6">
                          <AdminTextLink
                            href={appendQueryParam(
                              appendQueryParam(currentQueueHref, 'confirm', 'review-owner'),
                              'bankTransactionId',
                              transaction.id,
                            )}
                          >
                            {bankTransactionReviewAssignment(transaction) ? 'Reassign owner' : 'Assign owner'}
                          </AdminTextLink>
                        </div>
                      ) : null}
                      {reviewSla ? (
                        <div className="admin-mt-6">
                          <StatusBadgeFromPillClass pillClass={bankReconciliationSlaPill(reviewSla.status)}>
                            {bankReconciliationSlaLabel(reviewSla.status, reviewSla.waitingHours)}
                          </StatusBadgeFromPillClass>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="participant-list admin-filter-chip-group">
                        {bankReconciliationRowSources(transaction).map((source) => (
                          <StatusBadgeFromPillClass
                            key={source}
                            pillClass={bankReconciliationEvidenceSourcePill(source)}
                          >
                            {bankReconciliationEvidenceSourceLabel(source)}
                          </StatusBadgeFromPillClass>
                        ))}
                      </div>
                      {transaction.withdrawalCandidateSummary ? (
                        <div className="admin-mt-6">
                          <StatusBadgeFromPillClass
                            pillClass={withdrawalCandidateSummaryPill(
                              transaction.withdrawalCandidateSummary.confidence,
                            )}
                          >
                            {withdrawalCandidateSummaryLabel(
                              transaction.withdrawalCandidateSummary.confidence,
                            )}
                          </StatusBadgeFromPillClass>
                          <div className="muted">
                            {transaction.withdrawalCandidateSummary.candidateCount} withdrawal candidate(s)
                            {transaction.withdrawalCandidateSummary.strongCount > 0
                              ? ` · ${transaction.withdrawalCandidateSummary.strongCount} strong`
                              : ''}
                          </div>
                        </div>
                      ) : transaction.type === 'OUTFLOW' ? (
                        <div className="muted admin-mt-6">No withdrawal candidate</div>
                      ) : null}
                      <div className="muted">{bankTransactionSourceLabel(transaction.sourceKey)}</div>
                    </td>
                    <td className="finance-bank-next-action-cell">
                      <strong>{statusModel.nextAction}</strong>
                      <div className="muted">{statusModel.closeoutLabel}</div>
                      <AdminTextLink href={bankReconciliationDetailHref(transaction.id, currentQueueHref)}>
                        {statusModel.closed ? 'View record' : 'Review and match'}
                      </AdminTextLink>
                    </td>
                  </tr>
                );
              })}
            </FinanceDataTable>
            <FinanceTablePaginationFooter
              ariaLabel="Bank reconciliation pages"
              hrefForPage={(page) => queueHref({ ...filters, page }, transactionQuery, withdrawalCandidate)}
              pagination={pagination}
            />
          </FinanceTablePanel>
        </AdminFormShell>
      ) : null}
      {isReviewWorkspace && bankReconciliationReviewNeedsOwner(filters.review) ? (
        <FinanceReviewOwnerWorkloadPanel
          currentOperatorId={currentOperatorId}
          description="Workload uses every unresolved transaction in the current queue filters, not only the visible page. Ownership comes from the latest review-assignment audit record."
          hrefForOwner={(owner) => queueHref(filters, transactionQuery, withdrawalCandidate, owner)}
          summary={reviewOwnerSummary}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

async function loadBankReconciliationReviewOwnerOptions() {
  'use server';

  const currentOperatorId = (await getCurrentAdminOperatorAccess())?.id ?? null;
  const adminUsers = await adminGet<AdminUser[]>(
    '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
    [],
  );
  return withExplicitBankOwnerChoice(
    buildBankReconciliationReviewOwnerOptions(adminUsers, null, currentOperatorId),
  );
}

async function createCompanyBankTransactionAction(formData: FormData) {
  'use server';

  const redirectTo = safeBankReconciliationReturnTo(formData.get('redirectTo'));
  const occurredAt = formDateTimeToIso(formData.get('occurredAt'));
  const valueDate = String(formData.get('valueDate') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim();
  const type = String(formData.get('type') ?? 'INFLOW').trim();
  const confirmationIntent = String(formData.get('confirmationIntent') ?? '').trim();
  const operatorReason = String(formData.get('operatorReason') ?? '').trim();

  if (
    !isConfirmedManualBankTransactionImport({ confirmationIntent, evidence: operatorReason }) ||
    !bankAccountId ||
    !isBankTransactionType(type) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !occurredAt
  ) {
    return redirect(appendQueryParam(redirectTo, 'bankImportError', 'confirmation-required'));
  }

  try {
    await adminPostOrThrow('/admin/bank-reconciliation/transactions', {
      amount,
      bankAccountId,
      counterpartyName: String(formData.get('counterpartyName') ?? '').trim() || null,
      description: String(formData.get('description') ?? '').trim() || null,
      confirmPotentialDuplicate: formData.get('confirmPotentialDuplicate') === 'on',
      occurredAt,
      operatorReason,
      transferRef: String(formData.get('transferRef') ?? '').trim() || null,
      type,
      valueDate: valueDate ? `${valueDate}T00:00:00.000Z` : null,
    });
  } catch (error) {
    const errorCode = error instanceof AdminApiRequestError && error.status === 409 ? 'duplicate' : 'failed';
    const candidateIds = potentialDuplicateCandidateIds(error);
    const errorHref = appendQueryParam(redirectTo, 'bankImportError', errorCode);
    return redirect(
      candidateIds.length > 0
        ? appendQueryParam(errorHref, 'bankDuplicateCandidates', candidateIds.join(','))
        : errorHref,
    );
  }

  return redirect(appendQueryParam(redirectTo, 'bankImported', '1'));
}

async function assignImportBatchOwnerAction(formData: FormData) {
  'use server';

  const batchImportId = String(formData.get('batchImportId') ?? '').trim();
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const redirectTo = safeBankReconciliationReturnTo(formData.get('redirectTo'));
  if (!batchImportId || !assigneeAdminId || reason.length < 12) {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/import-batches/${encodeURIComponent(batchImportId)}/assignment`,
      { assigneeAdminId, reason },
    );
  } catch {
    redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'failed'));
  }
  redirect(appendQueryParam(redirectTo, 'assignmentNotice', 'assigned'));
}

async function assignBankTransactionReviewAction(formData: FormData) {
  'use server';

  const bankTransactionId = String(formData.get('bankTransactionId') ?? '').trim();
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const redirectTo = safeBankReconciliationReturnTo(formData.get('redirectTo'));
  if (!bankTransactionId || !assigneeAdminId || reason.length < 12) {
    redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'failed'));
  }

  let notificationFailed = false;
  try {
    const result = await adminPostOrThrow<BankReviewAssignmentResult>(
      `/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/review-assignment`,
      { assigneeAdminId, reason },
    );
    notificationFailed = result.notification.failedCount > 0;
  } catch {
    redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'failed'));
  }
  redirect(
    appendQueryParam(
      redirectTo,
      'reviewAssignmentNotice',
      notificationFailed ? 'notification-warning' : 'assigned',
    ),
  );
}

async function assignBankTransactionReviewsAction(formData: FormData) {
  'use server';

  const bankTransactionIds = Array.from(
    new Set(
      formData
        .getAll('bankTransactionIds')
        .map((bankTransactionId) => String(bankTransactionId).trim())
        .filter(Boolean),
    ),
  );
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const redirectTo = safeBankReconciliationReturnTo(formData.get('redirectTo'));
  if (
    bankTransactionIds.length === 0 ||
    bankTransactionIds.length > 50 ||
    !assigneeAdminId ||
    reason.length < 12
  ) {
    redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'failed'));
  }

  let notificationFailed = false;
  try {
    const result = await adminPostOrThrow<BankReviewAssignmentResult>(
      '/admin/bank-reconciliation/review-assignments',
      {
        assigneeAdminId,
        bankTransactionIds,
        reason,
      },
    );
    notificationFailed = result.notification.failedCount > 0;
  } catch {
    redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'failed'));
  }
  redirect(
    appendQueryParam(
      redirectTo,
      'reviewAssignmentNotice',
      notificationFailed ? 'notification-warning' : 'bulk-assigned',
    ),
  );
}

type BankReviewAssignmentResult = {
  readonly notification: {
    readonly deliveredCount: number;
    readonly failedCount: number;
    readonly warning: string | null;
  };
};

function formDateTimeToIso(value: FormDataEntryValue | null) {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function companyBankAccountOptionLabel(account: AdminCompanyBankAccount) {
  const masked =
    account.accountNumberMasked ?? (account.accountNumberLast4 ? `****${account.accountNumberLast4}` : '');
  return [account.name, account.bankName, masked, account.currency].filter(Boolean).join(' - ');
}

function bankAccountNumberLabel(transaction: AdminCompanyBankTransaction) {
  return transaction.bankAccount?.accountNumberMasked ?? transaction.bankAccount?.accountNumberLast4 ?? '';
}

function withdrawalCandidateSummaryLabel(confidence: 'NONE' | 'REVIEW' | 'STRONG') {
  if (confidence === 'STRONG') return 'Strong withdrawal candidate';
  if (confidence === 'REVIEW') return 'Review withdrawal candidates';
  return 'No withdrawal candidate';
}

function withdrawalCandidateSummaryPill(confidence: 'NONE' | 'REVIEW' | 'STRONG') {
  if (confidence === 'STRONG') return 'pill-success';
  if (confidence === 'REVIEW') return 'pill-warn';
  return 'pill-neutral';
}

function bankReconciliationSlaLabel(status: 'CURRENT' | 'OVER_24H' | 'OVER_48H', waitingHours: number) {
  const age = bankReconciliationWaitingAgeLabel(waitingHours);
  if (status === 'OVER_48H') return `${age} waiting · 48h+`;
  if (status === 'OVER_24H') return `${age} waiting · 24h+`;
  return `${age} waiting · Current`;
}

function bankReconciliationWaitingAgeLabel(hours: number) {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days === 0) return `${remainingHours}h`;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function bankTransactionSourceLabel(sourceKey: string) {
  const source = sourceKey.toLowerCase();
  if (source.startsWith('manual-bank-transaction:')) return 'Manual bank entry';
  if (source.includes('import') || source.includes('statement') || source.includes('batch')) {
    return 'Statement import';
  }
  return 'Imported bank evidence';
}

function bankReconciliationSlaPill(status: 'CURRENT' | 'OVER_24H' | 'OVER_48H') {
  if (status === 'OVER_48H') return 'pill-danger';
  if (status === 'OVER_24H') return 'pill-warn';
  return 'pill-info';
}

function withExplicitBankOwnerChoice(options: Array<{ label: string; value: string }>) {
  return [{ label: 'Select an eligible Finance operator', value: '' }, ...options];
}

function bankReconciliationReviewSla(status: string, occurredAt: string) {
  if (!['UNMATCHED', 'PARTIALLY_MATCHED'].includes(status)) return null;
  const occurredAtMs = new Date(occurredAt).getTime();
  if (!Number.isFinite(occurredAtMs)) return null;
  const waitingHours = Math.max(0, Math.floor((Date.now() - occurredAtMs) / 3_600_000));
  return {
    status:
      waitingHours >= 48
        ? ('OVER_48H' as const)
        : waitingHours >= 24
          ? ('OVER_24H' as const)
          : ('CURRENT' as const),
    waitingHours,
  };
}

function isBankTransactionType(value: string) {
  return value === 'INFLOW' || value === 'OUTFLOW';
}

function appendQueryParam(href: string, key: string, value: string) {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function bankReconciliationApiHref(
  href: string,
  query: string,
  candidate: WithdrawalCandidateFilter,
  owner: ReviewOwnerFilter,
  currentOperatorId: string | null,
) {
  let nextHref = query ? appendQueryParam(href, 'q', query) : href;
  if (candidate !== 'all') {
    nextHref = appendQueryParam(nextHref, 'candidate', candidate);
  }
  if (owner === 'mine' && currentOperatorId) {
    nextHref = appendQueryParam(nextHref, 'assignment', 'assigned');
    nextHref = appendQueryParam(nextHref, 'assigneeAdminId', currentOperatorId);
  } else if (owner === 'assigned') {
    nextHref = appendQueryParam(nextHref, 'assignment', 'assigned');
  } else if (owner === 'unassigned') {
    nextHref = appendQueryParam(nextHref, 'assignment', 'unassigned');
  }
  return nextHref;
}

function bankReconciliationQueueHref(
  filters: Parameters<typeof bankReconciliationHref>[0],
  query: string,
  candidate: WithdrawalCandidateFilter,
  owner: ReviewOwnerFilter = 'all',
) {
  let href = query
    ? appendQueryParam(bankReconciliationHref(filters), 'q', query)
    : bankReconciliationHref(filters);
  if (candidate !== 'all') {
    href = appendQueryParam(href, 'candidate', candidate);
  }
  if (owner !== 'all') {
    href = appendQueryParam(href, 'owner', owner);
  }
  return href;
}

function withdrawalCandidateFilter(value: string): WithdrawalCandidateFilter {
  return value === 'eligible' || value === 'strong' || value === 'review' || value === 'none' ? value : 'all';
}

function withdrawalCandidateFilterLabel(candidate: WithdrawalCandidateFilter) {
  if (candidate === 'eligible') return 'All eligible outflows';
  if (candidate === 'strong') return 'Strong candidates';
  if (candidate === 'review') return 'Needs review';
  if (candidate === 'none') return 'No candidate';
  return 'All transactions';
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

function bankReconciliationAgeLabel(age: BankReconciliationAgeFilter) {
  return age === '48h' ? '48h+ waiting' : 'All ages';
}

function bankReconciliationFiltersForDirection(
  filters: Parameters<typeof bankReconciliationHref>[0],
  direction: BankTransactionDirection,
) {
  const filtersWithoutDirection = {
    ...(filters.assigneeAdminId ? { assigneeAdminId: filters.assigneeAdminId } : {}),
    ...(filters.assignment ? { assignment: filters.assignment } : {}),
    ...(filters.bankReconciliationAge ? { bankReconciliationAge: filters.bankReconciliationAge } : {}),
    ...(filters.bankReconciliationSource
      ? { bankReconciliationSource: filters.bankReconciliationSource }
      : {}),
    page: 1,
    range: filters.range,
    review: filters.review,
    take: filters.take,
  };
  return direction === 'all'
    ? filtersWithoutDirection
    : { ...filtersWithoutDirection, bankTransactionType: direction };
}

function bankReconciliationFiltersForSource(
  filters: Parameters<typeof bankReconciliationHref>[0],
  source: BankReconciliationSourceFilter,
) {
  const filtersWithoutSource = {
    ...(filters.assigneeAdminId ? { assigneeAdminId: filters.assigneeAdminId } : {}),
    ...(filters.assignment ? { assignment: filters.assignment } : {}),
    ...(filters.bankReconciliationAge ? { bankReconciliationAge: filters.bankReconciliationAge } : {}),
    ...(filters.bankTransactionType ? { bankTransactionType: filters.bankTransactionType } : {}),
    page: 1,
    range: filters.range,
    review: filters.review,
    take: filters.take,
  };
  return source === 'all'
    ? filtersWithoutSource
    : { ...filtersWithoutSource, bankReconciliationSource: source };
}

function bankReconciliationFiltersForAge(
  filters: Parameters<typeof bankReconciliationHref>[0],
  age: BankReconciliationAgeFilter,
) {
  const filtersWithoutAge = {
    ...(filters.assigneeAdminId ? { assigneeAdminId: filters.assigneeAdminId } : {}),
    ...(filters.assignment ? { assignment: filters.assignment } : {}),
    ...(filters.bankReconciliationSource
      ? { bankReconciliationSource: filters.bankReconciliationSource }
      : {}),
    ...(filters.bankTransactionType ? { bankTransactionType: filters.bankTransactionType } : {}),
    page: 1,
    range: filters.range,
    review: filters.review,
    take: filters.take,
  };
  return age === '48h' ? { ...filtersWithoutAge, bankReconciliationAge: age } : filtersWithoutAge;
}

function withdrawalCandidateForDirection(
  direction: BankTransactionDirection,
  candidate: WithdrawalCandidateFilter,
) {
  return direction === 'OUTFLOW' ? candidate : 'all';
}

function reviewOwnerForReview(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  owner: ReviewOwnerFilter,
) {
  return bankReconciliationReviewNeedsOwner(review) ? owner : 'all';
}

function bankReconciliationReviewNeedsOwner(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
) {
  return review === 'unmatched' || review === 'partial';
}

function bankReconciliationOldestScope(value: string | null | undefined, count: number) {
  if (!value || count === 0) return 'Queue clear';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Needs action';
  const waitingHours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (waitingHours >= 48) return `Oldest ${Math.floor(waitingHours / 24)}d`;
  return `Oldest ${waitingHours}h`;
}

function bankReconciliationFilterDescription(input: {
  age: BankReconciliationAgeFilter;
  candidate: WithdrawalCandidateFilter;
  direction: BankTransactionDirection;
  owner: ReviewOwnerFilter;
  page: number;
  q: string;
  range: ReturnType<typeof readFinanceAccountingFilters>['range'];
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'];
  source: BankReconciliationSourceFilter;
  totalPages: number;
}) {
  const segments = [
    `Showing page ${input.page} of ${input.totalPages}.`,
    `Range: ${dateRangeLabel(input.range)}.`,
    `Direction: ${bankTransactionDirectionLabel(input.direction)}.`,
    `Evidence source: ${bankReconciliationEvidenceSourceLabel(input.source)}.`,
    `Queue: ${financeAccountingReviewLabel(input.review, BANK_RECONCILIATION_REVIEW_LINKS)}.`,
  ];
  if (input.direction === 'OUTFLOW') {
    segments.push(`Withdrawal candidates: ${withdrawalCandidateFilterLabel(input.candidate)}.`);
  }
  if (bankReconciliationReviewNeedsOwner(input.review)) {
    segments.push(`Review owner: ${reviewOwnerFilterLabel(input.owner)}.`);
    segments.push(`Waiting age: ${bankReconciliationAgeLabel(input.age)}.`);
  }
  if (input.q) segments.push(`Search: ${input.q}.`);
  segments.push(
    'Evidence totals use active matches; one transaction may appear in more than one linked source.',
  );
  return segments.join(' ');
}

function bankReconciliationTableTitle(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  direction: BankTransactionDirection,
) {
  const directionLabel = direction === 'all' ? '' : ` · ${bankTransactionDirectionLabel(direction)}`;
  if (review === 'unmatched') return `Needs action${directionLabel}`;
  if (review === 'partial') return `Partially matched${directionLabel}`;
  if (review === 'matched') return `Matched records${directionLabel}`;
  if (review === 'ignored') return `Ignored records${directionLabel}`;
  if (review === 'reversed') return `Reversed records${directionLabel}`;
  return `All bank transaction records${directionLabel}`;
}

function bankReconciliationTableDescription(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  candidate: WithdrawalCandidateFilter,
  direction: BankTransactionDirection,
) {
  if (review === 'unmatched') {
    return 'Oldest unmatched bank transactions appear first. Assign one owner and connect retained payment, withdrawal, payout, or ledger evidence.';
  }
  if (review === 'partial') {
    return 'These transactions are only partly matched. Review the remaining amount before treating the bank movement as complete.';
  }
  if (review === 'matched') {
    return 'Fully matched bank transactions are retained as accounting records. No operator action is expected.';
  }
  if (direction === 'OUTFLOW') {
    return candidate === 'all'
      ? 'Review bank outflows and narrow to strong, review, or missing withdrawal candidates when needed.'
      : 'Oldest withdrawal candidate transactions appear first. Confirm the retained transfer evidence before matching.';
  }
  if (review === 'ignored') {
    return 'Ignored transactions are retained with approval evidence and should not be edited directly.';
  }
  if (review === 'reversed') {
    return 'Reversed records are retained as closed audit evidence. Review their history before any follow-up.';
  }
  return 'Use this view for historical lookup. Current operational work remains in Needs action and Partially matched.';
}

function bankTransactionDirectionLabel(direction: BankTransactionDirection) {
  if (direction === 'INFLOW') return 'Inflow';
  if (direction === 'OUTFLOW') return 'Outflow';
  return 'All';
}

function bankReconciliationEvidenceSourceLabel(source: BankReconciliationSourceFilter) {
  if (source === 'PAYMENT_CLEARING') return 'Payment clearing';
  if (source === 'PARTNER_DEPOSIT') return 'Partner deposit';
  if (source === 'WITHDRAWAL') return 'Withdrawal';
  if (source === 'PAYOUT') return 'Payout';
  if (source === 'REFUND') return 'Refund';
  if (source === 'OTHER_JOURNAL') return 'Other journal';
  if (source === 'UNCLASSIFIED') return 'Not linked';
  return 'All evidence';
}

function bankReconciliationEvidenceSourceFilterLabel(
  label: string,
  source: BankReconciliationSourceFilter,
  summary: AdminBankReconciliationEvidenceSourceSummary,
) {
  const facet =
    source === 'all'
      ? { amount: summary.amount, count: summary.count }
      : (summary.sources?.find((item) => item.source === source) ?? { amount: 0, count: 0 });
  return `${label} · ${facet.count} · ${formatMoney(facet.amount, summary.currency || 'VND')}`;
}

function bankReconciliationEvidenceSourcePill(source: BankReconciliationSourceFilter) {
  if (source === 'PARTNER_DEPOSIT') return 'pill-success' as const;
  if (source === 'WITHDRAWAL' || source === 'PAYOUT') return 'pill-warn' as const;
  if (source === 'REFUND') return 'pill-danger' as const;
  if (source === 'UNCLASSIFIED') return 'pill-warn' as const;
  return 'pill-info' as const;
}

function bankReconciliationEvidenceSourceFilterPill(source: BankReconciliationSourceFilter) {
  if (source === 'PARTNER_DEPOSIT') return 'pill-success' as const;
  if (source === 'WITHDRAWAL' || source === 'PAYOUT' || source === 'REFUND' || source === 'UNCLASSIFIED') {
    return 'pill-warn' as const;
  }
  return 'pill-info' as const;
}

function bankReconciliationRowSources(
  transaction: AdminCompanyBankTransaction,
): BankReconciliationEvidenceSource[] {
  return transaction.reconciliationSources?.length ? transaction.reconciliationSources : ['UNCLASSIFIED'];
}

function bankReconciliationResultTone(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  count: number,
) {
  if (review === 'unmatched' || review === 'partial')
    return count > 0 ? ('warning' as const) : ('success' as const);
  if (review === 'matched') return 'success' as const;
  return 'neutral' as const;
}

function bankReconciliationLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function bankReconciliationMatchedAmount(transaction: AdminCompanyBankTransaction) {
  if (transaction.reconciliationMatchedAmount != null) return transaction.reconciliationMatchedAmount;
  return transaction.status === 'MATCHED' ? transaction.amount : 0;
}

function bankReconciliationRemainingAmount(transaction: AdminCompanyBankTransaction) {
  if (transaction.reconciliationRemainingAmount != null) return transaction.reconciliationRemainingAmount;
  return transaction.status === 'MATCHED' ? 0 : transaction.amount;
}

function safeBankReconciliationReturnTo(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '/finance-tax/bank-reconciliation';
  const url = new URL(normalized, 'http://localhost');
  return url.origin === 'http://localhost' && url.pathname === '/finance-tax/bank-reconciliation'
    ? `${url.pathname}${url.search}`
    : '/finance-tax/bank-reconciliation';
}

function adminFinanceReviewAssigneeLabel(
  assignee: { readonly email?: string | null; readonly fullName?: string | null } | null | undefined,
  userId: string,
) {
  return assignee?.fullName ?? assignee?.email ?? shortId(userId);
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function positivePage(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function importHistoryPagination(history: AdminCompanyBankTransactionImportBatchHistory, page: number) {
  const totalRows = history.pagination.total;
  const totalPages = Math.max(1, Math.ceil(totalRows / history.pagination.take));
  const safePage = Math.min(page, totalPages);
  const from = totalRows > 0 ? history.pagination.skip + 1 : 0;
  return {
    from,
    page: safePage,
    to: totalRows > 0 ? Math.min(history.pagination.skip + history.items.length, totalRows) : 0,
    totalPages,
    totalRows,
  };
}

function importHistoryHref(params: Record<string, string | string[] | undefined>, page: number) {
  const search = new URLSearchParams({ workspace: 'imports' });
  for (const [key, value] of bankReconciliationPreservedFilterEntries(params)) {
    search.set(key, value);
  }
  for (const key of ['importQ', 'importRange', 'importReview']) {
    const value = readParam(params, key);
    if (value) {
      search.set(key, value);
    }
  }
  if (page > 1) search.set('importPage', String(page));
  const query = search.toString();
  return `/finance-tax/bank-reconciliation${query ? `?${query}` : ''}`;
}

function buildImportHistoryApiHref(input: {
  page: number;
  q: string;
  range: string;
  review: string;
  take: number;
}) {
  const search = new URLSearchParams({
    range: input.range,
    skip: String((input.page - 1) * input.take),
    take: String(input.take),
  });
  if (input.q) search.set('q', input.q);
  if (input.review !== 'all') search.set('review', input.review);
  return `/admin/bank-reconciliation/import-batches?${search.toString()}`;
}

function importHistoryRangeValue(value: string) {
  return value === '7d' || value === '30d' || value === 'all' ? value : 'today';
}

function importHistoryReviewValue(value: string) {
  return value === 'needs-reconciliation' ||
    value === 'stale' ||
    value === 'escalated' ||
    value === 'reconciled'
    ? value
    : 'all';
}

function bankReconciliationFilterHiddenInputs(params: Record<string, string | string[] | undefined>) {
  return bankReconciliationPreservedFilterEntries(params).map(([key, value]) => (
    <input key={key} name={key} type="hidden" value={value} />
  ));
}

function bankTransactionReviewAssignment(transaction: AdminCompanyBankTransaction) {
  return transaction.reviewAssignment ?? transaction.withdrawalCandidateSummary?.reviewAssignment ?? null;
}

function clearImportHistoryHref(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams({ workspace: 'imports' });
  for (const [key, value] of bankReconciliationPreservedFilterEntries(params)) {
    search.set(key, value);
  }
  const query = search.toString();
  return `/finance-tax/bank-reconciliation${query ? `?${query}` : ''}`;
}

function bankReconciliationPreservedFilterEntries(params: Record<string, string | string[] | undefined>) {
  const direction = readParam(params, 'type');

  return ['range', 'review', 'take', 'page', 'type', 'source', 'age', 'candidate', 'owner', 'q'].flatMap(
    (key) => {
      const value = readParam(params, key);
      if (!value || (key === 'candidate' && direction !== 'OUTFLOW')) {
        return [];
      }
      return [[key, value] as const];
    },
  );
}

function importBatchReconciliationPillClass(
  status: AdminCompanyBankTransactionImportBatchHistory['items'][number]['reconciliationSlaStatus'],
) {
  if (status === 'ESCALATE') return 'pill-danger';
  if (status === 'OVER_24H') return 'pill-warn';
  if (status === 'WITHIN_24H') return 'pill-info';
  if (status === 'RECONCILED') return 'pill-success';
  return 'pill-neutral';
}

function importBatchReconciliationStatusLabel(
  batch: AdminCompanyBankTransactionImportBatchHistory['items'][number],
) {
  if (batch.reconciliationSlaStatus === 'ESCALATE') {
    return `Escalate · ${batch.reconciliationNeedsActionCount} open`;
  }
  if (batch.reconciliationSlaStatus === 'OVER_24H') {
    return `Over SLA · ${batch.reconciliationNeedsActionCount} open`;
  }
  if (batch.reconciliationSlaStatus === 'WITHIN_24H') {
    return `${batch.reconciliationNeedsActionCount} need action`;
  }
  return batch.reconciliationSlaStatus === 'RECONCILED' ? 'Reconciled' : 'No transactions';
}

function adminIdentityLabel(
  admin: { id: string; email: string | null; fullName: string | null } | null,
  fallback: string,
) {
  return admin?.fullName ?? admin?.email ?? admin?.id ?? fallback;
}

function readDuplicateCandidateIdsParam(params: Record<string, string | string[] | undefined>) {
  return readParam(params, 'bankDuplicateCandidates')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z0-9_-]{1,128}$/.test(value))
    .slice(0, 5);
}

function potentialDuplicateCandidateIds(error: unknown) {
  if (!(error instanceof AdminApiRequestError) || error.status !== 409) {
    return [];
  }
  const payload = error.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const record = payload as Record<string, unknown>;
  if (record.code !== 'BANK_TRANSACTION_POTENTIAL_DUPLICATE' || !Array.isArray(record.candidates)) {
    return [];
  }
  return record.candidates
    .map((candidate) =>
      candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? (candidate as Record<string, unknown>).id
        : null,
    )
    .filter((value): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value))
    .slice(0, 5);
}
