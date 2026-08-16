import { randomUUID } from 'node:crypto';

import {
  AdminAuditLog,
  AdminEarning,
  AdminServiceCatalogGroup,
  AdminTaxPolicyCapabilities,
  AdminTaxPolicyApprovalRequest,
  AdminTaxPolicyApprovalRequestPage,
  AdminTaxPolicyAuditLogPage,
  AdminTaxPolicyIntegritySummary,
  AdminTaxPolicyIntegrityRecordPage,
  AdminTaxPolicySimulation,
  AdminTaxPolicyVersion,
  AdminTaxPolicyVersionPage,
  AdminTaxPolicyWorkspaceSummary,
  AdminTaxRule,
  adminGetResult,
} from '../../lib/admin-api';
import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormCheckbox,
  AdminFormDate,
  AdminFormDateTime,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminDisclosure, AdminInsightCard, AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { CommandCopyButton } from '../../components/command-copy-button';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import {
  createTaxPolicyVersion,
  createTaxRule,
  decideTaxPolicyApprovalRequest,
  submitTaxPolicyApprovalRequest,
  updateTaxPolicyVersion,
  updateTaxRule,
} from './actions';
import { buildTaxPolicyAuditSummary } from './tax-policy-audit-summary';
import { taxPolicyNotice } from './tax-policy-notice';
import {
  buildTaxPolicyEditorHref,
  buildTaxPolicyLoadPlan,
  buildTaxPolicyPageHref,
  type TaxPolicyView,
} from './tax-policy-page-model';
import { buildTaxPolicySnapshotConsistency } from './tax-policy-snapshot-consistency';
import { isoToVietnamDateTimeLocal } from './tax-policy-time';
import { TaxPolicyActionForm, TaxPolicyFieldMessage } from './tax-policy-action-form';
import { TaxPolicyHashFocus } from './tax-policy-hash-focus';

const EMPTY_POLICY_PAGE: AdminTaxPolicyVersionPage = { items: [], total: 0, skip: 0, take: 25 };
const EMPTY_APPROVAL_PAGE: AdminTaxPolicyApprovalRequestPage = { items: [], total: 0, skip: 0, take: 25 };
const EMPTY_AUDIT_PAGE: AdminTaxPolicyAuditLogPage = { items: [], total: 0, skip: 0, take: 25 };
const EMPTY_INTEGRITY_SUMMARY: AdminTaxPolicyIntegritySummary = {
  generatedAt: '',
  range: '30d',
  rangeStart: '',
  total: 0,
  recordIntegrity: {
    healthy: 0,
    amountMismatch: 0,
    missingTaxLog: 0,
    missingSnapshot: 0,
    oldestAmountMismatch: null,
    oldestMissingTaxLog: null,
    oldestMissingSnapshot: null,
  },
  taxApplicability: {
    noActivePolicy: 0,
    noApprovedTaxProfile: 0,
    noMatchingRule: 0,
    oldestNoActivePolicy: null,
    oldestNoApprovedTaxProfile: null,
    oldestNoMatchingRule: null,
  },
};
const EMPTY_CAPABILITIES: AdminTaxPolicyCapabilities = {
  actorId: '',
  canDecide: false,
  canDraft: false,
  canSubmit: false,
  decisionBlockers: [{ code: 'CAPABILITY_UNAVAILABLE', message: 'Decision capability could not be verified.' }],
  draftBlockers: [{ code: 'CAPABILITY_UNAVAILABLE', message: 'Draft capability could not be verified.' }],
  generatedAt: '',
  independentCheckerCount: 0,
  source: 'UNKNOWN',
  submitBlockers: [{ code: 'CAPABILITY_UNAVAILABLE', message: 'Submission capability could not be verified.' }],
  warning: 'Operator capability could not be verified.',
};
const EMPTY_WORKSPACE_SUMMARY: AdminTaxPolicyWorkspaceSummary = {
  generatedAt: '',
  drafts: { needsAuthor: 0, awaitingChecker: 0, approved: 0, scheduled: 0 },
  history: { production: 0, testOrLegacy: 0 },
  nextScheduled: null,
};
const EMPTY_INTEGRITY_RECORDS: AdminTaxPolicyIntegrityRecordPage = {
  generatedAt: '', issue: '', items: [], skip: 0, sort: 'oldest', source: 'all', take: 25, total: 0,
};
const scopeOptions = [
  { label: 'Fallback — all services', value: 'DEFAULT' },
  { label: 'Specific service', value: 'SERVICE_TYPE' },
  { label: 'Gross amount range', value: 'AMOUNT_BAND' },
];
const integritySourceOptions = [
  { label: 'All evidence sources', value: 'all' },
  { label: 'Production / operator', value: 'production' },
  { label: 'Test / smoke', value: 'test' },
  { label: 'Legacy / migration', value: 'legacy' },
  { label: 'Unknown provenance', value: 'unknown' },
];

type TaxPolicyPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TaxPolicyPage({ searchParams }: { searchParams?: TaxPolicyPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const plan = buildTaxPolicyLoadPlan(params);
  const requestedPolicyId = readParam(params, 'policyId') ?? readParam(params, 'clonePolicyId');

  const [
    currentResult,
    workspaceResult,
    selectedResult,
    approvalResult,
    auditResult,
    auditEventResult,
    integritySummaryResult,
    integrityRecordsResult,
    earningsResult,
    servicesResult,
    capabilityResult,
    workspaceSummaryResult,
  ] =
    await Promise.all([
      adminGetResult(plan.currentPolicyHref, EMPTY_POLICY_PAGE),
      plan.workspacePoliciesHref
        ? adminGetResult(plan.workspacePoliciesHref, EMPTY_POLICY_PAGE)
        : Promise.resolve(successResult(EMPTY_POLICY_PAGE)),
      plan.selectedPolicyHref
        ? adminGetResult(plan.selectedPolicyHref, EMPTY_POLICY_PAGE)
        : Promise.resolve(successResult(EMPTY_POLICY_PAGE)),
      plan.approvalRequestsHref
        ? adminGetResult(plan.approvalRequestsHref, EMPTY_APPROVAL_PAGE)
        : Promise.resolve(successResult(EMPTY_APPROVAL_PAGE)),
      plan.auditLogsHref
        ? adminGetResult(plan.auditLogsHref, EMPTY_AUDIT_PAGE)
        : Promise.resolve(successResult(EMPTY_AUDIT_PAGE)),
      plan.auditEventHref
        ? adminGetResult(plan.auditEventHref, EMPTY_AUDIT_PAGE)
        : Promise.resolve(successResult(EMPTY_AUDIT_PAGE)),
      plan.integritySummaryHref
        ? adminGetResult(plan.integritySummaryHref, EMPTY_INTEGRITY_SUMMARY)
        : Promise.resolve(successResult(EMPTY_INTEGRITY_SUMMARY)),
      plan.integrityRecordsHref
        ? adminGetResult(plan.integrityRecordsHref, EMPTY_INTEGRITY_RECORDS)
        : Promise.resolve(successResult(EMPTY_INTEGRITY_RECORDS)),
      plan.recentEarningsHref
        ? adminGetResult<AdminEarning[]>(plan.recentEarningsHref, [])
        : Promise.resolve(successResult<AdminEarning[]>([])),
      plan.view === 'drafts'
        ? adminGetResult<AdminServiceCatalogGroup[]>('/admin/services/groups?scope=operational', [])
        : Promise.resolve(successResult<AdminServiceCatalogGroup[]>([])),
      adminGetResult(plan.capabilityHref, EMPTY_CAPABILITIES),
      adminGetResult(plan.workspaceSummaryHref, EMPTY_WORKSPACE_SUMMARY),
    ]);

  const currentPolicy = currentResult.data.items[0] ?? null;
  const workspacePolicies = workspaceResult.data.items;
  const selectedPolicy = requestedPolicyId
    ? selectedResult.data.items.find((policy) => policy.id === requestedPolicyId) ?? null
    : plan.view === 'drafts'
      ? workspacePolicies[0] ?? null
      : null;
  const serviceOptions = taxPolicyServiceOptions(servicesResult.data);
  const simulationService = readParam(params, 'simulationService') ?? serviceOptions[0]?.value ?? 'leg_massage';
  const simulationAmount = simulationGrossAmount(readParam(params, 'simulationAmount'));
  const [currentSimulationResult, proposedSimulationResult] = selectedPolicy
    ? await Promise.all([
        currentPolicy
          ? adminGetResult<AdminTaxPolicySimulation | null>(
              taxPolicySimulationHref(currentPolicy.id, simulationService, simulationAmount),
              null,
            )
          : Promise.resolve(successResult<AdminTaxPolicySimulation | null>(null)),
        adminGetResult<AdminTaxPolicySimulation | null>(
          taxPolicySimulationHref(selectedPolicy.id, simulationService, simulationAmount),
          null,
        ),
      ])
    : [
        successResult<AdminTaxPolicySimulation | null>(null),
        successResult<AdminTaxPolicySimulation | null>(null),
      ];
  const nextScheduled = workspaceSummaryResult.data.nextScheduled;
  const notice = taxPolicyNotice(params);
  const readiness = taxPolicyReadiness(currentPolicy);
  const hasReadFailure = !currentResult.ok || !workspaceResult.ok || !selectedResult.ok || !workspaceSummaryResult.ok;

  return (
    <AdminPageTemplate
      actions={
        <>
          {capabilityResult.ok && capabilityResult.data.canDraft ? (
            <AdminFormControlLink className="button-secondary" href="/tax-policy?view=drafts#create-tax-policy">
              Prepare production draft
            </AdminFormControlLink>
          ) : null}
          <AdminFormControlLink className="button-outline" href="/finance-tax/partner-withholding-tax">
            Open withholding records
          </AdminFormControlLink>
        </>
      }
      contentClassName="tax-policy-page"
      description="Prepare, review, schedule, and audit Vietnam Partner withholding policy without changing retained financial history."
      title="Tax Policy Control"
    >
      <TaxPolicyHashFocus />
      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role={notice.tone === 'danger' ? 'alert' : 'status'} tone={notice.tone}>
          <AdminSectionHeader
            actions={<StatusBadge tone={notice.tone === 'danger' ? 'danger' : 'success'}>{notice.badge}</StatusBadge>}
            description={notice.detail}
            title={notice.title}
          />
        </AdminNoticeCard>
      ) : null}

      {hasReadFailure ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <AdminSectionHeader
            actions={<AdminFormControlLink className="button-outline" href={`/tax-policy?view=${plan.view}`}>Retry</AdminFormControlLink>}
            description="One or more Tax Policy sources could not be loaded. No missing records are being represented as zero."
            title="Tax Policy data is incomplete"
          />
        </AdminNoticeCard>
      ) : null}

      {capabilityResult.data.source !== 'PRODUCTION' ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="warning">
          <strong>Test environment or fixture identity</strong>
          <p className="muted">{capabilityResult.data.warning ?? 'Production Tax Policy actions are disabled for this identity.'}</p>
        </AdminNoticeCard>
      ) : null}

      {plan.view === 'current' ? (
        <AdminSection
          actions={<StatusBadge tone={readiness.tone}>{readiness.label}</StatusBadge>}
          className="admin-mb-16 tax-policy-command-strip"
          description={readiness.detail}
          title={currentPolicy?.name ?? 'No policy currently in effect'}
        >
          <div className="tax-policy-command-grid">
            <CommandFact label="Provenance" value={provenanceLabel(currentPolicy?.provenance)} />
            <CommandFact label="In effect since" value={currentPolicy ? vietnamDateTimeLabel(currentPolicy.effectiveFrom) : 'Unavailable'} />
            <CommandFact label="Withholding" value={policyRateSummary(currentPolicy)} />
            <CommandFact label="Legal source" value={currentPolicy?.legalSourceTitle ?? 'Missing'} />
            <CommandFact label="Approval receipt" value={currentPolicy?.approvedAt ? vietnamDateTimeLabel(currentPolicy.approvedAt) : 'Not recorded'} />
            <CommandFact
              label="Next scheduled"
              value={!workspaceSummaryResult.ok
                ? 'Unavailable'
                : nextScheduled
                  ? `${nextScheduled.name} · ${vietnamDateTimeLabel(nextScheduled.effectiveFrom)}`
                  : 'None scheduled'}
            />
          </div>
          {currentPolicy?.provenance && currentPolicy.provenance !== 'OPERATOR' ? (
            <AdminNoticeCard className="admin-mt-12" role="alert" tone="danger">
              <strong>Critical — {provenanceLabel(currentPolicy.provenance)} policy is controlling live withholding</strong>
              <p className="muted">Do not edit or delete this referenced policy. Prepare a clean production draft, complete maker-checker review, and schedule activation.</p>
            </AdminNoticeCard>
          ) : null}
        </AdminSection>
      ) : (
        <AdminNoticeCard className="admin-mb-16 tax-policy-compact-status" role="status" tone={readiness.tone}>
          <strong>{readiness.label} · {currentPolicy?.name ?? 'No policy in effect'}</strong>
          <span>{readiness.detail}</span>
        </AdminNoticeCard>
      )}

      <nav aria-label="Tax Policy views" className="tax-policy-view-tabs admin-mb-16">
        {(['current', 'drafts', 'history', 'integrity'] as const).map((view) => (
          <AdminFormControlLink
            aria-current={plan.view === view ? 'page' : undefined}
            className={plan.view === view ? 'button-primary' : 'button-outline'}
            href={`/tax-policy?view=${view}`}
            key={view}
          >
            {viewLabel(view)}
          </AdminFormControlLink>
        ))}
      </nav>

      {plan.view === 'current' ? (
        <CurrentPolicyView
          currentPolicy={currentPolicy}
          nextScheduled={nextScheduled}
          nextScheduledAvailable={workspaceSummaryResult.ok}
        />
      ) : null}

      {plan.view === 'drafts' ? (
        <DraftsView
          approvalRequests={approvalResult.data.items}
          approvalEvidenceAvailable={approvalResult.ok}
          capabilities={capabilityResult.data}
          capabilitiesAvailable={capabilityResult.ok}
          cloneRequested={Boolean(readParam(params, 'clonePolicyId'))}
          currentPolicy={currentPolicy}
          page={plan.page}
          policies={workspacePolicies}
          policyPage={workspaceResult.data}
          requestedPolicyId={requestedPolicyId}
          selectedPolicy={selectedPolicy}
          serviceOptions={serviceOptions}
          simulationAmount={simulationAmount}
          simulationService={simulationService}
          currentSimulation={currentSimulationResult.data}
          proposedSimulation={proposedSimulationResult.data}
          simulationUnavailable={!currentSimulationResult.ok || !proposedSimulationResult.ok || !servicesResult.ok}
          workspaceSummary={workspaceSummaryResult.data}
          workspaceSummaryAvailable={workspaceSummaryResult.ok}
        />
      ) : null}

      {plan.view === 'history' ? (
        <HistoryView
          filters={{
            effectiveFrom: readParam(params, 'effectiveFrom') ?? '',
            effectiveTo: readParam(params, 'effectiveTo') ?? '',
            lifecycle: readParam(params, 'lifecycle') ?? '',
            q: readParam(params, 'q') ?? '',
            source: readParam(params, 'source') === 'test-legacy' ? 'test-legacy' : 'production',
          }}
          page={plan.page}
          policies={workspacePolicies}
          policyPage={workspaceResult.data}
          summary={workspaceSummaryResult.data}
          summaryAvailable={workspaceSummaryResult.ok}
        />
      ) : null}

      {plan.view === 'integrity' ? (
        <IntegrityView
          auditFilters={{
            action: readParam(params, 'auditAction') ?? '',
            actorId: readParam(params, 'auditActorId') ?? '',
            from: readParam(params, 'auditFrom') ?? '',
            policyId: readParam(params, 'auditPolicyId') ?? '',
            source: auditSourceParam(readParam(params, 'auditSource')),
            to: readParam(params, 'auditTo') ?? '',
          }}
          auditEventId={readParam(params, 'auditEventId')}
          auditEvent={auditEventResult.data.items[0] ?? null}
          auditEventUnavailable={!auditEventResult.ok}
          auditLogs={auditResult.data.items}
          auditPage={auditResult.data}
          auditUnavailable={!auditResult.ok}
          earnings={earningsResult.data}
          earningsUnavailable={!earningsResult.ok}
          integritySummary={integritySummaryResult.data}
          integritySummaryUnavailable={!integritySummaryResult.ok}
          issue={readParam(params, 'issue')}
          issueFilters={{
            from: readParam(params, 'issueFrom') ?? '',
            sort: readParam(params, 'issueSort') === 'newest' ? 'newest' : 'oldest',
            source: integritySourceParam(readParam(params, 'issueSource')),
            to: readParam(params, 'issueTo') ?? '',
          }}
          issuePage={plan.issuePage}
          issueRecords={integrityRecordsResult.data}
          issueRecordsUnavailable={!integrityRecordsResult.ok}
          page={plan.page}
        />
      ) : null}

      {plan.view === 'drafts' && !approvalResult.ok ? (
        <AdminNoticeCard role="alert" tone="danger">
          Approval requests could not be loaded. Do not use the visible queue to infer that no review is pending.
        </AdminNoticeCard>
      ) : null}
    </AdminPageTemplate>
  );
}

function CurrentPolicyView({
  currentPolicy,
  nextScheduled,
  nextScheduledAvailable,
}: {
  currentPolicy: AdminTaxPolicyVersion | null;
  nextScheduled: AdminTaxPolicyVersion | null;
  nextScheduledAvailable: boolean;
}) {
  if (!currentPolicy) {
    return (
      <AdminSection title="Current policy">
        <AdminEmptyState
          message="Withholding has no verified policy in effect. Review Finance records before preparing and approving a replacement."
          title="No policy in effect"
        />
      </AdminSection>
    );
  }

  return (
    <>
      <AdminSection
        actions={
          <AdminFormControlLink
            className="button-outline"
            href={`/tax-policy?view=drafts&clonePolicyId=${encodeURIComponent(currentPolicy.id)}#create-tax-policy`}
          >
            {currentPolicy.provenance === 'OPERATOR' ? 'Clone as new draft' : 'Prepare clean production draft'}
          </AdminFormControlLink>
        }
        className="admin-mb-16"
        description="The policy in effect is read-only. Historical earnings retain their captured policy and rule evidence."
        title="Current policy"
      >
        <PolicyMetadata policy={currentPolicy} />
        <PolicyRulesTable policy={currentPolicy} readOnly />
      </AdminSection>
      <AdminSection
        actions={<StatusBadge tone={!nextScheduledAvailable ? 'danger' : nextScheduled ? 'info' : 'neutral'}>{!nextScheduledAvailable ? 'Unavailable' : nextScheduled ? 'Scheduled' : 'None'}</StatusBadge>}
        description="The current policy stays active until a checker-approved replacement reaches its Vietnam effective time."
        title="Next activation"
      >
        {!nextScheduledAvailable ? (
          <AdminEmptyState message="Retry before relying on the next activation state." title="Scheduled activation unavailable" />
        ) : nextScheduled ? <PolicySummaryRow policy={nextScheduled} /> : <p className="muted">No scheduled policy exists.</p>}
      </AdminSection>
    </>
  );
}

