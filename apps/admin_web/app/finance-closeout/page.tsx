import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
  AdminOperatorAccessDeniedError,
  adminGetResult,
  adminPostOrThrow,
  type AdminBookingSettlementGapDryRun,
  type AdminBookingSettlementGapList,
  type AdminBookingSettlementGapRepairPreview,
  type AdminBookingSettlementGapRepairPreviewBatch,
  type AdminBookingSettlementGapRepairResult,
  type AdminBookingSettlementRepairCheckpoint,
  type AdminBookingSettlementGapSummary,
  type AdminUser,
  type AdminGetResult,
} from '../../lib/admin-api';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminNoticeCard } from '../../components/admin-surface';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTextLink } from '../../components/admin-text-link';
import { formatDateTime, formatRelativeAge } from '../../lib/admin-format';
import {
  buildFinanceCloseoutApiHrefs,
  buildFinanceCloseoutFilters,
  buildFinanceCloseoutOperationsHref,
  buildFinanceCloseoutPageHref,
  buildFinanceCloseoutSettlementBatchReviewHref,
  buildFinanceCloseoutSettlementRepairHref,
  buildFinanceCloseoutSettlementPagination,
  buildFinanceCloseoutSettlementPeriodOptions,
  buildFinanceCloseoutSettlementDryRunHref,
  FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS,
  FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS,
  FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS,
} from '../../lib/finance-closeout';
import { FinanceCloseoutSettlementBacklogSection } from './finance-closeout-settlement-backlog-section';
import { FinanceCloseoutSettlementBatchPreviewSection } from './finance-closeout-settlement-batch-preview-section';
import { FinanceCloseoutSettlementDryRunSection } from './finance-closeout-settlement-dry-run-section';
import { FinanceCloseoutSettlementRepairDrawer } from './finance-closeout-settlement-repair-drawer';

type FinanceCloseoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Settlement Repair',
};

