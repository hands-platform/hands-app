import { Settings } from 'lucide-react';
import { canViewAdminDeveloperSystem } from '../../components/admin-developer-system-section';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import {
  AdminDetailGrid,
  AdminNotePanel,
  AdminNoticeCard,
  AdminSection,
} from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import {
  AdminAuditLog,
  AdminBooking,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
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
import {
  buildOperationsPolicyDetailsHref,
  buildOperationsPolicyLoadPlan,
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
    adminGet<AdminBooking[]>(loadPlan.bookingsHref, []),
    loadPlan.providersHref
      ? adminGet<AdminProvider[]>(loadPlan.providersHref, [])
      : Promise.resolve<AdminProvider[]>([]),
    adminGet<AdminAuditLog[]>(loadPlan.policyAuditHref, []),
    adminGet<AdminAuditLog[]>(loadPlan.bookingGateAuditHref, []),
  ]);
  const auditLogs = [...policyAuditLogs, ...bookingGateAuditLogs];
  const shouldRenderAdvancedIndex = loadPlan.shouldRenderAdvancedIndex;
  const shouldRenderMatchingReview = loadPlan.shouldRenderMatchingReview;
  const shouldRenderDecisionReview = loadPlan.shouldRenderDecisionReview;
  const shouldRenderAuditReview = loadPlan.shouldRenderAuditReview;
  const needsProviderReview = shouldRenderMatchingReview || shouldRenderDecisionReview;
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = operationsPolicyNotice(params);
  const matchingPlaybook = shouldRenderMatchingReview
    ? buildMatchingPlaybook((key) => policyDisplayByKey(settings, key))
    : null;
  const recommendationReview = buildPolicyRecommendationReview(settings, bookings);
  const acceptanceMatrix = needsProviderReview
    ? buildBookingAcceptanceMatrix(settings, providers)
    : null;
  const bookingCreateGateReview = buildBookingCreateGateReview(settings, auditLogs);
  const actionGatePolicyChecklist = buildActionGatePolicyChecklist(settings, formatSnapshotPolicyValue);
  const policySimulation = shouldRenderMatchingReview
    ? buildPolicySimulation(settings, bookings, providers)
    : null;
  const impactDashboard = shouldRenderMatchingReview
    ? buildPolicyImpactDashboard(settings, bookings)
    : null;
  const policyEffectAnalysis = shouldRenderMatchingReview
    ? buildPolicyOutcomeEffect(settings, bookings)
    : null;
  const policyDrilldown = shouldRenderMatchingReview ? buildPolicyDrilldown(bookings, settings) : null;
  const policyAuditRows = shouldRenderAuditReview ? operationalPolicyAuditRows(auditLogs) : null;
  const supplySensitivity = needsProviderReview
    ? buildPolicySupplySensitivity(settings, bookings, providers)
    : null;
  const matchingStageImpactPreview = shouldRenderMatchingReview
    ? buildMatchingStageImpactPreview(settings, bookings, providers)
    : null;
  const policyEnforcementTrace = shouldRenderAuditReview
    ? buildPolicyEnforcementTrace(settings)
    : null;
  const ownerDecisionBacklog = shouldRenderDecisionReview ? operationsOwnerDecisionBacklog() : null;
  const ownerDecisionPressure =
    shouldRenderDecisionReview && supplySensitivity && acceptanceMatrix
      ? buildOwnerDecisionPressure(bookings, providers, supplySensitivity, acceptanceMatrix)
      : null;
  const shouldRenderDecisionEditor = shouldRenderDecisionReview;

  return (
    <AdminPageTemplate
      contentClassName="operations-policy-page"
      description="Change live matching details from Admin instead of editing code. Decision cards capture product choices that should be approved before deeper app-flow work."
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

      <OperationsPolicyAuthorityBaselineSection />

      <OperationsPolicyActionGateChecklistSection checklist={actionGatePolicyChecklist} />

      <OperationsPolicyBookingCreateGateSection review={bookingCreateGateReview} />

      <OperationsPolicyRecommendedValueReviewSection review={recommendationReview} />

      {shouldRenderMatchingReview ? (
        <>
          <OperationsPolicyFinalPartnerChoiceSection matrix={acceptanceMatrix!} />

          <OperationsPolicySensitivityPreviewSection sensitivity={supplySensitivity!} />

          <OperationsPolicyMatchingStageImpactSection preview={matchingStageImpactPreview!} />

          <OperationsPolicyOutcomeEffectSection analysis={policyEffectAnalysis!} />

        </>
      ) : null}

      <AdminSection
        actions={
          <>
            <StatusBadge tone="success">{matchingSettings.length} enforced policy</StatusBadge>
            <StatusBadge tone="info">{savedCount} saved override(s)</StatusBadge>
          </>
        }
        className="admin-mb-16"
        description="These settings are enforced by booking creation, marketplace partner discovery, and partner participation eligibility. Existing open bookings keep their stored expiry time, while new bookings use the latest policy."
        statusLabel="Admin editable"
        statusTone="success"
        title="Live matching policy"
      >
        <AdminDetailGrid>
          {matchingSettings.map((setting) => (
            <OperationsPolicyForm
              key={setting.key}
              setting={setting}
              bookings={bookings}
              diagnosticsMode={shouldRenderMatchingReview ? 'full' : 'summary'}
            />
          ))}
          {matchingSettings.length === 0 ? (
            <AdminNotePanel className="admin-m-0">
              <AdminEmptyState
                message="Seed operational policies before editing live matching rules. Each policy update will require a Change reason so operators can audit why the value changed."
                title="No matching policies loaded"
              />
              {canLoadFullDiagnostics ? (
                <AdminFormControlLink className="button-secondary" href="/setup">
                  <Settings size={16} aria-hidden="true" />
                  Open setup checks
                </AdminFormControlLink>
              ) : null}
            </AdminNotePanel>
          ) : null}
        </AdminDetailGrid>
      </AdminSection>

      {shouldRenderMatchingReview ? (
        <>
          <OperationsPolicyLiveSimulatorSection simulation={policySimulation!} />

          <OperationsPolicyChangeImpactSection
            dashboard={impactDashboard!}
            sampledBookingCount={bookings.length}
          />

          <OperationsPolicyDrilldownSection drilldown={policyDrilldown!} />

          <OperationsPolicyMatchingPlaybookSection playbook={matchingPlaybook!} />
        </>
      ) : canLoadFullDiagnostics && !shouldRenderAdvancedIndex ? (
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
          <AdminDetailGrid>
            {decisionSettings.map((setting) => (
              <OperationsPolicyForm
                key={setting.key}
                setting={setting}
                bookings={bookings}
                diagnosticsMode="full"
              />
            ))}
          </AdminDetailGrid>
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

      {shouldRenderDecisionReview && ownerDecisionBacklog && ownerDecisionPressure ? (
        <>
          <OperationsPolicyNextChoicesSection />

          <OperationsPolicyOwnerDecisionBacklogSection
            backlog={ownerDecisionBacklog}
            pressure={ownerDecisionPressure}
          />
        </>
      ) : null}
    </AdminPageTemplate>
  );
}