function DraftsView({
  approvalRequests,
  approvalEvidenceAvailable,
  capabilities,
  capabilitiesAvailable,
  cloneRequested,
  currentPolicy,
  page,
  policies,
  policyPage,
  requestedPolicyId,
  selectedPolicy,
  serviceOptions,
  simulationAmount,
  simulationService,
  currentSimulation,
  proposedSimulation,
  simulationUnavailable,
  workspaceSummary,
  workspaceSummaryAvailable,
}: {
  approvalRequests: AdminTaxPolicyApprovalRequest[];
  approvalEvidenceAvailable: boolean;
  capabilities: AdminTaxPolicyCapabilities;
  capabilitiesAvailable: boolean;
  cloneRequested: boolean;
  currentPolicy: AdminTaxPolicyVersion | null;
  page: number;
  policies: AdminTaxPolicyVersion[];
  policyPage: AdminTaxPolicyVersionPage;
  requestedPolicyId: string | null;
  selectedPolicy: AdminTaxPolicyVersion | null;
  serviceOptions: Array<{ label: string; value: string }>;
  simulationAmount: number;
  simulationService: string;
  currentSimulation: AdminTaxPolicySimulation | null;
  proposedSimulation: AdminTaxPolicySimulation | null;
  simulationUnavailable: boolean;
  workspaceSummary: AdminTaxPolicyWorkspaceSummary;
  workspaceSummaryAvailable: boolean;
}) {
  const cloneSource = cloneRequested ? selectedPolicy : null;
  return (
    <>
      <AdminSection
        className="admin-mb-16"
        description="Author work, checker review, and scheduled activation are counted from the full server result."
        title="Policy work queue"
      >
        {workspaceSummaryAvailable ? (
          <div className="tax-policy-command-grid tax-policy-queue-counts">
            <CommandFact label="Needs author" value={String(workspaceSummary.drafts.needsAuthor)} />
            <CommandFact label="Awaiting checker" value={String(workspaceSummary.drafts.awaitingChecker)} />
            <CommandFact label="Approved" value={String(workspaceSummary.drafts.approved)} />
            <CommandFact label="Scheduled" value={String(workspaceSummary.drafts.scheduled)} />
          </div>
        ) : <AdminEmptyState message="Queue counts could not be verified." title="Draft queue unavailable" />}
        <CapabilityNotice capabilities={capabilities} available={capabilitiesAvailable} />
        <PolicyListTable policies={policies} />
        <PolicyPagination page={page} policyPage={policyPage} view="drafts" />
      </AdminSection>

      {requestedPolicyId && !selectedPolicy ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Requested policy was not found</strong>
          <p className="muted">The requested ID was loaded exactly; the screen did not silently fall back to the active policy.</p>
        </AdminNoticeCard>
      ) : null}

      {selectedPolicy ? (
        <AdminSection
          actions={
            <>
              <StatusBadge tone={lifecycleTone(selectedPolicy.lifecycleStatus)}>{lifecycleLabel(selectedPolicy.lifecycleStatus)}</StatusBadge>
              {selectedPolicy.lifecycleStatus !== 'DRAFT' ? (
                <AdminFormControlLink
                  className="button-outline"
                  href={`/tax-policy?view=drafts&clonePolicyId=${encodeURIComponent(selectedPolicy.id)}#create-tax-policy`}
                >
                  {selectedPolicy.provenance === 'OPERATOR' ? 'Clone as production draft' : 'Prepare clean production draft'}
                </AdminFormControlLink>
              ) : null}
            </>
          }
          className="admin-mb-16"
          id={`tax-policy-${selectedPolicy.id}`}
          description={`Revision ${selectedPolicy.revision ?? 1} · ${provenanceLabel(selectedPolicy.provenance)}`}
          title={selectedPolicy.lifecycleStatus === 'DRAFT' ? `Draft · ${selectedPolicy.name}` : `Reviewing source · ${selectedPolicy.name}`}
        >
          <PolicyMetadata policy={selectedPolicy} />
          {selectedPolicy.lifecycleStatus === 'DRAFT' ? (
            <DraftPolicyEditor policy={selectedPolicy} />
          ) : (
            <p className="muted">This version is immutable. Review its approval receipt and rules below.</p>
          )}
          <PolicyRulesTable policy={selectedPolicy} readOnly={selectedPolicy.lifecycleStatus !== 'DRAFT'} />
          <ApprovalWorkflow
            approvalEvidenceAvailable={approvalEvidenceAvailable}
            capabilities={capabilities}
            policy={selectedPolicy}
            requests={approvalRequests}
          />
          <PolicySimulation
            current={currentSimulation}
            policyId={selectedPolicy.id}
            proposed={proposedSimulation}
            serviceOptions={serviceOptions}
            simulationAmount={simulationAmount}
            simulationService={simulationService}
            unavailable={simulationUnavailable || Boolean(currentPolicy && !currentSimulation)}
          />
        </AdminSection>
      ) : null}

      <CreateDraftForm canDraft={capabilitiesAvailable && capabilities.canDraft} cloneSource={cloneSource} />
    </>
  );
}

function HistoryView({
  filters,
  page,
  policies,
  policyPage,
  summary,
  summaryAvailable,
}: {
  filters: { effectiveFrom: string; effectiveTo: string; lifecycle: string; q: string; source: string };
  page: number;
  policies: AdminTaxPolicyVersion[];
  policyPage: AdminTaxPolicyVersionPage;
  summary: AdminTaxPolicyWorkspaceSummary;
  summaryAvailable: boolean;
}) {
  return (
    <AdminSection
      className="tax-policy-history-section"
      description={`Showing retained ${filters.source === 'production' ? 'production' : 'test and legacy'} evidence from an exact filtered total of ${policyPage.total}.`}
      title="Policy history"
    >
      <div className="tax-policy-source-tabs" role="group" aria-label="History evidence source">
        <AdminFormControlLink className={filters.source === 'production' ? 'button-primary' : 'button-outline'} href="/tax-policy?view=history&source=production">
          Production history · {summaryAvailable ? summary.history.production : 'Unavailable'}
        </AdminFormControlLink>
        <AdminFormControlLink className={filters.source === 'test-legacy' ? 'button-primary' : 'button-outline'} href="/tax-policy?view=history&source=test-legacy">
          Test / legacy evidence · {summaryAvailable ? summary.history.testOrLegacy : 'Unavailable'}
        </AdminFormControlLink>
      </div>
      <form className="tax-policy-filter-form" method="get">
        <input name="view" type="hidden" value="history" />
        <input name="source" type="hidden" value={filters.source} />
        <AdminFormInput defaultValue={filters.q} label="Search policy, ID, or legal source" labelVisibility="visible" name="q" />
        <AdminFormSelect defaultValue={filters.lifecycle} label="Lifecycle" labelVisibility="visible" name="lifecycle" options={[
          { label: 'All retained states', value: '' },
          { label: 'Replaced', value: 'SUPERSEDED' },
          { label: 'Archived', value: 'ARCHIVED' },
          { label: 'Rejected', value: 'REJECTED' },
          { label: 'Legacy review', value: 'LEGACY_REVIEW' },
        ]} />
        <AdminFormDate defaultValue={filters.effectiveFrom} label="Effective from" labelVisibility="visible" mode="date" name="effectiveFrom" />
        <AdminFormDate defaultValue={filters.effectiveTo} label="Effective to" labelVisibility="visible" mode="date" name="effectiveTo" />
        <AdminFormControlButton className="button-secondary" type="submit">Apply filters</AdminFormControlButton>
      </form>
      <PolicyListTable
        emptyMessage={filters.source === 'production'
          ? 'No governed production policy history matches the selected server filters.'
          : 'No test or legacy evidence matches the selected server filters.'}
        policies={policies}
        history
      />
      <PolicyPagination page={page} policyPage={policyPage} queryState={filters} view="history" />
    </AdminSection>
  );
}