export default async function FinanceCloseoutPage({ searchParams }: FinanceCloseoutPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildFinanceCloseoutFilters(params);
  if (filters.workspace === 'operations') {
    redirect(buildFinanceCloseoutOperationsHref(filters.range));
  }
  const isSettlementQueue = filters.settlementMode === 'queue';
  const isSettlementBatch = filters.settlementMode === 'batch';
  const repairBookingId = readPageParam(params, 'repairBookingId');
  const checkpointBookingId = readPageParam(params, 'checkpointBookingId');
  const repairNotice = readPageParam(params, 'repairNotice');
  const repairAuditLogId = readPageParam(params, 'repairAuditLogId');
  const repairSnapshotId = readPageParam(params, 'repairSnapshotId');
  const repairEarningId = readPageParam(params, 'repairEarningId');
  const repairActorId = readPageParam(params, 'repairActorId');
  const repairApprovalAdminId = readPageParam(params, 'repairApprovalAdminId');
  const repairCompletedAt = readPageParam(params, 'repairCompletedAt');
  const repairRequestedAt = readPageParam(params, 'repairRequestedAt');
  const shouldRunSettlementDryRun = readPageParam(params, 'settlementDryRun') === '1';
  const reviewBookingIds = readPageParamList(params, 'reviewBookingId', 10);
  const apiHrefs = buildFinanceCloseoutApiHrefs(filters);
  const emptySettlementGaps: AdminBookingSettlementGapList = {
    generatedAt: '',
    hasNext: false,
    items: [],
    skip: (filters.settlementPage - 1) * filters.settlementPageSize,
    take: filters.settlementPageSize,
    total: 0,
  };
  const [
    settlementGapsResult,
    settlementGapSummaryResult,
    settlementDryRunResult,
    repairPreviewResult,
    financeApproversResult,
    selectedRepairPreviewsResult,
    repairCheckpointResult,
  ] = await Promise.all([
    isSettlementQueue
      ? adminGetResult<AdminBookingSettlementGapList>(
          apiHrefs.bookingSettlementGapsHref,
          emptySettlementGaps,
        )
      : Promise.resolve(successfulAdminResult(emptySettlementGaps)),
    adminGetResult<AdminBookingSettlementGapSummary | null>(
      apiHrefs.bookingSettlementGapSummaryHref,
      null,
    ),
    isSettlementBatch && shouldRunSettlementDryRun
      ? adminGetResult<AdminBookingSettlementGapDryRun | null>(
          apiHrefs.bookingSettlementGapDryRunHref,
          null,
        )
      : Promise.resolve(successfulAdminResult<AdminBookingSettlementGapDryRun | null>(null)),
    isSettlementQueue && repairBookingId
      ? adminGetResult<AdminBookingSettlementGapRepairPreview | null>(
          `/admin/booking-settlement-gaps/${encodeURIComponent(repairBookingId)}/preview`,
          null,
        )
      : Promise.resolve(successfulAdminResult<AdminBookingSettlementGapRepairPreview | null>(null)),
    isSettlementQueue && repairBookingId
      ? adminGetResult<AdminUser[]>(
          '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
          [],
          {
            freshness: 'stable',
            revalidateSeconds: 300,
            tags: ['finance-approver-directory'],
          },
        )
      : Promise.resolve(successfulAdminResult<AdminUser[]>([])),
    isSettlementBatch && reviewBookingIds.length
      ? adminGetResult<AdminBookingSettlementGapRepairPreviewBatch>(
          `/admin/booking-settlement-gaps/preview-batch?bookingIds=${encodeURIComponent(reviewBookingIds.join(','))}`,
          { generatedAt: '', items: [], requested: reviewBookingIds.length },
        )
      : Promise.resolve(
          successfulAdminResult<AdminBookingSettlementGapRepairPreviewBatch>({
            generatedAt: '',
            items: [],
            requested: 0,
          }),
        ),
    isSettlementQueue && checkpointBookingId
      ? adminGetResult<AdminBookingSettlementRepairCheckpoint | null>(
          `/admin/booking-settlement-gaps/${encodeURIComponent(checkpointBookingId)}/checkpoint`,
          null,
        )
      : Promise.resolve(successfulAdminResult<AdminBookingSettlementRepairCheckpoint | null>(null)),
  ]);

  const settlementGaps = settlementGapsResult.data;
  const settlementGapSummary = settlementGapSummaryResult.data;
  const settlementDryRun = settlementDryRunResult.data;
  const repairPreview = repairPreviewResult.data;
  const financeApprovers = financeApproversResult.data;
  const selectedRepairPreviews = selectedRepairPreviewsResult.data.items;
  const repairCheckpoint = repairCheckpointResult.data;
  const requiredSources = [
    ...(isSettlementQueue
      ? [
          {
            available: settlementGapsResult.ok && settlementGapsResult.data != null,
            label: 'Settlement backlog',
            result: settlementGapsResult as AdminGetResult<unknown>,
          },
        ]
      : []),
    {
      available: settlementGapSummaryResult.ok && settlementGapSummaryResult.data != null,
      label: 'Settlement summary',
      result: settlementGapSummaryResult as AdminGetResult<unknown>,
    },
    ...(isSettlementBatch && shouldRunSettlementDryRun
      ? [
          {
            available: settlementDryRunResult.ok && settlementDryRunResult.data != null,
            label: 'Historical dry-run',
            result: settlementDryRunResult as AdminGetResult<unknown>,
          },
        ]
      : []),
    ...(isSettlementBatch && reviewBookingIds.length
      ? [
          {
            available: selectedRepairPreviewsResult.ok && selectedRepairPreviewsResult.data != null,
            label: 'Selected previews',
            result: selectedRepairPreviewsResult as AdminGetResult<unknown>,
          },
        ]
      : []),
    ...(isSettlementQueue && repairBookingId
      ? [
          {
            available: repairPreviewResult.ok && repairPreviewResult.data != null,
            label: 'Repair preview',
            result: repairPreviewResult as AdminGetResult<unknown>,
          },
          {
            available: financeApproversResult.ok,
            label: 'Finance approvers',
            result: financeApproversResult as AdminGetResult<unknown>,
          },
        ]
      : []),
    ...(isSettlementQueue && checkpointBookingId
      ? [
          {
            available: repairCheckpointResult.ok && repairCheckpointResult.data != null,
            label: 'Repair checkpoint',
            result: repairCheckpointResult as AdminGetResult<unknown>,
          },
        ]
      : []),
  ];
  const settlementSourcesAvailable = requiredSources.every((source) => source.available);
  const lastRefreshedAt =
    repairPreview?.generatedAt ||
    settlementDryRun?.generatedAt ||
    selectedRepairPreviewsResult.data.generatedAt ||
    settlementGapSummary?.generatedAt ||
    settlementGaps.generatedAt;

  const settlementPagination = buildFinanceCloseoutSettlementPagination(settlementGaps);
  const selectedSettlementPreviews = selectedRepairPreviews;
  const settlementPeriodOptions = buildFinanceCloseoutSettlementPeriodOptions();
  const settlementPaymentMethodLabel =
    FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS.find(
      (option) => option.value === filters.settlementPaymentMethod,
    )?.label ?? 'All payment methods';
  const queueSummaryLabels = [
    `Gap age: ${filters.settlementAgeLabel}`,
    `Repair track: ${filters.settlementTrackLabel}`,
    ...(filters.settlementPeriod === 'all' ? [] : [`Month: ${filters.settlementPeriod}`]),
    ...(filters.settlementPaymentMethod === 'all'
      ? []
      : [`Payment: ${settlementPaymentMethodLabel}`]),
    `Matching bookings: ${settlementGaps.total}`,
    `Oldest: ${formatRelativeAge(settlementGapSummary?.oldestGapAt, 'None')}`,
  ];
  const batchScopeLabels = [
    ...(filters.settlementPeriod === 'all' ? [] : [`Month: ${filters.settlementPeriod}`]),
    ...(filters.settlementPaymentMethod === 'all'
      ? []
      : [`Payment: ${settlementPaymentMethodLabel}`]),
    'Limit: 100 records',
    'Read-only — no records will be changed',
  ];

  return (
    <AdminPageTemplate
      description={
        isSettlementQueue
          ? 'Review missing settlement snapshots, verify policy evidence, and repair only approved records.'
          : 'Read-only historical batch diagnostics before individual dual-approval repair.'
      }
      metrics={
        !settlementSourcesAvailable
          ? []
          : isSettlementQueue
          ? [
              {
                helper: 'Completed bookings without a settlement snapshot in the active filters.',
                kind: 'risk',
                label: 'Matching repair gaps',
                scope: 'Active filters',
                value: settlementGapSummary?.total ?? settlementGaps.total,
              },
              {
                helper: 'Evidence must be corrected before a settlement snapshot can be created.',
                kind: 'risk',
                label: 'Evidence blocked',
                scope: 'Active filters',
                value: settlementGapSummary?.evidenceBlocked ?? 0,
              },
              {
                helper: 'Age of the oldest missing settlement snapshot in the active filter scope.',
                kind: 'record',
                label: 'Oldest gap',
                scope: 'Active filters',
                value: formatRelativeAge(settlementGapSummary?.oldestGapAt, 'None'),
              },
            ]
          : [
                {
                  helper: 'Historical paid evidence awaiting explicit policy review.',
                  kind: 'action',
                  label: 'Historical policy review',
                  scope: 'Batch scope',
                  value: settlementGapSummary?.historicalReady ?? 0,
                },
                {
                  helper: 'Evidence must be corrected before any individual repair can be approved.',
                  kind: 'risk',
                  label: 'Evidence blocked',
                  scope: 'Batch scope',
                  value: settlementGapSummary?.evidenceBlocked ?? 0,
                },
                {
                  helper: 'Age of the oldest missing settlement snapshot in the retained summary.',
                  kind: 'record',
                  label: 'Oldest gap',
                  scope: 'All gaps',
                  value: formatRelativeAge(settlementGapSummary?.oldestGapAt, 'None'),
                },
              ]
      }
      title="Settlement Repair"
    >
      {repairNotice ? (
        <AdminNoticeCard
          className="admin-mb-16"
          role={repairNotice === 'repaired' || repairNotice === 'approval-requested' ? 'status' : 'alert'}
          tone={
            repairNotice === 'repaired'
              ? 'success'
              : repairNotice === 'approval-requested'
                ? 'info'
              : repairNotice === 'checkpoint-failed'
                ? 'warning'
                : 'danger'
          }
        >
          <strong>
            {repairNotice === 'repaired'
              ? 'Settlement repaired and verified'
              : repairNotice === 'approval-requested'
                ? 'Independent Finance approval requested'
              : repairNotice === 'checkpoint-failed'
                ? 'Settlement recorded, accounting review required'
                : 'Settlement repair not completed'}
          </strong>
          <p className="muted">{settlementRepairNoticeMessage(repairNotice)}</p>
          {repairCheckpoint ? (
            <p className="muted">
              Checkpoint {repairCheckpoint.status}
              {repairCheckpoint.blockingFailures.length > 0
                ? ` · ${repairCheckpoint.blockingFailures.join(', ')}`
                : ` · ${repairCheckpoint.checks.length} checks passed`}
            </p>
          ) : null}
          {repairNotice === 'repaired' || repairNotice === 'checkpoint-failed' || repairNotice === 'approval-requested' ? (
            <div className="admin-inline-actions admin-mt-8" aria-label="Settlement repair evidence">
              {checkpointBookingId ? (
                <AdminTextLink href={`/bookings/${encodeURIComponent(checkpointBookingId)}`}>
                  Booking evidence
                </AdminTextLink>
              ) : null}
              {repairSnapshotId ? (
                <AdminTextLink
                  href={`/finance-tax/booking-settlement-audit?q=${encodeURIComponent(repairSnapshotId)}`}
                >
                  Settlement snapshot
                </AdminTextLink>
              ) : null}
              {repairEarningId ? (
                <AdminTextLink href={`/earnings?q=${encodeURIComponent(repairEarningId)}`}>
                  Partner earning
                </AdminTextLink>
              ) : null}
              {repairAuditLogId ? (
                <AdminTextLink href={`/audit-log?q=${encodeURIComponent(repairAuditLogId)}`}>
                  Audit log
                </AdminTextLink>
              ) : null}
            </div>
          ) : null}
          {repairActorId || repairApprovalAdminId || repairCompletedAt ? (
            <p className="muted admin-mt-8">
              Actor {repairActorId || 'Unavailable'} · Approver {repairApprovalAdminId || 'Unavailable'} ·
              Completed {repairCompletedAt ? formatDateTime(repairCompletedAt) : 'Unavailable'}
            </p>
          ) : null}
          {repairNotice === 'approval-requested' && (repairActorId || repairRequestedAt) ? (
            <p className="muted admin-mt-8">
              Requested by {repairActorId || 'Unavailable'} · Requested{' '}
              {repairRequestedAt ? formatDateTime(repairRequestedAt) : 'Unavailable'}
            </p>
          ) : null}
        </AdminNoticeCard>
      ) : null}

      {!settlementSourcesAvailable ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Data unavailable — do not close or repair</strong>
          <p className="muted">
            {requiredSources.filter((source) => source.available).length} of {requiredSources.length}{' '}
            required sources loaded. A failed source is not an empty queue.
          </p>
          <ul>
            {requiredSources.map((source) => (
              <li key={source.label}>
                {source.label}:{' '}
                {source.available
                  ? 'Loaded'
                  : source.result.ok
                    ? 'Invalid response'
                    : source.result.status ?? 'Network error'}
              </li>
            ))}
          </ul>
          <p className="muted">
            Last confirmed refresh: {lastRefreshedAt ? formatDateTime(lastRefreshedAt) : 'Unavailable'}
          </p>
          <AdminTextLink href={currentFinanceCloseoutHref(params)}>Retry required sources</AdminTextLink>
        </AdminNoticeCard>
      ) : (
        <AdminNoticeCard className="admin-mb-16" role="status" tone="info">
          <strong>Required finance sources loaded</strong>
          <p className="muted">
            Last refreshed ICT: {lastRefreshedAt ? formatDateTime(lastRefreshedAt) : 'Just now'}
          </p>
          <AdminTextLink href={currentFinanceCloseoutHref(params)}>Refresh now</AdminTextLink>
        </AdminNoticeCard>
      )}

      <AdminFilterPanel
        className="admin-mt-16 admin-mb-16"
        description="Use the repair queue for governed action. Batch evidence remains read-only diagnostics."
        resultLabel={isSettlementQueue ? 'Repair queue' : 'Batch evidence'}
        title="Settlement repair workspace"
      >
        <AdminSegmentedControl
          activeValue={isSettlementQueue ? 'settlement-queue' : 'settlement-batch'}
          ariaLabel="Finance closeout workspaces"
          options={[
            {
              href: buildFinanceCloseoutPageHref(filters, {
                settlementMode: 'queue',
                settlementPage: 1,
              }),
              label: 'Repair queue',
              value: 'settlement-queue',
            },
            {
              href: buildFinanceCloseoutPageHref(filters, {
                settlementMode: 'batch',
                settlementPage: 1,
              }),
              label: 'Batch evidence',
              value: 'settlement-batch',
            },
          ]}
        />
        <AdminTextLink href={buildFinanceCloseoutOperationsHref(filters.range)}>
          Open Finance Overview
        </AdminTextLink>
      </AdminFilterPanel>

      {isSettlementQueue ? (
        <AdminFilterPanel
          actions={
            <AdminTextLink
              href={buildFinanceCloseoutPageHref(filters, {
                settlementAge: 'backlog',
                settlementMode: 'queue',
                settlementPage: 1,
                settlementPaymentMethod: 'all',
                settlementPeriod: 'all',
                settlementQuery: '',
                settlementTrack: 'canonical',
              })}
            >
              Clear filters
            </AdminTextLink>
          }
          className="admin-mb-16"
          description="Completed bookings without a settlement snapshot. Choose a repair track first, then age. Historical evidence is a policy-review candidate; the current preview remains the final finance safety gate."
          resultLabel={settlementSourcesAvailable ? `${settlementGaps.total} booking(s)` : 'Data unavailable'}
          title="Repair queue filters"
        >
          <div className="booking-date-filter-bar finance-closeout-filter-group">
            <span className="finance-closeout-filter-group-label">Repair track</span>
            <AdminSegmentedControl
              activeValue={filters.settlementTrack}
              ariaLabel="Settlement repair track"
              className="finance-closeout-filter-buttons"
              options={FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS.map((option) => ({
                href: buildFinanceCloseoutPageHref(filters, {
                  settlementPage: 1,
                  settlementTrack: option.value,
                }),
                ...option,
              }))}
            />
          </div>
          <div className="booking-date-filter-bar finance-closeout-filter-group">
            <span className="finance-closeout-filter-group-label">Gap age</span>
            <AdminSegmentedControl
              activeValue={filters.settlementAge}
              ariaLabel="Settlement gap age"
              className="finance-closeout-filter-buttons"
              options={FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS.map((option) => ({
                href: buildFinanceCloseoutPageHref(filters, {
                  settlementAge: option.value,
                  settlementPage: 1,
                }),
                ...option,
              }))}
            />
          </div>
          <AdminFormShell
            action="/finance-closeout"
            className="admin-directory-filter-grid admin-mt-12"
            method="get"
          >
            <input name="view" type="hidden" value="settlement" />
            <input name="range" type="hidden" value={filters.range} />
            <input name="settlementAge" type="hidden" value={filters.settlementAge} />
            <input name="settlementPage" type="hidden" value="1" />
            <input name="settlementTrack" type="hidden" value={filters.settlementTrack} />
            <AdminFormSelect
              defaultValue={filters.settlementPeriod}
              label="Settlement month"
              labelVisibility="visible"
              name="settlementPeriod"
              options={settlementPeriodOptions}
            />
            <AdminFormSelect
              defaultValue={filters.settlementPaymentMethod}
              label="Payment method"
              labelVisibility="visible"
              name="settlementPaymentMethod"
              options={FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS}
            />
            <AdminFormSearch
              defaultValue={filters.settlementQuery}
              label="Search settlement backlog"
              name="q"
              placeholder="Booking, customer, phone, or Partner"
            />
            <AdminFormControlButton className="button-secondary" type="submit">
              Search backlog
            </AdminFormControlButton>
          </AdminFormShell>
          {settlementSourcesAvailable ? (
            <AdminFilterSummary
              ariaLabel="Settlement gap age summary"
              labels={queueSummaryLabels}
              tone={(settlementGapSummary?.backlog ?? 0) > 0 ? 'warning' : 'success'}
            />
          ) : null}
        </AdminFilterPanel>
      ) : null}

      {isSettlementBatch ? (
        <AdminFilterPanel
          actions={
            <AdminTextLink
              href={buildFinanceCloseoutPageHref(filters, {
                settlementMode: 'batch',
                settlementPaymentMethod: 'all',
                settlementPeriod: 'all',
              })}
            >
              Clear batch scope
            </AdminTextLink>
          }
          className="admin-mb-16"
          description="Narrow historical diagnostics by settlement month and payment method before running the bounded 100-record dry-run."
          resultLabel="Read only"
          title="Historical batch filters"
        >
          <AdminFormShell action="/finance-closeout" className="admin-directory-filter-grid" method="get">
            <input name="view" type="hidden" value="settlement" />
            <input name="settlementMode" type="hidden" value="batch" />
            <input name="range" type="hidden" value={filters.range} />
            <AdminFormSelect
              defaultValue={filters.settlementPeriod}
              label="Settlement month"
              labelVisibility="visible"
              name="settlementPeriod"
              options={settlementPeriodOptions}
            />
            <AdminFormSelect
              defaultValue={filters.settlementPaymentMethod}
              label="Payment method"
              labelVisibility="visible"
              name="settlementPaymentMethod"
              options={FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS}
            />
            <AdminFormControlButton className="button-secondary" type="submit">
              Apply batch scope
            </AdminFormControlButton>
          </AdminFormShell>
          <AdminFilterSummary
            ariaLabel="Historical settlement batch scope"
            labels={batchScopeLabels}
            tone="info"
          />
        </AdminFilterPanel>
      ) : null}

      {isSettlementQueue && settlementSourcesAvailable ? (
        <FinanceCloseoutSettlementBacklogSection
          hrefForPage={(page) => buildFinanceCloseoutPageHref(filters, { settlementPage: page })}
          hrefForRepair={(bookingId) => buildFinanceCloseoutSettlementRepairHref(filters, bookingId)}
          pagination={settlementPagination}
          reviewFormState={{
            q: filters.settlementQuery,
            range: filters.range,
            settlementAge: filters.settlementAge,
            settlementPage: filters.settlementPage,
            settlementPaymentMethod: filters.settlementPaymentMethod,
            settlementPeriod: filters.settlementPeriod,
            settlementTrack: filters.settlementTrack,
          }}
          rows={settlementGaps.items}
        />
      ) : isSettlementBatch && settlementSourcesAvailable ? (
        <>
          <FinanceCloseoutSettlementDryRunSection
            clearHref={buildFinanceCloseoutPageHref(filters, { settlementMode: 'batch' })}
            hrefForBatch={(bookingIds) => buildFinanceCloseoutSettlementBatchReviewHref(filters, bookingIds)}
            report={settlementDryRun}
            runHref={buildFinanceCloseoutSettlementDryRunHref(filters)}
          />

          <FinanceCloseoutSettlementBatchPreviewSection
            clearHref={buildFinanceCloseoutPageHref(filters, { settlementMode: 'batch' })}
            hrefForRepair={(bookingId) => buildFinanceCloseoutSettlementRepairHref(filters, bookingId)}
            previews={selectedSettlementPreviews}
          />
        </>
      ) : null}

      {isSettlementQueue && repairBookingId ? (
        <FinanceCloseoutSettlementRepairDrawer
          action={repairBookingSettlementGapAction}
          approvers={financeApprovers}
          closeHref={buildFinanceCloseoutPageHref(filters)}
          preview={settlementSourcesAvailable ? repairPreview : null}
          recheckHref={buildFinanceCloseoutSettlementRepairHref(filters, repairBookingId)}
          returnFilters={{
            q: filters.settlementQuery,
            range: filters.range,
            settlementAge: filters.settlementAge,
            settlementPage: filters.settlementPage,
            settlementPaymentMethod: filters.settlementPaymentMethod,
            settlementPeriod: filters.settlementPeriod,
            settlementTrack: filters.settlementTrack,
          }}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

async function repairBookingSettlementGapAction(formData: FormData) {
  'use server';

  const bookingId = readFormValue(formData, 'bookingId');
  const confirmationBookingId = readFormValue(formData, 'confirmationBookingId');
  const reason = readFormValue(formData, 'reason');
  const sourceVersion = readFormValue(formData, 'sourceVersion');
  const filters = buildFinanceCloseoutFilters({
    q: readFormValue(formData, 'q'),
    range: readFormValue(formData, 'range'),
    settlementAge: readFormValue(formData, 'settlementAge'),
    settlementPage: readFormValue(formData, 'settlementPage'),
    settlementPaymentMethod: readFormValue(formData, 'settlementPaymentMethod'),
    settlementPeriod: readFormValue(formData, 'settlementPeriod'),
    settlementTrack: readFormValue(formData, 'settlementTrack'),
  });
  const closeHref = buildFinanceCloseoutPageHref(filters);
  const previewHref = bookingId ? buildFinanceCloseoutSettlementRepairHref(filters, bookingId) : closeHref;

  if (!bookingId || !sourceVersion || reason.length < 12) {
    redirect(withRepairNotice(previewHref, 'invalid'));
  }
  if (confirmationBookingId !== bookingId) {
    redirect(withRepairNotice(previewHref, 'confirmation'));
  }

  let result: AdminBookingSettlementGapRepairResult;
  try {
    result = await adminPostOrThrow<AdminBookingSettlementGapRepairResult>(
      `/admin/booking-settlement-gaps/${encodeURIComponent(bookingId)}/repair`,
      { reason, sourceVersion },
    );
  } catch (error) {
    redirect(withRepairNotice(previewHref, settlementRepairErrorCode(error)));
  }

  if ('approvalRequested' in result) {
    const url = new URL(previewHref, 'http://admin.local');
    url.searchParams.set('repairNotice', 'approval-requested');
    url.searchParams.set('repairAuditLogId', result.auditLogId);
    url.searchParams.set('repairActorId', result.actorId);
    url.searchParams.set('repairRequestedAt', result.requestedAt);
    redirect(`${url.pathname}?${url.searchParams.toString()}`);
  }

  redirect(
    withRepairNotice(
      closeHref,
      result.checkpoint.passed ? 'repaired' : 'checkpoint-failed',
      result.bookingId,
      {
        approvalAdminId: result.approvalAdminId,
        auditLogId: result.auditLogId,
        actorId: result.actorId,
        completedAt: result.completedAt,
        earningId: result.earningId,
        snapshotId: result.settlementSnapshotId,
      },
    ),
  );
}

function readPageParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function readPageParamList(
  params: Record<string, string | string[] | undefined>,
  key: string,
  maxItems: number,
) {
  const value = params[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, maxItems);
}

function readFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function successfulAdminResult<T>(data: T): AdminGetResult<T> {
  return { data, ok: true, status: 200 };
}

function currentFinanceCloseoutHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    (Array.isArray(value) ? value : value ? [value] : []).forEach((item) => query.append(key, item));
  });
  const encoded = query.toString();
  return encoded ? `/finance-closeout?${encoded}` : '/finance-closeout';
}

