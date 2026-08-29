import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';

import { AdminTablePaginationFooter } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlButton, AdminFormControlLink, AdminFormDate, AdminFormGrid, AdminFormInput, AdminFormSelect } from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure, AdminNoticeCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { formatMoney } from '../../lib/admin-format';
import type {
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentOpenPeriod,
  AdminManualWalletAdjustmentPolicy,
  AdminManualWalletAdjustmentRequest,
  AdminManualWalletAdjustmentRequestStatus,
  AdminManualWalletAdjustmentRow,
  AdminManualWalletAdjustmentSummary,
  AdminManualWalletAdjustmentWorkspaceSummary,
} from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { FinanceDataTable } from '../finance-tax/finance-data-table';
import { WalletAdjustmentCreateWorkspace } from './wallet-adjustment-create-workspace';
import { WalletAdjustmentDetailFocusManager, WalletAdjustmentDetailPanel } from './wallet-adjustment-detail-focus';
import { WalletAdjustmentReversalWorkspace } from './wallet-adjustment-reversal-workspace';

type PageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WorkspaceView = 'records' | 'requests' | 'create';
type RequestReview = 'awaiting' | 'blocked' | 'recreation' | 'aged24h' | 'history';

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;
const ownerOptions: Array<{ label: string; value: AdminManualWalletAdjustmentOwnerType | '' }> = [
  { label: 'All wallet owners', value: '' },
  { label: 'Partner wallets', value: 'PARTNER' },
  { label: 'Customer wallets', value: 'CUSTOMER' },
];
const requestStatusOptions: Array<{ label: string; value: AdminManualWalletAdjustmentRequestStatus | '' }> = [
  { label: 'All request statuses', value: '' },
  { label: 'Awaiting finance approval', value: 'REQUESTED' },
  { label: 'Executed', value: 'EXECUTED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];
const pageSizeOptions = [
  { label: '10 rows', value: '10' },
  { label: '25 rows', value: '25' },
  { label: '50 rows', value: '50' },
];
const adjustmentTypeOptions = [
  { label: 'All adjustment types', value: '' },
  { label: 'Customer compensation', value: 'CUSTOMER_COMPENSATION' },
  { label: 'Promotion credit', value: 'PROMOTION_CREDIT' },
  { label: 'Referral correction', value: 'REFERRAL_CORRECTION' },
  { label: 'Partner bonus', value: 'PARTNER_BONUS' },
  { label: 'Partner penalty', value: 'PARTNER_PENALTY' },
  { label: 'Error correction', value: 'ERROR_CORRECTION' },
  { label: 'Manual reversal', value: 'MANUAL_REVERSAL' },
];
const directionOptions = [
  { label: 'Credit and debit', value: '' },
  { label: 'Credit', value: 'CREDIT' },
  { label: 'Debit', value: 'DEBIT' },
];
const evidenceOptions = [
  { label: 'Any evidence state', value: '' },
  { label: 'Evidence attached', value: 'attached' },
  { label: 'Evidence missing', value: 'missing' },
];
const periodStateOptions = [
  { label: 'Any period state', value: '' },
  { label: 'Legacy · period missing', value: 'true' },
];

export const metadata: Metadata = { title: 'Wallet Adjustments' };

export default async function WalletAdjustmentsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const requestedView = normalizeView(readParam(params, 'view'));
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canCreate = hasAdminOperatorCategory(operatorAccess, 'FINANCE_WALLET_ADJUSTMENTS');
  const view = requestedView === 'create' && !canCreate ? 'requests' : requestedView;
  const notice = walletAdjustmentNotice(readParam(params, 'adjustmentNotice'));
  const workspace =
    view === 'records'
      ? await RecordsWorkspace({ params })
      : view === 'requests'
        ? await RequestsWorkspace({ params })
        : await CreateWorkspace(params);

  return (
    <AdminPageTemplate
      description="Trace executed wallet ledger entries, follow approval requests, or prepare a new maker request. No bank or cash movement occurs here."
      title="Wallet Adjustments"
    >
      <AdminSegmentedControl
        activeValue={view}
        ariaLabel="Wallet adjustment workspace"
        className="admin-mb-16"
        options={[
          { href: '/wallet-adjustments?view=records', label: 'Records', value: 'records' },
          { href: '/wallet-adjustments?view=requests', label: 'Requests', value: 'requests' },
          ...(canCreate
            ? [{ href: '/wallet-adjustments?view=create', label: 'New request', value: 'create' as const }]
            : []),
        ]}
        semantics="tabs"
      />
      <WalletAdjustmentDetailFocusManager targetId={readParam(params, 'returnFocus')} />

      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role="status" tone={notice.tone}>
          <div>
            <h2>{notice.title}</h2>
            <p>{notice.detail}</p>
          </div>
        </AdminNoticeCard>
      ) : null}

      {workspace}
    </AdminPageTemplate>
  );
}

async function CreateWorkspace(params: Record<string, string | string[] | undefined>) {
  const reversalOfRequestId = readParam(params, 'reversalOfRequestId');
  const [policyResult, periodsResult, originalResult] = await Promise.all([
    adminGetResult<AdminManualWalletAdjustmentPolicy>(
      '/admin/wallet-adjustments/policy',
      emptyPolicy(),
    ),
    adminGetResult<AdminManualWalletAdjustmentOpenPeriod[]>(
      '/admin/wallet-adjustments/open-periods',
      [],
    ),
    reversalOfRequestId
      ? adminGetResult<AdminManualWalletAdjustmentRequest>(
          `/admin/wallet-adjustment-requests/${encodeURIComponent(reversalOfRequestId)}`,
          emptyRequest(),
        )
      : Promise.resolve(null),
  ]);
  if (!policyResult.ok || !periodsResult.ok) {
    return (
      <AdminNoticeCard role="alert" tone="danger">
        <div>
          <h2>Adjustment policy unavailable</h2>
          <p>Do not create a request until the finance policy can be loaded.</p>
          <AdminFormControlLink className="admin-mt-12" href="/wallet-adjustments?view=create">
            Try again
          </AdminFormControlLink>
        </div>
      </AdminNoticeCard>
    );
  }
  if (periodsResult.data.length === 0) {
    return (
      <AdminNoticeCard role="alert" tone="danger">
        <div>
          <h2>No open accounting month</h2>
          <p>Manual wallet requests are disabled until a VND period is in DRAFT or REVIEWED status.</p>
          <AdminFormControlLink className="admin-mt-12" href="/finance-tax">
            Open Tax &amp; Period Close
          </AdminFormControlLink>
        </div>
      </AdminNoticeCard>
    );
  }
  if (reversalOfRequestId) {
    if (!originalResult?.ok || originalResult.data.status !== 'EXECUTED' || !originalResult.data.ledgerEntryId) {
      return (
        <AdminNoticeCard role="alert" tone="danger">
          <div>
            <h2>Reversal source unavailable</h2>
            <p>Start from an executed request that still has its linked ledger evidence.</p>
            <AdminFormControlLink className="admin-mt-12" href="/wallet-adjustments?view=requests&requestStatus=EXECUTED">
              View executed requests
            </AdminFormControlLink>
          </div>
        </AdminNoticeCard>
      );
    }
    return (
      <WalletAdjustmentReversalWorkspace
        idempotencyKey={randomUUID()}
        openPeriods={periodsResult.data}
        original={originalResult.data}
        policy={policyResult.data}
      />
    );
  }
  return (
    <WalletAdjustmentCreateWorkspace
      idempotencyKey={randomUUID()}
      openPeriods={periodsResult.data}
      policy={policyResult.data}
    />
  );
}

