import { AlertTriangle, CheckCircle2, FileWarning, Landmark, UserCheck, UserRoundX } from 'lucide-react';
import { redirect } from 'next/navigation';

import type {
  AdminBankReconciliationSummary,
  AdminBankReconciliationWithdrawalCandidateSummary,
  AdminCompanyBankAccount,
  AdminCompanyBankTransaction,
  AdminCompanyBankTransactionImportBatchHistory,
  AdminCompanyBankTransactionImportBatchSummary,
  AdminUser,
} from '../../../lib/admin-api';
import { AdminApiRequestError, adminGet, adminPostOrThrow } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
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
import { AdminDisclosure, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { buildFinanceApproverOptions } from '../finance-approver-options';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { financeBankReconciliationStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { BankStatementBatchImport } from './bank-statement-batch-import';
import {
  BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH,
  MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT,
  isConfirmedManualBankTransactionImport,
} from './bank-reconciliation-action-validation';
import { BankReconciliationConfirmationDisclosure } from './bank-reconciliation-confirmation-disclosure';
import { buildBankReconciliationReviewOwnerOptions } from './bank-reconciliation-review-owner-model';
import {
  BANK_RECONCILIATION_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  bankReconciliationDetailHref,
  bankReconciliationHref,
  buildBankReconciliationApiHref,
  buildBankReconciliationSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBankReconciliationSummary,
  financeAccountingReviewLabel,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type BankReconciliationPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type ReviewOwnerFilter = 'all' | 'assigned' | 'mine' | 'unassigned';
type WithdrawalCandidateFilter = 'all' | 'eligible' | 'none' | 'review' | 'strong';

export default async function BankReconciliationPage({ searchParams }: BankReconciliationPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'unmatched');
  const transactionQuery = readParam(params, 'q').trim();
  const withdrawalCandidate = withdrawalCandidateFilter(readParam(params, 'candidate'));
  const reviewOwner = reviewOwnerFilter(readParam(params, 'owner'));
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
  const requestedBankTransactionId = readParam(params, 'bankTransactionId');
  const requestedBatchImportId = readParam(params, 'batchImportId');
  const currentOperatorAccess = await getCurrentAdminOperatorAccess();
  const currentOperatorId = currentOperatorAccess?.id ?? null;
  const [
    summary,
    withdrawalCandidateSummary,
    transactions,
    companyBankAccounts,
    importHistory,
    importBatchSummary,
  ] = await Promise.all([
    adminGet<AdminBankReconciliationSummary>(
      bankReconciliationApiHref(
        buildBankReconciliationSummaryApiHref(filters),
        transactionQuery,
        withdrawalCandidate,
        reviewOwner,
        currentOperatorId,
      ),
      emptyBankReconciliationSummary(),
    ),
    adminGet<AdminBankReconciliationWithdrawalCandidateSummary>(
      buildWithdrawalCandidateSummaryApiHref(filters.range, transactionQuery),
      emptyWithdrawalCandidateSummary(),
    ),
    adminGet<AdminCompanyBankTransaction[]>(
      bankReconciliationApiHref(
        buildBankReconciliationApiHref(filters),
        transactionQuery,
        withdrawalCandidate,
        reviewOwner,
        currentOperatorId,
      ),
      [],
    ),
    adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ACTIVE', []),
    adminGet<AdminCompanyBankTransactionImportBatchHistory>(
      buildImportHistoryApiHref({
        page: importHistoryPage,
        q: importHistoryQuery,
        range: importHistoryRange,
        review: importHistoryReview,
        take: importHistoryTake,
      }),
      { items: [], pagination: { skip: 0, take: importHistoryTake, total: 0 } },
    ),
    adminGet<AdminCompanyBankTransactionImportBatchSummary>(
      '/admin/bank-reconciliation/import-batches/summary',
      {
        batchCount: 0,
        escalatedNeedsReconciliationCount: 0,
        needsReconciliationCount: 0,
        noTransactionCount: 0,
        oldestOpenImportedAt: null,
        reconciledCount: 0,
        staleNeedsReconciliationCount: 0,
      },
    ),
  ]);
  const adminUsers = await adminGet<AdminUser[]>(
    '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
    [],
  );
  const financeApproverOptions = buildFinanceApproverOptions(adminUsers, currentOperatorId);
  const pagination = buildTaxSettlementServerPagination(transactions, filters, summary.count);
  const currentOperatorReviewCount = currentOperatorId
    ? (withdrawalCandidateSummary.assignments.find(
        (assignment) => assignment.assigneeAdminId === currentOperatorId,
      )?.count ?? 0)
    : 0;
  const rangeScope = dateRangeLabel(filters.range);
  const queueHref = (
    nextFilters = filters,
    nextQuery = transactionQuery,
    nextCandidate = withdrawalCandidate,
    nextOwner = reviewOwner,
  ) => bankReconciliationQueueHref(
    nextFilters,
    nextQuery,
    nextCandidate,
    nextOwner,
  );
  const currentQueueHref = queueHref();
  const currentImportHistoryHref = importHistoryHref(params, importHistoryPage);
  const requestedBankTransaction = requestedReviewOwnerConfirmation
    ? transactions.find((transaction) => transaction.id === requestedBankTransactionId) ?? null
    : null;
  const requestedCurrentAssignment =
    requestedBankTransaction ? bankTransactionReviewAssignment(requestedBankTransaction) : null;
  const requestedReviewOwnerOptions = buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    requestedCurrentAssignment?.assigneeAdminId ?? null,
    currentOperatorId,
  );
  const showReviewOwnerConfirmation =
    requestedReviewOwnerConfirmation &&
    Boolean(
      requestedBankTransaction &&
        ['UNMATCHED', 'PARTIALLY_MATCHED'].includes(requestedBankTransaction.status),
    ) &&
    requestedReviewOwnerOptions.length > 0;
  const requestedImportBatch = requestedBatchOwnerConfirmation
    ? importHistory.items.find((batch) => batch.batchImportId === requestedBatchImportId) ?? null
    : null;
  const requestedBatchOwnerOptions = buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    requestedImportBatch?.assigneeAdminId ?? null,
    currentOperatorId,
  );
  const showBatchOwnerConfirmation =
    requestedBatchOwnerConfirmation &&
    Boolean(requestedImportBatch?.reconciliationNeedsActionCount) &&
    requestedBatchOwnerOptions.length > 0;
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
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters: filters,
            current: 'bank-reconciliation',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Company bank transaction lookup for manual reconciliation against payments, withdrawals, payout batches, and accounting evidence."
      title="Bank Reconciliation"
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
              defaultValue: requestedReviewOwnerOptions[0]?.value,
              label: 'Review owner',
              name: 'assigneeAdminId',
              options: requestedReviewOwnerOptions,
              required: true,
            },
          ]}
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
          This review assignment is no longer available on the current page, or no eligible Finance operator can receive it.
        </AdminInlineNotice>
      ) : null}

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
              defaultValue: requestedBatchOwnerOptions[0]?.value,
              label: 'Reconciliation owner',
              name: 'assigneeAdminId',
              options: requestedBatchOwnerOptions,
              required: true,
            },
          ]}
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
          This import batch assignment is no longer available on the current page, has no open review work, or no eligible Finance operator can receive it.
        </AdminInlineNotice>
      ) : null}

      <FinanceListCommandBoard ariaLabel="Bank command board">
        <FinanceListCommandCard
          detail={`${summary.unmatchedCount} bank transaction(s) still need linked evidence matching.`}
          href={queueHref(
            { ...filters, page: 1, review: 'unmatched' },
            transactionQuery,
            withdrawalCandidate,
          )}
          icon={AlertTriangle}
          label="Unmatched ratio"
          scope={rangeScope}
          tone={summary.unmatchedCount > 0 ? 'danger' : 'success'}
          value={formatFinancePercent(summary.unmatchedCount, summary.count)}
        />
        <FinanceListCommandCard
          detail={
            <>
              {withdrawalCandidateSummary.strongCount} transaction(s),{' '}
              <MoneyText
                amount={withdrawalCandidateSummary.strongAmount}
                currency={withdrawalCandidateSummary.currency}
              />{' '}
              total bank amount.
              {withdrawalCandidateSummary.strongOver24hCount > 0 ? (
                <> {withdrawalCandidateSummary.strongOver24hCount} over 24 hours.</>
              ) : null}
              {withdrawalCandidateSummary.strongOver48hCount > 0 ? (
                <> {withdrawalCandidateSummary.strongOver48hCount} over 48 hours.</>
              ) : null}
              {withdrawalCandidateSummary.oldestStrongOccurredAt ? (
                <> Oldest candidate: <DateTimeText value={withdrawalCandidateSummary.oldestStrongOccurredAt} />.</>
              ) : null}
            </>
          }
          href={queueHref(
            { ...filters, page: 1, review: 'outflow' },
            transactionQuery,
            'strong',
            'all',
          )}
          icon={CheckCircle2}
          label="Strong withdrawal candidates"
          scope={withdrawalCandidateSlaScope(
            withdrawalCandidateSummary.strongOver24hCount,
            withdrawalCandidateSummary.strongOver48hCount,
            rangeScope,
          )}
          tone={withdrawalCandidateSummary.strongCount > 0 ? 'danger' : 'success'}
          value={withdrawalCandidateSummary.strongCount}
        />
        <FinanceListCommandCard
          detail={
            <>
              {withdrawalCandidateSummary.reviewCount} transaction(s),{' '}
              <MoneyText
                amount={withdrawalCandidateSummary.reviewAmount}
                currency={withdrawalCandidateSummary.currency}
              />{' '}
              total bank amount.
              {withdrawalCandidateSummary.reviewOver24hCount > 0 ? (
                <> {withdrawalCandidateSummary.reviewOver24hCount} over 24 hours.</>
              ) : null}
              {withdrawalCandidateSummary.reviewOver48hCount > 0 ? (
                <> {withdrawalCandidateSummary.reviewOver48hCount} over 48 hours.</>
              ) : null}
              {withdrawalCandidateSummary.oldestReviewOccurredAt ? (
                <> Oldest candidate: <DateTimeText value={withdrawalCandidateSummary.oldestReviewOccurredAt} />.</>
              ) : null}
            </>
          }
          href={queueHref(
            { ...filters, page: 1, review: 'outflow' },
            transactionQuery,
            'review',
            'all',
          )}
          icon={Landmark}
          label="Withdrawal candidates to review"
          scope={withdrawalCandidateSlaScope(
            withdrawalCandidateSummary.reviewOver24hCount,
            withdrawalCandidateSummary.reviewOver48hCount,
            rangeScope,
          )}
          tone={withdrawalCandidateSummary.reviewCount > 0 ? 'warning' : 'success'}
          value={withdrawalCandidateSummary.reviewCount}
        />
        <FinanceListCommandCard
          detail="Candidate transactions that do not have a review owner yet."
          href={queueHref(
            { ...filters, page: 1, review: 'outflow' },
            transactionQuery,
            'eligible',
            'unassigned',
          )}
          icon={UserRoundX}
          label="Unassigned candidate reviews"
          scope="Needs action"
          tone={withdrawalCandidateSummary.unassignedCount > 0 ? 'danger' : 'success'}
          value={withdrawalCandidateSummary.unassignedCount}
        />
        <FinanceListCommandCard
          detail={currentOperatorId
            ? 'Candidate transactions currently assigned to your operator account.'
            : 'No stored operator identity is available for this session.'}
          href={queueHref(
            { ...filters, page: 1, review: 'outflow' },
            transactionQuery,
            'eligible',
            'mine',
          )}
          icon={UserCheck}
          label="My assigned reviews"
          scope="Open queue"
          tone={currentOperatorReviewCount > 0 ? 'warning' : 'success'}
          value={currentOperatorReviewCount}
        />
        <FinanceListCommandCard
          detail={
            importBatchSummary.needsReconciliationCount > 0 ? (
              <>
                {importBatchSummary.needsReconciliationCount} statement import batch(es) contain open bank transactions.
                {importBatchSummary.staleNeedsReconciliationCount > 0 ? (
                  <> {importBatchSummary.staleNeedsReconciliationCount} over 24 hours.</>
                ) : null}
                {importBatchSummary.escalatedNeedsReconciliationCount > 0 ? (
                  <> {importBatchSummary.escalatedNeedsReconciliationCount} over 48 hours.</>
                ) : null}
                {importBatchSummary.oldestOpenImportedAt ? (
                  <> Oldest open import: <DateTimeText value={importBatchSummary.oldestOpenImportedAt} />.</>
                ) : null}
              </>
            ) : (
              'No statement import batches need reconciliation.'
            )
          }
          href={importHistoryReconciliationWorkHref(
            params,
            importBatchSummary.escalatedNeedsReconciliationCount > 0
              ? 'escalated'
              : importBatchSummary.staleNeedsReconciliationCount > 0
                ? 'stale'
                : 'needs-reconciliation',
          )}
          icon={FileWarning}
          label="Import batches"
          scope={
            importBatchSummary.escalatedNeedsReconciliationCount > 0
              ? 'Over 48h'
              : importBatchSummary.staleNeedsReconciliationCount > 0
                ? 'Over 24h'
              : importBatchSummary.needsReconciliationCount > 0
                ? 'Needs action'
                : 'All dates'
          }
          tone={
            importBatchSummary.escalatedNeedsReconciliationCount > 0
              ? 'danger'
              : importBatchSummary.staleNeedsReconciliationCount > 0
                ? 'warning'
              : importBatchSummary.needsReconciliationCount > 0
                ? 'warning'
                : 'success'
          }
          value={importBatchSummary.needsReconciliationCount}
        />
      </FinanceListCommandBoard>

      <AdminSection
        className="admin-mb-16"
        description={`${withdrawalCandidateSummary.assignedCount} assigned and ${withdrawalCandidateSummary.unassignedCount} unassigned open candidate review(s) in ${rangeScope.toLowerCase()}.`}
        title="Review ownership"
      >
        <FinanceDataTable
          emptyMessage="No candidate reviews are assigned in the selected range."
          headers={['Review owner', 'Open reviews', '24h+', '48h+']}
          rowCount={withdrawalCandidateSummary.assignments.length}
        >
          {withdrawalCandidateSummary.assignments.map((assignment) => (
            <tr key={assignment.assigneeAdminId}>
              <td>
                <strong>{adminFinanceReviewAssigneeLabel(assignment.assignee, assignment.assigneeAdminId)}</strong>
                {assignment.assigneeAdminId === currentOperatorId ? <div className="muted">Current operator</div> : null}
              </td>
              <td>{assignment.count}</td>
              <td>{assignment.over24hCount}</td>
              <td>{assignment.over48hCount}</td>
            </tr>
          ))}
        </FinanceDataTable>
      </AdminSection>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, BANK_RECONCILIATION_REVIEW_LINKS)}. Withdrawal candidates: ${withdrawalCandidateFilterLabel(withdrawalCandidate)}. Review owner: ${reviewOwnerFilterLabel(reviewOwner)}.${transactionQuery ? ` Search: ${transactionQuery}.` : ''}`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Bank reconciliation filters"
      >
        <AdminFormShell action="/finance-tax/bank-reconciliation" className="filter-form admin-mb-12" method="get">
          <input name="range" type="hidden" value={filters.range} />
          <input name="review" type="hidden" value={filters.review} />
          <input name="take" type="hidden" value={filters.take} />
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
            <AdminFormControlButton className="button-primary" type="submit">Search</AdminFormControlButton>
            {transactionQuery ? (
              <AdminTextLink
                href={queueHref(
                  { ...filters, page: 1 },
                  '',
                  withdrawalCandidate,
                )}
              >
                Clear
              </AdminTextLink>
            ) : null}
          </AdminFormActionRow>
        </AdminFormShell>
        <FinanceListFilterLinks
          groups={[
            {
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: queueHref(
                  { ...filters, page: 1, range },
                  transactionQuery,
                  withdrawalCandidate,
                ),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: BANK_RECONCILIATION_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: queueHref(
                  { ...filters, page: 1, review: item.review },
                  transactionQuery,
                  withdrawalCandidateForReview(item.review, withdrawalCandidate),
                  reviewOwnerForReview(item.review, reviewOwner),
                ),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'withdrawal-candidate',
              links: (['all', 'eligible', 'strong', 'review', 'none'] as const).map((candidate) => ({
                active: withdrawalCandidate === candidate,
                activePillClassName:
                  candidate === 'strong'
                    ? 'pill-success'
                    : candidate === 'review'
                      ? 'pill-warn'
                      : 'pill-info',
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
            {
              id: 'review-owner',
              links: (['all', 'mine', 'unassigned', 'assigned'] as const).map((owner) => ({
                active: reviewOwner === owner,
                activePillClassName:
                  owner === 'unassigned'
                    ? 'pill-warn'
                    : owner === 'mine'
                      ? 'pill-warn'
                      : 'pill-info',
                href: queueHref(
                  { ...filters, page: 1, review: 'outflow' },
                  transactionQuery,
                  withdrawalCandidate === 'all' ? 'eligible' : withdrawalCandidate,
                  owner,
                ),
                id: owner,
                label: reviewOwnerFilterLabel(owner),
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: queueHref(
                  { ...filters, page: 1, take },
                  transactionQuery,
                  withdrawalCandidate,
                ),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <AdminSection
        className="admin-mb-16"
        description="Review a CSV statement before any row is saved. Exact duplicates and invalid rows stay blocked; potential duplicates require explicit row selection."
        title="CSV bank statement review"
      >
        <AdminDisclosure className="finance-reconciliation-import-disclosure">
          <summary>
            <span>Upload and review statement</span>
            <small>Two steps: classify up to 50 rows, then import only reviewed rows with separate approval.</small>
          </summary>
          <div className="admin-mt-16">
            <BankStatementBatchImport
              companyBankAccounts={companyBankAccounts}
              financeApproverOptions={financeApproverOptions}
            />
          </div>
        </AdminDisclosure>
      </AdminSection>

      <AdminFilterPanel
        className="admin-mb-16"
        description={assignmentNotice === 'assigned'
          ? 'Owner assigned and an in-app operations notification was created.'
          : assignmentNotice === 'failed'
            ? 'Owner assignment failed. Confirm the operator has Bank Reconciliation access and try again.'
            : 'Search by batch ID, source filename, or importing operator. Date range and reconciliation queue are applied on the server.'}
        resultLabel={`${importHistory.pagination.total} batch(es)`}
        resultTone="info"
        title="Statement import history filters"
      >
        <AdminFormShell action="/finance-tax/bank-reconciliation" className="filter-form" method="get">
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
            <AdminFormControlButton className="button-primary" type="submit">Apply filters</AdminFormControlButton>
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
          headers={['Batch', 'Source file', 'Mapping', 'Import result', 'Reconciliation', 'Import owner', 'Approver', 'Imported at']}
          rowCount={importHistory.items.length}
        >
          {importHistory.items.map((batch) => (
            <tr key={batch.batchImportId}>
              <td>
                <AdminTextLink href={`/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(batch.batchImportId)}`}>
                  <strong>{shortId(batch.batchImportId)}</strong>
                </AdminTextLink>
                <div className="muted" title={batch.batchImportId}>{batch.batchImportId}</div>
              </td>
              <td>
                <strong>{batch.sourceFileName ?? 'Legacy import record'}</strong>
                <div className="muted">
                  {batch.sourceFileSha256 ? `SHA-256 ${batch.sourceFileSha256.slice(0, 12)}...` : 'No retained file hash'}
                </div>
              </td>
              <td>{batch.mappingPreset ?? 'Legacy'}</td>
              <td>
                <StatusBadgeFromPillClass pillClass={batch.skippedCount > 0 ? 'pill-warn' : 'pill-success'}>
                  {batch.importedCount} imported
                </StatusBadgeFromPillClass>
                <div className="muted">{batch.skippedCount} skipped / {batch.requestedCount} reviewed</div>
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
                <div className="muted">Imported by {adminIdentityLabel(batch.operator, 'Unknown operator')}</div>
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
              <td>{adminIdentityLabel(batch.approver, batch.approvalAdminId ?? 'Unknown approver')}</td>
              <td><DateTimeText value={batch.createdAt} /></td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Bank statement import history pages"
          hrefForPage={(page) => importHistoryHref(params, page)}
          pagination={importHistoryPagination(importHistory, importHistoryPage)}
        />
      </FinanceTablePanel>

      <AdminSection
        className="admin-mb-16"
        description="Create one bank statement row from manual evidence. Imported rows start unmatched and can be reconciled from the transaction detail page."
        statusLabel={importNotice === '1' ? 'Bank transaction imported' : importError ? 'Import failed' : undefined}
        statusTone={importNotice === '1' ? 'success' : importError ? 'danger' : 'info'}
        title="Manual bank transaction import"
      >
        <AdminDisclosure className="finance-reconciliation-import-disclosure" open={shouldOpenImportDisclosure}>
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
                  : 'Bank transaction import failed. Check approval admin, bank account, type, amount, and occurred date before trying again.'}
              </p>
              {duplicateCandidateIds.length > 0 ? (
                <div className="admin-inline-link-list admin-mt-8" aria-label="Potential duplicate bank transactions">
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
            <input
              name="redirectTo"
              type="hidden"
              value={queueHref(
                { ...filters, page: 1, review: 'unmatched' },
                transactionQuery,
                withdrawalCandidate,
              )}
            />
            <AdminFormSelect
              disabled={financeApproverOptions.length === 0}
              label="Separate Finance approver"
              labelVisibility="visible"
              name="approvalAdminId"
              options={[{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]}
              required
            />
            <AdminFormSelect
              defaultValue={bankAccountOptions[0]?.value ?? ''}
              disabled={!companyBankAccounts.length || financeApproverOptions.length === 0}
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
            <AdminFormInput label="Amount" labelVisibility="visible" min={1} name="amount" required step={1} type="number" />
            <AdminFormDateTime label="Occurred at" labelVisibility="visible" name="occurredAt" required />
            <AdminFormDate label="Value date" labelVisibility="visible" name="valueDate" />
            <AdminFormInput label="Transfer reference" labelVisibility="visible" name="transferRef" />
            <AdminFormInput label="Counterparty" labelVisibility="visible" name="counterpartyName" />
            <AdminFormTextarea className="admin-grid-span-2" label="Description" labelVisibility="visible" name="description" rows={2} />
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
              auditDetail="Submitting creates one unmatched company bank transaction and records the operator, independent approver, duplicate decision, and import evidence."
              className="admin-grid-span-2"
              confirmLabel="Confirm bank transaction import"
              detail="Verify the original statement, bank account, direction, amount, occurrence time, and duplicate review before creating this unmatched row."
              disabled={!companyBankAccounts.length}
              title="Review manual bank transaction"
              tone="danger"
            />
            {financeApproverOptions.length === 0 ? (
              <AdminInlineNotice className="admin-grid-span-2" role="alert" tone="warning">
                No other Finance approver is available. Assign the FINANCE_APPROVER role before importing a bank transaction.
              </AdminInlineNotice>
            ) : null}
          </AdminFormGrid>
        </AdminDisclosure>
      </AdminSection>

      <FinanceTablePanel
        grouped
        description={
          reviewAssignmentNotice === 'assigned'
            ? 'Review owner assigned. The bank transaction remains open until explicit matching or approved ignore is completed.'
            : reviewAssignmentNotice === 'failed'
              ? 'Review assignment failed. Confirm the operator has Bank Reconciliation access and is not already assigned.'
              : withdrawalCandidate === 'all'
            ? 'The list keeps match details collapsed. Use transfer reference, bank account, and source key to open the related evidence only when needed.'
            : 'Oldest candidate transactions appear first. Use the waiting badge and retained transfer evidence to clear overdue rows before newer records.'
        }
        resultLabel={`${pagination.totalRows} transaction(s)`}
        resultTone="info"
        title="Company bank transactions"
      >
        <FinanceDataTable
          emptyMessage="No bank transactions match the current filters."
          headers={['Transaction', 'Bank account', 'Counterparty', 'Amount', 'Value date', 'Match', 'Review owner', 'Status', 'Evidence']}
          rowCount={pagination.rows.length}
        >
          {pagination.rows.map((transaction) => (
            <tr key={transaction.id}>
              <td>
                <AdminTextLink href={bankReconciliationDetailHref(transaction.id)}>
                  <strong>{transaction.transferRef ?? shortId(transaction.sourceKey)}</strong>
                </AdminTextLink>
                <div className="muted">{transaction.type}</div>
                <div className="muted">{shortId(transaction.id)}</div>
              </td>
              <td>
                <strong>{transaction.bankAccount?.name ?? 'Unknown account'}</strong>
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
              </td>
              <td>
                {transaction.counterpartyName ? (
                  <strong>{transaction.counterpartyName}</strong>
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
                <div className="muted">{transaction.type === 'INFLOW' ? 'Bank inflow' : 'Bank outflow'}</div>
              </td>
              <td>
                <strong>
                  <DateTimeText value={transaction.occurredAt} />
                </strong>
                {transaction.valueDate ? (
                  <div className="muted">
                    Value <DateTimeText value={transaction.valueDate} />
                  </div>
                ) : null}
              </td>
              <td>
                <strong>{transaction._count?.reconciliationMatches ?? 0} match</strong>
                <div className="muted">{shortId(transaction.sourceKey)}</div>
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
                    <div className="admin-mt-6">
                      <StatusBadgeFromPillClass
                        pillClass={withdrawalCandidateSlaPill(
                          transaction.withdrawalCandidateSummary.slaStatus,
                        )}
                      >
                        {withdrawalCandidateSlaLabel(
                          transaction.withdrawalCandidateSummary.slaStatus,
                          transaction.withdrawalCandidateSummary.waitingHours,
                        )}
                      </StatusBadgeFromPillClass>
                    </div>
                  </div>
                ) : null}
              </td>
              <td>
                {bankTransactionReviewAssignment(transaction) ? (
                  <>
                    <strong>
                      {adminFinanceReviewAssigneeLabel(
                        bankTransactionReviewAssignment(transaction)?.assignee,
                        bankTransactionReviewAssignment(transaction)?.assigneeAdminId ?? 'Unknown operator',
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
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={financeBankReconciliationStatusPill(transaction.status)}>
                  {transaction.status}
                </StatusBadgeFromPillClass>
              </td>
              <td>
                <ActionMenu
                  actions={[{ href: bankReconciliationDetailHref(transaction.id), kind: 'link', label: 'Open detail', tone: 'info' }]}
                  label={`Bank reconciliation evidence actions for ${transaction.id}`}
                />
                <div className="muted">{transaction._count?.reconciliationMatches ?? 0} match</div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Bank reconciliation pages"
          hrefForPage={(page) =>
            queueHref(
              { ...filters, page },
              transactionQuery,
              withdrawalCandidate,
            )
          }
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

async function createCompanyBankTransactionAction(formData: FormData) {
  'use server';

  const redirectTo = safeBankReconciliationReturnTo(formData.get('redirectTo'));
  const occurredAt = formDateTimeToIso(formData.get('occurredAt'));
  const valueDate = String(formData.get('valueDate') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const approvalAdminId = String(formData.get('approvalAdminId') ?? '').trim();
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim();
  const type = String(formData.get('type') ?? 'INFLOW').trim();
  const confirmationIntent = String(formData.get('confirmationIntent') ?? '').trim();
  const operatorReason = String(formData.get('operatorReason') ?? '').trim();

  if (
    !isConfirmedManualBankTransactionImport({ confirmationIntent, evidence: operatorReason }) ||
    !approvalAdminId ||
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
      approvalAdminId,
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

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/review-assignment`,
      { assigneeAdminId, reason },
    );
  } catch {
    redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'failed'));
  }
  redirect(appendQueryParam(redirectTo, 'reviewAssignmentNotice', 'assigned'));
}

