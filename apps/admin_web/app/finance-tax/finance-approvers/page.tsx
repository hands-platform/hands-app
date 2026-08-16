import { randomUUID } from 'node:crypto';
import { History, RefreshCw, ShieldCheck, UserRoundPlus } from 'lucide-react';

import {
  AdminTablePaginationFooter,
  AdminTableSubstack,
} from '../../../components/admin-data-table';
import { AdminDirectoryFilterForm } from '../../../components/admin-directory-filter-form';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminDisclosure, AdminNoticeCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import {
  adminGetResult,
  type AdminFinanceApproverGovernanceHistoryItem,
  type AdminFinanceApproverGovernanceOperator,
  type AdminFinanceApproverGovernancePage,
  type AdminFinanceApproverGovernanceRequest,
  type AdminFinanceApproverGovernanceSummary,
  type AdminGetResult,
} from '../../../lib/admin-api';
import { FinanceTablePanel } from '../finance-table-panel';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceApproverActionForm } from './finance-approver-action-form';
import { FinanceApproverDrawerShell } from './finance-approver-drawer-shell';
import {
  createFinanceApproverAccessRequest,
  decideFinanceApproverAccessRequest,
} from './actions';

type FinanceApproversPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FinanceApproverView = 'active' | 'eligible' | 'history' | 'pending';
type FinanceApproverSource = 'all' | 'production' | 'test' | 'unknown';