function IntegrityView({
  auditEvent,
  auditEventId,
  auditEventUnavailable,
  auditFilters,
  auditLogs,
  auditPage,
  auditUnavailable,
  earnings,
  earningsUnavailable,
  integritySummary,
  integritySummaryUnavailable,
  issue,
  issueFilters,
  issuePage,
  issueRecords,
  issueRecordsUnavailable,
  page,
}: {
  auditEvent: AdminAuditLog | null;
  auditEventId: string | null;
  auditEventUnavailable: boolean;
  auditFilters: { action: string; actorId: string; from: string; policyId: string; source: string; to: string };
  auditLogs: AdminAuditLog[];
  auditPage: AdminTaxPolicyAuditLogPage;
  auditUnavailable: boolean;
  earnings: AdminEarning[];
  earningsUnavailable: boolean;
  integritySummary: AdminTaxPolicyIntegritySummary;
  integritySummaryUnavailable: boolean;
  issue: string | null;
  issueFilters: { from: string; sort: string; source: string; to: string };
  issuePage: number;
  issueRecords: AdminTaxPolicyIntegrityRecordPage;
  issueRecordsUnavailable: boolean;
  page: number;
}) {
  const audit = buildTaxPolicyAuditSummary(auditLogs);
  const selectedAudit = auditEvent ? buildTaxPolicyAuditSummary([auditEvent]).rows[0] ?? null : null;
  const integrity = buildTaxPolicySnapshotConsistency(earnings);
  return (
    <>
      <AdminSection
        actions={<StatusBadge tone={integritySummaryUnavailable ? 'danger' : 'info'}>{integritySummaryUnavailable ? 'Unavailable' : `${integritySummary.total} earnings`}</StatusBadge>}
        className="admin-mb-16"
        description="Full Partner earning population created in the last 30 days. Record integrity and tax applicability are reported independently."
        title="30-day integrity summary"
      >
        {integritySummaryUnavailable ? (
          <AdminEmptyState message="Retry before using this workspace for withholding closeout." title="Integrity summary unavailable" />
        ) : (
          <div className="tax-policy-integrity-grid">
            <IntegrityMetricCard count={integritySummary.recordIntegrity.amountMismatch} issue="amount-mismatch" label="Amount mismatch" oldestAt={integritySummary.recordIntegrity.oldestAmountMismatch} severity="danger" total={integritySummary.total} />
            <IntegrityMetricCard count={integritySummary.recordIntegrity.missingTaxLog} issue="missing-tax-log" label="Missing tax log" oldestAt={integritySummary.recordIntegrity.oldestMissingTaxLog} severity="danger" total={integritySummary.total} />
            <IntegrityMetricCard count={integritySummary.recordIntegrity.missingSnapshot} issue="missing-snapshot" label="Missing immutable snapshot" oldestAt={integritySummary.recordIntegrity.oldestMissingSnapshot} severity="danger" total={integritySummary.total} />
            <IntegrityMetricCard count={integritySummary.taxApplicability.noActivePolicy} issue="no-active-policy" label="No active policy at earning time" oldestAt={integritySummary.taxApplicability.oldestNoActivePolicy} severity="warning" total={integritySummary.total} />
            <IntegrityMetricCard count={integritySummary.taxApplicability.noApprovedTaxProfile} issue="no-approved-tax-profile" label="Tax profile not approved — applicability evidence missing" oldestAt={integritySummary.taxApplicability.oldestNoApprovedTaxProfile} severity="warning" total={integritySummary.total} />
            <IntegrityMetricCard count={integritySummary.taxApplicability.noMatchingRule} issue="no-matching-rule" label="No matching rule" oldestAt={integritySummary.taxApplicability.oldestNoMatchingRule} severity="warning" total={integritySummary.total} />
          </div>
        )}
      </AdminSection>

      {issue ? (
        <AdminSection
          actions={<StatusBadge tone={issueRecordsUnavailable ? 'danger' : 'warning'}>{issueRecordsUnavailable ? 'Unavailable' : `${issueRecords.total} records`}</StatusBadge>}
          className="admin-mb-16 tax-policy-integrity-queue"
          description="This queue is filtered on the server from the same 30-day evidence contract as the summary."
          title={`Integrity queue · ${integrityIssueLabel(issue)}`}
        >
          {issueRecordsUnavailable ? (
            <AdminEmptyState message="Retry before concluding that this exception queue is empty." title="Filtered evidence unavailable" />
          ) : (
            <>
              <form className="tax-policy-filter-form" method="get">
                <input name="view" type="hidden" value="integrity" />
                <input name="issue" type="hidden" value={issue} />
                <input name="auditAction" type="hidden" value={auditFilters.action} />
                <input name="auditActorId" type="hidden" value={auditFilters.actorId} />
                <input name="auditFrom" type="hidden" value={auditFilters.from} />
                <input name="auditPolicyId" type="hidden" value={auditFilters.policyId} />
                <input name="auditSource" type="hidden" value={auditFilters.source} />
                <input name="auditTo" type="hidden" value={auditFilters.to} />
                <AdminFormSelect defaultValue={issueFilters.source} label="Evidence source" labelVisibility="visible" name="issueSource" options={integritySourceOptions} />
                <AdminFormDate defaultValue={issueFilters.from} label="Created from · Vietnam" labelVisibility="visible" mode="date" name="issueFrom" />
                <AdminFormDate defaultValue={issueFilters.to} label="Created to · Vietnam" labelVisibility="visible" mode="date" name="issueTo" />
                <AdminFormSelect defaultValue={issueFilters.sort} label="Sort" labelVisibility="visible" name="issueSort" options={[
                  { label: 'Oldest first', value: 'oldest' },
                  { label: 'Newest first', value: 'newest' },
                ]} />
                <AdminFormControlButton className="button-secondary" type="submit">Apply evidence filters</AdminFormControlButton>
              </form>
              <AdminTableScroll ariaLabel={`${integrityIssueLabel(issue)} Tax Policy evidence table`}>
                <AdminDataTable emptyMessage="No records match this issue and evidence filter." headers={['Partner / booking evidence', 'Source / classification', 'Created · Vietnam', 'Amounts', 'Action']} rowCount={issueRecords.items.length}>
                  {issueRecords.items.map((record) => (
                    <tr key={record.id}>
                      <th scope="row">
                        <strong>{record.providerDisplayName}</strong>
                        <small>Partner <code>{record.providerProfileId}</code></small>
                        <small>Booking <code>{record.bookingId}</code></small>
                        <small>Earning <code>{record.id}</code></small>
                      </th>
                      <td><StatusBadge tone={integritySourceTone(record.evidenceSource)}>{integritySourceLabel(record.evidenceSource)}</StatusBadge><small>{integrityClassificationLabel(record.classification)}</small>{record.policyVersionId ? <small>Policy <code>{record.policyVersionId}</code></small> : null}</td>
                      <td>{vietnamDateTimeLabel(record.createdAt)}</td>
                      <td><strong>{record.grossAmount.toLocaleString('en-US')} VND gross</strong><small>{record.withholdingAmount.toLocaleString('en-US')} VND earning withholding · {record.taxLogWithholdingAmount.toLocaleString('en-US')} VND tax log</small></td>
                      <td><a className="text-link" href={`/bookings/${encodeURIComponent(record.bookingId)}#finance`}>Open booking finance evidence</a></td>
                    </tr>
                  ))}
                </AdminDataTable>
              </AdminTableScroll>
              <AdminTablePaginationFooter
                activePage={issuePage}
                ariaLabel={`${integrityIssueLabel(issue)} integrity queue pages`}
                from={issueRecords.total ? issueRecords.skip + 1 : 0}
                hrefForPage={(nextPage) => buildTaxPolicyPageHref('integrity', page, {
                  auditAction: auditFilters.action,
                  auditActorId: auditFilters.actorId,
                  auditFrom: auditFilters.from,
                  auditPolicyId: auditFilters.policyId,
                  auditSource: auditFilters.source,
                  auditTo: auditFilters.to,
                  issue,
                  issueFrom: issueFilters.from,
                  issuePage: String(nextPage),
                  issueSort: issueFilters.sort,
                  issueSource: issueFilters.source,
                  issueTo: issueFilters.to,
                })}
                itemLabel="integrity records"
                to={Math.min(issueRecords.total, issueRecords.skip + issueRecords.items.length)}
                totalPages={Math.max(1, Math.ceil(issueRecords.total / issueRecords.take))}
                totalRows={issueRecords.total}
              />
            </>
          )}
        </AdminSection>
      ) : null}

      <AdminSection
        actions={<StatusBadge tone={auditUnavailable ? 'danger' : 'info'}>{auditUnavailable ? 'Unavailable' : `${auditPage.total} events`}</StatusBadge>}
        className="admin-mb-16"
        description="Exact Tax Policy and tax rule lifecycle events. This total is not derived from broad text search."
        title="Lifecycle audit"
      >
        <form className="tax-policy-filter-form" method="get">
          <input name="view" type="hidden" value="integrity" />
          {issue ? <input name="issue" type="hidden" value={issue} /> : null}
          <input name="issueFrom" type="hidden" value={issueFilters.from} />
          <input name="issueSort" type="hidden" value={issueFilters.sort} />
          <input name="issueSource" type="hidden" value={issueFilters.source} />
          <input name="issueTo" type="hidden" value={issueFilters.to} />
          <AdminFormSelect defaultValue={auditFilters.source} label="Evidence source" labelVisibility="visible" name="auditSource" options={[
            { label: 'Production / operator', value: 'production' },
            { label: 'Test / smoke', value: 'test' },
            { label: 'Legacy / migration', value: 'legacy' },
            { label: 'Unknown provenance', value: 'unknown' },
          ]} />
          <AdminFormInput defaultValue={auditFilters.action} label="Exact action" labelVisibility="visible" name="auditAction" />
          <AdminFormInput defaultValue={auditFilters.actorId} label="Actor ID" labelVisibility="visible" name="auditActorId" />
          <AdminFormInput defaultValue={auditFilters.policyId} label="Policy ID" labelVisibility="visible" name="auditPolicyId" />
          <AdminFormDate defaultValue={auditFilters.from} label="From" labelVisibility="visible" mode="date" name="auditFrom" />
          <AdminFormDate defaultValue={auditFilters.to} label="To" labelVisibility="visible" mode="date" name="auditTo" />
          <AdminFormControlButton className="button-secondary" type="submit">Apply audit filters</AdminFormControlButton>
        </form>
        {auditEventId ? (
          <div className="tax-policy-audit-event" id="tax-policy-audit-event">
            {auditEventUnavailable ? (
              <AdminEmptyState message="Retry before using this event as approval or activation evidence." title="Audit event unavailable" />
            ) : !auditEvent || !selectedAudit ? (
              <AdminEmptyState message="The event ID was queried exactly. Clear the event selection and return to the filtered lifecycle audit." title="Audit event not found" />
            ) : (
              <>
                <AdminSectionHeader
                  actions={<CommandCopyButton copiedLabel="Event ID copied" failedLabel="Copy event ID failed" label="Copy event ID" value={auditEvent.id} />}
                  description={`${selectedAudit.actorLabel} · ${vietnamDateTimeLabel(selectedAudit.createdAt)} · ${auditEvidenceSourceLabel(auditEvent)}`}
                  title={selectedAudit.actionLabel}
                />
                <AuditEvidence detail={selectedAudit.detail} log={auditEvent} open />
                <div className="actions">
                  {auditPolicyId(auditEvent) ? <AdminFormControlLink className="button-outline" href={buildTaxPolicyEditorHref(auditPolicyId(auditEvent)!)}>Open related policy</AdminFormControlLink> : null}
                  <AdminFormControlLink className="button-outline" href={buildTaxPolicyPageHref('integrity', page, {
                    auditAction: auditFilters.action,
                    auditActorId: auditFilters.actorId,
                    auditFrom: auditFilters.from,
                    auditPolicyId: auditFilters.policyId,
                    auditSource: auditFilters.source,
                    auditTo: auditFilters.to,
                    issue: issue ?? undefined,
                    issueFrom: issueFilters.from,
                    issuePage: String(issuePage),
                    issueSort: issueFilters.sort,
                    issueSource: issueFilters.source,
                    issueTo: issueFilters.to,
                  })}>Back to filtered audit</AdminFormControlLink>
                </div>
              </>
            )}
          </div>
        ) : null}
        {auditUnavailable ? (
          <AdminEmptyState message="Retry before using this timeline as approval evidence." title="Audit unavailable" />
        ) : (
          <AdminTableScroll ariaLabel="Tax Policy lifecycle audit table">
            <AdminDataTable
              emptyMessage="No Tax Policy lifecycle events were recorded."
              headers={['Event', 'Actor', 'Target', 'Evidence', 'Vietnam time']}
              rowCount={audit.rows.length}
            >
              {audit.rows.map((row) => {
                const sourceLog = auditLogs.find((log) => log.id === row.id);
                const policyId = auditPolicyId(sourceLog);
                return (
                  <tr key={row.id}>
                    <th scope="row">{row.actionLabel}</th>
                    <td>{row.actorLabel}</td>
                    <td>{policyId ? <a className="text-link" href={`/tax-policy?view=drafts&policyId=${encodeURIComponent(policyId)}#tax-policy-${encodeURIComponent(policyId)}`}><code>{row.targetLabel}</code></a> : <code>{row.targetLabel}</code>}</td>
                    <td><span>{row.detail}</span><small>{auditEvidenceSourceLabel(sourceLog)}</small><AdminFormControlLink className="button-outline" href={`${buildTaxPolicyPageHref('integrity', page, {
                      auditAction: auditFilters.action,
                      auditActorId: auditFilters.actorId,
                      auditEventId: row.id,
                      auditFrom: auditFilters.from,
                      auditPolicyId: auditFilters.policyId,
                      auditSource: auditFilters.source,
                      auditTo: auditFilters.to,
                      issue: issue ?? undefined,
                      issueFrom: issueFilters.from,
                      issuePage: String(issuePage),
                      issueSort: issueFilters.sort,
                      issueSource: issueFilters.source,
                      issueTo: issueFilters.to,
                    })}#tax-policy-audit-event`}>Inspect event</AdminFormControlLink></td>
                    <td>{vietnamDateTimeLabel(row.createdAt)}</td>
                  </tr>
                );
              })}
            </AdminDataTable>
          </AdminTableScroll>
        )}
        <AdminTablePaginationFooter
          activePage={page}
          ariaLabel="Tax Policy audit pages"
          from={auditPage.total ? auditPage.skip + 1 : 0}
          hrefForPage={(nextPage) => buildTaxPolicyPageHref('integrity', nextPage, {
            auditAction: auditFilters.action,
            auditActorId: auditFilters.actorId,
            auditFrom: auditFilters.from,
            auditPolicyId: auditFilters.policyId,
            auditSource: auditFilters.source,
            auditTo: auditFilters.to,
            issue: issue ?? undefined,
            issueFrom: issueFilters.from,
            issuePage: String(issuePage),
            issueSort: issueFilters.sort,
            issueSource: issueFilters.source,
            issueTo: issueFilters.to,
          })}
          itemLabel="audit events"
          to={Math.min(auditPage.total, auditPage.skip + auditPage.items.length)}
          totalPages={Math.max(1, Math.ceil(auditPage.total / auditPage.take))}
          totalRows={auditPage.total}
        />
      </AdminSection>

      <AdminSection
        actions={<StatusBadge tone={earningsUnavailable ? 'danger' : 'neutral'}>{earningsUnavailable ? 'Unavailable' : `${integrity.sampleCount} examples`}</StatusBadge>}
        description="Record integrity and tax applicability are separate. This is a bounded 30-day evidence sample, not an all-period KPI."
        title="Settlement evidence sample"
      >
        {earningsUnavailable ? (
          <AdminEmptyState message="Earning evidence could not be loaded. No missing rows are shown as healthy." title="Evidence unavailable" />
        ) : (
          <AdminTableScroll ariaLabel="Tax Policy settlement integrity table">
            <AdminDataTable
              emptyMessage="No earnings are available in this evidence window."
              headers={['Partner', 'Booking', 'Record integrity', 'Tax applicability', 'Earning tax', 'Tax log', 'Open']}
              rowCount={integrity.rows.length}
            >
              {integrity.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.providerLabel}</th>
                  <td>{row.bookingLabel}</td>
                  <td><StatusBadge tone={row.recordIntegrityTone}>{row.recordIntegrityLabel}</StatusBadge></td>
                  <td><StatusBadge tone={row.taxApplicabilityTone}>{row.taxApplicabilityLabel}</StatusBadge></td>
                  <td>{row.earningTaxLabel}</td>
                  <td>{row.taxLogLabel}</td>
                  <td><a className="text-link" href={row.financeTraceHref}>Open booking finance evidence</a></td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        )}
      </AdminSection>
    </>
  );
}