async function RecordsWorkspace({ params }: { params: Record<string, string | string[] | undefined> }) {
  const filters = readRecordFilters(params);
  const selectedRecordId = readParam(params, 'recordDetailId');
  const apiParams = recordApiParams(filters);
  apiParams.set('take', String(filters.pageSize));
  if (filters.page > 1) apiParams.set('skip', String((filters.page - 1) * filters.pageSize));
  const summaryParams = recordApiParams(filters);

  const [rowsResult, summaryResult, selectedRecordResult] = await Promise.all([
    adminGetResult<AdminManualWalletAdjustmentRow[]>(
      `/admin/wallet-adjustments?${apiParams.toString()}`,
      [],
    ),
    adminGetResult<AdminManualWalletAdjustmentSummary>(
      `/admin/wallet-adjustments/summary${summaryParams.size ? `?${summaryParams.toString()}` : ''}`,
      { total: 0 },
    ),
    selectedRecordId
      ? adminGetResult<AdminManualWalletAdjustmentRow>(
          `/admin/wallet-adjustments/${encodeURIComponent(selectedRecordId)}`,
          emptyRecord(),
        )
      : Promise.resolve(null),
  ]);
  const total = summaryResult.ok ? safeTotal(summaryResult.data.total) : 0;
  const pagination = paginationState(rowsResult.data, filters.page, filters.pageSize, total);
  const selectedRecord = selectedRecordResult?.ok ? selectedRecordResult.data : null;

  return (
    <>
      <AdminFilterPanel
        className="admin-mb-16"
        description="Executed entries only. Request drafts and rejected requests are tracked in the Requests tab."
        resultLabel={rowsResult.ok && summaryResult.ok ? countLabel(total, 'executed record') : 'Records unavailable'}
        resultTone={rowsResult.ok && summaryResult.ok ? (total ? 'info' : 'neutral') : 'danger'}
        title="Executed wallet adjustments"
      >
        <AdminFormGrid method="get">
          <input name="view" type="hidden" value="records" />
          <AdminFormInput
            defaultValue={filters.q}
            label="Search records"
            labelVisibility="visible"
            name="recordQ"
            placeholder="Owner, phone, request, ledger or case"
          />
          <AdminFormDate defaultValue={filters.period} label="Accounting month" labelVisibility="visible" mode="month" name="recordPeriod" />
          <AdminFormSelect
            defaultValue={filters.ownerType ?? ''}
            label="Record wallet owner"
            labelVisibility="visible"
            name="recordOwnerType"
            options={ownerOptions}
          />
          <AdminFormSelect
            defaultValue={filters.sort}
            label="Record order"
            labelVisibility="visible"
            name="recordSort"
            options={[
              { label: 'Newest first', value: 'newest' },
              { label: 'Oldest first', value: 'oldest' },
              { label: 'Highest amount', value: 'amount-high' },
              { label: 'Lowest amount', value: 'amount-low' },
            ]}
          />
          <AdminFormControlButton>Apply record filters</AdminFormControlButton>
          <AdminFormControlLink href="/wallet-adjustments?view=records">Reset all</AdminFormControlLink>
          <AdminDisclosure ariaLabel="Advanced record filters" className="wallet-adjustment-advanced-filters">
            <summary>Advanced record filters</summary>
            <div className="wallet-adjustment-advanced-filter-grid">
              <AdminFormSelect defaultValue={filters.adjustmentType} label="Adjustment type" labelVisibility="visible" name="recordAdjustmentType" options={adjustmentTypeOptions} />
              <AdminFormSelect defaultValue={filters.direction} label="Direction" labelVisibility="visible" name="recordDirection" options={directionOptions} />
              <AdminFormSelect defaultValue={filters.evidence} label="Evidence" labelVisibility="visible" name="recordEvidence" options={evidenceOptions} />
              <AdminFormSelect defaultValue={filters.periodMissing} label="Period repair" labelVisibility="visible" name="recordPeriodMissing" options={periodStateOptions} />
              <AdminFormSelect
                defaultValue={String(filters.pageSize)}
                label="Record rows per page"
                labelVisibility="visible"
                name="recordPageSize"
                options={pageSizeOptions}
              />
              <AdminFormDate defaultValue={filters.from} label="Posted from" labelVisibility="visible" name="recordFrom" />
              <AdminFormDate defaultValue={filters.to} label="Posted to" labelVisibility="visible" name="recordTo" />
              <AdminFormInput defaultValue={filters.amountMin} label="Minimum amount" labelVisibility="visible" min="0" name="recordAmountMin" step="1" type="number" />
              <AdminFormInput defaultValue={filters.amountMax} label="Maximum amount" labelVisibility="visible" min="0" name="recordAmountMax" step="1" type="number" />
              <AdminFormInput defaultValue={filters.makerId} label="Maker admin ID" labelVisibility="visible" name="recordMakerId" />
              <AdminFormInput defaultValue={filters.approverId} label="Approver admin ID" labelVisibility="visible" name="recordApproverId" />
            </div>
          </AdminDisclosure>
        </AdminFormGrid>
        <AppliedFilterSummary
          labels={recordFilterLabels(filters)}
          resetHref="/wallet-adjustments?view=records"
        />
        {filters.ownerId ? <ExactOwnerFilterChip id={filters.ownerId} view="records" /> : null}
      </AdminFilterPanel>

      {!rowsResult.ok || !summaryResult.ok ? (
        <SectionLoadFailure href={recordHref(filters, filters.page)} label="executed wallet records" />
      ) : (
        <>
          <AdminTablePanel
            description="Select a row to review identifiers, accounting entries, evidence, and the stored reason below the table."
            resultLabel={`${pagination.from}-${pagination.to} of ${total}`}
            resultTone={total ? 'info' : 'neutral'}
            title="Executed wallet ledger"
          >
            <FinanceDataTable
              ariaLabel="Executed wallet ledger"
              emptyMessage="No executed wallet adjustments match these filters."
              headers={['Posted', 'Wallet owner', 'Adjustment', 'Amount', 'Balance', 'Details']}
              rowCount={pagination.rows.length}
              scrollClassName="wallet-adjustment-table-scroll"
            >
              {pagination.rows.map((row) => (
                <RecordRow
                  detailHref={recordDetailHref(filters, pagination.page, row.id)}
                  key={row.id}
                  row={row}
                />
              ))}
            </FinanceDataTable>
            <AdminTablePaginationFooter
              activePage={pagination.page}
              ariaLabel="Executed wallet ledger pages"
              from={pagination.from}
              hrefForPage={(page) => recordHref(filters, page)}
              to={pagination.to}
              totalPages={pagination.totalPages}
              totalRows={total}
            />
          </AdminTablePanel>
          {selectedRecordId ? (
            selectedRecord ? (
              <RecordEvidencePanel closeHref={recordHref(filters, pagination.page)} row={selectedRecord} />
            ) : (
              <DetailUnavailable closeHref={recordHref(filters, pagination.page)} label="executed record" />
            )
          ) : null}
        </>
      )}
    </>
  );
}

