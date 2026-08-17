import { RefreshCw, RotateCcw, Search } from 'lucide-react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import {
  type AdminBooking,
  type AdminGetResult,
  type AdminMatchingPreview,
  type AdminOperationalPolicySetting,
  type AdminOperationalPolicyAuditPage,
  type AdminProvider,
  adminGetResult,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { readSearchParam } from '../../lib/date-range';
import { formatRelativeTime } from '../../lib/admin-format';
import { operationalPolicyAnchor } from '../../lib/operations-policy';
import { buildBookingAcceptanceMatrix } from './booking-acceptance-matrix';
import { buildMatchingStageImpactPreview } from './matching-stage-impact-preview';
import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { OperationsPolicyChangeImpactSection } from './operations-policy-change-impact-section';
import { OperationsPolicyDrilldownSection } from './operations-policy-drilldown-section';
import { OperationsPolicyDiagnosticsDisclosure } from './operations-policy-diagnostics-disclosure';
import { OperationsPolicyFinalPartnerChoiceSection } from './operations-policy-final-partner-choice-section';
import { OperationsPolicyForm } from './operations-policy-form';
import {
  buildOperationsPolicyGroups,
  isOperationsPolicyDeviation,
  normalizeOperationsPolicyGroup,
  normalizeOperationsPolicyLifecycle,
  normalizeOperationsPolicyStatus,
  operationsPolicyLifecycle,
  operationsPolicyCounts,
  type OperationsPolicyLifecycle,
} from './operations-policy-groups';
import { OperationsPolicyLiveSimulatorSection } from './operations-policy-live-simulator-section';
import { OperationsPolicyMatchingStageImpactSection } from './operations-policy-matching-stage-impact-section';
import { OperationsPolicyOutcomeEffectSection } from './operations-policy-outcome-effect-section';
import {
  buildOperationsPolicyAuditHref,
  buildOperationsPolicyLoadPlan,
  buildOperationsPolicyMatchingHref,
} from './operations-policy-page-model';
import { OperationsPolicySensitivityPreviewSection } from './operations-policy-sensitivity-preview-section';
import { buildPolicyDrilldown } from './policy-drilldown';
import { operationalPolicyAuditRows } from './policy-audit-rows';
import { buildPolicyImpactDashboard } from './policy-impact-dashboard';
import { policyImpactDetails } from './policy-impact-details';
import { buildPolicyOutcomeEffect } from './policy-outcome-effect';
import { buildPolicySupplySensitivity } from './policy-supply-sensitivity';
import { policyDisplayValue } from './policy-value-display';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canLoadFullDiagnostics = hasAdminOperatorCategory(operatorAccess, 'DEVELOPER_SYSTEM');
  const loadPlan = buildOperationsPolicyLoadPlan(params, { allowFullDiagnostics: canLoadFullDiagnostics });
  const [settingsResult, bookingsResult, providersResult, matchingPreviewResult, auditResult, auditHealthResult] = await Promise.all([
    loadPlan.settingsHref
      ? adminGetResult<AdminOperationalPolicySetting[]>(loadPlan.settingsHref, [], {
          freshness: 'aggregate',
          revalidateSeconds: 30,
          tags: ['operations-policy'],
        })
      : Promise.resolve({ data: [], ok: true, status: null }),
    getOptionalResult<AdminBooking[]>(loadPlan.bookingsHref, []),
    getOptionalResult<AdminProvider[]>(loadPlan.providersHref, []),
    getOptionalResult<AdminMatchingPreview | null>(loadPlan.matchingPreviewHref, null),
    getOptionalResult<AdminOperationalPolicyAuditPage>(loadPlan.policyAuditHref, { items: [], nextCursor: null, source: 'operator' }),
    getOptionalResult<AdminOperationalPolicyAuditPage>(loadPlan.policyWriteAuditHealthHref, { items: [], nextCursor: null, source: 'operator' }),
  ]);
  const settings = settingsResult.data;
  const bookings = bookingsResult.data;
  const providers = providersResult.data;
  const selectedPolicyKey = readSearchParam(params.edit);
  const selectedSetting = settings.find((setting) => setting.key === selectedPolicyKey) ?? null;
  const query = readSearchParam(params.q);
  const statusFilter = normalizeOperationsPolicyStatus(readSearchParam(params.status));
  const lifecycleFilter = normalizeOperationsPolicyLifecycle(readSearchParam(params.lifecycle));
  const routeGroup =
    loadPlan.detailsMode === 'matching' && loadPlan.matchingMode === 'policy'
      ? 'matching-availability'
      : loadPlan.detailsMode === 'decisions' && loadPlan.decisionMode === 'editor'
        ? 'exceptions-evidence'
        : normalizeOperationsPolicyGroup(readSearchParam(params.group));
  const policyGroups = buildOperationsPolicyGroups(settings, {
    group: routeGroup,
    lifecycle: lifecycleFilter,
    query,
    status: statusFilter,
  });
  const counts = operationsPolicyCounts(settings);
  const observedAt = new Date().toISOString();
  const auditMode = loadPlan.auditSource;
  const policyAuditRows = operationalPolicyAuditRows(auditResult.data.items);
  const auditHistory = loadPlan.auditCursorHistory;
  const auditNewerCursor = auditHistory.at(-1) ?? null;
  const auditNextHistory = loadPlan.auditCursor
    ? [...auditHistory, loadPlan.auditCursor]
    : auditHistory;
  const auditFirstHref = loadPlan.auditCursor ? buildOperationsPolicyAuditHref(auditMode) : null;
  const auditNewerHref = loadPlan.auditCursor
    ? buildOperationsPolicyAuditHref(auditMode, auditNewerCursor, auditHistory.slice(0, -1))
    : null;
  const auditNextHref = auditResult.data.nextCursor
    ? buildOperationsPolicyAuditHref(auditMode, auditResult.data.nextCursor, auditNextHistory)
    : null;
  const refreshHref = currentOperationsPolicyHref(params);

  const acceptanceMatrix = loadPlan.shouldRenderMatchingSupply
    ? buildBookingAcceptanceMatrix(settings, providers)
    : null;
  const supplySensitivity = loadPlan.shouldRenderMatchingSupply
    ? buildPolicySupplySensitivity(settings, bookings, providers)
    : null;
  const matchingStageImpactPreview = loadPlan.shouldRenderMatchingSupply
    ? buildMatchingStageImpactPreview(settings, bookings, providers)
    : null;
  const impactDashboard = loadPlan.shouldRenderMatchingSimulation
    ? buildPolicyImpactDashboard(settings, bookings)
    : null;
  const policyEffectAnalysis = loadPlan.shouldRenderMatchingSimulation
    ? buildPolicyOutcomeEffect(settings, bookings)
    : null;
  const policyDrilldown = loadPlan.shouldRenderMatchingSimulation
    ? buildPolicyDrilldown(bookings, settings)
    : null;
  const evidenceUsesDemoReference = supplySensitivity?.referenceLabel === 'Demo Ho Chi Minh City';
  const usableSupply = Number(
    supplySensitivity?.summary.find((metric) => metric.label === 'Current visible supply')?.value ?? 0,
  );
  const supplyEvidenceFailed = !bookingsResult.ok || !providersResult.ok || !settingsResult.ok;
  const historicalEvidenceFailed = !bookingsResult.ok || !settingsResult.ok;

  return (
    <AdminPageTemplate
      contentClassName="operations-policy-page"
      description="Review live operating rules, change one policy with explicit evidence, and verify the resulting audit record."
      title="Operations Policy"
    >
      <nav aria-label="Operations Policy workspaces" className="operations-policy-workspace-nav">
        <span>Workspace</span>
        <AdminFilterChipGroup ariaLabel="Operations Policy workspaces">
          <AdminFormControlLink
            aria-current={loadPlan.shouldRenderPolicyOverview ? 'page' : undefined}
            className={loadPlan.shouldRenderPolicyOverview ? 'is-active' : undefined}
            href="/operations-policy"
          >
            Policies
          </AdminFormControlLink>
          {canLoadFullDiagnostics ? <AdminFormControlLink
            aria-current={loadPlan.shouldRenderMatchingSupply ? 'page' : undefined}
            className={loadPlan.shouldRenderMatchingSupply ? 'is-active' : undefined}
            href={buildOperationsPolicyMatchingHref('supply')}
          >
            Supply
          </AdminFormControlLink> : null}
          {canLoadFullDiagnostics ? (
            <>
              <AdminFormControlLink
                aria-current={loadPlan.shouldRenderMatchingSimulation ? 'page' : undefined}
                className={loadPlan.shouldRenderMatchingSimulation ? 'is-active' : undefined}
                href={buildOperationsPolicyMatchingHref('simulation')}
              >
                Simulation
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={loadPlan.shouldRenderAuditReview ? 'page' : undefined}
                className={loadPlan.shouldRenderAuditReview ? 'is-active' : undefined}
                href="/operations-policy?details=audit"
              >
                Audit
              </AdminFormControlLink>
            </>
          ) : null}
        </AdminFilterChipGroup>
      </nav>

      {loadPlan.shouldRenderPermissionDenied ? (
        <AdminNoticeCard role="alert" tone="danger">
          <AdminSectionHeader
            description="This diagnostic workspace requires Developer/System access. Policy settings were not loaded and the request was not redirected."
            status={<StatusBadge tone="danger">403 · Access denied</StatusBadge>}
            title="Operations Policy diagnostics are restricted"
          />
        </AdminNoticeCard>
      ) : null}

      {!settingsResult.ok ? (
        <AdminNoticeCard role="alert" tone="danger">
          <AdminSectionHeader
            actions={<AdminFormControlLink className="button-secondary" href={refreshHref}>Retry</AdminFormControlLink>}
            description="Policy settings could not be loaded. Do not treat this as zero policies or an aligned state."
            status={<StatusBadge tone="danger">Unavailable</StatusBadge>}
            title="Operations Policy is not ready for decisions"
          />
        </AdminNoticeCard>
      ) : null}

      {loadPlan.shouldRenderPolicyOverview && settingsResult.ok ? (
        <>
          <section aria-labelledby="operations-policy-attention-title" className="operations-policy-attention">
            <div className="operations-policy-attention-header">
              <div>
                <h2 id="operations-policy-attention-title">Policy command strip</h2>
                <p>Current deviations need review. Saved values and lifecycle counts are separate facts.</p>
              </div>
              <AdminFormControlLink className="button-secondary" href={refreshHref}>
                <RefreshCw size={16} aria-hidden="true" />
                Refresh policies
              </AdminFormControlLink>
            </div>
            <div className="operations-policy-attention-strip" aria-label="Policy status summary">
              <AdminFormControlLink
                className="operations-policy-attention-item"
                href={operationsPolicyFilterHref(query, 'needs-review', routeGroup, lifecycleFilter)}
              >
                <span>Current deviations</span><strong>{counts.deviationCount}</strong>
              </AdminFormControlLink>
              <AdminFormControlLink
                className="operations-policy-attention-item"
                href={operationsPolicyFilterHref(query, 'changed', routeGroup, lifecycleFilter)}
              >
                <span>Saved values</span><strong>{counts.changedCount}</strong>
                <small>
                  Operator {counts.provenanceCounts.operator} · Smoke {counts.provenanceCounts.automatedSmoke} · Legacy/unknown {counts.provenanceCounts.legacyUnknown + counts.provenanceCounts.unattributed}
                </small>
              </AdminFormControlLink>
              <AdminFormControlLink
                className="operations-policy-attention-item"
                href={operationsPolicyFilterHref(query, statusFilter, routeGroup, 'live')}
              ><span>Live</span><strong>{counts.lifecycleCounts.live}</strong></AdminFormControlLink>
              <AdminFormControlLink
                className="operations-policy-attention-item"
                href={operationsPolicyFilterHref(query, statusFilter, routeGroup, 'locked')}
              ><span>Locked</span><strong>{counts.lifecycleCounts.locked}</strong></AdminFormControlLink>
              <AdminFormControlLink
                className="operations-policy-attention-item"
                href={operationsPolicyFilterHref(query, statusFilter, routeGroup, 'planned')}
              ><span>Planned</span><strong>{counts.lifecycleCounts.planned}</strong></AdminFormControlLink>
              {counts.lifecycleCounts.unknown > 0 ? (
                <AdminFormControlLink
                  className="operations-policy-attention-item"
                  href={operationsPolicyFilterHref(query, statusFilter, routeGroup, 'unknown')}
                ><span>Unknown contract</span><strong>{counts.lifecycleCounts.unknown}</strong></AdminFormControlLink>
              ) : null}
            </div>
          </section>

          {settings.length === 0 ? (
            <AdminEmptyState
              framed
              message="No operational policy definitions were returned. Check API seed and policy consistency before editing."
              title="No policies loaded"
            />
          ) : (
            <>
              <AdminDirectoryFilterForm className="operations-policy-filter-bar" method="get" noValidate>
                <AdminFormSearch
                  defaultValue={query}
                  label="Search policies"
                  labelVisibility="visible"
                  name="q"
                  placeholder="Search label or description"
                />
                <AdminFormSelect
                  defaultValue={statusFilter}
                  label="Status"
                  labelVisibility="visible"
                  name="status"
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Needs review', value: 'needs-review' },
                    { label: 'Changed before', value: 'changed' },
                  ]}
                />
                <AdminFormSelect
                  defaultValue={routeGroup}
                  label="Operating group"
                  labelVisibility="visible"
                  name="group"
                  options={[
                    { label: 'All groups', value: 'all' },
                    ...buildOperationsPolicyGroups(settings).map((group) => ({
                      label: group.label,
                      value: group.id,
                    })),
                  ]}
                />
                <AdminFormSelect
                  defaultValue={lifecycleFilter}
                  label="Lifecycle"
                  labelVisibility="visible"
                  name="lifecycle"
                  options={[
                    { label: 'All lifecycle states', value: 'all' },
                    { label: 'Live', value: 'live' },
                    { label: 'Locked', value: 'locked' },
                    { label: 'Planned', value: 'planned' },
                    { label: 'Deprecated', value: 'deprecated' },
                    { label: 'Unknown', value: 'unknown' },
                  ]}
                />
                <div className="operations-policy-filter-actions">
                  <AdminFormControlButton className="button-primary" type="submit">
                    <Search size={16} aria-hidden="true" />
                    Apply filters
                  </AdminFormControlButton>
                  <AdminFormControlLink className="button-secondary" href="/operations-policy">
                    <RotateCcw size={16} aria-hidden="true" />
                    Reset
                  </AdminFormControlLink>
                </div>
              </AdminDirectoryFilterForm>

              {policyGroups.length === 0 ? (
                <AdminEmptyState
                  framed
                  message="No policy matches the selected search, status, group, and lifecycle filters."
                  title="No matching policies"
                />
              ) : (
                <div className={`operations-policy-workspace${selectedSetting ? ' has-editor' : ''}`}>
                  <div className="operations-policy-group-list">
                    {policyGroups.map((group, index) => (
                      <details
                        className="operations-policy-group"
                        key={group.id}
                        open={group.deviationCount > 0 || index === 0 || routeGroup !== 'all'}
                      >
                        <summary>
                          <div>
                            <strong>{group.label}</strong>
                            <span>{group.description}</span>
                          </div>
                          <div className="operations-policy-group-counts">
                            <span>{group.rows.length} shown / {group.allCount} total</span>
                            <span>{group.deviationCount} needs review</span>
                            <span>{group.changedCount} changed</span>
                          </div>
                        </summary>
                        <div className="operations-policy-list" role="table" aria-label={`${group.label} policies`}>
                          <div className="operations-policy-list-header" role="row">
                            <span role="columnheader">Policy</span>
                            <span role="columnheader">Current value</span>
                            <span role="columnheader">Status</span>
                            <span role="columnheader">Last changed</span>
                            <span role="columnheader">Action</span>
                          </div>
                          {group.rows.map((setting) => {
                            const deviation = isOperationsPolicyDeviation(setting);
                            const impact = policyImpactDetails(setting.key);
                            const lifecycle = operationsPolicyLifecycle(setting);
                            const isEditing = selectedSetting?.key === setting.key;
                            return (
                              <div className="operations-policy-list-row" key={setting.key} role="row">
                                <div className="operations-policy-list-policy" role="cell">
                                  <strong>{setting.label}</strong>
                                  <p>{setting.description}</p>
                                  <details>
                                    <summary>Operating impact</summary>
                                    <p><strong>{impact.title}</strong> {impact.detail}</p>
                                  </details>
                                </div>
                                <div role="cell">
                                  <strong>{policyDisplayValue(setting)}</strong>
                                  {deviation ? <small>Recommended: {policyDisplayValue(setting, true)}</small> : null}
                                </div>
                                <div role="cell">
                                  <StatusBadge tone={lifecycle === 'live' ? (deviation ? 'warning' : 'success') : 'info'}>
                                    {lifecycle === 'live' ? (deviation ? 'Live · needs review' : 'Live · baseline aligned') : lifecycleLabel(lifecycle)}
                                  </StatusBadge>
                                  {lifecycle === 'live' && !deviation ? (
                                    <small>Saved/current value matches the launch baseline; supply is not verified here.</small>
                                  ) : null}
                                </div>
                                <div role="cell">
                                  {setting.updatedAt ? (
                                    <>
                                      <DateTimeText value={setting.effectiveAt ?? setting.updatedAt} />
                                      <small>{policyProvenanceLabel(setting)}</small>
                                      <small>{setting.updatedBy?.fullName ?? setting.updatedBy?.phone ?? 'Actor not recorded'}</small>
                                      {!deviation ? <small>Restored to baseline</small> : null}
                                    </>
                                  ) : (
                                    <span>Never changed</span>
                                  )}
                                </div>
                                <div role="cell">
                                  {lifecycle === 'live' ? (
                                    <AdminTextLink
                                      aria-current={isEditing ? 'page' : undefined}
                                      href={operationsPolicyEditHref(setting.key, query, statusFilter, routeGroup, lifecycleFilter)}
                                    >
                                      {isEditing ? 'Editing' : 'Review change'}
                                    </AdminTextLink>
                                  ) : <span className="muted">Read only</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                  {selectedSetting && operationsPolicyLifecycle(selectedSetting) === 'live' && auditHealthResult.ok ? (
                    <aside aria-label={`Change ${selectedSetting.label}`} className="operations-policy-editor">
                      <OperationsPolicyForm key={selectedSetting.key} setting={selectedSetting} />
                    </aside>
                  ) : selectedSetting && operationsPolicyLifecycle(selectedSetting) === 'live' ? (
                    <AdminNoticeCard role="alert" tone="danger">
                      <AdminSectionHeader
                        actions={(
                          <div className="admin-inline-actions">
                            <AdminFormControlLink className="button-secondary" href={refreshHref}>Retry</AdminFormControlLink>
                            <AdminFormControlLink className="button-secondary" href="/background-jobs">System Health</AdminFormControlLink>
                          </div>
                        )}
                        description="Policy audit evidence could not be read. Changes are disabled until the audit service is available."
                        status={<StatusBadge tone="danger">Writes disabled</StatusBadge>}
                        title="Policy audit is unavailable"
                      />
                    </AdminNoticeCard>
                  ) : selectedSetting ? (
                    <AdminNoticeCard role="alert" tone={operationsPolicyLifecycle(selectedSetting) === 'unknown' ? 'danger' : 'info'}>
                      <strong>{selectedSetting.label} is {operationsPolicyLifecycle(selectedSetting)}</strong>
                      <p>{operationsPolicyLifecycle(selectedSetting) === 'unknown'
                        ? 'Lifecycle metadata is missing or unsupported. Editing is disabled until the API returns an explicit lifecycle contract.'
                        : selectedSetting.consumerContract?.fallbackBehavior ?? 'This policy is read-only in the current runtime contract.'}</p>
                    </AdminNoticeCard>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {loadPlan.shouldRenderMatchingSupply ? (
        <AdminSection
          actions={
            <AdminFormControlLink className="button-secondary" href={refreshHref}>
              <RefreshCw size={16} aria-hidden="true" />
              Refresh evidence
            </AdminFormControlLink>
          }
          className="operations-policy-evidence-header"
          description={(
            <>
              Observed <DateTimeText value={observedAt} /> ({formatRelativeTime(observedAt, { justNow: 'just now', includeFuture: true })}). Sources: operational policy settings, {bookings.length} recent booking records, and {providers.length} bounded Partner records.
            </>
          )}
          statusLabel={supplyEvidenceFailed ? 'Unavailable' : usableSupply === 0 ? 'Blocked · no eligible Partner supply' : 'Ready'}
          statusTone={supplyEvidenceFailed || usableSupply === 0 ? 'danger' : 'success'}
          title="Supply evidence"
        >
          {supplyEvidenceFailed ? (
            <AdminEmptyState
              framed
              message="The operational evidence sample could not be loaded. Refresh before using this workspace for a policy decision."
              title="Evidence unavailable"
            />
          ) : null}
          {evidenceUsesDemoReference ? (
            <AdminNoticeCard role="status" tone="warning">
              <AdminSectionHeader
                description="No usable booking coordinate was available, so the workspace uses a Ho Chi Minh City reference point. Refresh with production evidence before deciding a live policy change."
                status={<StatusBadge tone="warning">Demo reference</StatusBadge>}
                title="Do not use this coordinate for production policy decisions"
              />
            </AdminNoticeCard>
          ) : null}
          {!supplyEvidenceFailed && usableSupply === 0 ? (
            <AdminNoticeCard role="alert" tone="danger">
              <AdminSectionHeader
                actions={
                  <div className="admin-inline-actions">
                    <AdminFormControlLink className="button-secondary" href="/partner-controls?details=controls&review=location">Review Partner location</AdminFormControlLink>
                    <AdminFormControlLink className="button-secondary" href="/notifications?view=delivery">Review push delivery</AdminFormControlLink>
                  </div>
                }
                description="No currently usable Partner supply exists inside the sampled radius and freshness gates. This is a supply blocker, not a policy-alignment success."
                status={<StatusBadge tone="danger">0 usable Partners</StatusBadge>}
                title="Supply is not ready"
              />
            </AdminNoticeCard>
          ) : null}
        </AdminSection>
      ) : null}

      {loadPlan.shouldRenderMatchingSupply && !supplyEvidenceFailed ? (
        usableSupply === 0 ? (
          <OperationsPolicyDiagnosticsDisclosure>
            <div className="operations-policy-diagnostic-stack">
              <OperationsPolicyFinalPartnerChoiceSection matrix={acceptanceMatrix!} />
              <OperationsPolicySensitivityPreviewSection sensitivity={supplySensitivity!} />
              {matchingStageImpactPreview!.openMatchingCount > 0 ? (
                <OperationsPolicyMatchingStageImpactSection preview={matchingStageImpactPreview!} />
              ) : (
                <AdminEmptyState framed message="No open bookings to model." title="No matching stage sample" />
              )}
            </div>
          </OperationsPolicyDiagnosticsDisclosure>
        ) : (
          <>
            <OperationsPolicyFinalPartnerChoiceSection matrix={acceptanceMatrix!} />
            <OperationsPolicySensitivityPreviewSection sensitivity={supplySensitivity!} />
            <OperationsPolicyMatchingStageImpactSection preview={matchingStageImpactPreview!} />
          </>
        )
      ) : null}

      {loadPlan.shouldRenderMatchingSimulation ? (
        <>
          <OperationsPolicyLiveSimulatorSection
            preview={matchingPreviewResult.data}
            refreshHref={refreshHref}
            unavailable={!matchingPreviewResult.ok}
          />
          <AdminSection
            className="operations-policy-historical-evidence admin-mb-16"
            description="Past booking policy snapshots and outcomes. This evidence remains independent of current Partner supply."
            statusLabel={historicalEvidenceFailed ? 'Unavailable' : bookings.length > 0 ? `${bookings.length} booking records` : 'No history'}
            statusTone={historicalEvidenceFailed ? 'danger' : 'neutral'}
            title="Historical policy evidence"
          >
            {historicalEvidenceFailed ? (
              <AdminEmptyState
                framed
                message="Historical booking evidence could not be loaded. The current dispatch preview above remains independently usable."
                title="Historical evidence unavailable"
              />
            ) : bookings.length === 0 ? (
              <AdminEmptyState
                framed
                message="No recent booking policy snapshots are available for historical comparison."
                title="No historical booking evidence"
              />
            ) : null}
          </AdminSection>
          {!historicalEvidenceFailed && bookings.length > 0 ? (
            <>
              <OperationsPolicyChangeImpactSection dashboard={impactDashboard!} sampledBookingCount={bookings.length} />
              <OperationsPolicyDrilldownSection drilldown={policyDrilldown!} />
              <OperationsPolicyOutcomeEffectSection analysis={policyEffectAnalysis!} />
            </>
          ) : null}
        </>
      ) : null}

      {loadPlan.shouldRenderAuditReview ? (
        !auditResult.ok ? (
          <AdminNoticeCard role="alert" tone="danger">
            <AdminSectionHeader
              actions={<AdminFormControlLink className="button-secondary" href={refreshHref}>Retry</AdminFormControlLink>}
              description={auditResult.status === 401 || auditResult.status === 403
                ? 'Your current Admin access cannot read policy audit evidence. This is an access denial, not an empty audit trail.'
                : 'Policy audit records could not be loaded. This is an API failure, not an empty audit trail.'}
              status={<StatusBadge tone="danger">{auditResult.status === 401 || auditResult.status === 403 ? '403 · Access denied' : 'Unavailable'}</StatusBadge>}
              title={auditResult.status === 401 || auditResult.status === 403 ? 'Policy audit access denied' : 'Policy audit unavailable'}
            />
          </AdminNoticeCard>
        ) : (
          <OperationsPolicyAuditTrailSection
            firstHref={auditFirstHref}
            mode={auditMode}
            newerHref={auditNewerHref}
            nextHref={auditNextHref}
            pageNumber={loadPlan.auditCursor ? auditHistory.length + 2 : 1}
            rows={policyAuditRows}
          />
        )
      ) : null}
    </AdminPageTemplate>
  );
}

async function getOptionalResult<T>(href: string | null, fallback: T): Promise<AdminGetResult<T>> {
  return href
    ? adminGetResult<T>(href, fallback)
    : Promise.resolve({ data: fallback, ok: true, status: null });
}

function lifecycleLabel(lifecycle: OperationsPolicyLifecycle) {
  if (lifecycle === 'locked') return 'Locked · fixed contract';
  if (lifecycle === 'planned') return 'Planned · reference only';
  if (lifecycle === 'deprecated') return 'Deprecated';
  if (lifecycle === 'unknown') return 'Unknown · editing disabled';
  return 'Live';
}

function operationsPolicyEditHref(
  key: string,
  query: string,
  status: string,
  group: string,
  lifecycle: string,
) {
  const search = new URLSearchParams({ edit: key });
  if (query) search.set('q', query);
  if (status !== 'all') search.set('status', status);
  if (group !== 'all') search.set('group', group);
  if (lifecycle !== 'all') search.set('lifecycle', lifecycle);
  return `/operations-policy?${search.toString()}#${operationalPolicyAnchor(key)}`;
}

function operationsPolicyFilterHref(
  query: string,
  status: string,
  group: string,
  lifecycle: string,
) {
  const search = new URLSearchParams();
  if (query) search.set('q', query);
  if (status !== 'all') search.set('status', status);
  if (group !== 'all') search.set('group', group);
  if (lifecycle !== 'all') search.set('lifecycle', lifecycle);
  const value = search.toString();
  return value ? `/operations-policy?${value}` : '/operations-policy';
}

function policyProvenanceLabel(setting: AdminOperationalPolicySetting) {
  if (setting.auditSource === 'operator') return 'Operator changed';
  if (setting.auditSource === 'automated_smoke') return 'Verified smoke';
  if (setting.auditSource === 'legacy_unknown') return 'Legacy / unknown source';
  return 'Audit source unavailable';
}

function currentOperationsPolicyHref(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/operations-policy?${query}` : '/operations-policy';
}