function CreateDraftForm({ canDraft, cloneSource }: { canDraft: boolean; cloneSource: AdminTaxPolicyVersion | null }) {
  const productionSource = cloneSource?.provenance === 'OPERATOR' ? cloneSource : null;
  const formId = 'tax-policy-create-form';
  return (
    <AdminSection
      className="admin-mb-16"
      description="The policy and optional fallback rule are created in one database transaction. Creation never activates a policy."
      id="create-tax-policy"
      title={cloneSource
        ? cloneSource.provenance === 'OPERATOR'
          ? `Clone ${cloneSource.name} as a new draft`
          : 'Prepare clean production draft'
        : 'Prepare production draft'}
    >
      {cloneSource?.provenance !== 'OPERATOR' && cloneSource ? (
        <AdminNoticeCard className="admin-mb-12" role="alert" tone="danger">
          <strong>Non-production source requires independent reconstruction</strong>
          <p className="muted">Name, notes, legal evidence, and rates were intentionally cleared. Source lineage remains linked to <code>{cloneSource.id}</code>.</p>
        </AdminNoticeCard>
      ) : null}
      {!canDraft ? (
        <AdminNoticeCard className="admin-mb-12" role="alert" tone="danger">
          <strong>Draft creation is blocked</strong>
          <p className="muted">Resolve the operator capability blockers before attempting a write.</p>
        </AdminNoticeCard>
      ) : null}
      <TaxPolicyActionForm action={createTaxPolicyVersion} className="tax-policy-form-grid" id={formId}>
        <div className="tax-policy-field-group"><AdminFormInput defaultValue={productionSource ? `${productionSource.name} — new revision` : ''} label="Policy name" labelVisibility="visible" maxLength={160} name="name" required /><TaxPolicyFieldMessage helper="Use the governed policy title operators will recognize in approvals and history." name="name" /></div>
        <div className="tax-policy-field-group"><AdminFormDateTime defaultValue="" label="Effective from · Vietnam time" labelVisibility="visible" name="effectiveFrom" required /><TaxPolicyFieldMessage helper="Choose the approved Vietnam activation time. Creating this draft does not activate it." name="effectiveFrom" /></div>
        <div className="tax-policy-field-group"><AdminFormDate label="Promulgated date" labelVisibility="visible" mode="date" name="promulgatedDate" required /><TaxPolicyFieldMessage helper="Enter the promulgation date shown in the authoritative legal source." name="promulgatedDate" /></div>
        <div className="tax-policy-field-group"><AdminFormInput defaultValue={productionSource?.legalSourceTitle ?? ''} label="Legal source title" labelVisibility="visible" maxLength={240} name="legalSourceTitle" required /><TaxPolicyFieldMessage helper="Name the regulation, circular, or reviewed authority supporting this policy." name="legalSourceTitle" /></div>
        <div className="tax-policy-field-group"><AdminFormInput defaultValue={productionSource?.legalSourceUrl ?? ''} label="Legal source URL · HTTPS" labelVisibility="visible" maxLength={1000} name="legalSourceUrl" required type="url" /><TaxPolicyFieldMessage helper="Use the HTTPS URL reviewed by Finance. Test or fixture links are not production evidence." name="legalSourceUrl" /></div>
        <div className="tax-policy-field-group"><AdminFormInput defaultValue={productionSource?.taxSubject ?? ''} label="Tax subject" labelVisibility="visible" maxLength={240} name="taxSubject" required /><TaxPolicyFieldMessage helper="Describe the Partner income or transaction population governed by this policy." name="taxSubject" /></div>
        <div className="tax-policy-field-group"><AdminFormInput defaultValue={productionSource ? defaultRatePercent(productionSource) : undefined} label="Fallback withholding rate · %" labelVisibility="visible" max="100" min="0" name="defaultRatePercent" step="0.01" type="number" /><TaxPolicyFieldMessage helper="Leave blank when no authoritative fallback rate has been approved." name="defaultRatePercent" /></div>
        <div className="tax-policy-field-group is-wide"><AdminFormTextarea defaultValue={productionSource?.changeSummary ?? ''} label="Change summary" labelVisibility="visible" maxLength={1000} minLength={10} name="changeSummary" required rows={3} /><TaxPolicyFieldMessage helper="Summarize what changes from the current production policy and why." name="changeSummary" /></div>
        <div className="tax-policy-field-group is-wide"><AdminFormTextarea defaultValue={productionSource?.notes ?? ''} label="Notes" labelVisibility="visible" maxLength={1000} name="notes" rows={3} /></div>
        <div className="tax-policy-field-group is-wide"><AdminFormTextarea label="Preparation rationale" labelVisibility="visible" maxLength={500} minLength={10} name="operatorReason" required rows={3} /><TaxPolicyFieldMessage helper="Record the independent review performed and the source used to prepare this draft." name="operatorReason" /></div>
        {cloneSource ? <input name="supersedesPolicyVersionId" type="hidden" value={cloneSource.id} /> : null}
        <AdminFormControlButton className="button-primary" disabled={!canDraft} type="submit">Prepare production draft</AdminFormControlButton>
      </TaxPolicyActionForm>
    </AdminSection>
  );
}

function DraftPolicyEditor({ policy }: { policy: AdminTaxPolicyVersion }) {
  const formId = `tax-policy-metadata-${policy.id}`;
  return (
    <AdminDisclosure className="tax-policy-disclosure admin-mt-16" open>
      <summary>Draft metadata</summary>
      <TaxPolicyActionForm action={updateTaxPolicyVersion} className="tax-policy-form-grid admin-mt-12" id={formId}>
        <input name="policyId" type="hidden" value={policy.id} />
        <AdminFormInput defaultValue={policy.name} label="Policy name" labelVisibility="visible" maxLength={160} name="name" required />
        <TaxPolicyFieldMessage name="name" />
        <AdminFormDateTime defaultValue={isoToVietnamDateTimeLocal(policy.effectiveFrom)} label="Effective from · Vietnam time" labelVisibility="visible" name="effectiveFrom" required />
        <TaxPolicyFieldMessage name="effectiveFrom" />
        <AdminFormDateTime defaultValue={policy.effectiveTo ? isoToVietnamDateTimeLocal(policy.effectiveTo) : ''} label="Effective to · Vietnam time" labelVisibility="visible" name="effectiveTo" />
        <TaxPolicyFieldMessage name="effectiveTo" />
        <AdminFormDate defaultValue={policy.promulgatedDate ? isoToVietnamDateTimeLocal(policy.promulgatedDate).slice(0, 10) : ''} label="Promulgated date" labelVisibility="visible" mode="date" name="promulgatedDate" required />
        <TaxPolicyFieldMessage name="promulgatedDate" />
        <AdminFormInput defaultValue={policy.legalSourceTitle ?? ''} label="Legal source title" labelVisibility="visible" maxLength={240} name="legalSourceTitle" required />
        <TaxPolicyFieldMessage name="legalSourceTitle" />
        <AdminFormInput defaultValue={policy.legalSourceUrl ?? ''} label="Legal source URL · HTTPS" labelVisibility="visible" maxLength={1000} name="legalSourceUrl" required type="url" />
        <TaxPolicyFieldMessage name="legalSourceUrl" />
        <AdminFormInput defaultValue={policy.taxSubject ?? ''} label="Tax subject" labelVisibility="visible" maxLength={240} name="taxSubject" required />
        <TaxPolicyFieldMessage name="taxSubject" />
        <AdminFormTextarea defaultValue={policy.changeSummary ?? ''} label="Change summary" labelVisibility="visible" maxLength={1000} minLength={10} name="changeSummary" required rows={3} />
        <TaxPolicyFieldMessage name="changeSummary" />
        <AdminFormTextarea defaultValue={policy.notes ?? ''} label="Notes" labelVisibility="visible" maxLength={1000} name="notes" rows={3} />
        <AdminFormTextarea label="Why this draft changed" labelVisibility="visible" maxLength={500} minLength={10} name="operatorReason" required rows={3} />
        <TaxPolicyFieldMessage name="operatorReason" />
        <AdminFormControlButton className="button-primary" type="submit">Save draft</AdminFormControlButton>
      </TaxPolicyActionForm>
    </AdminDisclosure>
  );
}