async function RequestsWorkspace({ params }: { params: Record<string, string | string[] | undefined> }) {
  const filters = readRequestFilters(params);
  const selectedRequestId = readParam(params, 'requestDetailId');
  const apiParams = requestApiParams(filters);
  apiParams.set('take', String(filters.pageSize));
  if (filters.page > 1) apiParams.set('skip', String((filters.page - 1) * filters.pageSize));
  const summaryParams = requestApiParams(filters);

  const [rowsResult, summaryResult, workspaceSummaryResult, agedSummaryResult, selectedRequestResult] = await Promise.all([
    adminGetResult<AdminManualWalletAdjustmentRequest[]>(
      `/admin/wallet-adjustment-requests?${apiParams.toString()}`,
      [],
    ),
    adminGetResult<AdminManualWalletAdjustmentSummary>(
      `/admin/wallet-adjustment-requests/summary${summaryParams.size ? `?${summaryParams.toString()}` : ''}`,
      { total: 0 },
    ),
    adminGetResult<AdminManualWalletAdjustmentWorkspaceSummary>(
      '/admin/wallet-adjustment-requests/workspace-summary',
      { awaitingApproval: 0, history: 0, needsRecreation: 0, staleOrBlocked: 0 },
    ),
    adminGetResult<AdminManualWalletAdjustmentSummary>(
      '/admin/wallet-adjustment-requests/summary?review=awaiting&age=24h-plus',
      { total: 0 },
    ),
    selectedRequestId
      ? adminGetResult<AdminManualWalletAdjustmentRequest>(
          `/admin/wallet-adjustment-requests/${encodeURIComponent(selectedRequestId)}`,
          emptyRequest(),
        )
      : Promise.resolve(null),
  ]);
  const total = summaryResult.ok ? safeTotal(summaryResult.data.total) : 0;
  const pagination = paginationState(rowsResult.data, filters.page, filters.pageSize, total);

  return (
    <>
      <AdminFilterPanel
        className="admin-mb-16"
        description="Track maker/checker lifecycle here. Approval and rejection remain in the Finance Approval Queue."
        resultLabel={rowsResult.ok && summaryResult.ok && workspaceSummaryResult.ok && agedSummaryResult.ok ? countLabel(total, 'request') : 'Requests unavailable'}
        resultTone={rowsResult.ok && summaryResult.ok && workspaceSummaryResult.ok && agedSummaryResult.ok ? (total ? 'info' : 'neutral') : 'danger'}
        title="Approval request queue"
      >
        <AdminSegmentedControl
          activeValue={filters.review}
          ariaLabel="Wallet adjustment saved views"
          className="admin-mb-12"
          options={requestSavedViewOptions(workspaceSummaryResult.data, agedSummaryResult.data.total)}
          semantics="tabs"
        />
        <p className="muted admin-mb-12">
          Quick views may overlap. All pending is the total backlog. Needs recreation is a subset of Blocked.
        </p>
        <AdminFormGrid method="get">
          <input name="view" type="hidden" value="requests" />
          <input name="requestReview" type="hidden" value={filters.review} />
          <AdminFormInput
            defaultValue={filters.q}
            label="Search requests"
            labelVisibility="visible"
            name="requestQ"
            placeholder="Owner, phone, request, reason or case"
          />
          <AdminFormSelect
            defaultValue={filters.ownerType ?? ''}
            label="Request wallet owner"
            labelVisibility="visible"
            name="requestOwnerType"
            options={ownerOptions}
          />
          <AdminFormSelect
            defaultValue={filters.age}
            label="Pending age"
            labelVisibility="visible"
            name="requestAge"
            options={[
              { label: 'Any age', value: '' },
              { label: 'Older than 24 hours', value: '24h-plus' },
              { label: 'Older than 72 hours', value: '72h-plus' },
            ]}
          />
          <AdminFormControlButton>Apply request filters</AdminFormControlButton>
          <AdminFormControlLink href="/wallet-adjustments?view=requests">Reset all</AdminFormControlLink>
          <AdminDisclosure ariaLabel="Advanced request filters" className="wallet-adjustment-advanced-filters">
            <summary>Advanced request filters</summary>
            <div className="wallet-adjustment-advanced-filter-grid">
              {filters.review === 'history' ? (
                <AdminFormSelect
                  defaultValue={filters.status ?? ''}
                  label="History status"
                  labelVisibility="visible"
                  name="requestStatus"
                  options={requestStatusOptions.filter((option) => option.value !== 'REQUESTED')}
                />
              ) : null}
              <AdminFormDate defaultValue={filters.period} label="Accounting month" labelVisibility="visible" mode="month" name="requestPeriod" />
              <AdminFormSelect defaultValue={filters.adjustmentType} label="Adjustment type" labelVisibility="visible" name="requestAdjustmentType" options={adjustmentTypeOptions} />
              <AdminFormSelect defaultValue={filters.direction} label="Direction" labelVisibility="visible" name="requestDirection" options={directionOptions} />
              <AdminFormSelect defaultValue={filters.evidence} label="Evidence" labelVisibility="visible" name="requestEvidence" options={evidenceOptions} />
              <AdminFormSelect defaultValue={filters.periodMissing} label="Period repair" labelVisibility="visible" name="requestPeriodMissing" options={periodStateOptions} />
              <AdminFormInput defaultValue={filters.blocker} label="Blocker code" labelVisibility="visible" name="requestBlocker" placeholder="e.g. POLICY_MIGRATION_REQUIRED" />
              <AdminFormSelect
                defaultValue={filters.sort}
                label="Request order"
                labelVisibility="visible"
                name="requestSort"
                options={[
                  { label: 'Oldest first', value: 'oldest' },
                  { label: 'Newest first', value: 'newest' },
                ]}
              />
              <AdminFormSelect
                defaultValue={String(filters.pageSize)}
                label="Request rows per page"
                labelVisibility="visible"
                name="requestPageSize"
                options={pageSizeOptions}
              />
              <AdminFormDate defaultValue={filters.from} label="Requested from" labelVisibility="visible" name="requestFrom" />
              <AdminFormDate defaultValue={filters.to} label="Requested to" labelVisibility="visible" name="requestTo" />
              <AdminFormInput defaultValue={filters.amountMin} label="Minimum amount" labelVisibility="visible" min="0" name="requestAmountMin" step="1" type="number" />
              <AdminFormInput defaultValue={filters.amountMax} label="Maximum amount" labelVisibility="visible" min="0" name="requestAmountMax" step="1" type="number" />
              <AdminFormInput defaultValue={filters.makerId} label="Maker admin ID" labelVisibility="visible" name="requestMakerId" />
            </div>
          </AdminDisclosure>
        </AdminFormGrid>
        <AppliedFilterSummary
          labels={requestFilterLabels(filters)}
          resetHref="/wallet-adjustments?view=requests"
        />
        {filters.ownerId ? <ExactOwnerFilterChip id={filters.ownerId} view="requests" /> : null}
      </AdminFilterPanel>

      {!rowsResult.ok || !summaryResult.ok || !workspaceSummaryResult.ok || !agedSummaryResult.ok ? (
        <SectionLoadFailure href={requestHref(filters, filters.page)} label="wallet adjustment requests" />
      ) : (
        <>
          <AdminTablePanel
            description="Pending age and blockers support triage; decisions are made only in the Finance Approval Queue."
            resultLabel={`${pagination.from}-${pagination.to} of ${total}`}
            resultTone={total ? 'info' : 'neutral'}
            title="Wallet adjustment requests"
          >
            <FinanceDataTable
              ariaLabel="Wallet adjustment requests"
              emptyMessage="No wallet adjustment requests match these filters."
              headers={[
                filters.review === 'history' ? 'Decided / executed' : 'Requested',
                'Wallet owner',
                'Adjustment',
                'Amount',
                'Lifecycle',
                'Next action',
              ]}
              rowCount={pagination.rows.length}
              scrollClassName="wallet-adjustment-table-scroll"
            >
              {pagination.rows.map((request) => (
                <RequestRow
                  detailHref={requestDetailHref(filters, pagination.page, request.id)}
                  key={request.id}
                  request={request}
                />
              ))}
            </FinanceDataTable>
            <AdminTablePaginationFooter
              activePage={pagination.page}
              ariaLabel="Wallet adjustment request pages"
              from={pagination.from}
              hrefForPage={(page) => requestHref(filters, page)}
              to={pagination.to}
              totalPages={pagination.totalPages}
              totalRows={total}
            />
          </AdminTablePanel>
          {selectedRequestId ? (
            selectedRequestResult?.ok ? (
              <RequestEvidencePanel
                closeHref={requestHref(filters, pagination.page)}
                request={selectedRequestResult.data}
              />
            ) : (
              <DetailUnavailable closeHref={requestHref(filters, pagination.page)} label="request" />
            )
          ) : null}
        </>
      )}
    </>
  );
}

