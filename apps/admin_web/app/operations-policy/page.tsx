import Link from 'next/link';
import { AdminTableScroll } from '../../components/admin-data-table';
import {
  AdminAuditLog,
  AdminBooking,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';
import { MetricCard } from '../../components/metric-card';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { formatDateTime, formatMoney, formatRelativeTime, readPlainRecord } from '../../lib/admin-format';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  adminPartnerAccountNeedsFollowUp,
  adminPartnerBankReady,
  adminPartnerCanCompleteFinalGate,
  adminPartnerFinalGateHeld,
  adminPartnerHasEnabledPush,
  adminPartnerIdentityReady,
  adminPartnerAlertChannelRoutesToFcm,
  adminPartnerLocationFresh,
  adminPartnerMarketplaceBlocked,
  adminPartnerWalletBalance,
  adminWalletGateBlocksMarketplaceParticipation,
  normalizeAdminMarketplaceOpenMode,
  operationalPolicyAnchor,
} from '../../lib/operations-policy';
import { updateOperationalPolicy } from './actions';
import { buildActionGatePolicyChecklist } from './action-gate-policy-checklist';
import { buildMatchingStageImpactPreview } from './matching-stage-impact-preview';
import { buildMatchingPlaybook } from './matching-playbook';
import { buildPolicyEnforcementTrace } from './policy-enforcement-trace';
import { buildPolicyOutcomeEffect } from './policy-outcome-effect';
import { policyImpactDetails } from './policy-impact-details';
import { buildPolicySupplySensitivity, type PolicySupplySensitivity } from './policy-supply-sensitivity';
import {
  bookingPolicySnapshotDrift,
  formatSnapshotPolicyValue,
  readBookingMatchingPolicySnapshot,
  summarizeSnapshotValues,
} from './policy-snapshot';
import { operationsOwnerDecisionBacklog } from './owner-decision-backlog';
import { OperationsPolicyActionGateChecklistSection } from './operations-policy-action-gate-checklist-section';
import { OperationsPolicyAuthorityBaselineSection } from './operations-policy-authority-baseline-section';
import { OperationsPolicyBookingCreateGateSection } from './operations-policy-booking-create-gate-section';
import { OperationsPolicyRecommendedValueReviewSection } from './operations-policy-recommended-value-review-section';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