function PolicyRulesTable({ policy, readOnly }: { policy: AdminTaxPolicyVersion; readOnly: boolean }) {
  const rules = policy.rules ?? [];
  return (
    <div className="admin-mt-16">
      <AdminSectionHeader
        actions={<StatusBadge tone={rules.some((rule) => rule.active && rule.scope === 'DEFAULT') ? 'success' : 'warning'}>{rules.length} rules</StatusBadge>}
        description="Specific service rules take priority over amount ranges, followed by the fallback rule."
        title="Withholding rules"
      />
      <AdminTableScroll ariaLabel={`${policy.name} withholding rules table`}>
        <AdminDataTable
          emptyMessage="No withholding rules are defined. Exactly one active fallback rule is required before approval."
          headers={['Priority', 'Scope', 'Applies to', 'Rate', 'Fixed VND', 'Status', 'Action']}
          rowCount={rules.length}
        >
          {rules.map((rule, index) => (
            <tr key={rule.id}>
              <td>{index + 1}</td>
              <th scope="row">{scopeLabel(rule.scope)}</th>
              <td>{ruleAppliesTo(rule)}</td>
              <td>{formatRate(rule.rateBps)}</td>
              <td><MoneyText amount={rule.fixedAmount} fallback="0 VND" /></td>
              <td><StatusBadge tone={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Enabled' : 'Disabled'}</StatusBadge></td>
              <td>{readOnly ? 'Read-only' : <RuleEditor policyId={policy.id} rule={rule} />}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {!readOnly ? <CreateRuleForm policyId={policy.id} /> : null}
    </div>
  );
}

function RuleEditor({ policyId, rule }: { policyId: string; rule: AdminTaxRule }) {
  const formId = `tax-policy-rule-${rule.id}`;
  return (
    <AdminDisclosure className="tax-policy-row-details">
      <summary>Edit</summary>
      <TaxPolicyActionForm action={updateTaxRule} className="tax-policy-rule-form" id={formId}>
        <input name="ruleId" type="hidden" value={rule.id} />
        <input name="policyId" type="hidden" value={policyId} />
        <AdminFormSelect defaultValue={rule.scope} label={`Scope for rule ${rule.id.slice(0, 8)}`} labelVisibility="visible" name="scope" options={scopeOptions} />
        <TaxPolicyFieldMessage name="scope" />
        <AdminFormInput defaultValue={rule.serviceType ?? ''} label="Service code · only for specific service" labelVisibility="visible" name="serviceType" />
        <TaxPolicyFieldMessage name="serviceType" />
        <AdminFormInput defaultValue={rule.minGrossAmount ?? ''} label="Minimum gross VND · amount range only" labelVisibility="visible" min="0" name="minGrossAmount" type="number" />
        <TaxPolicyFieldMessage name="minGrossAmount" />
        <AdminFormInput defaultValue={rule.maxGrossAmount ?? ''} label="Maximum gross VND · amount range only" labelVisibility="visible" min="0" name="maxGrossAmount" type="number" />
        <TaxPolicyFieldMessage name="maxGrossAmount" />
        <AdminFormInput defaultValue={formatRateInput(rule.rateBps)} label="Withholding rate · %" labelVisibility="visible" max="100" min="0" name="ratePercent" required step="0.01" type="number" />
        <TaxPolicyFieldMessage name="ratePercent" />
        <AdminFormInput defaultValue={rule.fixedAmount} label="Additional fixed withholding · VND" labelVisibility="visible" min="0" name="fixedAmount" required type="number" />
        <TaxPolicyFieldMessage name="fixedAmount" />
        <AdminFormCheckbox defaultChecked={rule.active} label="Enabled in this draft" name="active">
          Enabled in this draft
        </AdminFormCheckbox>
        <AdminFormTextarea label="Why this rule changed" labelVisibility="visible" minLength={10} name="operatorReason" required rows={2} />
        <TaxPolicyFieldMessage name="operatorReason" />
        <AdminFormControlButton className="button-primary" type="submit">Save draft rule</AdminFormControlButton>
      </TaxPolicyActionForm>
    </AdminDisclosure>
  );
}

function CreateRuleForm({ policyId }: { policyId: string }) {
  const formId = `tax-policy-create-rule-${policyId}`;
  return (
    <AdminDisclosure className="tax-policy-disclosure admin-mt-12">
      <summary>Add draft rule</summary>
      <TaxPolicyActionForm action={createTaxRule} className="tax-policy-rule-form admin-mt-12" id={formId}>
        <input name="policyId" type="hidden" value={policyId} />
        <AdminFormSelect defaultValue="DEFAULT" label="Scope" labelVisibility="visible" name="scope" options={scopeOptions} />
        <TaxPolicyFieldMessage name="scope" />
        <AdminFormInput label="Service code · specific service only" labelVisibility="visible" name="serviceType" />
        <TaxPolicyFieldMessage name="serviceType" />
        <AdminFormInput label="Minimum gross VND · amount range only" labelVisibility="visible" min="0" name="minGrossAmount" type="number" />
        <TaxPolicyFieldMessage name="minGrossAmount" />
        <AdminFormInput label="Maximum gross VND · amount range only" labelVisibility="visible" min="0" name="maxGrossAmount" type="number" />
        <TaxPolicyFieldMessage name="maxGrossAmount" />
        <AdminFormInput label="Withholding rate · %" labelVisibility="visible" max="100" min="0" name="ratePercent" required step="0.01" type="number" />
        <TaxPolicyFieldMessage name="ratePercent" />
        <AdminFormInput defaultValue="0" label="Additional fixed withholding · VND" labelVisibility="visible" min="0" name="fixedAmount" required type="number" />
        <TaxPolicyFieldMessage name="fixedAmount" />
        <AdminFormTextarea label="Why this rule is needed" labelVisibility="visible" minLength={10} name="operatorReason" required rows={2} />
        <TaxPolicyFieldMessage name="operatorReason" />
        <AdminFormControlButton className="button-primary" type="submit">Add draft rule</AdminFormControlButton>
      </TaxPolicyActionForm>
    </AdminDisclosure>
  );
}

function ApprovalWorkflow({
  approvalEvidenceAvailable,
  capabilities,
  policy,
  requests,
}: {
  approvalEvidenceAvailable: boolean;
  capabilities: AdminTaxPolicyCapabilities;
  policy: AdminTaxPolicyVersion;
  requests: AdminTaxPolicyApprovalRequest[];
}) {
  const pending = requests.find((request) => request.status === 'PENDING') ?? null;
  const sourceNeedsAcknowledgement = Boolean(
    policy.supersedesPolicyVersion && policy.supersedesPolicyVersion.provenance !== 'OPERATOR',
  );
  const submitFormId = `tax-policy-submit-${policy.id}`;
  const decisionFormId = pending ? `tax-policy-decision-${pending.id}` : '';
  return (
    <div className="tax-policy-approval-panel admin-mt-16">
      <AdminSectionHeader
        actions={<StatusBadge tone={pending ? 'warning' : 'neutral'}>{pending ? 'Awaiting review' : lifecycleLabel(policy.lifecycleStatus)}</StatusBadge>}
        description="Maker and checker are derived from verified signed-in operator sessions. The maker cannot approve their own request."
        title="Approval workflow"
      />
      {!approvalEvidenceAvailable ? (
        <AdminNoticeCard className="admin-mb-12" role="alert" tone="danger">
          <strong>Approval evidence unavailable</strong>
          <p className="muted">The exact request history for this policy could not be loaded. Do not infer that no request exists.</p>
        </AdminNoticeCard>
      ) : null}
      {!capabilities.canSubmit ? (
        <AdminNoticeCard className="admin-mb-12" role="alert" tone="danger">
          <strong>Submission blocked</strong>
          <p className="muted">{capabilities.submitBlockers.map((blocker) => blocker.message).join(' ')}</p>
          <AdminFormControlLink className="button-outline" href="/finance-tax/finance-approvers">Open Finance Approvers</AdminFormControlLink>
        </AdminNoticeCard>
      ) : null}
      {policy.lifecycleStatus === 'DRAFT' && approvalEvidenceAvailable && !pending ? (
        <TaxPolicyActionForm action={submitTaxPolicyApprovalRequest} className="tax-policy-approval-form" id={submitFormId}>
          <input name="policyId" type="hidden" value={policy.id} />
          <input name="idempotencyKey" type="hidden" value={`tax-policy-${policy.id}-${randomUUID()}`} />
          <AdminFormTextarea label="Submission rationale and source" labelVisibility="visible" minLength={10} name="operatorReason" required rows={3} />
          <TaxPolicyFieldMessage name="operatorReason" />
          {sourceNeedsAcknowledgement ? (
            <>
              <AdminFormCheckbox label="Clean source acknowledgement" name="cleanSourceAcknowledged" required>
                I independently reviewed every production value and did not reuse unverified source text or rates.
              </AdminFormCheckbox>
              <TaxPolicyFieldMessage name="cleanSourceAcknowledged" />
            </>
          ) : null}
          <AdminFormControlButton className="button-primary" disabled={!capabilities.canSubmit} type="submit">Submit for Finance review</AdminFormControlButton>
        </TaxPolicyActionForm>
      ) : null}
      {pending ? (
        <div className="tax-policy-approval-receipt">
          <p><strong>Maker</strong> {operatorLabel(pending.maker)} · {vietnamDateTimeLabel(pending.requestedAt)}</p>
          <p className="muted">{pending.operatorReason}</p>
          {pending.maker?.id === capabilities.actorId ? (
            <p className="muted">You submitted this request. A different Finance approver must decide it.</p>
          ) : capabilities.canDecide ? (
            <TaxPolicyActionForm action={decideTaxPolicyApprovalRequest} className="tax-policy-approval-form" id={decisionFormId}>
              <input name="requestId" type="hidden" value={pending.id} />
              <input name="policyId" type="hidden" value={policy.id} />
              <AdminFormTextarea label="Reviewer decision reason" labelVisibility="visible" minLength={10} name="decisionReason" required rows={3} />
              <TaxPolicyFieldMessage name="decisionReason" />
              <div className="actions">
                <AdminFormControlButton className="button-primary" name="decision" type="submit" value="APPROVE">Approve and schedule</AdminFormControlButton>
                <AdminFormControlButton className="button-danger" name="decision" type="submit" value="REJECT">Reject</AdminFormControlButton>
              </div>
            </TaxPolicyActionForm>
          ) : (
            <p className="muted">{capabilities.decisionBlockers.map((blocker) => blocker.message).join(' ')}</p>
          )}
        </div>
      ) : null}
      {requests.filter((request) => request.status !== 'PENDING').map((request) => (
        <AdminDisclosure className="tax-policy-disclosure admin-mt-12" key={request.id}>
          <summary>{request.status} receipt · {vietnamDateTimeLabel(request.requestedAt)}</summary>
          <p><strong>Maker</strong> {operatorLabel(request.maker)}</p>
          <p><strong>Checker</strong> {operatorLabel(request.checker ?? undefined)}</p>
          <p><strong>Payload hash</strong> <code>{request.payloadHash}</code></p>
          <p className="muted">{request.decisionReason ?? request.operatorReason}</p>
        </AdminDisclosure>
      ))}
    </div>
  );
}

function PolicySimulation({
  current,
  policyId,
  proposed,
  serviceOptions,
  simulationAmount,
  simulationService,
  unavailable,
}: {
  current: AdminTaxPolicySimulation | null;
  policyId: string;
  proposed: AdminTaxPolicySimulation | null;
  serviceOptions: Array<{ label: string; value: string }>;
  simulationAmount: number;
  simulationService: string;
  unavailable: boolean;
}) {
  return (
    <AdminDisclosure className="tax-policy-disclosure admin-mt-16">
      <summary>Saved policy preview · production calculation contract</summary>
      <form className="tax-policy-simulation-form admin-mt-12" method="get">
        <input name="view" type="hidden" value="drafts" />
        <input name="policyId" type="hidden" value={policyId} />
        <AdminFormSelect
          defaultValue={simulationService}
          label="Service catalog item"
          labelVisibility="visible"
          name="simulationService"
          options={serviceOptions.length ? serviceOptions : [{ label: simulationService, value: simulationService }]}
        />
        <AdminFormInput
          defaultValue={simulationAmount}
          label="Gross service amount · VND"
          labelVisibility="visible"
          min="0"
          name="simulationAmount"
          required
          step="1"
          type="number"
        />
        <AdminFormControlButton className="button-outline" type="submit">Run read-only preview</AdminFormControlButton>
      </form>
      {unavailable || !proposed ? (
        <AdminNoticeCard className="admin-mt-12" role="alert" tone="danger">
          The production withholding preview could not be loaded. No missing calculation is represented as zero.
        </AdminNoticeCard>
      ) : (
        <>
          <div className="tax-policy-simulation-grid admin-mt-12">
            <CommandFact label="Tax profile scenario" value="Approved Partner tax profile" />
            <CommandFact label="Gross amount" value={`${simulationAmount.toLocaleString('en-US')} VND`} />
            <CommandFact label="Current withholding" value={current ? `${current.amount.toLocaleString('en-US')} VND` : 'No current policy'} />
            <CommandFact label="Proposed withholding" value={`${proposed.amount.toLocaleString('en-US')} VND`} />
            <CommandFact label="Delta" value={current ? `${(proposed.amount - current.amount).toLocaleString('en-US')} VND` : 'Unavailable'} />
            <CommandFact label="Selected rule" value={simulationRuleSummary(proposed)} />
          </div>
          <p className="muted">Calculated from the last saved policy rules by the same function used when an earning is created. Unsaved form values are not included, and this preview never updates financial records.</p>
        </>
      )}
    </AdminDisclosure>
  );
}

function PolicyListTable({
  emptyMessage,
  policies,
  history = false,
}: {
  emptyMessage?: string;
  policies: AdminTaxPolicyVersion[];
  history?: boolean;
}) {
  if (history) {
    return (
      <AdminTableScroll ariaLabel="Tax Policy history table">
        <AdminDataTable
          emptyMessage={emptyMessage ?? 'No retained history matches the selected server filters.'}
          headers={['Policy / source', 'Lifecycle / effective', 'Rule coverage', 'Legal / approval readiness', 'Open']}
          rowCount={policies.length}
        >
          {policies.map((policy) => (
            <tr key={policy.id}>
              <th scope="row"><strong>{policy.name}</strong><small>Revision {policy.revision ?? 1} · {provenanceLabel(policy.provenance)} · <code>{policy.id}</code></small></th>
              <td><StatusBadge tone={lifecycleTone(policy.lifecycleStatus)}>{lifecycleLabel(policy.lifecycleStatus)}</StatusBadge><small>{vietnamDateTimeLabel(policy.effectiveFrom)}</small></td>
              <td><strong>{policy.rules?.length ?? 0} rules</strong><small>{policyRateSummary(policy)}</small></td>
              <td><strong>{policy.legalSourceTitle ?? 'Legal source missing'}</strong><small>{policy.approvedAt ? `Approved ${vietnamDateTimeLabel(policy.approvedAt)}` : 'Approval receipt not recorded'}</small></td>
              <td><AdminFormControlLink className="button-outline" href={`/tax-policy?view=drafts&policyId=${encodeURIComponent(policy.id)}#tax-policy-${encodeURIComponent(policy.id)}`}>Inspect</AdminFormControlLink></td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    );
  }
  return (
    <AdminTableScroll ariaLabel="Tax Policy draft and schedule table">
      <AdminDataTable
        emptyMessage="No draft, pending, approved, or scheduled policies match this page."
        headers={['Policy', 'State', 'Provenance', 'Effective · Vietnam', 'Rules', 'Legal source', 'Action']}
        rowCount={policies.length}
      >
        {policies.map((policy) => (
          <tr key={policy.id}>
            <th scope="row"><strong>{policy.name}</strong><small>Revision {policy.revision ?? 1}</small></th>
            <td><StatusBadge tone={lifecycleTone(policy.lifecycleStatus)}>{lifecycleLabel(policy.lifecycleStatus)}</StatusBadge></td>
            <td>{provenanceLabel(policy.provenance)}</td>
            <td>{vietnamDateTimeLabel(policy.effectiveFrom)}</td>
            <td>{policy.rules?.length ?? 0}</td>
            <td>{policy.legalSourceTitle ?? 'Missing'}</td>
            <td>
              <AdminFormControlLink className="button-outline" href={buildTaxPolicyEditorHref(policy.id)}>Open</AdminFormControlLink>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function PolicyPagination({
  page,
  policyPage,
  queryState = {},
  view,
}: {
  page: number;
  policyPage: AdminTaxPolicyVersionPage;
  queryState?: Record<string, string | undefined>;
  view: TaxPolicyView;
}) {
  return (
    <AdminTablePaginationFooter
      activePage={page}
      ariaLabel={`${viewLabel(view)} pages`}
      from={policyPage.total ? policyPage.skip + 1 : 0}
      hrefForPage={(nextPage) => buildTaxPolicyPageHref(view, nextPage, queryState)}
      itemLabel="policy versions"
      to={Math.min(policyPage.total, policyPage.skip + policyPage.items.length)}
      totalPages={Math.max(1, Math.ceil(policyPage.total / policyPage.take))}
      totalRows={policyPage.total}
    />
  );
}

function PolicyMetadata({ policy }: { policy: AdminTaxPolicyVersion }) {
  return (
    <dl className="tax-policy-metadata-grid">
      <div><dt>State</dt><dd>{lifecycleLabel(policy.lifecycleStatus)}</dd></div>
      <div><dt>Vietnam effective time</dt><dd>{vietnamDateTimeLabel(policy.effectiveFrom)}</dd></div>
      <div><dt>Tax subject</dt><dd>{policy.taxSubject ?? 'Missing'}</dd></div>
      <div><dt>Legal source</dt><dd>{policy.legalSourceUrl ? <a className="text-link" href={policy.legalSourceUrl} rel="noreferrer" target="_blank">{policy.legalSourceTitle ?? 'Open source'}</a> : 'Missing'}</dd></div>
      <div><dt>Change summary</dt><dd>{policy.changeSummary ?? 'Missing'}</dd></div>
      <div><dt>Created by</dt><dd>{operatorLabel(policy.createdBy ?? undefined)} · {provenanceLabel(policy.provenance)}</dd></div>
      <div><dt>Source lineage</dt><dd>{policy.supersedesPolicyVersion ? `${policy.supersedesPolicyVersion.name} · ${provenanceLabel(policy.supersedesPolicyVersion.provenance)}` : 'New production source'}</dd></div>
      <div><dt>Policy ID</dt><dd><code>{policy.id}</code></dd></div>
    </dl>
  );
}

function PolicySummaryRow({ policy }: { policy: AdminTaxPolicyVersion }) {
  return (
    <div className="tax-policy-summary-row">
      <div><strong>{policy.name}</strong><p className="muted">{policy.changeSummary ?? 'No change summary'}</p></div>
      <div><strong>{vietnamDateTimeLabel(policy.effectiveFrom)}</strong><small>Vietnam time</small></div>
      <AdminFormControlLink className="button-outline" href={buildTaxPolicyEditorHref(policy.id)}>Review</AdminFormControlLink>
    </div>
  );
}

function CommandFact({ label, value }: { label: string; value: string }) {
  return <div className="tax-policy-command-fact"><span>{label}</span><strong>{value}</strong></div>;
}

function CapabilityNotice({
  available,
  capabilities,
}: {
  available: boolean;
  capabilities: AdminTaxPolicyCapabilities;
}) {
  const blockers = available ? capabilities.submitBlockers : EMPTY_CAPABILITIES.submitBlockers;
  return (
    <AdminNoticeCard className="admin-mt-12 admin-mb-12" role={blockers.length ? 'alert' : 'status'} tone={blockers.length ? 'warning' : 'success'}>
      <strong>{blockers.length ? 'Finance review is blocked' : 'Finance review capability verified'}</strong>
      <p className="muted">
        {blockers.length
          ? blockers.map((blocker) => blocker.message).join(' ')
          : `${capabilities.independentCheckerCount} independent checker(s) are ready.`}
      </p>
      {blockers.length ? <AdminFormControlLink className="button-outline" href="/finance-tax/finance-approvers">Review Finance Approvers</AdminFormControlLink> : null}
    </AdminNoticeCard>
  );
}

function IntegrityMetricCard({
  count,
  issue,
  label,
  oldestAt,
  severity,
  total,
}: {
  count: number;
  issue: string;
  label: string;
  oldestAt: string | null;
  severity: 'danger' | 'warning';
  total: number;
}) {
  const rate = total ? `${((count / total) * 100).toFixed(1)}%` : 'No denominator';
  return (
    <AdminInsightCard className="tax-policy-integrity-card">
      <div><span>{label}</span><StatusBadge tone={count ? severity : 'neutral'}>{count ? severity === 'danger' ? 'Integrity' : 'Readiness' : 'Clear'}</StatusBadge></div>
      <strong>{count} / {total}</strong>
      <p>{rate} of 30-day earnings · oldest {oldestAt ? ageLabel(oldestAt) : 'none'}</p>
      <small>Owner not assigned · SLA not configured</small>
      <AdminFormControlLink className="button-outline" href={`/tax-policy?view=integrity&issue=${encodeURIComponent(issue)}&issuePage=1`}>Review exact evidence</AdminFormControlLink>
    </AdminInsightCard>
  );
}

function integrityIssueLabel(issue: string) {
  return ({
    'amount-mismatch': 'Amount mismatch',
    'missing-snapshot': 'Missing immutable snapshot',
    'missing-tax-log': 'Missing tax log',
    'no-active-policy': 'No active policy at earning time',
    'no-approved-tax-profile': 'Tax profile not approved — applicability evidence missing',
    'no-matching-rule': 'No matching rule',
  } as Record<string, string>)[issue] ?? issue;
}

function ageLabel(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000));
  return days === 0 ? 'today' : `${days}d`;
}

function auditPolicyId(log?: AdminAuditLog) {
  if (!log) return null;
  if (log.target?.startsWith('tax_policy:')) return log.target.slice('tax_policy:'.length);
  const metadata = log.metadata;
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null;
  const values = metadata as Record<string, unknown>;
  return typeof values.policyVersionId === 'string' ? values.policyVersionId : null;
}

function AuditEvidence({ detail, log, open = false }: { detail: string; log?: AdminAuditLog; open?: boolean }) {
  const values = log?.metadata && !Array.isArray(log.metadata) && typeof log.metadata === 'object'
    ? log.metadata as Record<string, unknown>
    : {};
  const evidence = [
    ['Audit ID', log?.id],
    ['Target', log?.target],
    ['Policy version', auditPolicyId(log)],
    ['Approval request', auditString(values.approvalRequestId) ?? approvalRequestTarget(log?.target)],
    ['Payload hash', auditString(values.payloadHash)],
    ['Activation job', auditString(values.activationJobId)],
    ['Failure code', auditString(values.failureCode)],
    ['Before', auditSnapshot(values.before)],
    ['After', auditSnapshot(values.after)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <AdminDisclosure className="tax-policy-row-details" open={open}>
      <summary>Evidence fields</summary>
      <p>{detail}</p>
      <dl className="tax-policy-audit-evidence">
        {evidence.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><code>{value}</code></dd></div>)}
      </dl>
    </AdminDisclosure>
  );
}

function approvalRequestTarget(target?: string) {
  return target?.startsWith('tax_policy_approval:')
    ? target.slice('tax_policy_approval:'.length)
    : null;
}

function auditString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function auditSnapshot(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return '[unavailable]';
  }
}

function auditSourceParam(value: string | null) {
  return value === 'test' || value === 'legacy' || value === 'unknown' || value === 'test-legacy'
    ? value
    : 'production';
}

function integritySourceParam(value: string | null) {
  return value === 'production' || value === 'test' || value === 'legacy' || value === 'unknown'
    ? value
    : 'all';
}

function integritySourceLabel(value: AdminTaxPolicyIntegrityRecordPage['items'][number]['evidenceSource']) {
  return ({ LEGACY: 'Legacy / migration', PRODUCTION: 'Production / operator', TEST: 'Test / smoke', UNKNOWN: 'Unknown provenance' })[value];
}

function integritySourceTone(value: AdminTaxPolicyIntegrityRecordPage['items'][number]['evidenceSource']) {
  return ({ LEGACY: 'warning', PRODUCTION: 'success', TEST: 'info', UNKNOWN: 'danger' } as const)[value];
}

function integrityClassificationLabel(value: AdminTaxPolicyIntegrityRecordPage['items'][number]['classification']) {
  return ({
    APPLICABILITY_READINESS: 'Applicability / readiness',
    CURRENT_REGRESSION: 'Current production regression',
    LEGACY_MIGRATION_DEBT: 'Legacy / migration debt',
    UNKNOWN: 'Classification unknown',
  })[value];
}

function auditEvidenceSourceLabel(log?: AdminAuditLog) {
  if (!log?.policyProvenance) return 'Source provenance unavailable';
  return provenanceLabel(log.policyProvenance);
}

function taxPolicyReadiness(policy: AdminTaxPolicyVersion | null): { label: string; detail: string; tone: 'success' | 'warning' | 'danger' } {
  if (!policy) return { label: 'Critical', detail: 'No verified policy is currently in effect.', tone: 'danger' };
  if (policy.provenance !== 'OPERATOR') {
    return { label: 'Critical', detail: `${provenanceLabel(policy.provenance)} data is controlling live withholding.`, tone: 'danger' };
  }
  const hasDefault = policy.rules?.some((rule) => rule.active && rule.scope === 'DEFAULT');
  if (!policy.approvedAt || !policy.legalSourceUrl || !hasDefault) {
    return { label: 'Degraded', detail: 'The current policy is missing approval, legal source, or fallback rule evidence.', tone: 'warning' };
  }
  return { label: 'Ready', detail: 'Production policy, checker receipt, legal source, and fallback coverage are present.', tone: 'success' };
}

function successResult<T>(data: T) {
  return { data, ok: true as const, status: 200 };
}

function taxPolicyServiceOptions(groups: AdminServiceCatalogGroup[]) {
  const seen = new Set<string>();
  return groups.flatMap((group) => group.options)
    .filter((service) => service.active && service.publicationStatus !== 'ARCHIVED')
    .filter((service) => !seen.has(service.id) && Boolean(seen.add(service.id)))
    .map((service) => ({
      label: `${service.name} · ${service.durationMin} min`,
      value: service.id,
    }));
}

function simulationGrossAmount(value: string | null) {
  if (!value?.trim()) return 500_000;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 500_000;
}

function taxPolicySimulationHref(policyId: string, serviceType: string, grossAmount: number) {
  const query = new URLSearchParams({ serviceType, grossAmount: String(grossAmount) });
  return `/admin/tax-policy-versions/${encodeURIComponent(policyId)}/simulation?${query.toString()}`;
}

function simulationRuleSummary(simulation: AdminTaxPolicySimulation) {
  if (!simulation.lines.length) return 'No matching rule';
  return simulation.lines
    .map((line) => `${scopeLabel(line.scope)} · ${formatRate(line.rateBps)} · ${taxKindLabel(line.taxKind)}`)
    .join(' + ');
}

function taxKindLabel(value: string) {
  return ({
    PARTNER_VAT: 'Partner VAT',
    PARTNER_PIT: 'Partner PIT',
    PARTNER_WITHHOLDING_COMBINED: 'Combined withholding',
  } as Record<string, string>)[value] ?? 'Withholding';
}

function viewLabel(view: TaxPolicyView) {
  return ({ current: 'Current policy', drafts: 'Drafts & scheduled', history: 'History', integrity: 'Audit & integrity' })[view];
}

function lifecycleLabel(value?: string) {
  return ({
    ACTIVE: 'In effect', DRAFT: 'Draft', PENDING_APPROVAL: 'Awaiting review', APPROVED: 'Approved',
    SCHEDULED: 'Scheduled', SUPERSEDED: 'Replaced', ARCHIVED: 'Archived', REJECTED: 'Rejected',
    LEGACY_REVIEW: 'Test legacy · review required',
  } as Record<string, string>)[value ?? ''] ?? 'Unknown';
}

function lifecycleTone(value?: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (value === 'ACTIVE') return 'success';
  if (value === 'PENDING_APPROVAL' || value === 'SCHEDULED') return 'warning';
  if (value === 'REJECTED') return 'danger';
  if (value === 'DRAFT' || value === 'APPROVED') return 'info';
  return 'neutral';
}

function provenanceLabel(value?: string) {
  return ({ OPERATOR: 'Production', SMOKE_TEST: 'Smoke test', SEED: 'Seed', MIGRATION: 'Migration', LEGACY_UNKNOWN: 'Legacy unknown' } as Record<string, string>)[value ?? ''] ?? 'Unknown';
}

function scopeLabel(value: string) {
  return ({ DEFAULT: 'Fallback — all services', SERVICE_TYPE: 'Specific service', AMOUNT_BAND: 'Gross amount range' } as Record<string, string>)[value] ?? value;
}

function ruleAppliesTo(rule: AdminTaxRule) {
  if (rule.scope === 'SERVICE_TYPE') return rule.serviceType ?? 'Missing service';
  if (rule.scope === 'AMOUNT_BAND') return `${formatVnd(rule.minGrossAmount, 'No minimum')} – ${formatVnd(rule.maxGrossAmount, 'No maximum')}`;
  return 'All services not matched above';
}

function formatVnd(value: number | null | undefined, fallback: string) {
  return value == null ? fallback : `${value.toLocaleString('en-US')} VND`;
}

function formatRate(bps: number) {
  return `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function policyRateSummary(policy: AdminTaxPolicyVersion | null) {
  if (!policy?.rules?.length) return 'No rules';
  return [...new Set(policy.rules.filter((rule) => rule.active).map((rule) => formatRate(rule.rateBps)))].join(' / ') || 'No enabled rules';
}

function defaultRatePercent(policy: AdminTaxPolicyVersion) {
  const rateBps = policy.rules?.find((rule) => rule.active && rule.scope === 'DEFAULT')?.rateBps;
  return rateBps === undefined ? undefined : formatRateInput(rateBps);
}

function formatRateInput(rateBps: number) {
  return Number((rateBps / 100).toFixed(2));
}

function vietnamDateTimeLabel(value?: string | null) {
  if (!value) return 'Not recorded';
  const local = isoToVietnamDateTimeLocal(value);
  return local ? `${local.replace('T', ' ')} ICT` : 'Invalid timestamp';
}

function operatorLabel(operator?: {
  readonly email?: string | null;
  readonly fullName?: string | null;
  readonly phone?: string | null;
} | null) {
  return operator?.fullName ?? operator?.email ?? operator?.phone ?? 'Unknown operator';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}