function RecordRow({ detailHref, row }: { readonly detailHref: string; readonly row: AdminManualWalletAdjustmentRow }) {
  return (
    <tr>
      <td><strong><DateTimeText value={row.createdAt} /></strong><small className="wallet-adjustment-short-id" title={row.id}>{shortId(row.id)}</small></td>
      <td><strong><AdminTextLink href={ownerHref(row.ownerType, row.ownerId)}>{row.ownerLabel}</AdminTextLink></strong><small>{humanizeEnum(row.ownerType)} · {row.ownerPhone}</small></td>
      <td><StatusBadge tone={row.direction === 'CREDIT' ? 'success' : 'warning'}>{directionLabel(row.direction)}</StatusBadge><small>{humanizeEnum(row.adjustmentType)}</small></td>
      <td><strong><MoneyText amount={row.amount} currency={row.currency} /></strong><small>Delta <MoneyText amount={row.walletDelta} currency={row.currency} /></small></td>
      <td><strong>{balanceChange(row)}</strong><small>{row.monthlyPeriod ? `Accounting month ${row.monthlyPeriod}` : 'Legacy · period missing'}</small></td>
      <td>
        <span id={detailOpenerId('record', row.id)} tabIndex={-1}><AdminFormControlLink aria-label={`Open details for ${row.ownerLabel} (${shortId(row.id)})`} href={detailHref}>Open details</AdminFormControlLink></span>
      </td>
    </tr>
  );
}

function RequestRow({ detailHref, request }: { readonly detailHref: string; readonly request: AdminManualWalletAdjustmentRequest }) {
  const pending = request.status === 'REQUESTED' || !request.status;
  const firstBlocker = primaryRequestBlocker(request.preflight?.blockers);
  const needsRecreation = Boolean(request.preflight?.blockers?.some((item) => requestNeedsRecreation(item.code)));
  const needsPolicyMigration = Boolean(request.preflight?.blockers?.some((item) => item.code === 'POLICY_MIGRATION_REQUIRED'));
  const decisionAction = requestDecisionAction(request);
  const decision = pending ? null : terminalRequestDecision(request);
  const lifecycleAt = decision?.timestamp ?? request.updatedAt ?? request.createdAt;
  return (
    <tr>
      <td>
        <strong><DateTimeText value={lifecycleAt} /></strong>
        <small>{pending ? requestAge(request.createdAt) : `Requested ${vietnamDateTimeLabel(request.createdAt)}`}</small>
      </td>
      <td><strong><AdminTextLink href={ownerHref(request.ownerType, request.ownerId)}>{request.ownerName ?? shortId(request.ownerId)}</AdminTextLink></strong><small>{humanizeEnum(request.ownerType)}</small></td>
      <td><StatusBadge tone={request.direction === 'CREDIT' ? 'success' : 'warning'}>{directionLabel(request.direction)}</StatusBadge><small>{humanizeEnum(request.adjustmentType)}</small></td>
      <td><strong><MoneyText amount={request.amount} currency={request.currency} /></strong><small>Before <MoneyText amount={request.requestedBeforeBalance} currency={request.currency} /> · After <MoneyText amount={request.requestedAfterBalance} currency={request.currency} /></small></td>
      <td>
        <StatusBadge tone={needsRecreation ? 'danger' : requestStatusTone(request.status)}>
          {needsPolicyMigration
            ? 'Legacy invalid — cannot approve'
            : needsRecreation
              ? 'Recreation required — cannot approve'
              : requestStatusLabel(request.status)}
        </StatusBadge>
        <small>{firstBlocker?.message ?? (pending ? 'Separate finance approval required' : request.decisionReason ?? 'Lifecycle evidence stored')}</small>
      </td>
      <td>
        {decisionAction ? <AdminFormControlLink href={decisionAction.href}>{decisionAction.label}</AdminFormControlLink> : null}
        <span id={detailOpenerId('request', request.id)} tabIndex={-1}><AdminFormControlLink aria-label={`Open details for ${request.ownerName ?? shortId(request.ownerId)} (${shortId(request.id)})`} className="admin-mt-8" href={detailHref}>Open details</AdminFormControlLink></span>
      </td>
    </tr>
  );
}

function RecordEvidencePanel({ closeHref, row }: { readonly closeHref: string; readonly row: AdminManualWalletAdjustmentRow }) {
  const focusCloseHref = detailReturnHref(closeHref, detailOpenerId('record', row.id));
  return (
    <WalletAdjustmentDetailPanel closeHref={focusCloseHref} headingId="wallet-adjustment-record-detail-title">
      <div className="wallet-adjustment-evidence-heading">
        <div>
          <p className="admin-eyebrow">Executed record</p>
          <h2 id="wallet-adjustment-record-detail-title" tabIndex={-1}>Wallet adjustment evidence</h2>
          <p>Review the posting, owner, reason, evidence, and accounting impact without compressing the ledger table.</p>
        </div>
        <AdminFormControlLink href={focusCloseHref}>Close details</AdminFormControlLink>
      </div>
      <dl className="wallet-adjustment-evidence-facts">
        <EvidenceFact label="Ledger ID" value={row.id} />
        <EvidenceFact label="Request / approval ID" value={row.approvalId ?? 'Not stored'} />
        <EvidenceFact label="Wallet owner" value={`${row.ownerLabel} · ${humanizeEnum(row.ownerType)}`} />
        <EvidenceFact label="Owner reference" value={`${row.ownerPhone} · ${row.ownerId}`} />
        <EvidenceFact label="Posted" value={row.createdAt ? new Date(row.createdAt).toLocaleString('en-GB') : 'Not stored'} />
        <EvidenceFact label="Accounting period" value={row.monthlyPeriod ? `${row.monthlyPeriod} · ${row.monthlyPeriodStatus ?? 'Status not stored'}` : 'Not stored'} />
        <EvidenceFact label="Balance before" value={moneyLabel(row.beforeBalance, row.currency)} />
        <EvidenceFact label="Adjustment" value={`${directionLabel(row.direction)} · ${moneyLabel(row.amount, row.currency)}`} />
        <EvidenceFact label="Balance after" value={moneyLabel(row.afterBalance, row.currency)} />
        <EvidenceFact label="Source key" value={row.sourceKey} />
      </dl>
      <div className="wallet-adjustment-evidence-columns">
        <EvidenceNarrative
          caseReference={row.caseReference}
          expectedCorrection={row.expectedCorrection}
          operationalCause={row.operationalCause}
          reason={row.reason}
        />
        <EvidenceAttachment
          attachmentFileId={row.attachmentFileId}
          attachmentUrl={row.attachmentUrl}
          requiresAttachment={false}
        />
      </div>
      <AccountingEntries entries={row.accountingEntries} />
      {row.approvalId ? (
        <AdminFormControlLink className="admin-mt-16" href={`/wallet-adjustments?view=create&reversalOfRequestId=${encodeURIComponent(row.approvalId)}`}>
          Create reversal request
        </AdminFormControlLink>
      ) : null}
    </WalletAdjustmentDetailPanel>
  );
}