function withRepairNotice(
  href: string,
  notice: string,
  checkpointBookingId?: string,
  evidence?: {
    actorId: string;
    approvalAdminId: string;
    auditLogId: string;
    completedAt: string;
    earningId: string;
    snapshotId: string;
  },
) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set('repairNotice', notice);
  if (checkpointBookingId) url.searchParams.set('checkpointBookingId', checkpointBookingId);
  if (evidence) {
    url.searchParams.set('repairActorId', evidence.actorId);
    url.searchParams.set('repairApprovalAdminId', evidence.approvalAdminId);
    url.searchParams.set('repairAuditLogId', evidence.auditLogId);
    url.searchParams.set('repairCompletedAt', evidence.completedAt);
    url.searchParams.set('repairEarningId', evidence.earningId);
    url.searchParams.set('repairSnapshotId', evidence.snapshotId);
  }
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function settlementRepairErrorCode(error: unknown) {
  if (error instanceof AdminOperatorAccessDeniedError) return 'access-denied';
  if (error instanceof AdminApiRequestError) return `api-${error.status}`;
  if (error instanceof Error && error.message.startsWith('Admin Web session')) return 'admin-session';
  return 'failed';
}

function settlementRepairNoticeMessage(notice: string) {
  if (notice === 'approval-requested')
    return 'No finance write was made. A different signed-in verified Finance operator must reopen the same evidence version and submit the repair.';
  if (notice === 'repaired')
    return 'The missing snapshot was created and its journal, clearing, and retained evidence checks passed.';
  if (notice === 'checkpoint-failed')
    return 'The repair write exists, but one or more accounting checks failed. Do not retry; review the checkpoint and finance audit evidence.';
  if (notice === 'confirmation') return 'The confirmation booking ID did not match.';
  if (notice === 'invalid')
    return 'A reason of at least 12 characters, current preview, and booking confirmation are required.';
  if (notice === 'access-denied' || notice === 'api-403')
    return 'Your operator category cannot perform this repair.';
  if (notice === 'api-400')
    return 'The API blocked this repair because finance evidence or approval is not valid.';
  if (notice === 'admin-session' || notice === 'api-401')
    return 'Admin authentication expired. Sign in again.';
  return 'The finance write failed. No successful repair was confirmed.';
}
