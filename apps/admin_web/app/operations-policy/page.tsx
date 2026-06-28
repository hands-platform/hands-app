import Link from 'next/link';
import { Settings } from 'lucide-react';
import {
  AdminAuditLog,
  AdminBooking,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';
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
// Policy enforcement trace
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
  const loadPlan = buildOperationsPolicyLoadPlan(params);
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
  const shouldRenderFullDiagnostics = loadPlan.shouldRenderFullDiagnostics;
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = operationsPolicyNotice(params);
  const matchingPlaybook = buildMatchingPlaybook((key) => policyDisplayByKey(settings, key));
  const recommendationReview = buildPolicyRecommendationReview(settings, bookings);
  const acceptanceMatrix = buildBookingAcceptanceMatrix(settings, providers);
  const bookingCreateGateReview = buildBookingCreateGateReview(settings, auditLogs);
  const actionGatePolicyChecklist = buildActionGatePolicyChecklist(settings, formatSnapshotPolicyValue);
  const policySimulation = shouldRenderFullDiagnostics
    ? buildPolicySimulation(settings, bookings, providers)
    : null;
  const impactDashboard = shouldRenderFullDiagnostics
    ? buildPolicyImpactDashboard(settings, bookings)
    : null;
  const policyEffectAnalysis = shouldRenderFullDiagnostics
    ? buildPolicyOutcomeEffect(settings, bookings)
    : null;
  const policyDrilldown = shouldRenderFullDiagnostics ? buildPolicyDrilldown(bookings, settings) : null;
  const policyAuditRows = shouldRenderFullDiagnostics ? operationalPolicyAuditRows(auditLogs) : null;
  const supplySensitivity = shouldRenderFullDiagnostics
    ? buildPolicySupplySensitivity(settings, bookings, providers)
    : null;
  const matchingStageImpactPreview = shouldRenderFullDiagnostics
    ? buildMatchingStageImpactPreview(settings, bookings, providers)
    : null;
  const policyEnforcementTrace = shouldRenderFullDiagnostics
    ? buildPolicyEnforcementTrace(settings)
    : null;
  const ownerDecisionBacklog = shouldRenderFullDiagnostics ? operationsOwnerDecisionBacklog() : null;
  const ownerDecisionPressure =
    shouldRenderFullDiagnostics && supplySensitivity
      ? buildOwnerDecisionPressure(bookings, providers, supplySensitivity, acceptanceMatrix)
      : null;

  return (
    <div className="operations-policy-page">
      <section className="toolbar">
        <div>
          <h1>Operations Policy</h1>
          <p className="muted">
            Change live matching details from Admin instead of editing code. Decision cards capture product
            choices that should be approved before deeper app-flow work.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">{matchingSettings.length} enforced policy</span>
          <span className="pill pill-info">{decisionSettings.length} decision item(s)</span>
          <span className="pill pill-info">{savedCount} saved override(s)</span>
        </div>
      </section>

      {notice ? (
        <section
          className={`card admin-notice-card ${
            notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'
          }`}
        >
          <div className="ops-section-header">
            <div>
              <h2>{notice.title}</h2>
              <p className="muted">{notice.detail}</p>
            </div>
            <span className={`pill ${notice.tone === 'success' ? 'pill-success' : 'pill-danger'}`}>
              {notice.tone === 'success' ? 'Saved' : 'Blocked'}
            </span>
          </div>
        </section>
      ) : null}

      <OperationsPolicyAuthorityBaselineSection />

      <OperationsPolicyActionGateChecklistSection checklist={actionGatePolicyChecklist} />

      <OperationsPolicyBookingCreateGateSection review={bookingCreateGateReview} />

      <OperationsPolicyRecommendedValueReviewSection review={recommendationReview} />

      {shouldRenderFullDiagnostics ? (
        <>
          <OperationsPolicyFinalPartnerChoiceSection matrix={acceptanceMatrix} />

          <OperationsPolicySensitivityPreviewSection sensitivity={supplySensitivity!} />

          <OperationsPolicyMatchingStageImpactSection preview={matchingStageImpactPreview!} />

          <OperationsPolicyOutcomeEffectSection analysis={policyEffectAnalysis!} />

          <OperationsPolicyEnforcementTraceSection trace={policyEnforcementTrace!} />
        </>
      ) : null}

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Live matching policy</h2>
            <p className="muted">
              These settings are enforced by booking creation, marketplace partner discovery, and partner
              participation eligibility. Existing open bookings keep their stored expiry time, while new
              bookings use the latest policy.
            </p>
          </div>
          <span className="pill pill-success">Admin editable</span>
        </div>
        <div className="grid">
          {matchingSettings.map((setting) => (
            <OperationsPolicyForm key={setting.key} setting={setting} bookings={bookings} />
          ))}
          {matchingSettings.length === 0 ? (
            <div className="card admin-m-0">
              <h3>No matching policies loaded</h3>
              <p className="muted">
                Seed operational policies from the API setup before editing live matching rules. Each policy
                update will require a Change reason so operators can audit why the value changed.
              </p>
              <Link className="button button-secondary" href="/setup">
                <Settings size={16} aria-hidden="true" />
                Open setup checks
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {shouldRenderFullDiagnostics ? (
        <>
          <OperationsPolicyLiveSimulatorSection simulation={policySimulation!} />

          <OperationsPolicyChangeImpactSection
            dashboard={impactDashboard!}
            sampledBookingCount={bookings.length}
          />

          <OperationsPolicyDrilldownSection drilldown={policyDrilldown!} />

          <OperationsPolicyAuditTrailSection rows={policyAuditRows!} />

          <OperationsPolicyMatchingPlaybookSection playbook={matchingPlaybook} />
        </>
      ) : (
        <section className="card admin-mb-16">
          <div className="ops-section-header">
            <div>
              <h2>Diagnostics loaded on demand</h2>
              <p className="muted">
                The default policy page keeps live editing and gate checks fast. Load full diagnostics only
                when reviewing simulation, audit trail, drilldown, and owner decision pressure.
              </p>
            </div>
            <Link className="button button-secondary" href={buildOperationsPolicyDetailsHref('all')}>
              Load full diagnostics
            </Link>
          </div>
        </section>
      )}

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Operator decisions</h2>
            <p className="muted">
              These are the flow choices HANDS should decide before the mobile screens are redesigned. Saving
              them creates an audit trail; items marked &quot;planning&quot; are not enforced until that flow
              is built.
            </p>
          </div>
          <span className="pill pill-warn">Needs owner choice</span>
        </div>
        <div className="grid">
          {decisionSettings.map((setting) => (
            <OperationsPolicyForm key={setting.key} setting={setting} bookings={bookings} />
          ))}
        </div>
      </section>

      {shouldRenderFullDiagnostics && ownerDecisionBacklog && ownerDecisionPressure ? (
        <>
          <OperationsPolicyNextChoicesSection />

          <OperationsPolicyOwnerDecisionBacklogSection
            backlog={ownerDecisionBacklog}
            pressure={ownerDecisionPressure}
          />
        </>
      ) : null}
    </div>
  );
}
