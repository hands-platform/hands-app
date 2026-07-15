import { notFound, redirect } from 'next/navigation';
import { Download } from 'lucide-react';

import type { AdminCompanyBankTransactionImportBatchDetail, AdminUser } from '../../../../../lib/admin-api';
import { adminGet, adminPostOrThrow } from '../../../../../lib/admin-api';
import { AdminFilterPanel } from '../../../../../components/admin-filter-panel';
import {
  AdminFormActionRow,
  AdminFormControlLink,
} from '../../../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../../../components/admin-page-template';
import { AdminBasicTimeline } from '../../../../../components/admin-surface';
import { ConfirmDialog } from '../../../../../components/confirm-dialog';
import { DateTimeText } from '../../../../../components/date-time-text';
import { MoneyText } from '../../../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../../../components/status-badge';
import { shortId } from '../../../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../../../lib/admin-operator-access';
import { FinanceDataTable } from '../../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../../finance-detail-info-item';
import { FinanceListFilterLinks } from '../../../finance-list-filter-links';
import { FinanceTablePanel } from '../../../finance-table-panel';
import { buildBankReconciliationAssignmentTimeline } from '../../bank-reconciliation-assignment-timeline-model';
import { buildBankReconciliationReviewOwnerOptions } from '../../bank-reconciliation-review-owner-model';