function RequestEvidencePanel({ closeHref, request }: { readonly closeHref: string; readonly request: AdminManualWalletAdjustmentRequest }) {
  const blockers = request.preflight?.blockers ?? [];
  const pending = request.status === 'REQUESTED' || !request.status;
  const decision = pending ? null : terminalRequestDecision(request);
  const decisionAction = requestDecisionAction(request);
  const focusCloseHref = detailReturnHref(closeHref, detailOpenerId('request', request.id));
  return (
    <WalletAdjustmentDetailPanel closeHref={focusCloseHref} headingId="wallet-adjustment-request-detail-title">
      <div className="wallet-adjustment-evidence-heading">
        <div>
          <p className="admin-eyebrow">Approval request</p>
          <h2 id="wallet-adjustment-request-detail-title" tabIndex={-1}>Request decision evidence</h2>
          <p>
            {pending
              ? 'Policy blockers are rechecked by the same server guard before approval or cancellation.'
              : 'Stored lifecycle facts are shown as recorded when this request was decided.'}
          </p>
        </div>
        <AdminFormControlLink href={focusCloseHref}>Close details</AdminFormControlLink>
      </div>
      {blockers.length ? (
        <AdminNoticeCard role="alert" tone="danger">
          <div>
            <h3>
              {blockers.some((item) => item.code === 'POLICY_MIGRATION_REQUIRED')
                ? 'Legacy invalid — cannot approve'
                : blockers.some((item) => requestNeedsRecreation(item.code))
                  ? 'Request must be recreated before approval'
                  : 'Approval is blocked'}
            </h3>
            <ul className="wallet-adjustment-blocker-list">
              {blockers.map((item) => <li key={`${item.code}-${item.message}`}><strong>{item.code}</strong><span>{item.message}</span></li>)}
            </ul>
          </div>
        </AdminNoticeCard>
      ) : null}
      <dl className="wallet-adjustment-evidence-facts">
        <EvidenceFact label="Request ID" value={request.id} />
        <EvidenceFact label="Status" value={requestStatusLabel(request.status)} />
        <EvidenceFact label="Wallet owner" value={`${request.ownerName ?? request.ownerId} · ${humanizeEnum(request.ownerType)}`} />
        <EvidenceFact label="Owner reference" value={`${request.ownerMaskedPhone ?? 'Phone masked'} · ${request.ownerReference ?? request.ownerId}`} />
        <EvidenceFact label="Requested" value={new Date(request.createdAt).toLocaleString('en-GB')} />
        <EvidenceFact label="Accounting period" value={request.monthlyPeriod ? `${request.monthlyPeriod} · ${request.monthlyPeriodStatus ?? 'Status not stored'}` : 'Not stored'} />
        <EvidenceFact label="Balance before" value={moneyLabel(request.requestedBeforeBalance, request.currency)} />
        <EvidenceFact label="Adjustment" value={`${directionLabel(request.direction)} · ${moneyLabel(request.amount, request.currency)}`} />
        <EvidenceFact label="Balance after" value={moneyLabel(request.requestedAfterBalance, request.currency)} />
        <EvidenceFact label="Maker" value={request.requestedBy?.fullName ?? request.requestedBy?.email ?? request.requestedByAdminId} />
        <EvidenceFact label="Approver" value={request.approvedBy?.fullName ?? request.approvedBy?.email ?? request.approvedByAdminId ?? 'Not decided'} />
        <EvidenceFact label="Executed ledger" value={request.ledgerEntryId ?? 'No executed ledger'} />
        {decision ? <EvidenceFact label={decision.timestampLabel} value={vietnamDateTimeLabel(decision.timestamp)} /> : null}
        {decision ? <EvidenceFact label="Decision actor" value={decision.actor} /> : null}
        {decision ? <EvidenceFact label="Decision reason" value={request.decisionReason ?? 'Not stored'} /> : null}
      </dl>
      <div className="wallet-adjustment-evidence-columns">
        <EvidenceNarrative
          caseReference={request.caseReference}
          expectedCorrection={request.expectedCorrection}
          operationalCause={request.operationalCause}
          reason={request.reason}
        />
        <EvidenceAttachment
          attachmentFileId={request.attachmentFileId}
          attachmentName={request.attachmentFile?.originalName}
          attachmentUrl={request.attachmentUrl}
          requiresAttachment={request.requiresAttachment}
        />
      </div>
      <AccountingEntries entries={request.accountingPreview} />
      <div className="wallet-adjustment-detail-actions">
        {decisionAction ? <AdminFormControlLink href={decisionAction.href}>{decisionAction.label}</AdminFormControlLink> : null}
        {request.status === 'EXECUTED' && request.ledgerEntryId ? (
          <AdminFormControlLink href={`/wallet-adjustments?view=create&reversalOfRequestId=${encodeURIComponent(request.id)}`}>
            Create reversal request
          </AdminFormControlLink>
        ) : null}
      </div>
    </WalletAdjustmentDetailPanel>
  );
}