type OwnerDecisionPressure = {
  alertCount: number;
  summary: Array<{ label: string; value: string; helper: string }>;
  cards: Array<{
    title: string;
    status: string;
    detail: string;
    operatorAction: string;
    href: string;
    className: string;
    pillClass: string;
  }>;
};
type BookingCreateGateReview = {
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  rows: Array<{
    key: string;
    gate: string;
    current: string;
    defaultValue: string;
    operatorMeaning: string;
    evidence: string;
    href: string;
    pillClass: string;
  }>;
  recentAttempts: Array<{
    id: string;
    reason: string;
    detail: string;
    createdAt: string;
    href: string;
    pillClass: string;
  }>;
};
export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [settings, bookings, providers, auditLogs] = await Promise.all([
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
  ]);
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = policyNotice(params);
  const ownerDecisionBacklog = operationsOwnerDecisionBacklog();
  const matchingPlaybook = buildMatchingPlaybook((key) => policyDisplayByKey(settings, key));
  const policySimulation = buildPolicySimulation(settings, bookings, providers);
  const impactDashboard = buildPolicyImpactDashboard(settings, bookings);
  const policyEffectAnalysis = buildPolicyOutcomeEffect(settings, bookings);
  const policyDrilldown = buildPolicyDrilldown(bookings, settings);
  const policyAuditRows = operationalPolicyAuditRows(auditLogs);
  const recommendationReview = buildPolicyRecommendationReview(settings, bookings);
  const acceptanceMatrix = buildBookingAcceptanceMatrix(settings, providers);
  const supplySensitivity = buildPolicySupplySensitivity(settings, bookings, providers);
  const matchingStageImpactPreview = buildMatchingStageImpactPreview(settings, bookings, providers);
  const ownerDecisionPressure = buildOwnerDecisionPressure(
    bookings,
    providers,
    supplySensitivity,
    acceptanceMatrix,
  );
  const policyEnforcementTrace = buildPolicyEnforcementTrace(settings);
  const bookingCreateGateReview = buildBookingCreateGateReview(settings, auditLogs);
  const actionGatePolicyChecklist = buildActionGatePolicyChecklist(
    settings,
    formatSnapshotPolicyValue,
  );

  return (
    <>
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
          className="card"
          style={{
            marginBottom: 16,
            borderColor: notice.tone === 'success' ? '#b8ddb0' : '#f0c7c2',
            background: notice.tone === 'success' ? '#f4fbf1' : '#fff5f3',
          }}
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

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Final partner choice control matrix</h2>
            <p className="muted">
              Current owner choices for the direct booking window, marketplace participation, partner push
              reach, and the negative wallet marketplace/payout gate. This is the screen operators should
              check before changing the mobile flow.
            </p>
          </div>
          <span className={`pill ${acceptanceMatrix.blockingCount ? 'pill-warn' : 'pill-success'}`}>
            {acceptanceMatrix.blockingCount} control choice(s)
          </span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {acceptanceMatrix.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid admin-mt-14">
          {acceptanceMatrix.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.operatorAction}</small>
            </div>
          ))}
        </div>
        <div className="ops-section-header admin-mt-18">
          <div>
            <h3>Current partner acceptance impact</h3>
            <p className="muted">
              Applies the policy posture to the current partner snapshot so operators can see who can pass
              marketplace and payout gates, who needs account or identity follow-up, and who only needs
              readiness follow-up.
            </p>
          </div>
          <Link className="text-link" href="/partners">
            Open partner queue
          </Link>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {acceptanceMatrix.impact.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy sensitivity preview</h2>
            <p className="muted">
              Before changing radius or location freshness, compare how many partners would remain usable
              around the latest customer coordinate. This keeps policy choices tied to real supply instead of
              guesswork.
            </p>
          </div>
          <span className="pill pill-info">{supplySensitivity.currentPolicyLabel}</span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {supplySensitivity.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid admin-mt-14">
          <div className="admin-scroll-x">
            <h3>Marketplace supply sensitivity</h3>
            <p className="muted">
              Reference point: {supplySensitivity.referenceLabel}. Marketplace blockers include account,
              identity, and bank readiness. Negative wallet stays visible and is shown as a marketplace/payout
              hold.
            </p>
            <table className="table service-trace">
              <thead>
                <tr>
                  <th>Radius</th>
                  <th>Visible partners</th>
                  <th>Fresh location</th>
                  <th>Marketplace/payout held</th>
                  <th>Operator read</th>
                </tr>
              </thead>
              <tbody>
                {supplySensitivity.radiusRows.map((row) => (
                  <tr key={row.radiusLabel}>
                    <td>
                      <span className={`pill ${row.pillClass}`}>{row.radiusLabel}</span>
                    </td>
                    <td>{row.eligible}</td>
                    <td>{row.fresh}</td>
                    <td>{row.finalGateHeld}</td>
                    <td>{row.operatorRead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-scroll-x">
            <h3>Location freshness sensitivity</h3>
            <p className="muted">
              Shows how strict or loose freshness rules affect marketplace matching without real-time
              tracking.
            </p>
            <table className="table service-trace">
              <thead>
                <tr>
                  <th>Freshness</th>
                  <th>Eligible partners</th>
                  <th>Stale excluded</th>
                  <th>Operator read</th>
                </tr>
              </thead>
              <tbody>
                {supplySensitivity.freshnessRows.map((row) => (
                  <tr key={row.freshnessLabel}>
                    <td>
                      <span className={`pill ${row.pillClass}`}>{row.freshnessLabel}</span>
                    </td>
                    <td>{row.eligible}</td>
                    <td>{row.staleExcluded}</td>
                    <td>{row.operatorRead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card admin-mb-16" id="matching-stage-impact">
        <div className="ops-section-header">
          <div>
            <h2>Matching stage impact preview</h2>
            <p className="muted">
              Estimates how current open bookings would move across Stage 1/2/3/4 if the response window, 10km
              radius, or location freshness policy changed. This is a planning preview; saved booking
              snapshots still protect live requests.
            </p>
          </div>
          <span className="pill pill-info">{matchingStageImpactPreview.currentPolicyLabel}</span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {matchingStageImpactPreview.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <AdminTableScroll>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Value</th>
                <th>Stage 1 first-pick</th>
                <th>Stage 2 marketplace</th>
                <th>Stage 3 choice</th>
                <th>Stage 4 repair</th>
                <th>No supply</th>
                <th>Overdue</th>
                <th>Operator read</th>
              </tr>
            </thead>
            <tbody>
              {matchingStageImpactPreview.rows.map((row) => (
                <tr key={`${row.scenario}-${row.value}`}>
                  <td>
                    <span className={`pill ${row.pillClass}`}>{row.scenario}</span>
                  </td>
                  <td>{row.value}</td>
                  <td>{row.stage1}</td>
                  <td>{row.stage2}</td>
                  <td>{row.stage3}</td>
                  <td>{row.repair}</td>
                  <td>{row.noSupply}</td>
                  <td>{row.overdue}</td>
                  <td>{row.operatorRead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
        <div className="ops-task-note admin-mt-14">
          <strong>How to use this preview</strong>
          <p className="muted">
            If a tested value increases Stage 2 marketplace count without increasing stale/no-supply checks,
            it may reduce customer waiting anxiety. If it increases overdue or no-supply count, improve
            partner location freshness, push delivery, or city supply before changing policy.
          </p>
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy outcome effect</h2>
            <p className="muted">
              Groups real bookings by the policy snapshot saved at booking open. Use this before changing the
              10 minute response window, marketplace policy, invite cap, or marketplace opening mode.
            </p>
          </div>
          <span className={`pill ${policyEffectAnalysis.sampleCount ? 'pill-info' : 'pill-warn'}`}>
            {policyEffectAnalysis.sampleCount} booking(s) with saved policy
          </span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {policyEffectAnalysis.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <AdminTableScroll>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Policy cohort</th>
                <th>Sample</th>
                <th>Matched / completed</th>
                <th>Marketplace supply</th>
                <th>Check</th>
                <th>Operator read</th>
              </tr>
            </thead>
            <tbody>
              {policyEffectAnalysis.rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{displayOperationalWording(row.policy)}</strong>
                    <p className="muted">{row.value}</p>
                  </td>
                  <td>{row.sample}</td>
                  <td>
                    <strong>{row.matchedRate}</strong>
                    <p className="muted">{row.completedRate} completed</p>
                  </td>
                  <td>
                    <strong>{row.avgBackupInvites}</strong>
                    <p className="muted">{row.avgParticipants} participant avg</p>
                  </td>
                  <td>
                    <span className={`pill ${row.outcomePill}`}>{row.outcomeLabel}</span>
                    <p className="muted admin-mt-6">
                      {row.outcomeDetail}
                    </p>
                  </td>
                  <td>
                    <p style={{ margin: 0 }}>{row.operatorRead}</p>
                  </td>
                </tr>
              ))}
              {policyEffectAnalysis.rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No policy snapshots are available yet. Create a fresh customer booking, then check this
                    section again after partners accept, reject, or complete the request.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminTableScroll>
        <div className="ops-task-grid admin-mt-14">
          {policyEffectAnalysis.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.scope}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.operatorAction}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy enforcement trace</h2>
            <p className="muted">
              Shows where each operating decision is enforced today, so operators know whether a policy change
              affects customer matching, partner acceptance, notifications, or finance gates.
            </p>
          </div>
          <span className="pill pill-info">{policyEnforcementTrace.length} enforced lane(s)</span>
        </div>
        <div className="ops-task-grid admin-mt-14">
          {policyEnforcementTrace.map((item) => (
            <div className="ops-task-card ops-task-done" key={item.title}>
              <span className="pill pill-success">{item.scope}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>{`API touchpoint: ${item.api}`}</small>
              <small>{`Server owner: ${item.server}`}</small>
              <small>{item.verify}</small>
            </div>
          ))}
        </div>
      </section>

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
            <PolicyForm key={setting.key} setting={setting} bookings={bookings} />
          ))}
          {matchingSettings.length === 0 ? (
            <div className="card" style={{ margin: 0 }}>
              <h3>No matching policies loaded</h3>
              <p className="muted">
                Seed operational policies from the API setup before editing live matching rules. Each policy
                update will require a Change reason so operators can audit why the value changed.
              </p>
              <Link className="text-link" href="/setup">
                Open setup checks
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Live policy simulator</h2>
            <p className="muted">
              Uses the current policy values, the latest booking/customer coordinate, and current partner
              locations to preview who would see or participate in a new direct booking request.
            </p>
          </div>
          <span className={`pill ${policySimulation.ready ? 'pill-success' : 'pill-warn'}`}>
            {policySimulation.ready ? 'Ready for dispatch check' : 'Needs better location data'}
          </span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {policySimulation.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid admin-mt-14">
          <div className="ops-task-note">
            <h3>Simulated booking path</h3>
            <div className="timeline admin-mt-12">
              {policySimulation.timeline.map((step) => (
                <div className={`timeline-step ${step.className}`} key={step.title}>
                  <span>{step.step}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                  <div className="participant-list">
                    {step.tags.map((tag) => (
                      <span className={`pill ${tag.tone}`} key={`${step.title}-${tag.label}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ops-task-note">
            <div className="ops-section-header">
              <div>
                <h3>Eligible partner preview</h3>
                <p className="muted">
                  Top nearby online partners inside the current marketplace radius. Stale locations are
                  excluded from the dispatch count.
                </p>
              </div>
              <span className="pill pill-info">{policySimulation.partnerRows.length} shown</span>
            </div>
            <div className="stack admin-mt-10">
              {policySimulation.partnerRows.map((partner) => (
                <div className="ops-row" key={partner.id}>
                  <div>
                    <a className="text-link" href={`/partners/${partner.id}`}>
                      {displayOperationalWording(partner.name)}
                    </a>
                    <p className="muted">
                      {partner.distanceLabel} / location {partner.locationAgeLabel}
                    </p>
                  </div>
                  <span className={`pill ${partner.pillClass}`}>{partner.status}</span>
                </div>
              ))}
              {policySimulation.partnerRows.length === 0 ? (
                <p className="muted">
                  No online partner with a usable location is inside the current radius. Check partner app
                  location update and city supply before live launch.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="ops-task-grid admin-mt-14">
          {policySimulation.checks.map((check) => (
            <div className={`ops-task-card ${check.className}`} key={check.title}>
              <span className={`pill ${check.pillClass}`}>{check.status}</span>
              <h3>{check.title}</h3>
              <p>{check.detail}</p>
              <small>{check.operatorAction}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy change impact</h2>
            <p className="muted">
              Before changing a setting, use this view to see whether it only affects new bookings or also
              changes live partner visibility, participation checks, and operational review work.
            </p>
          </div>
          <span className="pill pill-info">{bookings.length} booking(s) sampled</span>
        </div>
        <div className="grid admin-mt-12">
          {impactDashboard.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
          ))}
        </div>
        <div className="ops-task-grid admin-mt-14">
          {impactDashboard.snapshotSummary.map((item) => (
            <div className="ops-task-card ops-task-done" key={item.label} style={{ minHeight: 0 }}>
              <span className="pill pill-info">{item.scope}</span>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <AdminTableScroll>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Current live value</th>
                <th>Saved booking snapshot</th>
                <th>Operator meaning</th>
              </tr>
            </thead>
            <tbody>
              {impactDashboard.snapshotRows.map((row) => (
                <tr key={row.policy}>
                  <td>
                    <strong>{displayOperationalWording(row.policy)}</strong>
                    <p className="muted">{row.scope}</p>
                  </td>
                  <td>{row.liveValue}</td>
                  <td>{row.savedValue}</td>
                  <td>
                    <p style={{ margin: 0 }}>{row.operatorMeaning}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
        <div className="ops-task-grid admin-mt-14">
          {impactDashboard.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.scope}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.operatorAction}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy impact drill-down</h2>
            <p className="muted">
              Click into the exact bookings and partners operators should review before changing live
              matching, wallet, or response-window policy.
            </p>
          </div>
          <span className="pill pill-info">{policyDrilldown.totalCount} item(s) to review</span>
        </div>
        <div className="ops-task-grid admin-mt-14">
          {policyDrilldown.lists.map((list) => (
            <PolicyDrilldownList key={list.key} list={list} />
          ))}
        </div>
      </section>

      <section className="card admin-card-scroll admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Recent policy audit trail</h2>
            <p className="muted">
              Shows who changed a policy, the previous value, the new value, and whether the setting is
              already enforced by live booking logic.
            </p>
          </div>
          <a className="text-link" href="/audit-log?bucket=Operations%2FPolicy">
            Open policy audit
          </a>
        </div>
        {policyAuditRows.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>When</th>
                <th>Policy</th>
                <th>Actor</th>
                <th>Before</th>
                <th>After</th>
                <th>Reason</th>
                <th>Ops effect</th>
              </tr>
            </thead>
            <tbody>
              {policyAuditRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>
                      {formatRelativeTime(row.createdAt, { justNow: 'Just now', includeFuture: true })}
                    </strong>
                    <p className="muted">{formatDate(row.createdAt)}</p>
                  </td>
                  <td>
                    <strong>{displayOperationalWording(row.label)}</strong>
                    <p className="muted">{displayOperationalWording(row.policyContext)}</p>
                  </td>
                  <td>{row.actorName}</td>
                  <td>{row.previousValue}</td>
                  <td>{row.value}</td>
                  <td>
                    <p style={{ margin: 0 }}>{displayOperationalWording(row.reason)}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.enforced ? 'pill-success' : 'pill-warn'}`}>
                      {row.enforced ? 'Live behavior' : 'Decision log'}
                    </span>
                    <p className="muted admin-mt-6">
                      {row.effect}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No policy change has been audited yet.</p>
        )}
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Booking matching playbook</h2>
            <p className="muted">
              Current operator-facing flow based on the saved policy values. Use this to verify whether the
              customer, partner, finance, and alert behavior still matches the intended operation.
            </p>
          </div>
          <span className="pill pill-info">Policy driven</span>
        </div>
        <div className="timeline admin-mt-12">
          {matchingPlaybook.map((step) => (
            <div className={`timeline-step ${step.className}`} key={step.title}>
              <span>{step.step}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <div className="participant-list">
                {step.tags.map((tag) => (
                  <span className={`pill ${tag.tone}`} key={`${step.title}-${tag.label}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

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
            <PolicyForm key={setting.key} setting={setting} bookings={bookings} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Recommended next choices</h2>
        <div className="booking-radar">
          <DecisionHint
            title="First-pick partner acceptance"
            recommendation="Keep first-pick priority with customer fallback."
            detail="The preferred Partner can match first under API rules, marketplace Partners can still enter the shortlist, and the customer chooses only when first-pick does not win."
          />
          <DecisionHint
            title="Marketplace participation"
            recommendation="Keep immediate marketplace visibility during the partner response window."
            detail="It reduces waiting anxiety, gives the customer alternatives, and fits the reference flow you described."
          />
          <DecisionHint
            title="Negative wallet gate"
            recommendation="Keep marketplace visibility open, but block final acceptance, service start, and payout release."
            detail="Cash services create company-fee debt. Partners can still see demand, while final acceptance, service start, and payout release wait for settlement."
          />
          <DecisionHint
            title="Phone OTP"
            recommendation="Keep production SMS deferred until the SMS service selection is complete."
            detail="Use internal/demo auth for local development, then turn on phone auth once Vonage credentials, Vietnam sender rules, and the HANDS API token exchange are verified."
          />
          <DecisionHint
            title="Cancellation after match"
            recommendation="Keep admin review before any customer charge decision."
            detail="This keeps early customer support flexible while HANDS learns real cancellation, chat, and partner arrival patterns."
          />
          <DecisionHint
            title="No-show disputes"
            recommendation="Require admin review until evidence upload and dispute screens are mature."
            detail="No-show is an operational closeout state in MVP, not a person judgment. Operators should review evidence before payment or support action."
          />
          <DecisionHint
            title="Partner alert routing"
            recommendation="Keep in-app notifications first, then promote FCM after production credentials are stable."
            detail="The system can record notifications now; push delivery should become mandatory only after monitoring is ready."
          />
        </div>
      </section>

      <section className="card admin-mt-16">
        <div className="ops-section-header">
          <div>
            <h2>Owner decision backlog</h2>
            <p className="muted">
              Product and operations choices that should be reviewed before HANDS turns each policy into
              stricter automation. Keep the decision in Admin first, then automate after real operating data.
            </p>
          </div>
          <span className="pill pill-info">Review weekly</span>
        </div>
        <div className="ops-task-note admin-mt-14">
          <div className="ops-section-header">
            <div>
              <h3>Current decision pressure</h3>
              <p className="muted">
                Data-driven records that tell the owner which policy choice deserves attention first. This
                keeps HANDS from changing flow rules without matching, supply, wallet, or push evidence.
              </p>
            </div>
            <span className={`pill ${ownerDecisionPressure.alertCount ? 'pill-warn' : 'pill-success'}`}>
              {ownerDecisionPressure.alertCount} active record(s)
            </span>
          </div>
          <div className="service-trace-summary admin-mt-12">
            {ownerDecisionPressure.summary.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </div>
          <div className="ops-task-grid admin-mt-14">
            {ownerDecisionPressure.cards.map((item) => (
              <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <small>{item.operatorAction}</small>
              </Link>
            ))}
          </div>
        </div>
        <div className="ops-task-grid admin-mt-14">
          {ownerDecisionBacklog.map((item) => (
            <div className={`ops-task-card ${item.className}`} key={item.title}>
              <span className={`pill ${item.pillClass}`}>{item.owner}</span>
              <h3>{item.title}</h3>
              <p>{item.question}</p>
              <small>{item.evidence}</small>
              <div className="booking-radar admin-mt-12">
                {item.options.map((option) => (
                  <div className="insight-card" key={option.label}>
                    <strong>{displayOperationalWording(option.label)}</strong>
                    <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
                  </div>
                ))}
              </div>
              <div className="ops-task-note admin-mt-12">
                <strong>Recommended direction</strong>
                <p className="muted">{item.recommendation}</p>
                <strong>Decision trigger</strong>
                <p className="muted">{item.decisionTrigger}</p>
                <Link className="text-link" href={item.href}>
                  Review data
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function PolicyForm({
  setting,
  bookings,
}: {
  setting: AdminOperationalPolicySetting;
  bookings: AdminBooking[];
}) {
  const valueType = typeof setting.value;
  const isNumber = valueType === 'number';
  const recommended = policyDisplayValue(setting, true);
  const impact = policyImpactDetails(setting.key);
  const relatedBookings = policyRelatedBookingRecords(setting.key, bookings);
  return (
    <form
      action={updateOperationalPolicy}
      className="card"
      id={operationalPolicyAnchor(setting.key)}
      style={{ margin: 0 }}
    >
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="valueType" value={valueType} />
      <div className="ops-section-header">
        <div>
          <h3>{displayOperationalWording(setting.label)}</h3>
          <p className="muted">{displayOperationalWording(setting.description)}</p>
        </div>
        <span className={`pill ${setting.enforced ? 'pill-success' : 'pill-warn'}`}>
          {setting.enforced ? 'Enforced' : 'Planning'}
        </span>
      </div>
      <div className="service-trace-summary">
        <div>
          <span>Current</span>
          <strong>{policyDisplayValue(setting)}</strong>
        </div>
        <div>
          <span>Recommended</span>
          <strong>{recommended}</strong>
        </div>
        <div>
          <span>Impact</span>
          <strong>{impact.area}</strong>
        </div>
        <div>
          <span>Related booking records</span>
          <strong>{relatedBookings.recordCount}</strong>
        </div>
      </div>
      <div className="ops-task-note admin-mt-12">
        <div className="ops-row">
          <div>
            <strong>{impact.title}</strong>
            <p className="muted">{impact.detail}</p>
          </div>
          <span className={`pill ${setting.enforced ? 'pill-success' : 'pill-warn'}`}>
            {setting.enforced ? 'Live behavior' : 'Decision log'}
          </span>
        </div>
      </div>
      <div className="ops-task-note admin-mt-12">
        <div className="ops-row">
          <div>
            <strong>{relatedBookings.title}</strong>
            <p className="muted">{relatedBookings.helper}</p>
          </div>
          <Link className="text-link" href={relatedBookings.href}>
            Open records
          </Link>
        </div>
        <div className="booking-radar admin-mt-12">
          {relatedBookings.rows.map((row) => (
            <Link className="insight-card" href={row.href} key={`${setting.key}-${row.id}`}>
              <strong>{row.title}</strong>
              <p className="muted">{row.subtitle}</p>
              <div className="participant-list">
                {row.pills.map((pill) => (
                  <span className={`pill ${pill.className}`} key={`${row.id}-${pill.label}`}>
                    {pill.label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {relatedBookings.rows.length === 0 ? (
            <div className="insight-card">
              <strong>No sampled record</strong>
              <p className="muted">{relatedBookings.emptyText}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="ops-task-note admin-mt-12">
        <strong>Before saving this policy</strong>
        <p className="muted">
          Review these operating surfaces first, then write the reason so the shift team can trace why the
          behavior changed.
        </p>
        <div className="booking-radar admin-mt-12">
          {impact.saveChecks.map((check) => (
            <Link className="insight-card" href={check.href} key={`${setting.key}-${check.label}`}>
              <strong>{check.label}</strong>
              <p className="muted">{check.detail}</p>
            </Link>
          ))}
        </div>
      </div>
      {setting.options?.length ? (
        <>
          <label className="field">
            <span>Decision</span>
            <select name="value" defaultValue={String(setting.value)}>
              {setting.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {displayOperationalWording(option.label)}
                </option>
              ))}
            </select>
          </label>
          <div className="booking-radar admin-mt-12">
            {setting.options.map((option) => (
              <div key={option.value} className="insight-card">
                <strong>{displayOperationalWording(option.label)}</strong>
                <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <label className="field">
          <span>
            Value {setting.unit ? `(${setting.unit})` : ''}
            {isNumber && setting.min !== undefined && setting.max !== undefined
              ? `, ${setting.min}-${setting.max}`
              : ''}
          </span>
          <input
            type={isNumber ? 'number' : 'text'}
            name="value"
            defaultValue={String(setting.value)}
            min={isNumber ? (setting.min ?? undefined) : undefined}
            max={isNumber ? (setting.max ?? undefined) : undefined}
          />
        </label>
      )}
      <label className="field">
        <span>Change reason</span>
        <textarea
          name="reason"
          minLength={12}
          required
          placeholder="Example: Increase marketplace visibility because District 1 wait time is rising."
        />
      </label>
      <button className="admin-mt-12" type="submit">
        Save policy
      </button>
      {setting.updatedAt ? (
        <p className="muted admin-mt-10">
          Last changed {formatDate(setting.updatedAt)} by{' '}
          {setting.updatedBy?.fullName ?? setting.updatedBy?.phone ?? 'admin'}
        </p>
      ) : (
        <p className="muted admin-mt-10">
          Using default until an admin override is saved.
        </p>
      )}
    </form>
  );
}

function DecisionHint({
  title,
  recommendation,
  detail,
}: {
  title: string;
  recommendation: string;
  detail: string;
}) {
  return (
    <div className="insight-card">
      <strong>{title}</strong>
      <p>{recommendation}</p>
      <p className="muted">{detail}</p>
    </div>
  );
}

function PolicyDrilldownList({ list }: { list: PolicyDrilldownListView }) {
  return (
    <div className={`ops-task-card ${list.className}`} style={{ minHeight: 0 }}>
      <div>
        <span className={`pill ${list.pillClass}`}>{list.rows.length} item(s)</span>
        <h3>{list.title}</h3>
        <p>{list.helper}</p>
      </div>
      {list.rows.length ? (
        <div className="ops-task-breakdown">
          {list.rows.map((row) => (
            <div className="ops-task-note" key={`${list.key}-${row.id}`}>
              <a className="text-link" href={row.href}>
                {row.title}
              </a>
              <p className="muted" style={{ margin: '6px 0' }}>
                {row.subtitle}
              </p>
              <div className="participant-list">
                {row.pills.map((pill) => (
                  <span className={`pill ${pill.className}`} key={`${row.id}-${pill.label}`}>
                    {pill.label}
                  </span>
                ))}
              </div>
              <small>{row.operatorAction}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="ops-task-note">
          <p className="muted" style={{ margin: 0 }}>
            {list.emptyText}
          </p>
        </div>
      )}
    </div>
  );
}

type PolicySimulatorPartnerRow = {
  id: string;
  name: string;
  status: string;
  distanceLabel: string;
  locationAgeLabel: string;
  pillClass: string;
};

function buildPolicySimulation(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
) {
  const responseWindowMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes;
  const backupRadiusMeters =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const backupInvitationLimit =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceInvitationLimit;
  const travelBufferMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.travelBufferMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.travelBufferMinutes;
  const marketplaceOpenMode = normalizeAdminMarketplaceOpenMode(
    policyStringValueFromKeys(settings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode,
  );
  const preferredAcceptMode =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode;
  const alertChannel =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.partnerAlertChannel) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.partnerAlertChannel;
  const reference = referenceBookingCoordinate(bookings);
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE'));
  const partnerCandidates = onlinePartners
    .map((provider) => {
      const lat = readOptionalNumber(provider.currentLat);
      const lng = readOptionalNumber(provider.currentLng);
      const distanceMeters =
        lat !== null && lng !== null ? haversineDistanceMeters(reference.lat, reference.lng, lat, lng) : null;
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
      const usableLocation =
        distanceMeters !== null && ageMinutes !== null && ageMinutes <= 24 * 60 && !provider.blockedAt;
      return {
        provider,
        distanceMeters,
        ageMinutes,
        usableLocation,
      };
    })
    .filter((item) => item.usableLocation && item.distanceMeters !== null)
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity));

  const eligiblePartners = partnerCandidates.filter(
    (item) => (item.distanceMeters ?? Infinity) <= backupRadiusMeters,
  );
  const freshEligible = eligiblePartners.filter(
    (item) => (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes,
  );
  const invitedPartners = eligiblePartners.slice(0, backupInvitationLimit);
  const partnerRows: PolicySimulatorPartnerRow[] = invitedPartners.slice(0, 6).map((item) => ({
    id: item.provider.id,
    name: displayOperationalWording(item.provider.displayName ?? item.provider.user?.fullName ?? 'Partner'),
    status: (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes ? 'Fresh' : 'Stale',
    distanceLabel: formatDistance(item.distanceMeters ?? 0),
    locationAgeLabel: formatLocationAge(item.ageMinutes),
    pillClass: (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes ? 'pill-success' : 'pill-warn',
  }));
  const expiresAt = new Date(Date.now() + responseWindowMinutes * 60 * 1000);
  const immediateBackup = marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const customerFinalConfirm = preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const ready = eligiblePartners.length > 0 && freshEligible.length > 0;

  return {
    ready,
    partnerRows,
    metrics: [
      {
        label: 'Reference location',
        value: reference.label,
        helper: `${reference.lat.toFixed(4)}, ${reference.lng.toFixed(4)}`,
      },
      {
        label: 'First response window',
        value: `${responseWindowMinutes} min`,
        helper: `A request created now would auto-close around ${expiresAt.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
        })}.`,
      },
      {
        label: 'Marketplace policy',
        value: formatDistance(backupRadiusMeters),
        helper: `${eligiblePartners.length} visible partner(s), ${freshEligible.length} fresh location(s).`,
      },
      {
        label: 'Marketplace alert cap',
        value: `${backupInvitationLimit} partner(s)`,
        helper: `${invitedPartners.length} partner(s) would be invited now after distance sorting.`,
      },
      {
        label: 'Partner alert routing',
        value: policyDisplayByKey(settings, 'notification.partner_alert_channel'),
        helper: `${
          adminPartnerAlertChannelRoutesToFcm(alertChannel)
            ? 'FCM push plus in-app listing'
            : 'In-app listing now, FCM push later'
        } for eligible partners.`,
      },
    ],
    timeline: [
      {
        step: '1',
        title: 'Customer creates direct request',
        detail:
          'The selected Partner receives the first-pick request. Marketplace Partners are evaluated from current policy and location data.',
        className: 'timeline-done',
        tags: [
          {
            label: customerFinalConfirm ? 'Customer final choice' : 'Historical value ignored',
            tone: 'pill-info',
          },
          { label: `${responseWindowMinutes} min`, tone: 'pill-success' },
        ],
      },
      {
        step: '2',
        title: immediateBackup
          ? 'Marketplace list opens immediately'
          : 'Marketplace list waits unless declined',
        detail: immediateBackup
          ? `${invitedPartners.length}/${eligiblePartners.length} Partner(s) can see or participate while the first Partner decides under current policy.`
          : `Marketplace Partners are held until the ${responseWindowMinutes} minute first-pick window ends, but open immediately if the first-pick Partner declines.`,
        className: immediateBackup ? 'timeline-active' : 'timeline-warn',
        tags: [
          { label: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode), tone: 'pill-info' },
          {
            label: `${eligiblePartners.length} eligible`,
            tone: eligiblePartners.length ? 'pill-success' : 'pill-danger',
          },
        ],
      },
      {
        step: '3',
        title: 'Partner availability is buffered',
        detail: `After a partner completes a booking, the system uses a ${travelBufferMinutes} minute travel buffer before they become normally available again.`,
        className: 'timeline-done',
        tags: [
          { label: `${travelBufferMinutes} min travel buffer`, tone: 'pill-neutral' },
          { label: 'Location reuse only', tone: 'pill-info' },
        ],
      },
    ],
    checks: [
      {
        status: ready ? 'Supply ready' : 'Needs supply',
        title: 'Dispatch supply check',
        detail: ready
          ? `${freshEligible.length} fresh partner location(s) are inside the current radius.`
          : 'No fresh eligible partner location is inside the current radius.',
        operatorAction: ready
          ? 'This policy can support a real customer wait screen for the reference area.'
          : 'Ask partners to open the app and send location, or review radius/city supply before launch.',
        className: ready ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: ready ? 'pill-success' : 'pill-danger',
      },
      {
        status: immediateBackup ? 'Customer alternatives visible' : 'Strict first-pick',
        title: 'Customer waiting experience',
        detail: immediateBackup
          ? 'Customers can see marketplace partner interest during the first response window.'
          : 'Customers may see an empty waiting screen until the first partner times out, unless that partner declines first.',
        operatorAction: immediateBackup
          ? 'Keep monitoring whether customers understand first-pick vs marketplace partner choice.'
          : 'Use only if first-pick response rate is high enough to avoid empty waiting.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        status: customerFinalConfirm ? 'Customer controls' : 'Fast lock',
        title: 'Final matching decision',
        detail: customerFinalConfirm
          ? 'Customer final selection applies when first-pick does not validly match first.'
          : 'This setting would conflict with the first-pick priority plus customer fallback flow.',
        operatorAction: customerFinalConfirm
          ? 'This matches the current HANDS direction: first-pick can win first, otherwise the customer chooses.'
          : 'Treat this as a configuration conflict for HANDS and return to first-pick priority with customer fallback.',
        className: customerFinalConfirm ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: customerFinalConfirm ? 'pill-success' : 'pill-danger',
      },
    ],
  };
}

function buildPolicyRecommendationReview(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
) {
  const openMatchingCount = bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length;
  const activeBookingCount = bookings.filter((booking) =>
    ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  ).length;
  const reviewable = settings.filter(
    (setting) => setting.recommendedValue !== null && setting.recommendedValue !== undefined,
  );
  const cards = reviewable.map((setting) => {
    const aligned = String(setting.value) === String(setting.recommendedValue);
    const posture = policyRecommendationPosture(setting, { openMatchingCount, activeBookingCount });
    return {
      key: setting.key,
      label: displayOperationalWording(setting.label),
      status: aligned ? 'Recommended' : posture.status,
      detail: aligned
        ? `Current value matches the recommended baseline: ${policyDisplayValue(setting)}.`
        : `Current value is ${policyDisplayValue(setting)}; recommended is ${policyDisplayValue(setting, true)}. ${posture.detail}`,
      operatorAction: aligned ? posture.alignedAction : posture.operatorAction,
      className: aligned ? 'ops-task-done' : posture.className,
      pillClass: aligned ? 'pill-success' : posture.pillClass,
      aligned,
      enforced: setting.enforced,
    };
  });
  const warningCount = cards.filter((card) => !card.aligned).length;
  const enforcedWarningCount = cards.filter((card) => !card.aligned && card.enforced).length;
  return {
    warningCount,
    summary: [
      {
        label: 'Compared policies',
        value: String(reviewable.length),
        helper: 'Policies with an explicit recommended baseline.',
      },
      {
        label: 'Owner choices',
        value: String(warningCount),
        helper: 'Current values intentionally different from recommendation.',
      },
      {
        label: 'Live deviations',
        value: String(enforcedWarningCount),
        helper: 'Differences that can affect live booking behavior.',
      },
      {
        label: 'Active bookings',
        value: String(activeBookingCount),
        helper: 'Bookings to consider before changing enforced values.',
      },
    ],
    cards,
  };
}

function buildBookingCreateGateReview(
  settings: AdminOperationalPolicySetting[],
  auditLogs: AdminAuditLog[],
): BookingCreateGateReview {
  const customerDistanceKm =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingMaxCustomerCurrentToAddressKm;
  const preferredPartnerDistanceKm =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingMaxPreferredPartnerDistanceKm;
  const freshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingCurrentLocationFreshnessMinutes;
  const distanceGateEnabled = policyBooleanValue(settings, 'booking.distance_gate_enabled') ?? true;
  const serviceAreaRequired = policyBooleanValue(settings, 'booking.service_area_required') ?? true;
  const rejections = auditLogs
    .filter((log) => log.action === 'booking.create.rejected')
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const reasonCounts = bookingGateReasonCounts(rejections);

  return {
    currentPolicyLabel: distanceGateEnabled ? 'Distance gates active' : 'Distance gates disabled',
    summary: [
      {
        label: 'Optional customer GPS evidence',
        value: `${customerDistanceKm} km`,
        helper: 'Optional evidence only. Booking authority comes from the confirmed service address.',
      },
      {
        label: 'First-pick partner gate',
        value: `${preferredPartnerDistanceKm} km`,
        helper: 'Preferred partner must be near the booking address before payment opens.',
      },
      {
        label: 'Location freshness',
        value: `${freshnessMinutes} min`,
        helper: 'Optional GPS evidence freshness when the app can provide it.',
      },
      {
        label: 'Blocked attempts',
        value: String(rejections.length),
        helper: 'Recent booking create requests stopped before payment and matching.',
      },
    ],
    rows: [
      {
        key: 'booking.distance_gate_enabled',
        gate: 'Distance gate',
        current: distanceGateEnabled ? 'Enabled' : 'Disabled',
        defaultValue: 'Enabled',
        operatorMeaning: distanceGateEnabled
          ? 'First-pick partner distance is checked from the booking address. Customer GPS stays optional evidence.'
          : 'Partner distance gate is disabled. Keep this only for controlled tests.',
        evidence: 'Blocked attempts',
        href: '/bookings?view=blocked-create',
        pillClass: distanceGateEnabled ? 'pill-success' : 'pill-danger',
      },
      {
        key: 'booking.service_area_required',
        gate: 'Service area',
        current: serviceAreaRequired ? 'Required' : 'Optional',
        defaultValue: 'Required',
        operatorMeaning: serviceAreaRequired
          ? 'Booking address must be inside an enabled Vietnam service area.'
          : 'Booking can be created outside configured service areas. Use only before a city launch test.',
        evidence: `${reasonCounts.get('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') ?? 0} reject(s)`,
        href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
        pillClass: serviceAreaRequired ? 'pill-success' : 'pill-warn',
      },
      {
        key: 'booking.max_customer_current_to_booking_address_km',
        gate: 'Optional customer GPS evidence',
        current: `${customerDistanceKm} km`,
        defaultValue: '20 km',
        operatorMeaning:
          'A customer can browse globally and book from a confirmed Vietnam service address. GPS distance is retained only as optional evidence.',
        evidence: `${reasonCounts.get('CUSTOMER_CURRENT_LOCATION_TOO_FAR') ?? 0} historical row(s)`,
        href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION_TOO_FAR',
        pillClass: customerDistanceKm === 20 ? 'pill-success' : 'pill-warn',
      },
      {
        key: 'booking.max_preferred_partner_distance_km',
        gate: 'First-pick partner',
        current: `${preferredPartnerDistanceKm} km`,
        defaultValue: '50 km',
        operatorMeaning:
          'The selected first-pick Partner must be close enough to the booking address before payment authorization.',
        evidence: `${reasonCounts.get('PREFERRED_PARTNER_TOO_FAR') ?? 0} reject(s)`,
        href: '/audit-log?query=PREFERRED_PARTNER_TOO_FAR',
        pillClass: preferredPartnerDistanceKm === 50 ? 'pill-success' : 'pill-warn',
      },
      {
        key: 'booking.current_location_freshness_minutes',
        gate: 'Optional GPS freshness',
        current: `${freshnessMinutes} min`,
        defaultValue: '10 min',
        operatorMeaning:
          'Fresh customer GPS can be stored as optional support evidence when available. Booking authority remains the confirmed service address.',
        evidence: `${bookingGateCurrentLocationRejectCount(reasonCounts)} historical row(s)`,
        href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION',
        pillClass: freshnessMinutes === 10 ? 'pill-success' : 'pill-warn',
      },
    ],
    recentAttempts: rejections.slice(0, 5).map((log) => {
      const metadata = readPlainRecord(log.metadata);
      const reasonCode = readOptionalString(metadata?.reasonCode) ?? 'UNKNOWN';
      return {
        id: log.id,
        reason: bookingGateReasonLabel(reasonCode),
        detail: bookingGateAttemptDetail(metadata),
        createdAt: log.createdAt,
        href: `/audit-log?query=${encodeURIComponent(reasonCode)}`,
        pillClass: bookingGateReasonPill(reasonCode),
      };
    }),
  };
}

function policyRecommendationPosture(
  setting: AdminOperationalPolicySetting,
  context: { openMatchingCount: number; activeBookingCount: number },
) {
  const value = String(setting.value);
  const recommended = String(setting.recommendedValue);
  const numericValue = Number(setting.value);
  const numericRecommended = Number(setting.recommendedValue);
  const liveContext =
    context.openMatchingCount > 0
      ? `${context.openMatchingCount} open matching booking(s) may feel this policy while active.`
      : 'No open matching booking is currently exposed to this policy.';

  if (setting.key === 'matching.provider_response_window_minutes') {
    const shorter =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue < numericRecommended;
    return {
      status: shorter ? 'Faster than baseline' : 'Slower than baseline',
      detail: shorter
        ? 'This can reduce waiting time but may make first-pick Partners miss requests.'
        : 'This gives Partners more time but increases customer waiting anxiety.',
      operatorAction: `${liveContext} Existing booking countdowns do not recalculate.`,
      alignedAction: 'Keep monitoring first-pick response rate and cancellation during the waiting window.',
      className: shorter ? 'ops-task-pending' : 'ops-task-blocked',
      pillClass: shorter ? 'pill-warn' : 'pill-danger',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
    ])
  ) {
    const narrower =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue < numericRecommended;
    return {
      status: narrower ? 'Narrow supply' : 'Wide supply',
      detail: narrower
        ? 'Fewer partners can participate in marketplace matching, so customer alternatives may look empty.'
        : 'More partners can participate, but distance and arrival quality need closer monitoring.',
      operatorAction: `${liveContext} Monitor ignored marketplace alerts and late arrivals by city.`,
      alignedAction:
        'Radius is at the default operating range; keep reviewing city density before making it dynamic.',
      className: narrower ? 'ops-task-blocked' : 'ops-task-pending',
      pillClass: narrower ? 'pill-danger' : 'pill-warn',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
    ])
  ) {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Allows older locations' : 'Stricter freshness',
      detail: looser
        ? 'Marketplace alerts may reach partners whose last known location is no longer reliable.'
        : 'Only recently refreshed partner locations are eligible for marketplace alerts and participation.',
      operatorAction: `${liveContext} Check partner app location refresh failures before loosening this.`,
      alignedAction:
        'Freshness is at the 30-minute baseline; this fits the 10-minute periodic location update rule.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === 'matching.preferred_accept_mode') {
    return {
      status: value === 'AUTO_MATCH_ON_ACCEPT' ? 'Historical value ignored' : 'First-pick priority',
      detail:
        value === 'AUTO_MATCH_ON_ACCEPT'
          ? 'The API now ignores this historical value and uses first-pick priority with customer fallback instead.'
          : 'First-pick priority is required: the first-pick Partner can match first, otherwise customer fallback choice remains available.',
      operatorAction: 'Keep first-pick priority active before scaling marketplace partner shortlist UX.',
      alignedAction:
        'First-pick priority with customer fallback is aligned with the intended direct + marketplace matching model.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (
    policyKeyMatches(setting.key, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ])
  ) {
    return {
      status: value === 'IMMEDIATE_WITHIN_WINDOW' ? 'Immediate marketplace' : 'Delayed marketplace',
      detail:
        value === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'This reduces empty waiting screens and lets nearby partners show interest early.'
          : 'This protects the first-pick Partner window, but marketplace Partners now open immediately when the first-pick Partner declines.',
      operatorAction: `${liveContext} If delayed mode is kept, support should watch waiting-screen complaints.`,
      alignedAction:
        'Immediate marketplace participation supports lower customer anxiety during the first window.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'wallet.negative_balance_gate') {
    const blocksMarketplace = adminWalletGateBlocksMarketplaceParticipation(value);
    return {
      status: blocksMarketplace ? 'Marketplace hold' : 'Historical setting review',
      detail: blocksMarketplace
        ? 'Cash-debt exposure is contained at final acceptance, service start, and payout release gates.'
        : 'Historical exception mode is retained for audit only. The MVP still blocks final acceptance, service start, and payout release until settlement.',
      operatorAction:
        'Keep marketplace list visibility open; use settlement evidence before final acceptance, service start, or payout release.',
      alignedAction: 'Marketplace settlement control matches the HANDS MVP authority rule.',
      className: blocksMarketplace ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: blocksMarketplace ? 'pill-success' : 'pill-danger',
    };
  }

  if (setting.key === 'booking.distance_gate_enabled') {
    return {
      status: value === 'true' ? 'Distance protected' : 'Distance disabled',
      detail:
        value === 'true'
          ? 'Booking create keeps address, customer GPS, and preferred partner distance gates active.'
          : 'Booking create can bypass distance gates. Keep this only for internal tests.',
      operatorAction:
        'Review blocked create attempts before changing this because customers can browse globally while booking remains local.',
      alignedAction: 'Distance gates are active before payment authorization and matching.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: value === recommended ? 'pill-success' : 'pill-danger',
    };
  }

  if (setting.key === 'booking.service_area_required') {
    return {
      status: value === 'true' ? 'Service area required' : 'Service area bypass',
      detail:
        'This controls whether selected booking addresses must be inside enabled Vietnam operating areas.',
      operatorAction:
        'Use setup and blocked-create evidence before relaxing this during city launch configuration.',
      alignedAction: 'Immediate booking stays inside configured HANDS service areas.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'booking.max_customer_current_to_booking_address_km') {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Wide optional GPS evidence range' : 'Baseline optional GPS evidence range',
      detail:
        'This records the optional customer GPS evidence threshold. Booking creation authority is the confirmed service address snapshot.',
      operatorAction:
        'Review optional customer GPS rows only as support context. Keep booking decisions tied to the immutable address snapshot.',
      alignedAction:
        'Customer GPS evidence is optional while global browsing and address-based booking stay open.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === 'booking.max_preferred_partner_distance_km') {
    const wider =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: wider ? 'Wide first-pick gate' : 'Strict first-pick gate',
      detail:
        'This controls how far the selected first-pick Partner can be from the booking address before payment opens.',
      operatorAction:
        'Check Partner location coverage and rejected first-pick distance logs before widening this.',
      alignedAction: 'First-pick partner distance matches the 50 km baseline for local direct booking.',
      className: wider ? 'ops-task-pending' : 'ops-task-done',
      pillClass: wider ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === 'booking.current_location_freshness_minutes') {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Keeps older optional GPS evidence' : 'Optional GPS evidence baseline',
      detail:
        'This controls how recent optional customer GPS evidence is retained when the app can provide it.',
      operatorAction:
        'Verify address search and optional current-location capture before changing evidence freshness.',
      alignedAction: 'Optional customer GPS evidence matches the 10 minute support-evidence baseline.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  return {
    status: setting.enforced ? 'Owner choice' : 'Planning choice',
    detail: 'This differs from the recommended baseline and should stay visible in weekly operations review.',
    operatorAction: setting.enforced
      ? `${context.activeBookingCount} active booking(s) may need operator awareness.`
      : 'This is not enforced yet; keep the decision documented before automation.',
    alignedAction: 'Current value matches the recommended policy posture.',
    className: setting.enforced ? 'ops-task-pending' : 'ops-task-done',
    pillClass: setting.enforced ? 'pill-warn' : 'pill-info',
  };
}

function buildBookingAcceptanceMatrix(settings: AdminOperationalPolicySetting[], providers: AdminProvider[]) {
  const responseWindowMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes;
  const backupRadiusMeters =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const preferredAcceptMode =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode;
  const marketplaceOpenMode = normalizeAdminMarketplaceOpenMode(
    policyStringValueFromKeys(settings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode,
  );
  const alertChannel =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.partnerAlertChannel) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.partnerAlertChannel;
  const walletGate =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate;

  const customerFinalChoice = preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const immediateBackup = marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const pushReady = adminPartnerAlertChannelRoutesToFcm(alertChannel);
  const hardWalletBlock = adminWalletGateBlocksMarketplaceParticipation(walletGate);
  const baselineRadius = backupRadiusMeters === 10000;
  const baselineTimer = responseWindowMinutes === 10;
  const baselineLocationFreshness = backupLocationFreshnessMinutes === 30;

  const cards = [
    {
      title: 'First-pick response window',
      status: baselineTimer ? 'HANDS baseline' : 'Owner override',
      detail: `The first selected partner has ${responseWindowMinutes} minute(s) before the request needs operator attention.`,
      operatorAction: baselineTimer
        ? 'Keep this at 10 minutes until live response-rate data says otherwise.'
        : 'Monitor customer wait complaints and first-pick acceptance rate before keeping this override.',
      className: baselineTimer ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineTimer ? 'pill-success' : 'pill-warn',
      blocking: !baselineTimer,
    },
    {
      title: 'Marketplace Partner pool',
      status: baselineRadius ? 'Default policy' : 'Custom policy',
      detail: `Marketplace participation currently uses ${formatDistance(backupRadiusMeters)} as an operating alert and distance-ordering policy.`,
      operatorAction: baselineRadius
        ? 'This matches the current operating baseline for partner participation alerts.'
        : 'Review city supply, arrival time, and ignored marketplace alerts before changing policy.',
      className: baselineRadius ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineRadius ? 'pill-success' : 'pill-warn',
      blocking: !baselineRadius,
    },
    {
      title: 'Marketplace location freshness',
      status: baselineLocationFreshness ? '30m default' : 'Custom freshness',
      detail: `Marketplace Partner location freshness is checked at ${backupLocationFreshnessMinutes} minute(s) for operator confidence.`,
      operatorAction: baselineLocationFreshness
        ? 'This matches the partner app rule that refreshes location every 10 minutes while open.'
        : 'If this is loosened, monitor stale-location participation and partner no-response rates.',
      className: baselineLocationFreshness ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineLocationFreshness ? 'pill-success' : 'pill-warn',
      blocking: !baselineLocationFreshness,
    },
    {
      title: 'Marketplace visibility timing',
      status: immediateBackup ? 'Visible during wait' : 'Legacy value review',
      detail: immediateBackup
        ? 'Nearby Partners can participate while the first-pick Partner is still deciding.'
        : 'Custom marketplace timing values need API review before rollout.',
      operatorAction: immediateBackup
        ? 'This best matches the customer waiting screen where available marketplace Partners appear early.'
        : 'Keep immediate marketplace participation unless a new approved policy is added.',
      className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      blocking: !immediateBackup,
    },
    {
      title: 'Customer final selection',
      status: customerFinalChoice ? 'Customer controls' : 'Customer-choice conflict',
      detail: customerFinalChoice
        ? 'Customer fallback selection applies when first-pick does not validly match first.'
        : 'This setting would remove the customer fallback choice step.',
      operatorAction: customerFinalChoice
        ? 'Keep first-pick priority with customer fallback before production rollout.'
        : 'Return this policy to customer-confirm mode before production use.',
      className: customerFinalChoice ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: customerFinalChoice ? 'pill-success' : 'pill-danger',
      blocking: !customerFinalChoice,
    },
    {
      title: 'Partner alert delivery',
      status: pushReady ? 'Push enabled' : 'In-app first',
      detail: pushReady
        ? 'Partner booking and marketplace participation alerts are ready to route through FCM.'
        : 'Booking notifications are recorded in-app until FCM production setup is fully ready.',
      operatorAction: pushReady
        ? 'Monitor delivery failures and disabled devices on the Notifications board.'
        : 'Keep this until FCM and production SMS credentials/monitoring are complete.',
      className: pushReady ? 'ops-task-done' : 'ops-task-pending',
      pillClass: pushReady ? 'pill-success' : 'pill-info',
      blocking: false,
    },
    {
      title: 'Negative wallet gate',
      status: hardWalletBlock ? 'Marketplace hold' : 'Historical setting review',
      detail: hardWalletBlock
        ? 'Partners with unpaid cash-service fee debt can stay visible, but final acceptance, service start, and payout release wait for settlement.'
        : 'Historical exception mode is retained for audit only. Final acceptance, service start, and payout release should remain blocked until settlement.',
      operatorAction: hardWalletBlock
        ? 'This protects HANDS cash-fee collection without removing marketplace visibility.'
        : 'Reset to the marketplace hold policy after reviewing the saved setting.',
      className: hardWalletBlock ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: hardWalletBlock ? 'pill-success' : 'pill-danger',
      blocking: !hardWalletBlock,
    },
  ];
  const impact = buildPartnerAcceptancePolicyImpact(providers, {
    backupLocationFreshnessMinutes,
    hardWalletBlock,
  });

  return {
    blockingCount: cards.filter((card) => card.blocking).length,
    summary: [
      {
        label: 'First-pick timer',
        value: `${responseWindowMinutes} min`,
        helper: 'Partner accepts or the request needs operator attention.',
      },
      {
        label: 'Marketplace policy',
        value: formatDistance(backupRadiusMeters),
        helper: 'Nearby partners who can participate.',
      },
      {
        label: 'Location freshness',
        value: `${backupLocationFreshnessMinutes} min`,
        helper: 'Marketplace alerts flag older partner locations.',
      },
      {
        label: 'Marketplace timing',
        value: immediateBackup ? 'Immediate' : 'Delayed',
        helper: 'Visibility during first-pick wait.',
      },
      {
        label: 'Final match',
        value: customerFinalChoice ? 'Customer chooses' : 'Policy conflict',
        helper: 'Customer fallback selection remains available unless first-pick validly matches first.',
      },
    ],
    cards,
    impact,
  };
}

function buildPartnerAcceptancePolicyImpact(
  providers: AdminProvider[],
  policy: { backupLocationFreshnessMinutes: number; hardWalletBlock: boolean },
) {
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE'));
  const finalGateReadyPartners = providers.filter((provider) =>
    partnerCanCompleteFinalGateUnderCurrentPolicy(provider, policy),
  );
  const walletGateHeld = providers.filter((provider) => partnerWalletBalance(provider) < 0);
  const identityBlocked = providers.filter((provider) => !partnerIdentityReady(provider));
  const bankBlocked = providers.filter((provider) => !partnerBankReady(provider));
  const locationBlocked = providers.filter(
    (provider) => !partnerLocationFresh(provider, policy.backupLocationFreshnessMinutes),
  );
  const pushGaps = providers.filter((provider) => !partnerHasEnabledPush(provider));
  const accountFollowUps = providers.filter((provider) => partnerAccountNeedsFollowUp(provider));
  const softRecovery = providers.filter(
    (provider) =>
      !partnerCanCompleteFinalGateUnderCurrentPolicy(provider, policy) &&
      !partnerFinalGateHeld(provider, policy),
  );

  return [
    {
      label: 'Marketplace ready',
      value: finalGateReadyPartners.length.toString(),
      helper: `${onlinePartners.length} online partner(s), filtered by marketplace, location, push, and control readiness.`,
    },
    {
      label: 'Marketplace held',
      value: providers
        .filter((provider) => partnerMarketplaceBlocked(provider, { hardWalletBlock: policy.hardWalletBlock }))
        .length.toString(),
      helper:
        'Account controls, identity failure, missing approved bank, or negative wallet can hold marketplace alerts and participation.',
    },
    {
      label: 'Cash debt gate',
      value: walletGateHeld.length.toString(),
      helper: policy.hardWalletBlock
        ? 'Negative wallet gates final acceptance, service start, and payout release.'
        : 'Negative wallet still needs settlement before final acceptance, service start, and payout release.',
    },
    {
      label: 'Identity block',
      value: identityBlocked.length.toString(),
      helper: 'Partner approval, KYC, and required CCCD/selfie documents are not all approved.',
    },
    {
      label: 'Bank block',
      value: bankBlocked.length.toString(),
      helper: 'No approved bank account is available, so paid work acceptance should stay blocked.',
    },
    {
      label: 'Location block',
      value: locationBlocked.length.toString(),
      helper: `Missing or older than ${policy.backupLocationFreshnessMinutes} minute(s), so marketplace matching should request a fresh location.`,
    },
    {
      label: 'Push gap',
      value: pushGaps.length.toString(),
      helper: 'Partner may not receive first-pick or marketplace participation alerts.',
    },
    {
      label: 'Account follow-up',
      value: accountFollowUps.length.toString(),
      helper:
        'Blocked account, active admin hold, blocked device, session follow-up, or shared device record.',
    },
    {
      label: 'Readiness follow-up',
      value: softRecovery.length.toString(),
      helper: 'Not ready now, but can be made ready through app open, push refresh, or manual follow-up.',
    },
  ];
}

function partnerCanCompleteFinalGateUnderCurrentPolicy(
  provider: AdminProvider,
  policy: { backupLocationFreshnessMinutes: number; hardWalletBlock: boolean },
) {
  return adminPartnerCanCompleteFinalGate(provider, {
    freshnessMinutes: policy.backupLocationFreshnessMinutes,
    hardWalletBlock: policy.hardWalletBlock,
  });
}

function partnerMarketplaceBlocked(provider: AdminProvider, policy: { hardWalletBlock?: boolean } = {}) {
  return adminPartnerMarketplaceBlocked(provider, policy);
}

function partnerFinalGateHeld(provider: AdminProvider, policy: { hardWalletBlock: boolean }) {
  return adminPartnerFinalGateHeld(provider, policy);
}

function partnerIdentityReady(provider: AdminProvider) {
  return adminPartnerIdentityReady(provider);
}

function partnerBankReady(provider: AdminProvider) {
  return adminPartnerBankReady(provider);
}

function partnerWalletBalance(provider: AdminProvider) {
  return adminPartnerWalletBalance(provider);
}

function partnerLocationFresh(provider: AdminProvider, freshnessMinutes: number) {
  return adminPartnerLocationFresh(provider, freshnessMinutes, Date.now());
}

function partnerHasEnabledPush(provider: AdminProvider) {
  return adminPartnerHasEnabledPush(provider);
}

function partnerAccountNeedsFollowUp(provider: AdminProvider) {
  return adminPartnerAccountNeedsFollowUp(provider);
}

function buildPolicyImpactDashboard(settings: AdminOperationalPolicySetting[], bookings: AdminBooking[]) {
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const activeDispatch = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const negativeCashDebtBookings = bookings.filter((booking) => bookingWalletLedgerTotal(booking) < 0);
  const withSnapshot = bookings.filter((booking) => readBookingMatchingPolicySnapshot(booking));
  const snapshotDrift = bookings.filter(
    (booking) => bookingPolicySnapshotDrift(booking, settings).length > 0,
  );
  const withoutSnapshot = bookings.filter((booking) => !readBookingMatchingPolicySnapshot(booking));
  const openMatchingWithSnapshot = openMatching.filter((booking) =>
    readBookingMatchingPolicySnapshot(booking),
  );
  const openMatchingWithoutSnapshot = openMatching.length - openMatchingWithSnapshot.length;
  const snapshotCoverage =
    bookings.length > 0 ? `${Math.round((withSnapshot.length / bookings.length) * 100)}%` : 'No sample';
  const immediateBackup =
    normalizeAdminMarketplaceOpenMode(
      policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
    ) === 'IMMEDIATE_WITHIN_WINDOW';
  const customerConfirm =
    policyRawValue(settings, 'matching.preferred_accept_mode') === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

  return {
    metrics: [
      {
        label: 'Open matching now',
        value: String(openMatching.length),
        helper:
          'Existing open bookings keep their saved policy snapshot; new bookings use the current live policy.',
      },
      {
        label: 'Active dispatch',
        value: String(activeDispatch.length),
        helper: 'Matched or in-service bookings should be handled by their saved booking state.',
      },
      {
        label: 'Policy drift',
        value: String(snapshotDrift.length),
        helper:
          'Expected when Admin policy changed after a booking opened; use booking detail before manual action.',
      },
      {
        label: 'Older bookings',
        value: String(withoutSnapshot.length),
        helper: 'Older bookings without metadata fall back to live policy explanations.',
      },
    ],
    snapshotSummary: [
      {
        scope: 'Forward-only',
        label: 'Live policy applies to new bookings',
        value: 'Create time snapshot',
        helper:
          'When a customer books, HANDS copies the active matching policy into booking metadata for later audit.',
      },
      {
        scope: 'Open now',
        label: 'Open bookings with saved policy',
        value: `${openMatchingWithSnapshot.length}/${openMatching.length}`,
        helper:
          openMatchingWithoutSnapshot > 0
            ? `${openMatchingWithoutSnapshot} open booking(s) without snapshots still need manual policy interpretation.`
            : 'Every open matching booking in this sample has a saved policy snapshot.',
      },
      {
        scope: 'Coverage',
        label: 'Snapshot coverage',
        value: snapshotCoverage,
        helper: `${withSnapshot.length}/${bookings.length} sampled booking(s) include metadata.matchingPolicy.`,
      },
      {
        scope: 'Review',
        label: 'Policy drift meaning',
        value: snapshotDrift.length ? `${snapshotDrift.length} changed` : 'Aligned',
        helper:
          'Drift is not an error. It tells operators that the booking was opened under an older policy value.',
      },
    ],
    snapshotRows: [
      {
        policy: 'First-pick response timer',
        scope: 'Timer / expiry',
        liveValue: policyDisplayByKey(settings, 'matching.provider_response_window_minutes'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.providerResponseWindowMinutes,
          (value) => `${value} min`,
        ),
        operatorMeaning:
          'Saved at booking open. Existing countdowns and Redis matching TTL should not be recalculated after a policy edit.',
      },
      {
        policy: 'Marketplace Partner radius',
        scope: 'Partner eligibility',
        liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupProviderRadiusMeters,
          (value) => formatDistance(Number(value)),
        ),
        operatorMeaning:
          'Controls which nearby partners can participate for each booking. New bookings copy the latest radius.',
      },
      {
        policy: 'Marketplace location freshness',
        scope: 'Partner eligibility',
        liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupProviderLocationMaxAgeMinutes,
          (value) => `${value} min`,
        ),
        operatorMeaning:
          'Controls whether stale partner locations are excluded from marketplace alerts and participation attempts.',
      },
      {
        policy: 'Partner accept mode',
        scope: 'Final matching',
        liveValue: policyDisplayByKey(settings, 'matching.preferred_accept_mode'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.preferredAcceptMode,
          (value) => formatSnapshotPolicyValue(settings, 'matching.preferred_accept_mode', value),
        ),
        operatorMeaning:
          'Confirms first-pick Partners can match first under API rules; otherwise customer final selection is required.',
      },
      {
        policy: 'Marketplace opening mode',
        scope: 'Marketplace visibility',
        liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupOpenMode,
          (value) => formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, value),
        ),
        operatorMeaning:
          'Explains whether marketplace Partners were allowed to participate during the first-pick response window.',
      },
      {
        policy: 'Travel buffer',
        scope: 'Availability',
        liveValue: policyDisplayByKey(settings, 'matching.travel_buffer_minutes'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.travelBufferMinutes,
          (value) => `${value} min`,
        ),
        operatorMeaning:
          'Used for availability explanations and partner supply planning around back-to-back bookings.',
      },
    ],
    cards: [
      {
        scope: 'New bookings',
        title: 'Response timer changes are forward-only',
        detail:
          'Changing the first-pick Partner response window affects new booking expiry and Redis TTL. Existing bookings keep their saved expiresAt value.',
        operatorAction:
          openMatching.length > 0
            ? `There are ${openMatching.length} open booking(s); do not expect their countdown to recalculate.`
            : 'No open matching bookings are waiting right now.',
        className: 'ops-task-done',
        pillClass: 'pill-success',
      },
      {
        scope: 'Live matching',
        title: immediateBackup
          ? 'Marketplace Partners can participate during the first window'
          : 'Marketplace timing needs policy review',
        detail: immediateBackup
          ? 'Eligible Partners can appear while the first-pick Partner is still deciding.'
          : 'Only immediate marketplace participation is approved for the current MVP runtime.',
        operatorAction: customerConfirm
          ? 'First-pick priority is active, with customer final choice as the fallback when first-pick does not win.'
          : 'Historical policy value is ignored; reset the policy to first-pick priority with customer fallback.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        scope: 'Partner controls',
        title: 'Negative wallet gate protects cash-fee debt',
        detail:
          'Partners with unpaid cash-fee debt can still see marketplace requests, but final acceptance, service start, and payout release wait until settlement is posted.',
        operatorAction:
          negativeCashDebtBookings.length > 0
            ? `${negativeCashDebtBookings.length} recent booking(s) have negative wallet state to review.`
            : 'No negative wallet booking state was found in the current sample.',
        className: negativeCashDebtBookings.length > 0 ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: negativeCashDebtBookings.length > 0 ? 'pill-danger' : 'pill-success',
      },
      {
        scope: 'Audit',
        title: 'Saved policy snapshots make old bookings explainable',
        detail:
          'Bookings created after this change keep response window, marketplace radius, accept mode, marketplace-open mode, and travel buffer in metadata.',
        operatorAction:
          snapshotDrift.length > 0
            ? `${snapshotDrift.length} booking(s) differ from current policy; review booking detail before manual action.`
            : 'Current booking snapshots are aligned with the live policy sample.',
        className: snapshotDrift.length > 0 ? 'ops-task-pending' : 'ops-task-done',
        pillClass: snapshotDrift.length > 0 ? 'pill-warn' : 'pill-success',
      },
    ],
  };
}

type PolicyDrilldownPill = {
  label: string;
  className: string;
};

type PolicyDrilldownRow = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  pills: PolicyDrilldownPill[];
  operatorAction: string;
};

type PolicyDrilldownListView = {
  key: string;
  title: string;
  helper: string;
  className: string;
  pillClass: string;
  emptyText: string;
  rows: PolicyDrilldownRow[];
};

function buildPolicyDrilldown(bookings: AdminBooking[], settings: AdminOperationalPolicySetting[]) {
  const openMatchingRows = bookings
    .filter((booking) => booking.status === 'OPEN_MATCHING')
    .sort(byNewestBooking)
    .slice(0, 6)
    .map((booking) => {
      const participantCount = booking.participants?.length ?? 0;
      return {
        id: booking.id,
        href: `/bookings/${booking.id}`,
        title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
        subtitle: `${bookingPartnerLabel(booking)} / ${bookingCustomerLabel(booking)}`,
        pills: [
          { label: booking.status, className: 'pill-warn' },
          {
            label: `${participantCount} participant(s)`,
            className: participantCount ? 'pill-info' : 'pill-neutral',
          },
          {
            label: booking.expiresAt
              ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
              : 'no expiry',
            className: 'pill-info',
          },
        ],
        operatorAction:
          'Review this booking before changing response-window, marketplace-radius, or marketplace-open policy.',
      };
    });

  const driftRows = bookings
    .map((booking) => ({ booking, drift: bookingPolicySnapshotDrift(booking, settings) }))
    .filter(({ drift }) => drift.length > 0)
    .sort((left, right) => byNewestBooking(left.booking, right.booking))
    .slice(0, 6)
    .map(({ booking, drift }) => ({
      id: booking.id,
      href: `/bookings/${booking.id}`,
      title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
      subtitle: `${booking.status} / ${bookingPartnerLabel(booking)}`,
      pills: drift.slice(0, 3).map((item) => ({
        label: item.label,
        className: 'pill-warn',
      })),
      operatorAction:
        drift.length > 3
          ? `${drift.length} policy values differ. Use the booking detail snapshot before manual action.`
          : 'Saved booking policy differs from live policy. Check the booking detail snapshot first.',
    }));

  const walletRows = bookings
    .map((booking) => ({ booking, recentWalletTotal: bookingWalletLedgerTotal(booking) }))
    .filter(({ recentWalletTotal }) => recentWalletTotal < 0)
    .sort((left, right) => left.recentWalletTotal - right.recentWalletTotal)
    .slice(0, 6)
    .map(({ booking, recentWalletTotal }) => ({
      id: booking.id,
      href: `/bookings/${booking.id}`,
      title: `${bookingPartnerLabel(booking)} / ${shortId(booking.id)}`,
      subtitle: `${bookingServiceLabel(booking)} / ${booking.payment?.method ?? 'payment unknown'}`,
      pills: [
        { label: formatMoney(recentWalletTotal), className: 'pill-danger' },
        { label: booking.payment?.status ?? 'payment unknown', className: 'pill-warn' },
        { label: booking.status, className: 'pill-neutral' },
      ],
      operatorAction:
        'Recent wallet entries are negative. Confirm settlement before marketplace alerts, participation, or payout release.',
    }));

  const lists: PolicyDrilldownListView[] = [
    {
      key: 'open-matching',
      title: 'Open matching queue',
      helper: 'Bookings currently waiting for first-pick and marketplace partner decisions.',
      className: openMatchingRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: openMatchingRows.length ? 'pill-warn' : 'pill-success',
      emptyText: 'No open matching booking needs policy review right now.',
      rows: openMatchingRows,
    },
    {
      key: 'snapshot-drift',
      title: 'Snapshot drift',
      helper: 'Bookings whose saved policy snapshot differs from the current Admin policy.',
      className: driftRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: driftRows.length ? 'pill-warn' : 'pill-success',
      emptyText: 'No sampled booking has policy drift.',
      rows: driftRows,
    },
    {
      key: 'wallet-gate',
      title: 'Wallet gate queue',
      helper:
        'Partners with negative recent wallet ledger entries that may hold marketplace alerts, participation, or payout release.',
      className: walletRows.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: walletRows.length ? 'pill-danger' : 'pill-success',
      emptyText: 'No negative recent wallet ledger was found in the current booking sample.',
      rows: walletRows,
    },
  ];

  return {
    totalCount: lists.reduce((total, list) => total + list.rows.length, 0),
    lists,
  };
}

function byNewestBooking(left: AdminBooking, right: AdminBooking) {
  return (
    Date.parse(right.createdAt ?? right.updatedAt ?? '') - Date.parse(left.createdAt ?? left.updatedAt ?? '')
  );
}

function bookingServiceLabel(booking: AdminBooking) {
  const service = booking.services?.[0];
  const name = service?.service?.name ?? 'Service';
  const duration = service?.service?.durationMin ? `${service.service.durationMin} min` : null;
  return duration ? `${name} (${duration})` : name;
}

function bookingPartnerLabel(booking: AdminBooking) {
  const partner =
    booking.selectedProvider ??
    booking.preferredProvider ??
    booking.participants?.[0]?.providerProfile ??
    null;
  return (
    partner?.displayName ??
    partner?.user?.fullName ??
    partner?.user?.phone ??
    (booking.participants?.length ? 'Participating partner' : 'No partner yet')
  );
}

function bookingCustomerLabel(booking: AdminBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer not loaded'
  );
}

type PolicyRelatedBookingRecord = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  pills: PolicyDrilldownPill[];
};

function policyRelatedBookingRecords(key: string, bookings: AdminBooking[]) {
  const activeStatuses = ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'];
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const acceptedButNotFinal = openMatching.filter(
    (booking) =>
      !booking.selectedProviderId && (booking.participants ?? []).some((item) => item.status === 'ACCEPTED'),
  );
  const marketplaceRows = openMatching.filter(
    (booking) =>
      (booking.participants?.length ?? 0) > 0 ||
      Boolean(readBookingMatchingPolicySnapshot(booking)) ||
      Boolean(parseCoordinatePair(booking.lat, booking.lng)),
  );
  const walletRows = bookings.filter((booking) => bookingWalletLedgerTotal(booking) < 0);
  const cancellationRows = bookings.filter(
    (booking) => booking.status === 'CANCELLED' || booking.closedReason?.toUpperCase().includes('CANCEL'),
  );
  const noShowRows = bookings.filter(
    (booking) => booking.status === 'NO_SHOW' || booking.closedReason?.toUpperCase().includes('NO_SHOW'),
  );
  const activeRows = bookings.filter((booking) => activeStatuses.includes(booking.status));

  if (key === 'matching.provider_response_window_minutes') {
    return policyRelatedBookingRecordSet({
      title: 'First-pick waiting records',
      helper:
        'Existing open bookings keep their saved expiry; new timer values affect the next booking only.',
      href: '/bookings?view=first-pick',
      emptyText: 'No first-pick waiting booking is currently loaded.',
      bookings: openMatching,
      recordCount: openMatching.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        {
          label: booking.expiresAt
            ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
            : 'no expiry',
          className: 'pill-info',
        },
        { label: `${booking.participants?.length ?? 0} participant row(s)`, className: 'pill-neutral' },
      ],
    });
  }

  if (
    policyKeyMatches(key, [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ])
  ) {
    return policyRelatedBookingRecordSet({
      title: 'Marketplace participation records',
      helper:
        'These bookings show the current marketplace lane, participant count, saved policy snapshot, or booking coordinate.',
      href: '/bookings?view=marketplace',
      emptyText: 'No marketplace participation booking is currently loaded.',
      bookings: marketplaceRows,
      recordCount: marketplaceRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: booking.status === 'OPEN_MATCHING' ? 'pill-warn' : 'pill-info' },
        { label: `${booking.participants?.length ?? 0} participant(s)`, className: 'pill-info' },
        {
          label: readBookingMatchingPolicySnapshot(booking) ? 'saved policy' : 'live sample',
          className: readBookingMatchingPolicySnapshot(booking) ? 'pill-success' : 'pill-neutral',
        },
      ],
    });
  }

  if (key === 'matching.preferred_accept_mode') {
    return policyRelatedBookingRecordSet({
      title: 'Customer fallback-choice records',
      helper: 'Use this queue when first-pick does not validly win and the customer must choose from participating Partners.',
      href: '/bookings?view=customer-choice',
      emptyText: 'No accepted partner is currently waiting for customer final choice.',
      bookings: acceptedButNotFinal,
      recordCount: acceptedButNotFinal.length,
      pillBuilder: (booking) => [
        { label: 'customer choice', className: 'pill-success' },
        { label: `${booking.participants?.length ?? 0} participant(s)`, className: 'pill-info' },
        { label: booking.status, className: 'pill-warn' },
      ],
    });
  }

  if (key === 'wallet.negative_balance_gate') {
    return policyRelatedBookingRecordSet({
      title: 'Cash-fee debt records',
      helper: 'Negative wallet records can hold final acceptance, service start, or payout release.',
      href: '/cash-settlements',
      emptyText: 'No negative wallet booking record is currently loaded.',
      bookings: walletRows,
      recordCount: walletRows.length,
      pillBuilder: (booking) => [
        { label: formatMoney(Math.abs(bookingWalletLedgerTotal(booking))), className: 'pill-danger' },
        { label: booking.status, className: 'pill-info' },
        { label: 'marketplace gate check', className: 'pill-warn' },
      ],
    });
  }

  if (key === 'cancellation.after_match_policy') {
    return policyRelatedBookingRecordSet({
      title: 'Cancellation closeout records',
      helper:
        'Use these records to compare payment release, refund, chat evidence, and closeout reason handling.',
      href: '/bookings?view=closeout',
      emptyText: 'No cancelled booking record is currently loaded.',
      bookings: cancellationRows,
      recordCount: cancellationRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        { label: booking.closedByRole ?? 'no actor', className: 'pill-info' },
        { label: booking.closedReason ?? 'no reason', className: 'pill-neutral' },
      ],
    });
  }

  if (key === 'no_show.partner_report_policy') {
    return policyRelatedBookingRecordSet({
      title: 'No-show evidence records',
      helper: 'No-show remains an admin evidence review, not an automatic person judgment.',
      href: '/bookings?view=no-show',
      emptyText: 'No no-show closeout record is currently loaded.',
      bookings: noShowRows,
      recordCount: noShowRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        {
          label: booking.chatRoom?.id ? 'chat retained' : 'chat missing',
          className: booking.chatRoom?.id ? 'pill-success' : 'pill-danger',
        },
        { label: booking.closedReason ?? 'evidence review', className: 'pill-info' },
      ],
    });
  }

  if (key === 'notification.partner_alert_channel') {
    return policyRelatedBookingRecordSet({
      title: 'Alert-sensitive booking records',
      helper: 'Open and active bookings are the records most affected by partner alert delivery changes.',
      href: '/notifications',
      emptyText: 'No active booking record is currently loaded for alert review.',
      bookings: activeRows,
      recordCount: activeRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-info' },
        {
          label: booking.chatRoom?.id ? 'chat room' : 'no chat yet',
          className: booking.chatRoom?.id ? 'pill-success' : 'pill-neutral',
        },
        { label: bookingPartnerLabel(booking), className: 'pill-neutral' },
      ],
    });
  }

  return policyRelatedBookingRecordSet({
    title: 'Active booking records',
    helper: 'Review active booking state before changing an enforced operating policy.',
    href: '/bookings',
    emptyText: 'No active booking record is currently loaded.',
    bookings: activeRows,
    recordCount: activeRows.length,
    pillBuilder: (booking) => [
      { label: booking.status, className: 'pill-info' },
      { label: bookingPartnerLabel(booking), className: 'pill-neutral' },
      {
        label: booking.expiresAt
          ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
          : 'no expiry',
        className: 'pill-info',
      },
    ],
  });
}

function policyRelatedBookingRecordSet(input: {
  title: string;
  helper: string;
  href: string;
  emptyText: string;
  bookings: AdminBooking[];
  recordCount: number;
  pillBuilder: (booking: AdminBooking) => PolicyDrilldownPill[];
}) {
  return {
    title: input.title,
    helper: input.helper,
    href: input.href,
    emptyText: input.emptyText,
    recordCount: `${input.recordCount} record(s)`,
    rows: input.bookings
      .sort(byNewestBooking)
      .slice(0, 3)
      .map<PolicyRelatedBookingRecord>((booking) => ({
        id: booking.id,
        href: `/bookings/${booking.id}`,
        title: displayOperationalWording(`${bookingServiceLabel(booking)} / ${shortId(booking.id)}`),
        subtitle: displayOperationalWording(
          `${bookingCustomerLabel(booking)} / ${bookingPartnerLabel(booking)}`,
        ),
        pills: input.pillBuilder(booking).map((pill) => ({
          ...pill,
          label: displayOperationalWording(pill.label),
        })),
      })),
  };
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function policyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalNumber(policyRawValue(settings, key));
}

function policyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalString(policyRawValue(settings, key));
}

function policyStringValueFromKeys(settings: AdminOperationalPolicySetting[], keys: string[]) {
  for (const key of keys) {
    const value = policyStringValue(settings, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function policyBooleanValue(settings: AdminOperationalPolicySetting[], key: string) {
  const value = policyRawValue(settings, key);
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return null;
}

function bookingGateReasonCounts(logs: AdminAuditLog[]) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const metadata = readPlainRecord(log.metadata);
    const reasonCode = readOptionalString(metadata?.reasonCode) ?? 'UNKNOWN';
    counts.set(reasonCode, (counts.get(reasonCode) ?? 0) + 1);
  });
  return counts;
}

function bookingGateReasonLabel(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Optional customer GPS distance evidence';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'First-pick partner too far';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Outside service area';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Optional stale customer GPS';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Optional missing customer GPS';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Optional missing GPS timestamp';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Optional invalid GPS timestamp';
  }
  return displayOperationalWording(reasonCode.replace(/_/g, ' ').toLowerCase());
}

function bookingGateReasonPill(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'pill-warn';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'pill-danger';
  }
  return 'pill-info';
}

function bookingGateCurrentLocationRejectCount(counts: Map<string, number>) {
  return [
    'CUSTOMER_CURRENT_LOCATION_MISSING',
    'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING',
    'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID',
    'CUSTOMER_CURRENT_LOCATION_STALE',
  ].reduce((total, key) => total + (counts.get(key) ?? 0), 0);
}

function bookingGateAttemptDetail(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return 'No detailed booking gate evidence was recorded.';
  }
  const reason = readOptionalString(metadata.reason);
  const customerDistance = readOptionalNumber(metadata.customerDistanceMeters);
  const customerLimit = readOptionalNumber(metadata.customerDistanceLimitMeters);
  const partnerDistance = readOptionalNumber(metadata.preferredProviderDistanceMeters);
  const partnerLimit = readOptionalNumber(metadata.preferredProviderDistanceLimitMeters);
  const address = readPlainRecord(metadata.bookingAddress);
  const addressText = readOptionalString(address?.addressText);
  const parts = [
    reason,
    customerDistance !== null && customerLimit !== null
      ? `Customer ${formatDistance(customerDistance)} / limit ${formatDistance(customerLimit)}`
      : null,
    partnerDistance !== null && partnerLimit !== null
      ? `First-pick ${formatDistance(partnerDistance)} / limit ${formatDistance(partnerLimit)}`
      : null,
    addressText ? `Address: ${addressText}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('. ') : 'Booking create was stopped before payment authorization.';
}

function referenceBookingCoordinate(bookings: AdminBooking[]) {
  const withCoordinate = bookings
    .filter((booking) => parseCoordinatePair(booking.lat, booking.lng))
    .sort(byNewestBooking)[0];
  const coordinate = withCoordinate ? parseCoordinatePair(withCoordinate.lat, withCoordinate.lng) : null;
  if (withCoordinate && coordinate) {
    return {
      lat: coordinate.lat,
      lng: coordinate.lng,
      label: `Booking ${shortId(withCoordinate.id)}`,
    };
  }
  return {
    lat: 10.7769,
    lng: 106.7009,
    label: 'Demo Ho Chi Minh City',
  };
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = readOptionalNumber(lat);
  const parsedLng = readOptionalNumber(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const startLat = degreesToRadians(fromLat);
  const endLat = degreesToRadians(toLat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function formatLocationAge(minutes: number | null) {
  if (minutes === null) {
    return 'unknown';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}

export function operationalPolicyAuditRows(logs: AdminAuditLog[]) {
  return logs
    .filter((log) => log.action === 'operational_policy.update')
    .map((log) => {
      const metadata = readPlainRecord(log.metadata);
      const key = readOptionalString(metadata?.key) ?? targetPolicyKey(log.target);
      const details = policyImpactDetails(key);
      const enforced = Boolean(metadata?.enforced);
      return {
        id: log.id,
        createdAt: log.createdAt,
        key,
        label: policyKeyLabel(key),
        policyContext: details.title,
        actorName: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        previousValue: compactAuditValue(metadata?.previousValue),
        value: compactAuditValue(metadata?.value),
        reason: policyAuditReasonText(readOptionalString(metadata?.reason) ?? 'No reason recorded'),
        enforced,
        effect: enforced
          ? details.detail
          : `${details.title}. This is stored as an owner decision until enforced.`,
      };
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
}

function targetPolicyKey(target: string) {
  return target.startsWith('operational_policy:') ? target.slice('operational_policy:'.length) : target;
}

function policyKeyLabel(key: string) {
  const label = key
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' / ');
  const titled = label.charAt(0).toUpperCase() + label.slice(1);
  return displayOperationalWording(titled);
}

function policyAuditReasonText(reason: string) {
  return reason.replace(
    /\b(?:booking|matching|notification|wallet|cancellation|no_show|decision|cash|payout)\.[a-z0-9_.-]+/g,
    (key) => policyKeyLabel(key),
  );
}

function compactAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    return displayOperationalWording(JSON.stringify(value));
  }
  return displayOperationalWording(policyAuditValueText(String(value)));
}

function policyAuditValueText(value: string) {
  if (!/^[A-Z0-9_]+$/.test(value) || !value.includes('_')) {
    return value;
  }
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(policyAuditValueWord)
    .join(' ');
}

function policyAuditValueWord(part: string) {
  const acronyms: Record<string, string> = {
    api: 'API',
    fcm: 'FCM',
    mvp: 'MVP',
    sms: 'SMS',
  };
  return acronyms[part] ?? part.charAt(0).toUpperCase() + part.slice(1);
}

function buildOwnerDecisionPressure(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  supplySensitivity: PolicySupplySensitivity,
  acceptanceMatrix: ReturnType<typeof buildBookingAcceptanceMatrix>,
): OwnerDecisionPressure {
  const activeStatuses = new Set([
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  ]);
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const activeBookings = bookings.filter((booking) => activeStatuses.has(booking.status));
  const waitingFirstPick = openMatching.filter(
    (booking) => booking.preferredProvider && !booking.selectedProvider,
  );
  const acceptedButNotFinal = openMatching.filter(
    (booking) =>
      !booking.selectedProvider &&
      (booking.participants ?? []).some((participant) => participant.status === 'ACCEPTED'),
  );
  const backupInterest = openMatching.filter((booking) =>
    (booking.participants ?? []).some(
      (participant) =>
        participant.status !== 'REJECTED' &&
        participant.providerProfile?.id &&
        participant.providerProfile.id !== booking.preferredProvider?.id,
    ),
  );
  const currentVisibleSupply = readSupplySummaryNumber(supplySensitivity, 'Current visible supply');
  const staleExcluded = readSupplySummaryNumber(supplySensitivity, 'Stale excluded');
  const finalGateHeldInRadius = readSupplySummaryNumber(
    supplySensitivity,
    'Marketplace/payout held in radius',
  );
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE')).length;
  const enabledPushPartners = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const pushGap = Math.max(onlinePartners - enabledPushPartners, 0);
  const finalGatePressure = acceptanceMatrix.blockingCount + finalGateHeldInRadius;

  const cards = [
    {
      title: 'First-pick response window',
      status: waitingFirstPick.length ? 'Monitor now' : 'Stable',
      detail: waitingFirstPick.length
        ? `${waitingFirstPick.length} open matching booking(s) are waiting on a first-pick Partner. ${acceptedButNotFinal.length} already have accepted participants awaiting final customer choice.`
        : 'No open booking is currently waiting on the first-pick response window.',
      operatorAction: waitingFirstPick.length
        ? 'Review matching wait time before shortening or extending the timer.'
        : 'Keep the launch baseline unless new wait-time data changes.',
      href: '/bookings?view=matching',
      className: waitingFirstPick.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: waitingFirstPick.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Marketplace policy and supply',
      status: currentVisibleSupply > 0 ? 'Supply visible' : 'Supply thin',
      detail: `${currentVisibleSupply} visible partner(s) are inside the current policy sample. ${backupInterest.length} open booking(s) already show marketplace interest.`,
      operatorAction:
        currentVisibleSupply > 0
          ? 'Use the sensitivity table before changing the 10km radius.'
          : 'Refresh partner locations or consider city/service supply rules before launch.',
      href: '/partners?review=marketplace-ready',
      className: currentVisibleSupply > 0 ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: currentVisibleSupply > 0 ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Location freshness rule',
      status: staleExcluded ? 'Refresh needed' : 'Fresh enough',
      detail: `${staleExcluded} partner(s) are excluded only because their saved location is stale under the current freshness window.`,
      operatorAction: staleExcluded
        ? 'Ask partners to open the app and send location before loosening freshness rules.'
        : 'Current location freshness is not excluding supply in the sample.',
      href: '/partners?review=location',
      className: staleExcluded ? 'ops-task-pending' : 'ops-task-done',
      pillClass: staleExcluded ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Wallet and marketplace holds',
      status: finalGatePressure ? 'Gate active' : 'Clear',
      detail: `${finalGatePressure} partner marketplace/payout record(s) may require settlement, identity, bank, or account review.`,
      operatorAction: finalGatePressure
        ? 'Keep marketplace visibility open while finance and partner controls clear marketplace and payout holds.'
        : 'No current sample pressure to relax marketplace gates.',
      href: finalGatePressure ? '/partners?review=marketplace-held' : '/partner-controls',
      className: finalGatePressure ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: finalGatePressure ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Partner FCM readiness',
      status: pushGap ? 'Push gap' : 'Ready',
      detail: `${enabledPushPartners}/${onlinePartners} online partner(s) have enabled push devices in the current snapshot.`,
      operatorAction: pushGap
        ? 'Keep in-app request listing as the fallback until FCM device coverage is reliable.'
        : 'Push coverage is ready enough for production-device testing.',
      href: '/notifications?review=failed',
      className: pushGap ? 'ops-task-pending' : 'ops-task-done',
      pillClass: pushGap ? 'pill-warn' : 'pill-success',
    },
  ];

  return {
    alertCount: cards.filter((card) => card.className !== 'ops-task-done').length,
    summary: [
      {
        label: 'Open matching',
        value: String(openMatching.length),
        helper: 'Bookings where customers are waiting for partner response or final choice.',
      },
      {
        label: 'Active service flow',
        value: String(activeBookings.length),
        helper: 'Matched, on-the-way, arrived, or in-service bookings affected by operator decisions.',
      },
      {
        label: 'Visible supply',
        value: String(currentVisibleSupply),
        helper: `${supplySensitivity.currentPolicyLabel} around ${supplySensitivity.referenceLabel}.`,
      },
      {
        label: 'Marketplace/payout holds',
        value: String(finalGatePressure),
        helper:
          'Wallet, identity, bank, or account-control records that change marketplace or payout readiness.',
      },
    ],
    cards,
  };
}

function readSupplySummaryNumber(supplySensitivity: PolicySupplySensitivity, label: string) {
  const value = supplySensitivity.summary.find((item) => item.label === label)?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function policyDisplayByKey(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = adminOperationalPolicySettingByKey(settings, key);
  return setting ? policyDisplayValue(setting) : 'Not configured';
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return adminOperationalPolicySettingByKey(settings, key)?.value;
}

function formatPolicyValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined) return '-';
  if (unit === 'meters') {
    return `${(Number(value) / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  if (unit === 'minutes') {
    return `${value} min`;
  }
  const suffix = unit ? ` ${unit}` : '';
  return `${String(value)}${suffix}`;
}

function policyDisplayValue(setting: AdminOperationalPolicySetting, recommended = false) {
  const value = String(recommended ? setting.recommendedValue : setting.value);
  return displayOperationalWording(
    setting.options?.find((option) => option.value === value)?.label ??
      formatPolicyValue(value, setting.unit),
  );
}

function policyKeyMatches(key: string, candidates: string[]) {
  return candidates.includes(key);
}

function formatDate(value: string) {
  return formatDateTime(value);
}

function policyNotice(params: Record<string, string | string[] | undefined>) {
  const status = firstParam(params.status);
  const reason = firstParam(params.reason);
  if (status === 'saved') {
    return {
      tone: 'success' as const,
      title: 'Operational policy saved',
      detail: `Updated ${reason}. New bookings and partner participation checks will use the latest enforced settings.`,
    };
  }
  if (status === 'blocked') {
    return {
      tone: 'danger' as const,
      title: 'Policy update blocked',
      detail:
        reason === 'missing-value'
          ? 'Enter a policy value before saving.'
          : 'The API rejected this policy update. Check the allowed range and try again.',
    };
  }
  return null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function bookingWalletLedgerTotal(booking: AdminBooking) {
  return (booking.earning?.walletLedgerEntries ?? []).reduce(
    (total, entry) => total + Number(entry.amount ?? 0),
    0,
  );
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