type BankStatementImportBatchDetailPageProps = {
  readonly params?: Promise<{ readonly batchImportId?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type BatchRow = AdminCompanyBankTransactionImportBatchDetail['rows'][number];
type BatchRowFilter = 'all' | 'needs-reconciliation' | 'reconciled' | 'skipped';

export default async function BankStatementImportBatchDetailPage({
  params,
  searchParams,
}: BankStatementImportBatchDetailPageProps) {
  const batchImportId = (await params)?.batchImportId;
  if (!batchImportId) notFound();
  const pageParams = searchParams ? await searchParams : {};
  const batch = await adminGet<AdminCompanyBankTransactionImportBatchDetail | null>(
    `/admin/bank-reconciliation/import-batches/${encodeURIComponent(batchImportId)}`,
    null,
  );
  if (!batch) notFound();
  const rowFilter = readBatchRowFilter(pageParams.review);
  const rowSummary = summarizeBatchRows(batch.rows);
  const visibleRows = batch.rows.filter((row) => batchRowMatchesFilter(row, rowFilter));
  const reconciliationProgress = rowSummary.created > 0
    ? `${Math.round((rowSummary.reconciled / rowSummary.created) * 100)}%`
    : 'N/A';
  const batchHref = `/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(batch.batchImportId)}`;
  const assignmentTimeline = buildBankReconciliationAssignmentTimeline(batch.assignmentHistory);
  const currentAssignment = assignmentTimeline[0] ?? null;
  const canAssignReviewOwner = rowSummary.needsReconciliation > 0;
  const requestedReviewOwnerConfirmation =
    readSearchParam(pageParams.confirm) === 'review-owner' && canAssignReviewOwner;
  const [currentOperatorAccess, adminUsers] = await Promise.all([
    requestedReviewOwnerConfirmation ? getCurrentAdminOperatorAccess() : Promise.resolve(null),
    requestedReviewOwnerConfirmation
      ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
      : Promise.resolve([]),
  ]);
  const reviewOwnerOptions = buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    currentAssignment?.assigneeId ?? null,
    currentOperatorAccess?.id ?? null,
  );
  const showReviewOwnerConfirmation =
    requestedReviewOwnerConfirmation && reviewOwnerOptions.length > 0;
  const reviewAssignmentNotice = readSearchParam(pageParams.reviewAssignmentNotice);

  return (
    <AdminPageTemplate
      actions={
        <AdminFormActionRow wide={false}>
          <AdminFormControlLink className="button-secondary" href="/finance-tax/bank-reconciliation">
            Back to bank reconciliation
          </AdminFormControlLink>
          <AdminFormControlLink
            className="button-secondary"
            download
            href={`/api/admin/bank-reconciliation/import-batches/${encodeURIComponent(batch.batchImportId)}/export`}
          >
            <Download aria-hidden="true" size={16} />
            Export audit CSV
          </AdminFormControlLink>
          {canAssignReviewOwner ? (
            <AdminFormControlLink className="button-primary" href={`${batchHref}?confirm=review-owner`}>
              {currentAssignment ? 'Reassign owner' : 'Assign owner'}
            </AdminFormControlLink>
          ) : null}
        </AdminFormActionRow>
      }
      description="Read-only row outcomes and retained provenance for one reviewed bank statement import."
      metrics={[
        { helper: 'Open transaction records that still require matching or review.', kind: rowSummary.needsReconciliation > 0 ? 'risk' : 'record', label: 'Needs reconciliation', scope: 'Current batch', value: rowSummary.needsReconciliation },
        { helper: 'Transaction records already matched, ignored, or reversed.', kind: 'record', label: 'Reconciled', scope: 'Current batch', value: rowSummary.reconciled },
        { helper: 'Share of created bank transactions with a closed reconciliation state.', kind: 'record', label: 'Progress', scope: 'Current batch', value: reconciliationProgress },
        { helper: 'Rows blocked or skipped after review.', kind: batch.skippedCount > 0 ? 'risk' : 'record', label: 'Skipped', scope: 'Batch result', value: batch.skippedCount },
      ]}
      title="Bank Statement Import Batch"
    >
      {reviewAssignmentNotice === 'assigned' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="success">
          Batch review owner updated. The original import SLA and prior ownership evidence remain unchanged.
        </AdminInlineNotice>
      ) : reviewAssignmentNotice === 'failed' ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Batch review owner was not updated. Confirm the operator access and current assignment.
        </AdminInlineNotice>
      ) : null}

      {showReviewOwnerConfirmation ? (
        <ConfirmDialog
          action={assignImportBatchReviewAction}
          cancelHref={batchHref}
          confirmLabel={currentAssignment ? 'Reassign owner' : 'Assign owner'}
          description={
            currentAssignment
              ? 'Transfer this open statement batch to another eligible Finance operator. Import SLA and prior ownership evidence remain unchanged.'
              : 'Assign this open statement batch to an eligible Finance operator without changing any bank transaction status.'
          }
          hiddenInputs={[{ name: 'batchImportId', value: batch.batchImportId }]}
          id={`bank-import-batch-owner-${batch.batchImportId}`}
          selectInputs={[
            {
              defaultValue: reviewOwnerOptions[0]?.value,
              label: 'Review owner',
              name: 'assigneeAdminId',
              options: reviewOwnerOptions,
              required: true,
            },
          ]}
          textInputs={[
            {
              label: 'Assignment reason',
              maxLength: 500,
              minLength: 12,
              name: 'reason',
              placeholder: 'Why should this operator own the statement reconciliation queue?',
              required: true,
            },
          ]}
          title={`${currentAssignment ? 'Reassign' : 'Assign'} statement batch review?`}
          tone="warning"
        />
      ) : requestedReviewOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          No eligible Finance operator is available for this batch. Check Admin Operator category access.
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        description={<><DateTimeText value={batch.createdAt} /> · {batch.sourceFileName ?? 'Legacy import record'}</>}
        resultLabel={shortId(batch.batchImportId)}
        resultTone={batch.skippedCount > 0 ? 'warning' : 'success'}
        title="Batch provenance"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Batch ID" value={batch.batchImportId} />
          <FinanceDetailInfoItem label="Source file" value={batch.sourceFileName ?? 'Not retained'} />
          <FinanceDetailInfoItem label="SHA-256" value={batch.sourceFileSha256 ?? 'Not retained'} />
          <FinanceDetailInfoItem label="Mapping preset" value={batch.mappingPreset ?? 'Legacy'} />
          <FinanceDetailInfoItem label="Operator" value={adminIdentityLabel(batch.operator, 'Unknown operator')} />
          <FinanceDetailInfoItem label="Approver" value={adminIdentityLabel(batch.approver, batch.approvalAdminId ?? 'Unknown approver')} />
          <FinanceDetailInfoItem label="Imported at" value={<DateTimeText value={batch.createdAt} />} />
          <FinanceDetailInfoItem label="Original CSV" value="Not stored" />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Persisted ownership changes for this statement batch. Reassignment never resets the original import reconciliation SLA."
        resultLabel={currentAssignment?.assigneeLabel ?? 'Unassigned'}
        resultTone={currentAssignment ? currentAssignment.tone : 'warning'}
        title="Batch review owner history"
      >
        {assignmentTimeline.length ? (
          <AdminBasicTimeline
            className="finance-bank-assignment-timeline admin-mt-16"
            compactMeta
            items={assignmentTimeline.map((assignment) => ({
              detail: assignment.detail,
              id: assignment.id,
              meta: [
                { label: 'Assigned by', value: assignment.assignedByLabel },
                { label: 'Previous owner', value: assignment.previousAssigneeLabel },
                { label: 'SLA elapsed', value: assignment.elapsedLabel },
              ],
              statusLabel: assignment.statusLabel,
              statusTone: assignment.tone,
              time: <DateTimeText value={assignment.assignedAt} />,
              title: assignment.assigneeLabel,
              tone: assignment.tone,
            }))}
          />
        ) : (
          <AdminInlineFallback>
            No batch review owner has been assigned. Open rows remain in the unassigned reconciliation queue.
          </AdminInlineFallback>
        )}
      </FinanceTablePanel>

      <AdminFilterPanel
        description="Separate open reconciliation work from completed and skipped statement rows."
        resultLabel={`${visibleRows.length} of ${batch.rows.length} row(s)`}
        resultTone={rowSummary.needsReconciliation > 0 ? 'warning' : 'success'}
        title="Reconciliation queue"
      >
        <FinanceListFilterLinks
          groups={[
            {
              id: 'review',
              links: [
                batchRowFilterLink(batchHref, rowFilter, 'all', `All (${batch.rows.length})`),
                batchRowFilterLink(
                  batchHref,
                  rowFilter,
                  'needs-reconciliation',
                  `Needs reconciliation (${rowSummary.needsReconciliation})`,
                  'pill-warn',
                ),
                batchRowFilterLink(
                  batchHref,
                  rowFilter,
                  'reconciled',
                  `Reconciled (${rowSummary.reconciled})`,
                  'pill-success',
                ),
                batchRowFilterLink(
                  batchHref,
                  rowFilter,
                  'skipped',
                  `Skipped (${rowSummary.skipped})`,
                ),
              ],
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        description="Open a transaction that needs reconciliation to review its evidence and record a match."
        resultLabel={`${visibleRows.length} visible row(s)`}
        resultTone={rowFilter === 'needs-reconciliation' ? 'warning' : 'info'}
        title="Row outcomes"
      >
        <FinanceDataTable
          emptyMessage={batchRowEmptyMessage(rowFilter)}
          headers={['CSV row', 'Classification', 'Import result', 'Reconciliation', 'Transaction', 'Amount', 'Occurred at']}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <tr key={`${row.rowNumber}:${row.transactionId ?? row.status}`}>
              <td><strong>{row.rowNumber}</strong></td>
              <td>
                <StatusBadgeFromPillClass pillClass={classificationPill(row.classification)}>
                  {row.classification.replaceAll('_', ' ')}
                </StatusBadgeFromPillClass>
              </td>
              <td>
                {row.transaction ? (
                  <StatusBadgeFromPillClass pillClass={reconciliationStatusPill(row.transaction.status)}>
                    {row.transaction.status.replaceAll('_', ' ')}
                  </StatusBadgeFromPillClass>
                ) : (
                  <AdminInlineFallback>Not created</AdminInlineFallback>
                )}
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={row.status === 'IMPORTED' ? 'pill-success' : 'pill-warn'}>
                  {row.status}
                </StatusBadgeFromPillClass>
              </td>
              <td>
                {row.transaction ? (
                  <AdminFormControlLink
                    className="button-secondary"
                    href={`/finance-tax/bank-reconciliation/${encodeURIComponent(row.transaction.id)}`}
                  >
                    {row.transaction.transferRef ?? shortId(row.transaction.id)}
                  </AdminFormControlLink>
                ) : (
                  <AdminInlineFallback>No transaction created</AdminInlineFallback>
                )}
              </td>
              <td>{row.transaction ? <MoneyText amount={row.transaction.amount} currency={row.transaction.currency} /> : '-'}</td>
              <td>{row.transaction ? <DateTimeText value={row.transaction.occurredAt} /> : '-'}</td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function adminIdentityLabel(
  admin: { id: string; email: string | null; fullName: string | null } | null,
  fallback: string,
) {
  return admin?.fullName ?? admin?.email ?? admin?.id ?? fallback;
}

async function assignImportBatchReviewAction(formData: FormData) {
  'use server';

  const batchImportId = String(formData.get('batchImportId') ?? '').trim();
  const assigneeAdminId = String(formData.get('assigneeAdminId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const batchHref = batchImportId
    ? `/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(batchImportId)}`
    : '/finance-tax/bank-reconciliation';
  if (!batchImportId || !assigneeAdminId || reason.length < 12) {
    redirect(`${batchHref}?reviewAssignmentNotice=failed`);
  }

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/import-batches/${encodeURIComponent(batchImportId)}/assignment`,
      { assigneeAdminId, reason },
    );
  } catch {
    redirect(`${batchHref}?reviewAssignmentNotice=failed`);
  }

  redirect(`${batchHref}?reviewAssignmentNotice=assigned`);
}

function classificationPill(classification: string) {
  if (classification === 'NEW') return 'pill-success';
  if (classification === 'POTENTIAL_DUPLICATE') return 'pill-warn';
  if (classification === 'EXACT_DUPLICATE') return 'pill-danger';
  return 'pill-neutral';
}

function readBatchRowFilter(value: string | string[] | undefined): BatchRowFilter {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'needs-reconciliation' || normalized === 'reconciled' || normalized === 'skipped') {
    return normalized;
  }
  return 'all';
}

function summarizeBatchRows(rows: BatchRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (!row.transaction) {
        summary.skipped += 1;
      } else {
        summary.created += 1;
        if (isReconciliationOpen(row)) summary.needsReconciliation += 1;
        else summary.reconciled += 1;
      }
      return summary;
    },
    { created: 0, needsReconciliation: 0, reconciled: 0, skipped: 0 },
  );
}

function batchRowMatchesFilter(row: BatchRow, filter: BatchRowFilter) {
  if (filter === 'needs-reconciliation') return isReconciliationOpen(row);
  if (filter === 'reconciled') return Boolean(row.transaction) && !isReconciliationOpen(row);
  if (filter === 'skipped') return !row.transaction;
  return true;
}

function isReconciliationOpen(row: BatchRow) {
  return row.transaction?.status === 'UNMATCHED' || row.transaction?.status === 'PARTIALLY_MATCHED';
}

function batchRowFilterLink(
  batchHref: string,
  activeFilter: BatchRowFilter,
  filter: BatchRowFilter,
  label: string,
  activePillClassName: 'pill-info' | 'pill-success' | 'pill-warn' = 'pill-info',
) {
  return {
    active: activeFilter === filter,
    activePillClassName,
    href: filter === 'all' ? batchHref : `${batchHref}?review=${filter}`,
    id: filter,
    label,
  } as const;
}

function reconciliationStatusPill(status: string) {
  if (status === 'MATCHED') return 'pill-success';
  if (status === 'UNMATCHED' || status === 'PARTIALLY_MATCHED') return 'pill-warn';
  if (status === 'REVERSED') return 'pill-danger';
  return 'pill-neutral';
}

function batchRowEmptyMessage(filter: BatchRowFilter) {
  if (filter === 'needs-reconciliation') return 'No bank transactions in this batch need reconciliation.';
  if (filter === 'reconciled') return 'No reconciled bank transactions are retained in this batch.';
  if (filter === 'skipped') return 'No statement rows were skipped in this batch.';
  return 'No row-level outcomes were retained for this legacy batch.';
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