function EvidenceFact({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function EvidenceNarrative({ caseReference, expectedCorrection, operationalCause, reason }: {
  readonly caseReference?: string | null;
  readonly expectedCorrection?: string | null;
  readonly operationalCause?: string | null;
  readonly reason?: string | null;
}) {
  return (
    <div className="wallet-adjustment-evidence-group">
      <h3>Operator rationale</h3>
      <dl>
        <EvidenceFact label="Operational cause" value={operationalCause ?? 'Not stored'} />
        <EvidenceFact label="Expected correction" value={expectedCorrection ?? 'Not stored'} />
        <EvidenceFact label="Case reference" value={caseReference ?? 'Not stored'} />
        <EvidenceFact label="Reason" value={reason ?? 'Not stored'} />
      </dl>
    </div>
  );
}

function EvidenceAttachment({ attachmentFileId, attachmentName, attachmentUrl, requiresAttachment }: {
  readonly attachmentFileId?: string | null;
  readonly attachmentName?: string | null;
  readonly attachmentUrl?: string | null;
  readonly requiresAttachment: boolean;
}) {
  return (
    <div className="wallet-adjustment-evidence-group">
      <h3>Private evidence</h3>
      {attachmentFileId ? (
        <>
          <p><strong>{attachmentName ?? 'Finance evidence file'}</strong></p>
          <p className="muted">Internal file ID: {attachmentFileId}</p>
          <AdminFormControlLink href={`/files/${encodeURIComponent(attachmentFileId)}/open`}>
            Open private evidence
          </AdminFormControlLink>
        </>
      ) : safeEvidenceUrl(attachmentUrl) ? (
        <a href={attachmentUrl!} rel="noreferrer" target="_blank">Open legacy HTTPS evidence</a>
      ) : (
        <AdminInlineFallback>{requiresAttachment ? 'Required evidence is missing' : 'No evidence attached'}</AdminInlineFallback>
      )}
    </div>
  );
}

function AccountingEntries({ entries }: { readonly entries?: readonly { accountCredit: string; accountDebit: string; amount: number }[] }) {
  return (
    <div className="wallet-adjustment-accounting-evidence">
      <h3>Accounting entries</h3>
      {entries?.length ? (
        <ul>{entries.map((entry, index) => (
          <li key={`${entry.accountDebit}-${entry.accountCredit}-${index}`}>
            <span>Debit {humanizeEnum(entry.accountDebit)}</span>
            <span>Credit {humanizeEnum(entry.accountCredit)}</span>
            <strong>{moneyLabel(entry.amount, 'VND')}</strong>
          </li>
        ))}</ul>
      ) : <AdminInlineFallback>No accounting preview stored</AdminInlineFallback>}
    </div>
  );
}

function DetailUnavailable({ closeHref, label }: { readonly closeHref: string; readonly label: string }) {
  return (
    <AdminNoticeCard className="admin-mt-16" role="alert" tone="danger">
      <div>
        <h2>Selected {label} is unavailable</h2>
        <p>The row may be outside this page or the source request could not be loaded. This is not an empty evidence record.</p>
        <AdminFormControlLink className="admin-mt-12" href={closeHref}>Close details</AdminFormControlLink>
      </div>
    </AdminNoticeCard>
  );
}

function ExactOwnerFilterChip({ id, view }: { id: string; view: 'records' | 'requests' }) {
  return (
    <div className="wallet-adjustment-exact-filter" role="status">
      <span>Exact owner: <strong>{shortId(id)}</strong></span>
      <AdminTextLink href={`/wallet-adjustments?view=${view}`}>Clear exact owner</AdminTextLink>
    </div>
  );
}

function AppliedFilterSummary({ labels, resetHref }: { readonly labels: readonly string[]; readonly resetHref: string }) {
  if (!labels.length) return null;
  return (
    <div className="wallet-adjustment-applied-filters" role="status">
      <strong>Applied filters</strong>
      <ul aria-label="Applied wallet adjustment filters">
        {labels.map((label) => <li key={label}>{label}</li>)}
      </ul>
      <AdminTextLink href={resetHref}>Clear all filters</AdminTextLink>
    </div>
  );
}

function SectionLoadFailure({ href, label }: { href: string; label: string }) {
  return (
    <AdminNoticeCard role="alert" tone="danger">
      <div>
        <h2>Could not load {label}</h2>
        <p>This is not an empty result. Retry before using this workspace for finance decisions.</p>
        <AdminFormControlLink className="admin-mt-12" href={href}>Try again</AdminFormControlLink>
      </div>
    </AdminNoticeCard>
  );
}

type RecordFilters = {
  adjustmentType: string;
  amountMax: string;
  amountMin: string;
  approverId: string;
  direction: string;
  evidence: string;
  from: string;
  makerId: string;
  ownerId: string;
  ownerType: AdminManualWalletAdjustmentOwnerType | null;
  page: number;
  pageSize: number;
  period: string;
  periodMissing: string;
  q: string;
  sort: string;
  to: string;
};
type RequestFilters = RecordFilters & {
  age: string;
  blocker: string;
  review: RequestReview;
  sort: 'newest' | 'oldest';
  status: AdminManualWalletAdjustmentRequestStatus | null;
};

function recordFilterLabels(filters: RecordFilters) {
  return compactLabels([
    filters.q && `Search: ${filters.q}`,
    filters.ownerType && `Owner: ${humanizeEnum(filters.ownerType)}`,
    filters.period && `Month: ${filters.period}`,
    filters.periodMissing && 'Legacy period missing',
    filters.adjustmentType && `Type: ${humanizeEnum(filters.adjustmentType)}`,
    filters.direction && `Direction: ${humanizeEnum(filters.direction)}`,
    filters.evidence && `Evidence: ${humanizeEnum(filters.evidence)}`,
    filters.from && `From: ${filters.from}`,
    filters.to && `To: ${filters.to}`,
    filters.amountMin && `Minimum: ${filters.amountMin} VND`,
    filters.amountMax && `Maximum: ${filters.amountMax} VND`,
    filters.makerId && `Maker: ${shortId(filters.makerId)}`,
    filters.approverId && `Approver: ${shortId(filters.approverId)}`,
    filters.sort !== 'newest' && `Order: ${humanizeEnum(filters.sort)}`,
    filters.pageSize !== PAGE_SIZE_DEFAULT && `Rows: ${filters.pageSize}`,
  ]);
}

function requestFilterLabels(filters: RequestFilters) {
  const defaultSort = filters.review === 'history' ? 'newest' : 'oldest';
  return compactLabels([
    ...recordFilterLabels({ ...filters, approverId: '', sort: 'newest' }),
    filters.review === 'history' && filters.status && `Status: ${humanizeEnum(filters.status)}`,
    filters.review !== 'aged24h' && filters.age && `Age: ${humanizeEnum(filters.age)}`,
    filters.blocker && `Blocker: ${filters.blocker}`,
    filters.sort !== defaultSort && `Order: ${humanizeEnum(filters.sort)}`,
  ]);
}

function compactLabels(values: readonly (string | false | null | undefined)[]) {
  return values.filter((value): value is string => Boolean(value));
}

function readRecordFilters(params: Record<string, string | string[] | undefined>): RecordFilters {
  return {
    adjustmentType: readParam(params, 'recordAdjustmentType'),
    amountMax: readParam(params, 'recordAmountMax'),
    amountMin: readParam(params, 'recordAmountMin'),
    approverId: readParam(params, 'recordApproverId'),
    direction: readParam(params, 'recordDirection'),
    evidence: readParam(params, 'recordEvidence'),
    from: readParam(params, 'recordFrom'),
    makerId: readParam(params, 'recordMakerId'),
    ownerId: readParam(params, 'recordOwnerId'),
    ownerType: normalizeOwnerType(readParam(params, 'recordOwnerType')),
    page: positiveInt(readParam(params, 'recordPage'), 1),
    pageSize: Math.min(positiveInt(readParam(params, 'recordPageSize'), PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX),
    period: readParam(params, 'recordPeriod'),
    periodMissing: readParam(params, 'recordPeriodMissing'),
    q: readParam(params, 'recordQ'),
    sort: normalizeRecordSort(readParam(params, 'recordSort')),
    to: readParam(params, 'recordTo'),
  };
}

function readRequestFilters(params: Record<string, string | string[] | undefined>): RequestFilters {
  const review = normalizeRequestReview(readParam(params, 'requestReview'));
  const requestedSort = readParam(params, 'requestSort');
  return {
    adjustmentType: readParam(params, 'requestAdjustmentType'),
    age: review === 'aged24h' ? '24h-plus' : readParam(params, 'requestAge'),
    amountMax: readParam(params, 'requestAmountMax'),
    amountMin: readParam(params, 'requestAmountMin'),
    approverId: '',
    blocker: readParam(params, 'requestBlocker'),
    direction: readParam(params, 'requestDirection'),
    evidence: readParam(params, 'requestEvidence'),
    from: readParam(params, 'requestFrom'),
    makerId: readParam(params, 'requestMakerId'),
    ownerId: readParam(params, 'requestOwnerId'),
    ownerType: normalizeOwnerType(readParam(params, 'requestOwnerType')),
    page: positiveInt(readParam(params, 'requestPage'), 1),
    pageSize: Math.min(positiveInt(readParam(params, 'requestPageSize'), PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX),
    period: readParam(params, 'requestPeriod'),
    periodMissing: readParam(params, 'requestPeriodMissing'),
    q: readParam(params, 'requestQ'),
    review,
    sort:
      requestedSort === 'newest' || (requestedSort !== 'oldest' && review === 'history')
        ? 'newest'
        : 'oldest',
    status: normalizeRequestStatus(readParam(params, 'requestStatus')),
    to: readParam(params, 'requestTo'),
  };
}

function recordApiParams(filters: RecordFilters) {
  const params = new URLSearchParams();
  setQuery(params, 'q', filters.q);
  setQuery(params, 'ownerType', filters.ownerType ?? '');
  setQuery(params, 'ownerId', filters.ownerId);
  setQuery(params, 'period', filters.period);
  setQuery(params, 'periodMissing', filters.periodMissing);
  setQuery(params, 'from', filters.from);
  setQuery(params, 'to', filters.to);
  setQuery(params, 'adjustmentType', filters.adjustmentType);
  setQuery(params, 'direction', filters.direction);
  setQuery(params, 'amountMin', filters.amountMin);
  setQuery(params, 'amountMax', filters.amountMax);
  setQuery(params, 'makerId', filters.makerId);
  setQuery(params, 'approverId', filters.approverId);
  setQuery(params, 'evidence', filters.evidence);
  setQuery(params, 'sort', filters.sort === 'newest' ? '' : filters.sort);
  return params;
}

function requestApiParams(filters: RequestFilters) {
  const params = recordApiParams(filters);
  params.set('review', filters.review === 'aged24h' ? 'awaiting' : filters.review);
  if (filters.review === 'history' && filters.status) params.set('status', filters.status);
  setQuery(params, 'age', filters.age);
  setQuery(params, 'blocker', filters.blocker);
  setQuery(params, 'sort', filters.sort === 'oldest' ? '' : filters.sort);
  params.delete('approverId');
  return params;
}

function recordHref(filters: RecordFilters, page: number) {
  return filteredHref('records', filters, page);
}

function recordDetailHref(filters: RecordFilters, page: number, recordId: string) {
  return selectedDetailHref(recordHref(filters, page), 'recordDetailId', recordId);
}

function requestHref(filters: RequestFilters, page: number) {
  const href = new URL(filteredHref('requests', filters, page), 'http://admin.local');
  href.searchParams.set('requestReview', filters.review);
  if (filters.review === 'history' && filters.status) href.searchParams.set('requestStatus', filters.status);
  const defaultSort = filters.review === 'history' ? 'newest' : 'oldest';
  if (filters.sort !== defaultSort) href.searchParams.set('requestSort', filters.sort);
  setQuery(href.searchParams, 'requestAge', filters.age);
  setQuery(href.searchParams, 'requestBlocker', filters.blocker);
  return `${href.pathname}?${href.searchParams.toString()}`;
}

function requestDetailHref(filters: RequestFilters, page: number, requestId: string) {
  return selectedDetailHref(requestHref(filters, page), 'requestDetailId', requestId);
}

function selectedDetailHref(href: string, key: string, id: string) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set(key, id);
  return `${url.pathname}?${url.searchParams.toString()}#wallet-adjustment-detail`;
}

function detailOpenerId(kind: 'record' | 'request', id: string) {
  return `wallet-adjustment-open-${kind}-${id}`;
}

function detailReturnHref(href: string, targetId: string) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set('returnFocus', targetId);
  url.hash = targetId;
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
}

function filteredHref(view: 'records' | 'requests', filters: RecordFilters, page: number) {
  const prefix = view === 'records' ? 'record' : 'request';
  const params = new URLSearchParams({ view });
  setQuery(params, `${prefix}Q`, filters.q);
  if (filters.ownerType) params.set(`${prefix}OwnerType`, filters.ownerType);
  if (filters.ownerId) params.set(`${prefix}OwnerId`, filters.ownerId);
  setQuery(params, `${prefix}Period`, filters.period);
  setQuery(params, `${prefix}PeriodMissing`, filters.periodMissing);
  setQuery(params, `${prefix}From`, filters.from);
  setQuery(params, `${prefix}To`, filters.to);
  setQuery(params, `${prefix}AdjustmentType`, filters.adjustmentType);
  setQuery(params, `${prefix}Direction`, filters.direction);
  setQuery(params, `${prefix}AmountMin`, filters.amountMin);
  setQuery(params, `${prefix}AmountMax`, filters.amountMax);
  setQuery(params, `${prefix}MakerId`, filters.makerId);
  if (view === 'records') setQuery(params, 'recordApproverId', filters.approverId);
  setQuery(params, `${prefix}Evidence`, filters.evidence);
  if (view === 'records' && filters.sort !== 'newest') setQuery(params, 'recordSort', filters.sort);
  if (filters.pageSize !== PAGE_SIZE_DEFAULT) params.set(`${prefix}PageSize`, String(filters.pageSize));
  if (page > 1) params.set(`${prefix}Page`, String(page));
  return `/wallet-adjustments?${params.toString()}`;
}

function setQuery(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function normalizeRecordSort(value: string) {
  return value === 'oldest' || value === 'amount-high' || value === 'amount-low' ? value : 'newest';
}

function paginationState<Row>(rows: readonly Row[], requestedPage: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  return { from: rows.length ? start + 1 : 0, page, rows, to: rows.length ? Math.min(start + rows.length, total) : 0, totalPages };
}

function normalizeView(value: string): WorkspaceView {
  return value === 'records' || value === 'create' ? value : 'requests';
}

function normalizeOwnerType(value: string): AdminManualWalletAdjustmentOwnerType | null {
  return value === 'CUSTOMER' || value === 'PARTNER' ? value : null;
}

function normalizeRequestStatus(value: string): AdminManualWalletAdjustmentRequestStatus | null {
  return value === 'REQUESTED' || value === 'EXECUTED' || value === 'REJECTED' || value === 'CANCELLED' ? value : null;
}

function normalizeRequestReview(value: string): RequestReview {
  return value === 'blocked' || value === 'recreation' || value === 'aged24h' || value === 'history'
    ? value
    : 'awaiting';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function positiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeTotal(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function ownerHref(ownerType: AdminManualWalletAdjustmentOwnerType, ownerId: string) {
  return ownerType === 'CUSTOMER' ? `/customers/${encodeURIComponent(ownerId)}` : `/partners/${encodeURIComponent(ownerId)}`;
}

function directionLabel(direction: string) {
  return direction === 'CREDIT' ? 'Add balance' : 'Deduct balance';
}

function humanizeEnum(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function balanceChange(row: AdminManualWalletAdjustmentRow) {
  if (typeof row.beforeBalance !== 'number' || typeof row.afterBalance !== 'number') return 'Balance snapshot unavailable';
  return `Before ${formatMoney(row.beforeBalance, row.currency)} · After ${formatMoney(row.afterBalance, row.currency)}`;
}

function safeEvidenceUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function moneyLabel(value: number | null | undefined, currency: string) {
  return formatMoney(value, currency, 'Not stored');
}

function requestSavedViewOptions(summary: AdminManualWalletAdjustmentWorkspaceSummary, aged24h: number) {
  return [
    { href: '/wallet-adjustments?view=requests&requestReview=awaiting', label: `All pending · ${safeTotal(summary.awaitingApproval)}`, value: 'awaiting' },
    { href: '/wallet-adjustments?view=requests&requestReview=blocked', label: `Blocked · ${safeTotal(summary.staleOrBlocked)}`, value: 'blocked' },
    { href: '/wallet-adjustments?view=requests&requestReview=recreation', label: `Needs recreation · ${safeTotal(summary.needsRecreation)}`, value: 'recreation' },
    { href: '/wallet-adjustments?view=requests&requestReview=aged24h&requestAge=24h-plus', label: `Aged 24h+ · ${safeTotal(aged24h)}`, value: 'aged24h' },
    { href: '/wallet-adjustments?view=requests&requestReview=history', label: `History · ${safeTotal(summary.history)}`, value: 'history' },
  ] as const;
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

const REQUEST_RECREATION_BLOCKERS = new Set([
  'POLICY_MIGRATION_REQUIRED',
  'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND',
  'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN',
  'WALLET_ADJUSTMENT_PERIOD_REQUIRED',
  'WALLET_BALANCE_CHANGED',
]);

function requestNeedsRecreation(code: string) {
  return REQUEST_RECREATION_BLOCKERS.has(code);
}

function primaryRequestBlocker(
  blockers?: readonly { readonly code: string; readonly message: string }[],
) {
  return blockers?.reduce<(typeof blockers)[number] | undefined>((selected, blocker) => {
    if (!selected) return blocker;
    return requestBlockerPriority(blocker.code) < requestBlockerPriority(selected.code)
      ? blocker
      : selected;
  }, undefined);
}

function requestBlockerPriority(code: string) {
  if (code === 'POLICY_MIGRATION_REQUIRED') return 1;
  if (code === 'WALLET_BALANCE_CHANGED' || code.startsWith('WALLET_ADJUSTMENT_PERIOD_')) return 2;
  if (code === 'ATTACHMENT_REQUIRED' || code === 'REQUEST_INVALID') return 3;
  if (code === 'MAKER_CANNOT_APPROVE' || code === 'FINANCE_APPROVER_REQUIRED') return 5;
  return 4;
}

function requestDecisionAction(request: AdminManualWalletAdjustmentRequest) {
  if (request.status && request.status !== 'REQUESTED') return null;
  const preflight = request.preflight;
  if (!preflight) return null;
  const baseHref = `/finance-tax/approval-queue?view=wallet&requestId=${encodeURIComponent(request.id)}`;
  const needsRecreation = preflight.blockers.some((item) => requestNeedsRecreation(item.code));
  if (preflight.canCancel === true) {
    return { href: `${baseHref}&confirm=cancel-wallet`, label: 'Cancel and recreate' };
  }
  if (preflight.canReject === true && needsRecreation) {
    return { href: baseHref, label: 'Reject in Approval Queue' };
  }
  if (preflight.canApprove === true || preflight.canReject === true) {
    return { href: baseHref, label: 'Review in Approval Queue' };
  }
  return null;
}

function requestAge(createdAt: string) {
  const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours >= 24) return `Pending ${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours) return `Pending ${hours}h`;
  return `Pending ${Math.max(1, Math.floor(elapsed / 60_000))}m`;
}

function requestStatusLabel(status?: AdminManualWalletAdjustmentRequestStatus) {
  if (status === 'EXECUTED') return 'Executed';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Awaiting finance approval';
}

function requestStatusTone(status?: AdminManualWalletAdjustmentRequestStatus): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'EXECUTED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'CANCELLED') return 'neutral';
  return 'warning';
}

function terminalRequestDecision(request: AdminManualWalletAdjustmentRequest) {
  if (request.status === 'EXECUTED') {
    return {
      actor: request.approvedBy?.fullName ?? request.approvedBy?.email ?? request.approvedByAdminId ?? 'Not stored',
      timestamp: request.executedAt,
      timestampLabel: 'Executed at',
    };
  }
  if (request.status === 'REJECTED') {
    return {
      actor: request.rejectedBy?.fullName ?? request.rejectedBy?.email ?? request.rejectedByAdminId ?? 'Not stored',
      timestamp: request.rejectedAt,
      timestampLabel: 'Rejected at',
    };
  }
  return {
    actor: request.requestedBy?.fullName ?? request.requestedBy?.email ?? request.requestedByAdminId,
    timestamp: request.updatedAt,
    timestampLabel: 'Cancelled at',
  };
}

function vietnamDateTimeLabel(value?: string | null) {
  if (!value) return 'Not stored';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not stored';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function emptyPolicy(): AdminManualWalletAdjustmentPolicy {
  return {
    allowedCombinations: [],
    constraints: { amountMax: 0, attachmentRequiredAt: 0, attachmentUrlMaxLength: 0, reasonMaxLength: 0 },
    openPeriodStatuses: [],
    specialFlows: { cashBookingDeduction: 'SETTLEMENT_ROUTE_REQUIRED', manualReversal: 'SOURCE_REQUEST_REQUIRED' },
  };
}

function emptyRequest(): AdminManualWalletAdjustmentRequest {
  return {
    adjustmentType: 'ERROR_CORRECTION',
    amount: 0,
    createdAt: '',
    currency: 'VND',
    direction: 'CREDIT',
    id: '',
    ownerId: '',
    ownerType: 'CUSTOMER',
    reason: '',
    requestedAfterBalance: 0,
    requestedBeforeBalance: 0,
    requestedByAdminId: '',
    requiresAttachment: false,
    status: 'CANCELLED',
  };
}

function emptyRecord(): AdminManualWalletAdjustmentRow {
  return {
    adjustmentType: 'ERROR_CORRECTION',
    amount: 0,
    currency: 'VND',
    direction: 'CREDIT',
    id: '',
    ledgerType: 'ADMIN_ADJUSTMENT',
    ownerId: '',
    ownerLabel: '',
    ownerPhone: 'Phone unavailable',
    ownerType: 'CUSTOMER',
    sourceKey: '',
    walletDelta: 0,
  };
}

function walletAdjustmentNotice(value: string) {
  if (value === 'requested') return { detail: 'The request is waiting for a separate finance approver.', title: 'Approval request created', tone: 'success' as const };
  if (value === 'admin-auth') return { detail: 'Sign in with a finance-authorized admin account and try again.', title: 'Permission required', tone: 'danger' as const };
  if (value) return { detail: 'No request was created. Review the inputs and try again.', title: 'Wallet adjustment failed', tone: 'danger' as const };
  return null;
}
