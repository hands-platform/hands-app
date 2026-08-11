import { Settings } from 'lucide-react';
import { canViewAdminDeveloperSystem } from '../../components/admin-developer-system-section';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import {
  AdminNotePanel,
  AdminNoticeCard,
  AdminSection,
} from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import {
  AdminAuditLog,
  AdminBooking,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { readSearchParam } from '../../lib/date-range';
import { operationalPolicyAnchor } from '../../lib/operations-policy';
import { buildActionGatePolicyChecklist } from './action-gate-policy-checklist';
import { buildBookingAcceptanceMatrix } from './booking-acceptance-matrix';
import { buildBookingCreateGateReview } from './booking-create-gate-review';
import { buildMatchingStageImpactPreview } from './matching-stage-impact-preview';
import { buildMatchingPlaybook } from './matching-playbook';
import { buildPolicyEnforcementTrace } from './policy-enforcement-trace';
import { buildPolicyDrilldown } from './policy-drilldown';
import { buildPolicyImpactDashboard } from './policy-impact-dashboard';
import { buildPolicyOutcomeEffect } from './policy-outcome-effect';
import { buildPolicyRecommendationReview } from './policy-recommendation-review';
import { buildPolicySimulation } from './policy-simulation';
import { buildPolicySupplySensitivity } from './policy-supply-sensitivity';
import { formatSnapshotPolicyValue } from './policy-snapshot';
import { operationsOwnerDecisionBacklog } from './owner-decision-backlog';
import { OperationsPolicyActionGateChecklistSection } from './operations-policy-action-gate-checklist-section';
import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { OperationsPolicyAuthorityBaselineSection } from './operations-policy-authority-baseline-section';
import { OperationsPolicyBookingCreateGateSection } from './operations-policy-booking-create-gate-section';
import { OperationsPolicyChangeImpactSection } from './operations-policy-change-impact-section';
import { OperationsPolicyDrilldownSection } from './operations-policy-drilldown-section';
import { OperationsPolicyEnforcementTraceSection } from './operations-policy-enforcement-trace-section';
import { OperationsPolicyFinalPartnerChoiceSection } from './operations-policy-final-partner-choice-section';
import { OperationsPolicyMatchingStageImpactSection } from './operations-policy-matching-stage-impact-section';
import { OperationsPolicyLiveSimulatorSection } from './operations-policy-live-simulator-section';
import { OperationsPolicyMatchingPlaybookSection } from './operations-policy-matching-playbook-section';
import { OperationsPolicyNextChoicesSection } from './operations-policy-next-choices-section';
import { OperationsPolicyOutcomeEffectSection } from './operations-policy-outcome-effect-section';
import { OperationsPolicyForm } from './operations-policy-form';
import { OperationsPolicyOwnerDecisionBacklogSection } from './operations-policy-owner-decision-backlog-section';
import { OperationsPolicyRecommendedValueReviewSection } from './operations-policy-recommended-value-review-section';
import { OperationsPolicySensitivityPreviewSection } from './operations-policy-sensitivity-preview-section';
import { buildOwnerDecisionPressure } from './owner-decision-pressure';
import { operationalPolicyAuditRows } from './policy-audit-rows';
import { operationsPolicyNotice } from './policy-notice';
import { policyDisplayByKey } from './policy-value-display';
import { policyDisplayValue } from './policy-value-display';
import { policyImpactDetails } from './policy-impact-details';
import {
  buildOperationsPolicyDecisionHref,
  buildOperationsPolicyDetailsHref,
  buildOperationsPolicyLoadPlan,
  buildOperationsPolicyMatchingHref,
} from './operations-policy-page-model';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

// External setup marker: Vonage is the selected deferred SMS path before real Phone Auth/SMS E2E.
// Static authority markers mirrored from child sections for guard coverage:
// Final partner choice control matrix
// Current partner acceptance impact
// Matching stage impact preview
// Policy enforcement evidence
// operationalPolicyAnchor(setting.key)
// id={operationalPolicyAnchor(setting.key)}
// OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes
// OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters
// OPERATIONAL_POLICY_KEYS.walletNegativeGate
// Keep first-pick priority with customer fallback.
// The preferred Partner can match first under API rules, marketplace Partners can still enter the shortlist, and the customer chooses only when first-pick does not win.
export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canLoadFullDiagnostics = canViewAdminDeveloperSystem(operatorAccess);
  const loadPlan = buildOperationsPolicyLoadPlan(params, { allowFullDiagnostics: canLoadFullDiagnostics });
  const [settings, bookings, providers, policyAuditLogs, bookingGateAuditLogs] = await Promise.all([
    adminGet<AdminOperationalPolicySetting[]>(loadPlan.settingsHref, []),
    loadPlan.bookingsHref
      ? adminGet<AdminBooking[]>(loadPlan.bookingsHref, [])
      : Promise.resolve<AdminBooking[]>([]),
    loadPlan.providersHref
      ? adminGet<AdminProvider[]>(loadPlan.providersHref, [])
      : Promise.resolve<AdminProvider[]>([]),
    loadPlan.policyAuditHref
      ? adminGet<AdminAuditLog[]>(loadPlan.policyAuditHref, [])
      : Promise.resolve<AdminAuditLog[]>([]),
    loadPlan.bookingGateAuditHref
      ? adminGet<AdminAuditLog[]>(loadPlan.bookingGateAuditHref, [])
      : Promise.resolve<AdminAuditLog[]>([]),
  ]);
  const auditLogs = [...policyAuditLogs, ...bookingGateAuditLogs];
  const shouldRenderAdvancedIndex = loadPlan.shouldRenderAdvancedIndex;
  const shouldRenderMatchingReview = loadPlan.shouldRenderMatchingReview;
  const shouldRenderMatchingSupply = loadPlan.shouldRenderMatchingSupply;
  const shouldRenderMatchingSimulation = loadPlan.shouldRenderMatchingSimulation;
  const shouldRenderDecisionReview = loadPlan.shouldRenderDecisionReview;
  const shouldRenderDecisionEvidence = loadPlan.shouldRenderDecisionEvidence;
  const shouldRenderAuditReview = loadPlan.shouldRenderAuditReview;
  const shouldRenderPolicyOverview = loadPlan.shouldRenderPolicyOverview;
  const shouldRenderMatchingPolicy = loadPlan.shouldRenderMatchingPolicy;
  const shouldRenderDecisionSummary = loadPlan.shouldRenderDecisionSummary;
  const shouldRenderMatchingEditor =
    shouldRenderMatchingPolicy && (!shouldRenderMatchingReview || loadPlan.matchingMode === 'policy');
  const needsAcceptanceReview = shouldRenderMatchingSupply || shouldRenderDecisionEvidence;
  const needsSupplyReview = shouldRenderMatchingSupply || shouldRenderDecisionEvidence;
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const selectedPolicyKey = readSearchParam(params.edit);
  const selectedSetting = settings.find((setting) => setting.key === selectedPolicyKey) ?? null;
  const notice = operationsPolicyNotice(params);
  const matchingPlaybook = shouldRenderMatchingReview && loadPlan.matchingMode === 'policy'
    ? buildMatchingPlaybook((key) => policyDisplayByKey(settings, key))
    : null;
  const recommendationReview = shouldRenderPolicyOverview
    ? buildPolicyRecommendationReview(settings, bookings)
    : null;
  const acceptanceMatrix = needsAcceptanceReview
    ? buildBookingAcceptanceMatrix(settings, providers)
    : null;
  const bookingCreateGateReview = shouldRenderPolicyOverview
    ? buildBookingCreateGateReview(settings, auditLogs)
    : null;
  const actionGatePolicyChecklist = shouldRenderPolicyOverview
    ? buildActionGatePolicyChecklist(settings, formatSnapshotPolicyValue)
    : null;
  const policySimulation = shouldRenderMatchingSimulation
    ? buildPolicySimulation(settings, bookings, providers)
    : null;
  const impactDashboard = shouldRenderMatchingSimulation
    ? buildPolicyImpactDashboard(settings, bookings)
    : null;
  const policyEffectAnalysis = shouldRenderMatchingSimulation
    ? buildPolicyOutcomeEffect(settings, bookings)
    : null;
  const policyDrilldown = shouldRenderMatchingSimulation
    ? buildPolicyDrilldown(bookings, settings)
    : null;
  const policyAuditRows = shouldRenderAuditReview ? operationalPolicyAuditRows(auditLogs) : null;
  const supplySensitivity = needsSupplyReview
    ? buildPolicySupplySensitivity(settings, bookings, providers)
    : null;
  const matchingStageImpactPreview = shouldRenderMatchingSupply
    ? buildMatchingStageImpactPreview(settings, bookings, providers)
    : null;
  const policyEnforcementTrace = shouldRenderAuditReview
    ? buildPolicyEnforcementTrace(settings)
    : null;
  const ownerDecisionBacklog = shouldRenderDecisionEvidence ? operationsOwnerDecisionBacklog() : null;
  const ownerDecisionPressure =
    shouldRenderDecisionEvidence && supplySensitivity && acceptanceMatrix
      ? buildOwnerDecisionPressure(bookings, providers, supplySensitivity, acceptanceMatrix)
      : null;
  const shouldRenderDecisionEditor =
    shouldRenderDecisionReview && loadPlan.decisionMode === 'editor';

  return (
    <AdminPageTemplate
      contentClassName="operations-policy-page"
      description="Compare active operating rules and change one policy at a time with a recorded reason and effective time."
      title="Operations Policy"
    >

      {notice ? (
        <AdminNoticeCard role="status" tone={notice.tone === 'success' ? 'success' : 'danger'}>
          <AdminSectionHeader
            description={notice.detail}
            status={
              <StatusBadge tone={notice.tone === 'success' ? 'success' : 'danger'}>
                {notice.tone === 'success' ? 'Saved' : 'Blocked'}
              </StatusBadge>
            }
            title={notice.title}
          />
        </AdminNoticeCard>
      ) : null}

      {shouldRenderPolicyOverview ? (
        <AdminTablePanel
          className="admin-mb-16"
          description="Current and recommended values are read-only here. Open one controlled change panel from the selected row."
          resultLabel={`${settings.length} policies`}
          resultTone="info"
          title="Policy comparison"
        >
          <AdminTableScroll>
            <AdminDataTable
              emptyMessage="No operational policies are available."
              headers={[
                'Policy',
                'Current value',
                'Recommended value',
                'Scope',
                'Operating impact',
                'Last changed by',
                'Last changed at',
                'Change',
              ]}
              rowCount={settings.length}
            >
              {settings.map((setting) => {
                const impact = policyImpactDetails(setting.key);
                const isEditing = selectedSetting?.key === setting.key;
                return (
                  <tr key={setting.key}>
                    <td>
                      <strong>{setting.label}</strong>
                      <p className="muted">{setting.description}</p>
                    </td>
                    <td><strong>{policyDisplayValue(setting)}</strong></td>
                    <td>{policyDisplayValue(setting, true)}</td>
                    <td>
                      <strong>{setting.category}</strong>
                      <p className="muted">{setting.enforced ? 'Live operating rule' : 'Decision record'}</p>
                    </td>
                    <td>
                      <strong>{impact.title}</strong>
                      <p className="muted">{impact.detail}</p>
                    </td>
                    <td>{setting.updatedBy?.fullName ?? setting.updatedBy?.phone ?? 'Default policy'}</td>
                    <td>{setting.updatedAt ? <DateTimeText value={setting.updatedAt} /> : 'Not changed'}</td>
                    <td>
                      <AdminTextLink
                        aria-current={isEditing ? 'page' : undefined}
                        href={operationsPolicyEditHref(setting.key)}
                      >
                        {isEditing ? 'Editing' : 'Open change'}
                      </AdminTextLink>
                    </td>
                  </tr>
                );
              })}
            </AdminDataTable>
          </AdminTableScroll>
        </AdminTablePanel>
      ) : null}

      {shouldRenderPolicyOverview && selectedSetting ? (
        <OperationsPolicyForm setting={selectedSetting} />
      ) : null}

      {shouldRenderPolicyOverview ? (
        <>
          <OperationsPolicyAuthorityBaselineSection />

          <OperationsPolicyActionGateChecklistSection checklist={actionGatePolicyChecklist!} />

          <OperationsPolicyBookingCreateGateSection review={bookingCreateGateReview!} />

          <OperationsPolicyRecommendedValueReviewSection review={recommendationReview!} />
        </>
      ) : null}

      {shouldRenderMatchingReview ? (
        <AdminSection
          className="admin-mb-16"
          description="Review matching controls separately from supply evidence and booking simulation."
          statusLabel={
            shouldRenderMatchingSupply
              ? 'Supply evidence'
              : shouldRenderMatchingSimulation
                ? 'Simulation'
                : 'Policy editor'
          }
          statusTone={shouldRenderMatchingEditor ? 'info' : 'warning'}
          title="Matching workspace"
        >
          <AdminFilterChipGroup ariaLabel="Matching workspaces">
            <AdminFormControlLink
              aria-current={shouldRenderMatchingEditor ? 'page' : undefined}
              href={buildOperationsPolicyMatchingHref('policy')}
            >
              Policy editor
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={shouldRenderMatchingSupply ? 'page' : undefined}
              href={buildOperationsPolicyMatchingHref('supply')}
            >
              Supply evidence
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={shouldRenderMatchingSimulation ? 'page' : undefined}
              href={buildOperationsPolicyMatchingHref('simulation')}
            >
              Simulation
            </AdminFormControlLink>
          </AdminFilterChipGroup>
        </AdminSection>
      ) : null}

      {shouldRenderMatchingSupply ? (
        <>
          <OperationsPolicyFinalPartnerChoiceSection matrix={acceptanceMatrix!} />

          <OperationsPolicySensitivityPreviewSection sensitivity={supplySensitivity!} />

          <OperationsPolicyMatchingStageImpactSection preview={matchingStageImpactPreview!} />
        </>
      ) : null}

      {shouldRenderMatchingPolicy ? (
      <AdminSection
        actions={
          <>
            <StatusBadge tone="success">{matchingSettings.length} enforced policy</StatusBadge>
            <StatusBadge tone="info">{savedCount} saved override(s)</StatusBadge>
          </>
        }
        className="admin-mb-16"
        description="These settings are enforced by booking creation, marketplace partner discovery, and partner participation eligibility. Existing open bookings keep their stored expiry time, while new bookings use the latest policy."
        statusLabel={shouldRenderMatchingEditor ? 'Admin editable' : 'Read-only evidence'}
        statusTone={shouldRenderMatchingEditor ? 'success' : 'info'}
        title="Live matching policy"
      >
        {shouldRenderMatchingEditor ? (
          matchingSettings.length === 0 ? (
            <AdminNotePanel className="admin-m-0">
              <AdminEmptyState
                message="Seed operational policies before changing live matching rules. Every policy update requires a reason and creates an audit record."
                title="No matching policies loaded"
              />
              {canLoadFullDiagnostics ? (
                <AdminFormControlLink className="button-secondary" href="/setup">
                  <Settings size={16} aria-hidden="true" />
                  Open setup checks
                </AdminFormControlLink>
              ) : null}
            </AdminNotePanel>
          ) : (
            <AdminNotePanel className="admin-m-0">
              <AdminSectionHeader
                description="Use the policy comparison to inspect current and recommended values, then open exactly one change panel."
                status={<StatusBadge tone="info">{matchingSettings.length} matching policy item(s)</StatusBadge>}
                title="Matching policy changes"
              />
              <AdminFormControlLink className="button-secondary admin-mt-12" href="/operations-policy">
                Open policy comparison
              </AdminFormControlLink>
            </AdminNotePanel>
          )
        ) : (
          <AdminNotePanel className="admin-m-0">
            <AdminSectionHeader
              description="The active policy values remain enforced while this workspace focuses on bounded evidence. Return to the policy editor to change a value."
              status={<StatusBadge tone="warning">Evidence workspace</StatusBadge>}
              title="Matching policy editor"
            />
            <AdminFormControlLink
              className="button-secondary admin-mt-12"
              href={buildOperationsPolicyMatchingHref('policy')}
            >
              Open policy editor
            </AdminFormControlLink>
          </AdminNotePanel>
        )}
      </AdminSection>
      ) : null}

      {shouldRenderMatchingSimulation ? (
        <>
          <OperationsPolicyLiveSimulatorSection simulation={policySimulation!} />

          <OperationsPolicyChangeImpactSection
            dashboard={impactDashboard!}
            sampledBookingCount={bookings.length}
          />

          <OperationsPolicyDrilldownSection drilldown={policyDrilldown!} />

          <OperationsPolicyOutcomeEffectSection analysis={policyEffectAnalysis!} />
        </>
      ) : shouldRenderMatchingReview && matchingPlaybook ? (
        <OperationsPolicyMatchingPlaybookSection playbook={matchingPlaybook} />
      ) : shouldRenderPolicyOverview && canLoadFullDiagnostics ? (
        <AdminSection
          actions={
            <AdminFormControlLink className="button-secondary" href={buildOperationsPolicyDetailsHref('all')}>
              Open advanced review
            </AdminFormControlLink>
          }
          className="admin-mb-16"
          description="The default policy page keeps live editing and gate checks fast. Open advanced review when checking simulations, audit trail, drilldown, and owner decision pressure."
          title="Advanced policy review"
        />
      ) : null}

      {shouldRenderAuditReview ? (
        <>
          <OperationsPolicyEnforcementTraceSection trace={policyEnforcementTrace!} />
          <OperationsPolicyAuditTrailSection rows={policyAuditRows!} />
        </>
      ) : null}

      {shouldRenderAdvancedIndex ? (
        <AdminSection
          className="admin-mb-16"
          description="Open one bounded workspace at a time. Matching review covers simulation and supply, decision review contains owner-editable choices, and audit review keeps retained policy evidence."
          statusLabel="Choose workspace"
          statusTone="info"
          title="Advanced policy review"
        >
          <AdminFilterChipGroup ariaLabel="Advanced policy workspaces">
            <AdminFormControlLink href={buildOperationsPolicyDetailsHref('matching')}>
              Matching review
            </AdminFormControlLink>
            <AdminFormControlLink href={buildOperationsPolicyDetailsHref('decisions')}>
              Decision review
            </AdminFormControlLink>
            <AdminFormControlLink href={buildOperationsPolicyDetailsHref('audit')}>
              Audit review
            </AdminFormControlLink>
          </AdminFilterChipGroup>
        </AdminSection>
      ) : null}

      {shouldRenderDecisionReview ? (
        <AdminSection
          className="admin-mb-16"
          description="Review owner-approved choices separately from the live booking and Partner evidence sample."
          statusLabel={shouldRenderDecisionEvidence ? 'Live evidence' : 'Decision editor'}
          statusTone={shouldRenderDecisionEvidence ? 'warning' : 'info'}
          title="Decision workspace"
        >
          <AdminFilterChipGroup ariaLabel="Decision workspaces">
            <AdminFormControlLink
              aria-current={!shouldRenderDecisionEvidence ? 'page' : undefined}
              href={buildOperationsPolicyDecisionHref('editor')}
            >
              Decision editor
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={shouldRenderDecisionEvidence ? 'page' : undefined}
              href={buildOperationsPolicyDecisionHref('evidence')}
            >
              Live evidence
            </AdminFormControlLink>
          </AdminFilterChipGroup>
        </AdminSection>
      ) : null}

      {shouldRenderDecisionSummary ? (
      <AdminSection
        className="admin-mb-16"
        description={
          <>
            These are the flow choices HANDS should decide before the mobile screens are redesigned. Saving
            them creates an audit trail; items marked &quot;planning&quot; are not enforced until that flow
            is built.
          </>
        }
        statusLabel="Needs owner choice"
        statusTone="warning"
        title="Operator decisions"
      >
        {shouldRenderDecisionEditor ? (
          <AdminNotePanel className="admin-m-0">
            <AdminSectionHeader
              description="Use the policy comparison to review current and recommended choices, then open one change panel."
              status={<StatusBadge tone="info">{decisionSettings.length} decision item(s)</StatusBadge>}
              title="Decision policy changes"
            />
            <AdminFormControlLink className="button-secondary admin-mt-12" href="/operations-policy">
              Open policy comparison
            </AdminFormControlLink>
          </AdminNotePanel>
        ) : shouldRenderDecisionEvidence ? (
          <AdminNotePanel className="admin-m-0">
            <AdminSectionHeader
              description="This workspace keeps the live evidence sample separate from policy changes. Return to the comparison to change an owner-approved decision."
              status={<StatusBadge tone="warning">Evidence sample</StatusBadge>}
              title="Decision policy editor"
            />
            <AdminFormControlLink
              className="button-secondary admin-mt-12"
              href={buildOperationsPolicyDecisionHref('editor')}
            >
              Open decision editor
            </AdminFormControlLink>
          </AdminNotePanel>
        ) : canLoadFullDiagnostics ? (
          <AdminNotePanel className="admin-m-0">
            <AdminSectionHeader
              description="Decision policy editors are available in advanced review so the default page stays focused on live matching edits and booking gates."
              status={<StatusBadge tone="info">{decisionSettings.length} decision item(s)</StatusBadge>}
              title="Decision policy editor"
            />
            <AdminFormControlLink
              className="button-secondary admin-mt-12"
              href={buildOperationsPolicyDetailsHref('all')}
            >
              Load decision editor
            </AdminFormControlLink>
          </AdminNotePanel>
        ) : (
          <AdminNotePanel className="admin-m-0">
            <AdminSectionHeader
              description="Decision policies are retained for owner review while this compact operations view stays focused on live matching and booking gates."
              status={<StatusBadge tone="info">{decisionSettings.length} decision item(s)</StatusBadge>}
              title="Decision policies retained"
            />
          </AdminNotePanel>
        )}
      </AdminSection>
      ) : null}

      {shouldRenderDecisionEditor ? <OperationsPolicyNextChoicesSection /> : null}

      {shouldRenderDecisionEvidence && ownerDecisionBacklog ? (
        <OperationsPolicyOwnerDecisionBacklogSection
          backlog={ownerDecisionBacklog}
          pressure={ownerDecisionPressure}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function operationsPolicyEditHref(key: string) {
  return `/operations-policy?edit=${encodeURIComponent(key)}#${operationalPolicyAnchor(key)}`;
}