const FINANCE_APPROVERS_PATH = '/finance-tax/finance-approvers';
const PAGE_SIZE = 25;
export default async function FinanceApproversPage({ searchParams }: FinanceApproversPageProps) {
  const params = searchParams ? await searchParams : {};
  const view = readView(params.view);
  const query = readParam(params.q).slice(0, 160);
  const accountStatus = readAccountStatus(params.accountStatus);
  const source = readSource(params.source);
  const page = readPositiveInteger(params.page, 1);
  const skip = (page - 1) * PAGE_SIZE;
  const dialog = readParam(params.dialog);
  const targetUserId = readParam(params.targetUserId);
  const requestId = readParam(params.requestId);
  const returnHref = financeApproverHref({
    accountStatus: view === 'active' || view === 'eligible' ? accountStatus : undefined,
    page,
    query,
    source: view === 'pending' || view === 'history' ? source : undefined,
    view,
  });

  const [summaryResult, viewData] = await Promise.all([
    adminGetResult<AdminFinanceApproverGovernanceSummary | null>(
      '/admin/finance-approver-governance/summary',
      null,
    ),
    loadFinanceApproverView({ accountStatus, query, skip, source, view }),
  ]);
  const summary = summaryResult.ok ? summaryResult.data : null;
  let selectedOperator = viewData.kind === 'operators' && viewData.result.ok
    ? viewData.result.data?.items.find((item) => item.id === targetUserId) ?? null
    : viewData.kind === 'eligible'
      ? [...(viewData.readyResult.data?.items ?? []), ...(viewData.needsResult.data?.items ?? [])]
          .find((item) => item.id === targetUserId) ?? null
      : null;
  let selectedRequest = viewData.kind === 'requests' && viewData.result.ok
    ? viewData.result.data?.items.find((item) => item.id === requestId) ?? null
    : null;
  let deepLinkResult: AdminGetResult<unknown> | null = null;
  if (dialog === 'review' && targetUserId && !selectedOperator) {
    const search = new URLSearchParams({ q: targetUserId, source: 'all', status: 'all', take: '1' });
    const result = await adminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null>(
      `/admin/finance-approver-governance/operators?${search.toString()}`,
      null,
    );
    selectedOperator = result.data?.items.find((item) => item.id === targetUserId) ?? null;
    deepLinkResult = result;
  }
  if (dialog === 'decision' && requestId && !selectedRequest) {
    const search = new URLSearchParams({ q: requestId, source: 'all', status: 'all', take: '1' });
    const result = await adminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceRequest> | null>(
      `/admin/finance-approver-governance/requests?${search.toString()}`,
      null,
    );
    selectedRequest = result.data?.items.find((item) => item.id === requestId) ?? null;
    deepLinkResult = result;
  }

  return (
    <AdminPageTemplate
      actions={
        <div className="finance-approver-header-actions">
          <AdminFormControlLink className="button-secondary" href="/finance-tax/approval-queue">
            <ShieldCheck aria-hidden="true" size={16} />
            View finance approvals
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href={`${FINANCE_APPROVERS_PATH}?view=history`}>
            <History aria-hidden="true" size={16} />
            View role history
          </AdminFormControlLink>
          <AdminFormControlLink
            className={summary?.currentActor.canRequest && summary.eligibleCandidateCount > 0 ? 'button-primary' : 'button-secondary'}
            href={`${FINANCE_APPROVERS_PATH}?view=eligible`}
          >
            <UserRoundPlus aria-hidden="true" size={16} />
            {!summaryResult.ok || !summary
              ? 'View governance requirements'
              : !summary.currentActor.canRequest
                ? 'View governance requirements'
                : summary.eligibleCandidateCount > 0
                  ? 'Request access change'
                  : 'Resolve candidate blockers'}
          </AdminFormControlLink>
        </div>
      }
      description="Manage who may provide the independent second approval for money movement. Access changes require a different role governor."
      title="Finance approval access"
    >
      <FinanceApproverReadiness result={summaryResult} summary={summary} />

      <AdminDisclosure className="finance-approver-help admin-mb-16">
        <summary>How dual control works</summary>
        <p>
          A verified Master Admin submits an access request. A different verified Finance approver who is also a
          Master Admin reviews it. Only an approved request executes the role change, and every step shares one request ID.
        </p>
      </AdminDisclosure>

      <section aria-labelledby="finance-approver-workspace-title" className="finance-approver-workspace">
        <div className="finance-approver-workspace-heading">
          <div>
            <h2 id="finance-approver-workspace-title">Access governance workspace</h2>
            <p className="muted">Search verified operators, review pending work, and trace exact role events.</p>
          </div>
          <AdminFormControlLink className="button-secondary" href={returnHref}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh now
          </AdminFormControlLink>
        </div>

        <AdminSegmentedControl
          activeValue={view}
          ariaLabel="Finance approval access views"
          className="finance-approver-tabs"
          options={[
            { href: financeApproverHref({ view: 'active' }), label: 'Active approvers', value: 'active' },
            { href: financeApproverHref({ view: 'eligible' }), label: 'Eligible operators', value: 'eligible' },
            { href: financeApproverHref({ view: 'pending' }), label: 'Pending requests', value: 'pending' },
            { href: financeApproverHref({ view: 'history' }), label: 'History', value: 'history' },
          ]}
          semantics="navigation"
        />

        <FinanceApproverFilters accountStatus={accountStatus} query={query} source={source} view={view} />
        <FinanceApproverViewContent
          accountStatus={accountStatus}
          page={page}
          query={query}
          source={source}
          summary={summary}
          view={view}
          viewData={viewData}
        />
      </section>

      {dialog === 'review' && selectedOperator ? (
        <FinanceApproverRequestDrawer
          key={`${selectedOperator.id}-${selectedOperator.action.requestedEnabled}`}
          operator={selectedOperator}
          returnFocusHref={financeApproverReviewHref(returnHref, { targetUserId: selectedOperator.id })}
          returnHref={returnHref}
          summary={summary}
          summaryAvailable={summaryResult.ok}
        />
      ) : null}
      {dialog === 'decision' && selectedRequest ? (
        <FinanceApproverDecisionDrawer
          key={selectedRequest.id}
          request={selectedRequest}
          returnFocusHref={financeApproverReviewHref(returnHref, { requestId: selectedRequest.id })}
          returnHref={returnHref}
          summary={summary}
          summaryAvailable={summaryResult.ok}
        />
      ) : null}
      {(dialog === 'review' || dialog === 'decision') && (targetUserId || requestId) && !selectedOperator && !selectedRequest ? (
        <FinanceApproverDeepLinkError
          result={deepLinkResult}
          returnHref={returnHref}
          view={dialog === 'decision' ? 'pending' : view}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function FinanceApproverReadiness({
  result,
  summary,
}: {
  readonly result: AdminGetResult<AdminFinanceApproverGovernanceSummary | null>;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
}) {
  if (!result.ok || !summary) {
    return (
      <AdminNoticeCard className="finance-approver-readiness admin-mb-16" tone="danger">
        <div className="finance-approver-readiness-title">
          <div>
            <h2>Independent approval readiness</h2>
            <p>Finance approval access could not be loaded. No readiness decision was made.</p>
          </div>
          <StatusBadge tone="warning">Unknown</StatusBadge>
        </div>
        <p>{financeApproverReadError(result.status, result.requestId)}</p>
        <AdminFormControlLink className="button-secondary" href={FINANCE_APPROVERS_PATH}>Retry readiness</AdminFormControlLink>
      </AdminNoticeCard>
    );
  }

  const readinessTone = summary.readiness === 'READY' ? 'success' : summary.readiness === 'BLOCKED' ? 'danger' : 'warning';
  return (
    <section aria-labelledby="finance-approver-readiness-title" className="finance-approver-readiness admin-mb-16">
      <div className="finance-approver-readiness-title">
        <div>
          <h2 id="finance-approver-readiness-title">Independent approval readiness</h2>
          <p className="muted">Only verified production operators with independent decision authority count.</p>
        </div>
        <StatusBadge tone={readinessTone}>{humanizeState(summary.readiness)}</StatusBadge>
      </div>
      <dl className="finance-approver-readiness-grid">
        <ReadinessFact
          label="Verified approvers"
          value={`${summary.verifiedRealApproverCount} / ${summary.requiredApproverCount} required`}
        />
        <ReadinessFact label="Independent backup available" value={coverageLabel(summary.backupReady)} />
        <ReadinessFact label="Pending access requests" value={String(summary.pendingRequestCount)} />
        <ReadinessFact label="Ready for request" value={String(summary.eligibleCandidateCount)} />
        <ReadinessFact label="Unattested legacy access" value={String(summary.unattestedLegacyCount)} />
        <ReadinessFact label="Test fixtures excluded" value={String(summary.fixtureExcludedCount)} />
      </dl>
      {summary.blockers.length > 0 ? (
        <div className="finance-approver-readiness-blockers" role="status">
          <strong>Independent approval is blocked</strong>
          <ul>
            {summary.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}
          </ul>
          <p>Verify a separate backup role governor or document a break-glass runbook outside this normal access flow.</p>
        </div>
      ) : null}
      <p className="finance-approver-evaluated muted">
        Policy evaluated by server at <time dateTime={summary.lastEvaluatedAt}>{formatVietnamDateTime(summary.lastEvaluatedAt)}</time>
      </p>
    </section>
  );
}

function ReadinessFact({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function FinanceApproverFilters({
  accountStatus,
  query,
  source,
  view,
}: {
  readonly accountStatus: string;
  readonly query: string;
  readonly source: FinanceApproverSource;
  readonly view: FinanceApproverView;
}) {
  return (
    <AdminDirectoryFilterForm action={FINANCE_APPROVERS_PATH} className="finance-approver-filters" method="get">
      <input name="view" type="hidden" value={view} />
      <AdminFormSearch
        defaultValue={query}
        label="Search by operator name, work email, or operator ID"
        labelVisibility="visible"
        name="q"
        placeholder="Name, work email, or operator ID"
      />
      {view === 'active' || view === 'eligible' ? (
        <AdminFormSelect
          defaultValue={accountStatus}
          label="Account verification"
          labelVisibility="visible"
          name="accountStatus"
          options={[
            { label: 'Production and legacy', value: 'production' },
            { label: 'All account states', value: 'all' },
            { label: 'Status unknown', value: 'unknown' },
            { label: 'Test fixture', value: 'fixture' },
          ]}
        />
      ) : (
        <AdminFormSelect
          defaultValue={source}
          label="Evidence source"
          labelVisibility="visible"
          name="source"
          options={[
            { label: 'Production evidence', value: 'production' },
            { label: 'Test runs only', value: 'test' },
            { label: 'Unknown provenance', value: 'unknown' },
            { label: 'All sources', value: 'all' },
          ]}
        />
      )}
      <div className="finance-approver-filter-actions">
        <AdminFormControlButton className="button-primary" type="submit">Apply filters</AdminFormControlButton>
        <AdminFormControlLink className="button-secondary" href={financeApproverHref({ view })}>Clear</AdminFormControlLink>
      </div>
    </AdminDirectoryFilterForm>
  );
}

function FinanceApproverViewContent({
  accountStatus,
  page,
  query,
  source,
  summary,
  view,
  viewData,
}: {
  readonly accountStatus: string;
  readonly page: number;
  readonly query: string;
  readonly source: FinanceApproverSource;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
  readonly view: FinanceApproverView;
  readonly viewData: FinanceApproverViewData;
}) {
  if (viewData.kind === 'eligible') {
    if (!viewData.readyResult.ok || !viewData.readyResult.data) {
      return <FinanceApproverLoadError accountStatus={accountStatus} page={page} query={query} result={viewData.readyResult} view={view} />;
    }
    if (!viewData.needsResult.ok || !viewData.needsResult.data) {
      return <FinanceApproverLoadError accountStatus={accountStatus} page={page} query={query} result={viewData.needsResult} view={view} />;
    }
    return (
      <div className="finance-approver-eligible-groups">
        <FinanceApproverOperatorTable
          accountStatus={accountStatus}
          page={page}
          query={query}
          result={viewData.readyResult.data}
          summary={summary}
          view="eligible-ready"
        />
        <FinanceApproverOperatorTable
          accountStatus={accountStatus}
          page={page}
          query={query}
          result={viewData.needsResult.data}
          summary={summary}
          view="eligible-needs"
        />
      </div>
    );
  }
  if (viewData.kind === 'operators') {
    if (!viewData.result.ok || !viewData.result.data) {
      return <FinanceApproverLoadError accountStatus={accountStatus} page={page} query={query} result={viewData.result} view={view} />;
    }
    return (
      <FinanceApproverOperatorTable
        accountStatus={accountStatus}
        page={page}
        query={query}
        result={viewData.result.data}
        summary={summary}
        view="active"
      />
    );
  }
  if (viewData.kind === 'requests') {
    if (!viewData.result.ok || !viewData.result.data) {
      return <FinanceApproverLoadError accountStatus={accountStatus} page={page} query={query} result={viewData.result} view={view} />;
    }
    return (
      <FinanceApproverPendingTable page={page} query={query} result={viewData.result.data} source={source} summary={summary} />
    );
  }
  if (!viewData.result.ok || !viewData.result.data) {
    return <FinanceApproverLoadError accountStatus={accountStatus} page={page} query={query} result={viewData.result} view={view} />;
  }
  return <FinanceApproverHistoryTable page={page} query={query} result={viewData.result.data} source={source} summary={summary} />;
}

function FinanceApproverLoadError({
  accountStatus,
  page,
  query,
  result,
  view,
}: {
  readonly accountStatus: string;
  readonly page: number;
  readonly query: string;
  readonly result: AdminGetResult<unknown>;
  readonly view: FinanceApproverView;
}) {
  return (
    <AdminNoticeCard className="finance-approver-list-error" tone="danger">
      <strong>{financeApproverReadErrorTitle(result.status)}</strong>
      <p>{financeApproverReadError(result.status, result.requestId)}</p>
      <AdminFormControlLink className="button-secondary" href={financeApproverHref({ accountStatus, query, view, page })}>
        Retry this view
      </AdminFormControlLink>
    </AdminNoticeCard>
  );
}

function FinanceApproverDeepLinkError({
  result,
  returnHref,
  view,
}: {
  readonly result: AdminGetResult<unknown> | null;
  readonly returnHref: string;
  readonly view: FinanceApproverView;
}) {
  const title = result?.status === 403
    ? 'Access to this record is denied'
    : result?.ok
      ? 'Governance record not found'
      : 'Governance record could not be loaded';
  const detail = result?.status === 403
    ? 'Your current operator access cannot read this target. No empty state was inferred.'
    : result?.ok
      ? 'The requested operator or access request no longer exists in this scope.'
      : financeApproverReadError(result?.status ?? null, result?.requestId);
  return (
    <FinanceApproverDrawerShell returnHref={returnHref} title={title}>
      <AdminNoticeCard tone="danger">
        <strong>{title}</strong>
        <p>{detail}</p>
        <AdminFormControlLink className="button-secondary" href={financeApproverHref({ view })}>
          Back to {view === 'pending' ? 'pending queue' : 'access list'}
        </AdminFormControlLink>
      </AdminNoticeCard>
    </FinanceApproverDrawerShell>
  );
}

function FinanceApproverOperatorTable({
  accountStatus,
  page,
  query,
  result,
  summary,
  view,
}: {
  readonly accountStatus: string;
  readonly page: number;
  readonly query: string;
  readonly result: AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator>;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
  readonly view: 'active' | 'eligible-ready' | 'eligible-needs';
}) {
  const title = view === 'active'
    ? 'Current role holders'
    : view === 'eligible-ready'
      ? 'Ready for request'
      : 'Needs verification';
  const emptyMessage = query || accountStatus !== 'all'
    ? `No ${title.toLowerCase()} match these filters.`
    : view === 'active'
      ? 'No verified Finance approvers are in this list. Readiness remains blocked until independent coverage is verified.'
      : view === 'eligible-ready'
        ? 'No production admins currently satisfy the setup, credential, MFA, and permission checks for a request.'
        : 'No candidate verification work is currently visible in this scope.';
  return (
    <FinanceTablePanel
      grouped
      description={view === 'active'
        ? 'Role holders remain fail-closed until production provenance, setup, credential, MFA, permission, and access evidence all pass.'
        : view === 'eligible-ready'
          ? 'Every row passes the same server policy used before an access request is created.'
          : 'Resolve the first blocker, then re-run the server policy before requesting access.'}
      resultLabel={formatCount(result.totalCount, view === 'active' ? 'role holder' : 'candidate')}
      resultTone={view === 'eligible-ready' && result.totalCount > 0 ? 'success' : result.totalCount > 0 ? 'warning' : 'neutral'}
      title={title}
    >
      <FinanceDataTable
          ariaLabel={`${title} table`}
          emptyMessage={emptyMessage}
          headers={['Operator', 'Account readiness', 'Approval readiness', 'Request status', 'Next action']}
          rowCount={result.items.length}
          scrollClassName="finance-approver-table-wrap"
          tableClassName="finance-approver-table"
        >
          {result.items.map((operator) => {
            const reviewHref = financeApproverReviewHref(
              financeApproverHref({
                accountStatus,
                query,
                view: view === 'active' ? 'active' : 'eligible',
                page,
              }),
              { targetUserId: operator.id },
            );
            return (
              <tr key={operator.id}>
                <td>
                  <AdminTableSubstack>
                    <strong>{operator.fullName || 'Unnamed operator'} {operator.isCurrentActor ? <StatusBadge tone="info">You</StatusBadge> : null}</strong>
                    <span>{operator.email || 'No work email on record'}</span>
                    <span className="finance-approver-source-badge"><SourceBadge runId={operator.fixtureRunId} source={operator.source} /></span>
                  </AdminTableSubstack>
                </td>
                <td>
                  <StatusBadge tone={accountStatusTone(operator.accountStatus)}>{accountStatusLabel(operator.accountStatus)}</StatusBadge>
                  <div className="muted">MFA {operator.mfaVerified ? 'configured' : 'not verified'} · permission v{operator.permissionVersion ?? 'missing'}</div>
                </td>
                <td>
                  <StatusBadge tone={operator.policyBlockers.length === 0 ? 'success' : 'danger'}>
                    {operator.policyBlockers.length === 0 ? 'Ready' : 'Blocked'}
                  </StatusBadge>
                  <div className="muted">
                    {operator.policyBlockers[0]?.message ?? `${financeAccessLabel(operator.financeAccess)} · ${attestationLabel(operator.attestationStatus)}`}
                    {operator.policyBlockers.length > 1 ? ` +${operator.policyBlockers.length - 1}` : ''}
                  </div>
                </td>
                <td>
                  {operator.reviewStatus === 'PENDING' ? <StatusBadge tone="warning">Pending</StatusBadge> : <StatusBadge tone="neutral">None</StatusBadge>}
                  <div className="muted">{operator.lastChangedAt ? `Last changed ${formatVietnamDateTime(operator.lastChangedAt)}` : 'No executed role change'}</div>
                </td>
                <td>
                  <AdminFormControlLink
                    className="button-secondary button-small"
                    href={operator.pendingRequest
                      ? financeApproverReviewHref(financeApproverHref({ view: 'pending' }), { requestId: operator.pendingRequest.id })
                      : reviewHref}
                  >
                    {operator.pendingRequest
                      ? 'Open pending'
                      : view === 'eligible-ready' && summary?.currentActor.canRequest
                        ? 'Request change'
                        : view === 'eligible-needs'
                          ? 'Complete verification'
                          : 'View details'}
                  </AdminFormControlLink>
                  {!summary?.currentActor.canRequest && !operator.pendingRequest ? <div className="muted">View governance requirements</div> : null}
                </td>
              </tr>
            );
          })}
      </FinanceDataTable>
      <FinanceApproverPagination
        accountStatus={accountStatus}
        page={page}
        query={query}
        result={result}
        view={view === 'active' ? 'active' : 'eligible'}
      />
    </FinanceTablePanel>
  );
}

function FinanceApproverPendingTable({
  page,
  query,
  result,
  source,
  summary,
}: {
  readonly page: number;
  readonly query: string;
  readonly result: AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceRequest>;
  readonly source: FinanceApproverSource;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
}) {
  return (
    <FinanceTablePanel
      grouped
      description="Oldest requests appear first. The requester cannot decide their own request."
      resultLabel={formatCount(result.totalCount, 'pending request')}
      resultTone={result.totalCount > 0 ? 'warning' : 'success'}
      title="Pending requests"
    >
      <FinanceDataTable
          ariaLabel="Pending finance access requests table"
          emptyMessage={query ? 'No pending access requests match this search.' : 'No finance approval access requests are waiting for a decision.'}
          headers={['Request', 'Target & change', 'Maker', 'Risk check', 'Assignment', 'Action']}
          rowCount={result.items.length}
          scrollClassName="finance-approver-table-wrap"
          tableClassName="finance-approver-table finance-approver-pending-table"
        >
          {result.items.map((request) => {
            const returnHref = financeApproverHref({ query, source, view: 'pending', page });
            const decisionHref = financeApproverReviewHref(returnHref, { requestId: request.id });
            const isMaker = summary?.currentActor.id === request.requestedByAdminId;
            return (
              <tr key={request.id}>
                <td><AdminTableSubstack><strong>{shortId(request.id)}</strong><span>{formatAge(request.requestedAt)}</span><span className="muted">{formatVietnamDateTime(request.requestedAt)}</span></AdminTableSubstack></td>
                <td className="finance-approver-identity-cell"><AdminTableSubstack><strong>{identityLabel(request.targetUser)}</strong><span>{accessTransition(request.previousEnabled, request.requestedEnabled)}</span><span className="finance-approver-source-badge"><SourceBadge runId={request.sourceReference} source={request.source} /></span></AdminTableSubstack></td>
                <td className="finance-approver-identity-cell">{identityLabel(request.requestedByAdmin)}{isMaker ? <div className="text-danger">You — cannot decide</div> : <div className="muted">Independent from you</div>}</td>
                <td>
                  <StatusBadge tone={request.targetPolicy.ready ? 'success' : 'danger'}>{request.targetPolicy.ready ? 'Pass' : 'Blocked'}</StatusBadge>
                  <div className="muted">{request.targetPolicy.blockers[0]?.message ?? `MFA verified · permission v${request.targetPolicy.permissionVersion ?? 'missing'}`}</div>
                </td>
                <td><span>Not recorded</span><div className="muted">A checker is selected at decision time.</div></td>
                <td>
                  <AdminFormControlLink className="button-secondary button-small" href={decisionHref}>
                    {summary?.currentActor.canDecide && !isMaker ? 'Decide request' : 'View request details'}
                  </AdminFormControlLink>
                  {!summary?.currentActor.canDecide ? <div className="muted">Verified checker access required</div> : null}
                </td>
              </tr>
            );
          })}
      </FinanceDataTable>
      <FinanceApproverPagination page={page} query={query} result={result} source={source} view="pending" />
    </FinanceTablePanel>
  );
}

function FinanceApproverHistoryTable({
  page,
  query,
  result,
  source,
  summary,
}: {
  readonly page: number;
  readonly query: string;
  readonly result: AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceHistoryItem>;
  readonly source: FinanceApproverSource;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
}) {
  return (
    <FinanceTablePanel
      grouped
      description="Only exact finance role request, decision, execution, and blocked actions are included. Page views are excluded."
      resultLabel={formatCount(result.totalCount, 'access request')}
      resultTone="info"
      title="Exact role history"
    >
      {summary?.unattestedLegacyCount ? (
        <AdminNoticeCard tone="danger">
          <strong>Unattested legacy access: {summary.unattestedLegacyCount}</strong>
          <p>These role holders remain blocked from Finance execution until independent owner evidence is approved.</p>
          <AdminFormControlLink className="button-secondary" href={`${FINANCE_APPROVERS_PATH}?view=active&accountStatus=production`}>Review role holders</AdminFormControlLink>
        </AdminNoticeCard>
      ) : null}
      <FinanceDataTable
          ariaLabel="Exact finance approval role history table"
          emptyMessage={query ? 'No exact finance role history matches this search.' : 'No durable finance approval access history has been recorded.'}
          headers={['Time / request', 'Target / change', 'Maker → checker', 'Outcome / reason', 'Source', 'Evidence']}
          rowCount={result.items.length}
          scrollClassName="finance-approver-table-wrap"
          tableClassName="finance-approver-table finance-approver-history-table"
        >
          {result.items.map((request) => (
            <tr key={request.id}>
              <td><AdminTableSubstack><strong>{request.decidedAt ? formatVietnamDateTime(request.decidedAt) : formatVietnamDateTime(request.requestedAt)}</strong><span className="muted">{shortId(request.id)}</span></AdminTableSubstack></td>
              <td className="finance-approver-identity-cell"><AdminTableSubstack><strong>{identityLabel(request.targetUser)}</strong><span>{accessTransition(request.previousEnabled, request.requestedEnabled)}</span></AdminTableSubstack></td>
              <td className="finance-approver-identity-cell">{identityLabel(request.requestedByAdmin)}<div className="muted">→ {request.decidedByAdmin ? identityLabel(request.decidedByAdmin) : 'Awaiting checker'}</div></td>
              <td>
                <StatusBadge tone={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {humanizeState(request.status)}
                </StatusBadge>
                <div className="muted">{request.decidedByAdmin ? identityLabel(request.decidedByAdmin) : 'Awaiting decision'}</div>
                <div className="muted">{request.decisionReason ?? request.operatorReason}</div>
              </td>
              <td><span className="finance-approver-source-badge"><SourceBadge runId={request.sourceReference} source={request.source} /></span></td>
              <td>
                <AdminDisclosure className="finance-approver-history-events">
                  <summary>{formatCount(request.events.length, 'exact event')}</summary>
                  <ol>
                    {request.events.map((event) => (
                      <li key={event.id}>
                        <strong>{auditActionLabel(event.action)}</strong>
                        <span>{identityLabel(event.actor)} · {formatVietnamDateTime(event.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                </AdminDisclosure>
                <AdminFormControlLink className="text-link" href={exactAuditHref(request.id)}>View exact audit</AdminFormControlLink>
              </td>
            </tr>
          ))}
      </FinanceDataTable>
      <FinanceApproverPagination page={page} query={query} result={result} source={source} view="history" />
    </FinanceTablePanel>
  );
}

function FinanceApproverPagination<T>({
  accountStatus,
  page,
  query,
  result,
  source,
  view,
}: {
  readonly accountStatus?: string;
  readonly page: number;
  readonly query: string;
  readonly result: AdminFinanceApproverGovernancePage<T>;
  readonly source?: FinanceApproverSource;
  readonly view: FinanceApproverView;
}) {
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.take));
  const from = result.totalCount === 0 ? 0 : result.skip + 1;
  const to = Math.min(result.skip + result.items.length, result.totalCount);
  return (
    <AdminTablePaginationFooter
      activePage={Math.min(page, totalPages)}
      ariaLabel={`${view} finance access pagination`}
      from={from}
      hrefForPage={(nextPage) => financeApproverHref({ accountStatus, query, source, view, page: nextPage })}
      itemLabel="records"
      to={to}
      totalPages={totalPages}
      totalRows={result.totalCount}
    />
  );
}

function FinanceApproverRequestDrawer({
  operator,
  returnFocusHref,
  returnHref,
  summary,
  summaryAvailable,
}: {
  readonly operator: AdminFinanceApproverGovernanceOperator;
  readonly returnFocusHref: string;
  readonly returnHref: string;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
  readonly summaryAvailable: boolean;
}) {
  const name = operator.fullName || operator.email || operator.id;
  const canSubmit = summaryAvailable && Boolean(summary?.currentActor.canRequest) && operator.action.allowed;
  const blockers = [
    ...(!summaryAvailable ? [{ code: 'SUMMARY_UNAVAILABLE', message: 'Readiness is unknown because the governance summary could not be loaded.' }] : []),
    ...(!summary?.currentActor.canRequest ? [{ code: 'REQUEST_PERMISSION_REQUIRED', message: 'Verified Master Admin request permission is required.' }] : []),
    ...operator.action.blockers,
  ];
  return (
    <FinanceApproverDrawerShell returnFocusHref={returnFocusHref} returnHref={returnHref} title={`Review ${name}'s access`}>
      <FinanceApproverReviewSummary
        accountStatus={accountStatusLabel(operator.accountStatus)}
        currentAccess={financeAccessLabel(operator.financeAccess)}
        operatorId={operator.id}
        operatorName={name}
        proposedAccess={operator.action.requestedEnabled ? 'Finance approver' : 'No independent approval authority'}
      />
      <section aria-labelledby="finance-approver-preflight-title" className="finance-approver-drawer-section">
        <h3 id="finance-approver-preflight-title">Policy preflight</h3>
        <ul className="finance-approver-preflight-list">
          <PreflightItem label="Target is not the current operator" passed={!operator.isCurrentActor} />
          <PreflightItem label="Production account and operator authentication verified" passed={operator.accountStatus === 'ACTIVE'} />
          <PreflightItem label="No duplicate pending request" passed={operator.reviewStatus !== 'PENDING'} />
          <PreflightItem label="Different role governor available" passed={!hasBlocker(operator, 'INDEPENDENT_ROLE_GOVERNOR_REQUIRED')} />
          <PreflightItem label="Primary and backup remain after removal" passed={!hasBlocker(operator, 'MINIMUM_APPROVER_COVERAGE_REQUIRED')} />
          <PreflightItem label="Current target permission version recorded" passed={operator.permissionVersion !== null} />
        </ul>
        <p className="muted">Target state and minimum coverage are checked again inside the decision transaction.</p>
      </section>
      <section aria-labelledby="finance-approver-impact-title" className="finance-approver-drawer-section">
        <h3 id="finance-approver-impact-title">Impact and reassignment</h3>
        <dl className="finance-approver-review-grid">
          <div><dt>Access effect</dt><dd>{operator.action.requestedEnabled ? 'May independently approve money actions submitted by another admin.' : 'Loses independent finance decision authority. Existing work ownership is not asserted by this governance view.'}</dd></div>
        </dl>
      </section>
      {!canSubmit ? (
        <AdminNoticeCard tone="danger">
          <strong>Access request blocked</strong>
          <ul>{dedupeBlockers(blockers).map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>
          <p>No role or request state changed.</p>
        </AdminNoticeCard>
      ) : (
        <FinanceApproverActionForm
          action={createFinanceApproverAccessRequest}
          cancelHref={returnHref}
          mode="request"
          operatorName={name}
        >
          <input name="targetUserId" type="hidden" value={operator.id} />
          <input name="requestedEnabled" type="hidden" value={String(operator.action.requestedEnabled)} />
          <input name="idempotencyKey" type="hidden" value={`finance-access:${randomUUID()}`} />
          <section aria-labelledby="finance-approver-request-summary-title" className="finance-approver-drawer-section">
            <h3 id="finance-approver-request-summary-title">Request summary</h3>
            <p>{accessTransition(operator.financeAccess === 'APPROVER', operator.action.requestedEnabled)} for {name}.</p>
            <p className="muted">Submission creates a pending request. It does not change the role.</p>
          </section>
        </FinanceApproverActionForm>
      )}
    </FinanceApproverDrawerShell>
  );
}

function FinanceApproverDecisionDrawer({
  request,
  returnFocusHref,
  returnHref,
  summary,
  summaryAvailable,
}: {
  readonly request: AdminFinanceApproverGovernanceRequest;
  readonly returnFocusHref: string;
  readonly returnHref: string;
  readonly summary: AdminFinanceApproverGovernanceSummary | null;
  readonly summaryAvailable: boolean;
}) {
  const targetName = identityLabel(request.targetUser);
  const isMaker = summary?.currentActor.id === request.requestedByAdminId;
  const canDecide = summaryAvailable && Boolean(summary?.currentActor.canDecide) && !isMaker;
  return (
    <FinanceApproverDrawerShell returnFocusHref={returnFocusHref} returnHref={returnHref} title={`Decide ${shortId(request.id)}`}>
      <FinanceApproverReviewSummary
        accountStatus={`${humanizeState(request.targetPolicy.credentialState)} · MFA ${request.targetPolicy.mfaVerified ? 'verified' : 'not verified'}`}
        currentAccess={request.previousEnabled ? 'Finance approver' : 'No independent approval authority'}
        operatorId={request.targetUserId}
        operatorName={targetName}
        proposedAccess={request.requestedEnabled ? 'Finance approver' : 'No independent approval authority'}
      />
      <section aria-labelledby="finance-approver-request-evidence-title" className="finance-approver-drawer-section">
        <h3 id="finance-approver-request-evidence-title">Request evidence</h3>
        <dl className="finance-approver-review-grid">
          <div><dt>Request ID</dt><dd>{request.id}</dd></div>
          <div><dt>Requester</dt><dd>{identityLabel(request.requestedByAdmin)}{isMaker ? ' (You)' : ''}</dd></div>
          <div><dt>Requested</dt><dd>{formatVietnamDateTime(request.requestedAt)}</dd></div>
          <div><dt>Operator reason</dt><dd>{request.operatorReason}</dd></div>
          <div><dt>Source</dt><dd className="finance-approver-source-badge"><SourceBadge runId={request.sourceReference} source={request.source} /></dd></div>
          <div><dt>Permission version</dt><dd>{request.targetPolicy.permissionVersion ?? 'Missing'}</dd></div>
          <div><dt>Attestation</dt><dd>{attestationLabel(request.targetPolicy.attestationStatus)}</dd></div>
          <div><dt>Current policy</dt><dd>{request.targetPolicy.ready ? 'Ready for independent review' : request.targetPolicy.blockers[0]?.message ?? 'Blocked'}</dd></div>
        </dl>
      </section>
      {!canDecide ? (
        <AdminNoticeCard tone="danger">
          <strong>Independent decision unavailable</strong>
          <p>{!summaryAvailable
            ? 'Readiness is unknown because the governance summary could not be loaded.'
            : isMaker
              ? 'The requester cannot decide this access request. Ask a different verified role governor.'
              : 'Verified Finance approver and Master Admin decision permission is required.'}</p>
          <p>No role or request state changed.</p>
        </AdminNoticeCard>
      ) : (
        <FinanceApproverActionForm
          action={decideFinanceApproverAccessRequest}
          cancelHref={returnHref}
          mode="decision"
          operatorName={targetName}
        >
          <input name="requestId" type="hidden" value={request.id} />
        </FinanceApproverActionForm>
      )}
    </FinanceApproverDrawerShell>
  );
}

function FinanceApproverReviewSummary({
  accountStatus,
  currentAccess,
  operatorId,
  operatorName,
  proposedAccess,
}: {
  readonly accountStatus: string;
  readonly currentAccess: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly proposedAccess: string;
}) {
  return (
    <section aria-labelledby="finance-approver-target-title" className="finance-approver-drawer-section">
      <h3 id="finance-approver-target-title">Target and proposed access</h3>
      <dl className="finance-approver-review-grid">
        <div><dt>Operator</dt><dd>{operatorName}</dd></div>
        <div><dt>Operator ID</dt><dd>{operatorId}</dd></div>
        <div><dt>Account status</dt><dd>{accountStatus}</dd></div>
        <div><dt>Current access</dt><dd>{currentAccess}</dd></div>
        <div><dt>Proposed access</dt><dd>{proposedAccess}</dd></div>
      </dl>
    </section>
  );
}

function PreflightItem({ label, passed }: { readonly label: string; readonly passed: boolean | null }) {
  return (
    <li>
      <StatusBadge tone={passed === null ? 'warning' : passed ? 'success' : 'danger'}>
        {passed === null ? 'Server rechecks' : passed ? 'Pass' : 'Blocked'}
      </StatusBadge>
      <span>{label}</span>
    </li>
  );
}

type FinanceApproverViewData =
  | {
      kind: 'eligible';
      needsResult: AdminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null>;
      readyResult: AdminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null>;
    }
  | { kind: 'history'; result: AdminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceHistoryItem> | null> }
  | { kind: 'operators'; result: AdminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null> }
  | { kind: 'requests'; result: AdminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceRequest> | null> };

async function loadFinanceApproverView({
  accountStatus,
  query,
  skip,
  source,
  view,
}: {
  readonly accountStatus: string;
  readonly query: string;
  readonly skip: number;
  readonly source: FinanceApproverSource;
  readonly view: FinanceApproverView;
}): Promise<FinanceApproverViewData> {
  const search = new URLSearchParams({ skip: String(skip), take: String(PAGE_SIZE) });
  if (query) search.set('q', query);
  if (view === 'eligible') {
    search.set('access', view);
    if (accountStatus !== 'all') search.set('status', accountStatus);
    const readySearch = new URLSearchParams(search);
    readySearch.set('readiness', 'ready');
    const needsSearch = new URLSearchParams(search);
    needsSearch.set('readiness', 'needs');
    const [readyResult, needsResult] = await Promise.all([
      adminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null>(
        `/admin/finance-approver-governance/operators?${readySearch.toString()}`,
        null,
      ),
      adminGetResult<AdminFinanceApproverGovernancePage<AdminFinanceApproverGovernanceOperator> | null>(
        `/admin/finance-approver-governance/operators?${needsSearch.toString()}`,
        null,
      ),
    ]);
    return { kind: 'eligible', needsResult, readyResult };
  }
  if (view === 'active') {
    search.set('access', view);
    if (accountStatus !== 'all') search.set('status', accountStatus);
    return {
      kind: 'operators',
      result: await adminGetResult(`/admin/finance-approver-governance/operators?${search.toString()}`, null),
    };
  }
  if (view === 'pending') {
    search.set('status', 'PENDING');
    search.set('source', source);
    return {
      kind: 'requests',
      result: await adminGetResult(`/admin/finance-approver-governance/requests?${search.toString()}`, null),
    };
  }
  search.set('source', source);
  return {
    kind: 'history',
    result: await adminGetResult(`/admin/finance-approver-governance/history?${search.toString()}`, null),
  };
}

function financeApproverHref({
  accountStatus,
  page,
  query,
  source,
  view,
}: {
  readonly accountStatus?: string;
  readonly page?: number;
  readonly query?: string;
  readonly source?: FinanceApproverSource;
  readonly view: FinanceApproverView;
}) {
  const search = new URLSearchParams({ view });
  if (query) search.set('q', query);
  if (accountStatus && accountStatus !== 'all') search.set('accountStatus', accountStatus);
  if (source && source !== 'production') search.set('source', source);
  if (page && page > 1) search.set('page', String(page));
  return `${FINANCE_APPROVERS_PATH}?${search.toString()}`;
}

function financeApproverReviewHref(
  returnHref: string,
  input: { readonly requestId?: string; readonly targetUserId?: string },
) {
  const url = new URL(returnHref, 'http://admin.local');
  url.searchParams.set('dialog', input.requestId ? 'decision' : 'review');
  if (input.requestId) url.searchParams.set('requestId', input.requestId);
  if (input.targetUserId) url.searchParams.set('targetUserId', input.targetUserId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function exactAuditHref(requestId: string) {
  const search = new URLSearchParams({
    range: 'all',
    sort: 'oldest',
    targetPrefix: `finance_approver_request:${requestId}`,
  });
  return `/audit-log?${search.toString()}`;
}

function hasBlocker(operator: AdminFinanceApproverGovernanceOperator, code: string) {
  return operator.action.blockers.some((blocker) => blocker.code === code);
}

function dedupeBlockers(blockers: Array<{ code: string; message: string }>) {
  return blockers.filter((blocker, index) => blockers.findIndex((candidate) => candidate.code === blocker.code) === index);
}

function readView(value: string | string[] | undefined): FinanceApproverView {
  const view = readParam(value);
  return view === 'eligible' || view === 'pending' || view === 'history' ? view : 'active';
}

function readAccountStatus(value: string | string[] | undefined) {
  const status = readParam(value);
  if (status === 'all' || status === 'fixture' || status === 'unknown') return status;
  return 'production';
}

function readSource(value: string | string[] | undefined): FinanceApproverSource {
  const source = readParam(value);
  return source === 'all' || source === 'test' || source === 'unknown' ? source : 'production';
}

function readPositiveInteger(value: string | string[] | undefined, fallback: number) {
  const parsed = Number.parseInt(readParam(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function financeApproverReadErrorTitle(status: number | null) {
  if (status === 401) return 'Admin session expired';
  if (status === 403) return 'Finance access governance is read-only';
  if (status === 429) return 'Finance access requests are rate limited';
  return 'Finance approval access could not be loaded';
}

function financeApproverReadError(status: number | null, requestId?: string | null) {
  if (status === 401) return 'Sign in again before using this controlled access workspace.';
  if (status === 403) return 'Your role cannot read this governance data. Ask a Master Admin or System Audit operator.';
  if (status === 429) return 'Wait briefly, then retry this view. No empty result was inferred.';
  const suffix = requestId ? ` Request ID: ${requestId}.` : '';
  return `Retry before making any readiness or access decision. This is not an empty result.${suffix}`;
}

function accountStatusLabel(status: AdminFinanceApproverGovernanceOperator['accountStatus']) {
  if (status === 'ACTIVE') return 'Credential active';
  if (status === 'TEST_FIXTURE') return 'Test fixture';
  if (status === 'SETUP_INCOMPLETE') return 'Setup incomplete';
  if (status === 'DISABLED') return 'Credential disabled';
  if (status === 'LOCKED') return 'Account locked';
  return 'Credential missing';
}

function accountStatusTone(status: AdminFinanceApproverGovernanceOperator['accountStatus']) {
  return status === 'ACTIVE' ? 'success' as const : status === 'TEST_FIXTURE' ? 'warning' as const : 'danger' as const;
}

function SourceBadge({
  runId,
  source,
}: {
  readonly runId: string | null;
  readonly source: AdminFinanceApproverGovernanceOperator['source'];
}) {
  const label = source === 'TEST_RUN'
    ? `TEST RUN${runId ? ` · ${runId}` : ''}`
    : source === 'FIXTURE'
      ? 'FIXTURE'
      : source === 'LEGACY'
        ? 'LEGACY'
        : source === 'PRODUCTION'
          ? 'PRODUCTION'
          : 'UNKNOWN';
  const tone = source === 'PRODUCTION' ? 'success' : source === 'LEGACY' ? 'warning' : source === 'UNKNOWN' ? 'danger' : 'neutral';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function attestationLabel(status: AdminFinanceApproverGovernanceOperator['attestationStatus']) {
  if (status === 'GOVERNED_WORKFLOW') return 'Governed access evidence';
  if (status === 'ATTESTED') return 'Legacy owner attested';
  if (status === 'UNATTESTED') return 'Legacy owner unattested';
  return 'Attestation not required';
}

function formatAge(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Age unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

function financeAccessLabel(access: AdminFinanceApproverGovernanceOperator['financeAccess']) {
  return access === 'APPROVER' ? 'Finance approver' : 'No independent approval authority';
}

function coverageLabel(value: boolean | null) {
  return value === null ? 'Unknown' : value ? 'Ready' : 'Missing';
}

function humanizeState(value: string) {
  return value.toLowerCase().replace(/_/gu, ' ').replace(/^./u, (letter) => letter.toUpperCase());
}

function formatCount(count: number, singular: string) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : `${singular}s`}`;
}

function identityLabel(identity: { email: string | null; fullName: string | null; id: string }) {
  return identity.fullName || identity.email || identity.id;
}

function accessTransition(previousEnabled: boolean, requestedEnabled: boolean) {
  const before = previousEnabled ? 'Finance approver' : 'No independent approval authority';
  const after = requestedEnabled ? 'Finance approver' : 'No independent approval authority';
  return `${before} → ${after}`;
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function auditActionLabel(action: string) {
  const token = action.split('.').at(-1) ?? action;
  return humanizeState(token);
}

function formatVietnamDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