function formDateTimeToIso(value: FormDataEntryValue | null) {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function companyBankAccountOptionLabel(account: AdminCompanyBankAccount) {
  const masked = account.accountNumberMasked ?? (account.accountNumberLast4 ? `****${account.accountNumberLast4}` : '');
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

function withdrawalCandidateSlaLabel(
  status: 'CURRENT' | 'OVER_24H' | 'OVER_48H',
  waitingHours: number,
) {
  if (status === 'OVER_48H') return `${waitingHours}h waiting · 48h+`;
  if (status === 'OVER_24H') return `${waitingHours}h waiting · 24h+`;
  return `${waitingHours}h waiting · Current`;
}

function withdrawalCandidateSlaPill(status: 'CURRENT' | 'OVER_24H' | 'OVER_48H') {
  if (status === 'OVER_48H') return 'pill-danger';
  if (status === 'OVER_24H') return 'pill-warn';
  return 'pill-info';
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

function buildWithdrawalCandidateSummaryApiHref(range: string, query: string) {
  const search = new URLSearchParams({ range });
  if (query) search.set('q', query);
  return `/admin/bank-reconciliation/withdrawal-candidate-summary?${search.toString()}`;
}

function emptyWithdrawalCandidateSummary(): AdminBankReconciliationWithdrawalCandidateSummary {
  return {
    assignedCount: 0,
    assignments: [],
    currency: 'VND',
    eligibleCount: 0,
    noneAmount: 0,
    noneCount: 0,
    oldestReviewOccurredAt: null,
    oldestStrongOccurredAt: null,
    reviewAmount: 0,
    reviewCount: 0,
    reviewOver24hCount: 0,
    reviewOver48hCount: 0,
    strongAmount: 0,
    strongCount: 0,
    strongOver24hCount: 0,
    strongOver48hCount: 0,
    unassignedCount: 0,
  };
}

function bankReconciliationQueueHref(
  filters: Parameters<typeof bankReconciliationHref>[0],
  query: string,
  candidate: WithdrawalCandidateFilter,
  owner: ReviewOwnerFilter = 'all',
) {
  let href = query ? appendQueryParam(bankReconciliationHref(filters), 'q', query) : bankReconciliationHref(filters);
  if (candidate !== 'all') {
    href = appendQueryParam(href, 'candidate', candidate);
  }
  if (owner !== 'all') {
    href = appendQueryParam(href, 'owner', owner);
  }
  return href;
}

function withdrawalCandidateFilter(value: string): WithdrawalCandidateFilter {
  return value === 'eligible' || value === 'strong' || value === 'review' || value === 'none'
    ? value
    : 'all';
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

function withdrawalCandidateSlaScope(over24hCount: number, over48hCount: number, fallback: string) {
  if (over48hCount > 0) return 'Over 48h';
  if (over24hCount > 0) return 'Over 24h';
  return fallback;
}

function withdrawalCandidateForReview(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  candidate: WithdrawalCandidateFilter,
) {
  return review === 'matched' || review === 'inflow' ? 'all' : candidate;
}

function reviewOwnerForReview(
  review: (typeof BANK_RECONCILIATION_REVIEW_LINKS)[number]['review'],
  owner: ReviewOwnerFilter,
) {
  return review === 'matched' || review === 'inflow' ? 'all' : owner;
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
  const search = new URLSearchParams();
  for (const key of [
    'range',
    'review',
    'take',
    'candidate',
    'owner',
    'q',
    'importQ',
    'importRange',
    'importReview',
  ]) {
    const value = readParam(params, key);
    if (value) search.set(key, value);
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
  return ['range', 'review', 'take', 'candidate', 'owner', 'q'].map((key) => {
    const value = readParam(params, key);
    return value ? <input key={key} name={key} type="hidden" value={value} /> : null;
  });
}

function bankTransactionReviewAssignment(transaction: AdminCompanyBankTransaction) {
  return transaction.reviewAssignment ?? transaction.withdrawalCandidateSummary?.reviewAssignment ?? null;
}

function clearImportHistoryHref(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const key of ['range', 'review', 'take', 'candidate', 'owner', 'q']) {
    const value = readParam(params, key);
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return `/finance-tax/bank-reconciliation${query ? `?${query}` : ''}`;
}

function importHistoryReconciliationWorkHref(
  params: Record<string, string | string[] | undefined>,
  review: 'needs-reconciliation' | 'stale' | 'escalated',
) {
  const search = new URLSearchParams();
  for (const key of ['range', 'review', 'take', 'candidate', 'owner', 'q']) {
    const value = readParam(params, key);
    if (value) search.set(key, value);
  }
  search.set('importRange', 'all');
  search.set('importReview', review);
  return `/finance-tax/bank-reconciliation?${search.toString()}`;
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
