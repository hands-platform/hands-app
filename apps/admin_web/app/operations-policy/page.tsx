import Link from 'next/link';
import {
  AdminAuditLog,
  AdminBooking,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';
import { updateOperationalPolicy } from './actions';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

type BookingMatchingPolicySnapshot = {
  providerResponseWindowMinutes: number | null;
  backupProviderRadiusMeters: number | null;
  backupProviderLocationMaxAgeMinutes: number | null;
  backupProviderInvitationLimit: number | null;
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
};
type PolicySupplySensitivity = {
  referenceLabel: string;
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  radiusRows: Array<{
    radiusLabel: string;
    eligible: number;
    fresh: number;
    hardBlocked: number;
    operatorRead: string;
    pillClass: string;
  }>;
  freshnessRows: Array<{
    freshnessLabel: string;
    eligible: number;
    staleExcluded: number;
    operatorRead: string;
    pillClass: string;
  }>;
};
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
type MatchingStageImpactPreview = {
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  rows: Array<{
    scenario: string;
    value: string;
    stage1: number;
    stage2: number;
    stage3: number;
    repair: number;
    noSupply: number;
    overdue: number;
    operatorRead: string;
    pillClass: string;
  }>;
};

const REQUIRED_KYC_DOCUMENTS = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];

export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [settings, bookings, providers, auditLogs] = await Promise.all([
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminProvider[]>('/admin/partners', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
  ]);
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = policyNotice(params);
  const ownerDecisionBacklog = operationsOwnerDecisionBacklog();
  const matchingPlaybook = buildMatchingPlaybook(settings);
  const policySimulation = buildPolicySimulation(settings, bookings, providers);
  const impactDashboard = buildPolicyImpactDashboard(settings, bookings);
  const policyEffectAnalysis = buildPolicyEffectAnalysis(settings, bookings);
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
          <div className="risk-watch-header">
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Recommended value review</h2>
            <p className="muted">
              Compares current policy values with the HANDS recommended baseline. Differences are allowed, but
              operators should know the likely tradeoff before keeping them.
            </p>
          </div>
          <span className={`pill ${recommendationReview.warningCount ? 'pill-warn' : 'pill-success'}`}>
            {recommendationReview.warningCount
              ? `${recommendationReview.warningCount} owner choice(s)`
              : 'Aligned'}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {recommendationReview.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {recommendationReview.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.key}>
              <span className={`pill ${card.pillClass}`}>{card.status}</span>
              <h3>{card.label}</h3>
              <p>{card.detail}</p>
              <small>{card.operatorAction}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking acceptance control matrix</h2>
            <p className="muted">
              Current owner choices for the direct booking window, marketplace participation, partner push
              reach, and negative wallet blocking. This is the screen operators should check before changing
              the mobile flow.
            </p>
          </div>
          <span className={`pill ${acceptanceMatrix.blockingCount ? 'pill-warn' : 'pill-success'}`}>
            {acceptanceMatrix.blockingCount} control choice(s)
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {acceptanceMatrix.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {acceptanceMatrix.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.operatorAction}</small>
            </div>
          ))}
        </div>
        <div className="risk-watch-header" style={{ marginTop: 18 }}>
          <div>
            <h3>Current partner acceptance impact</h3>
            <p className="muted">
              Applies the policy posture to the current partner snapshot so operators can see who can accept,
              who is hard-blocked, and who only needs recovery follow-up.
            </p>
          </div>
          <Link className="text-link" href="/partners">
            Open partner queue
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {acceptanceMatrix.impact.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
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
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {supplySensitivity.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div style={{ overflowX: 'auto' }}>
            <h3>Marketplace supply sensitivity</h3>
            <p className="muted">
              Reference point: {supplySensitivity.referenceLabel}. Hard blockers include identity, bank,
              cash-debt, and account controls.
            </p>
            <table className="table service-trace">
              <thead>
                <tr>
                  <th>Radius</th>
                  <th>Usable partners</th>
                  <th>Fresh location</th>
                  <th>Hard blocked</th>
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
                    <td>{row.hardBlocked}</td>
                    <td>{row.operatorRead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <h3>Location freshness sensitivity</h3>
            <p className="muted">
              Shows how strict or loose freshness rules affect marketplace matching without real-time tracking.
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

      <section className="card" id="matching-stage-impact" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
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
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {matchingStageImpactPreview.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
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
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <strong>How to use this preview</strong>
          <p className="muted">
            If a candidate value increases Stage 2 marketplace count without increasing stale/no-supply checks, it
            may reduce customer waiting anxiety. If it increases overdue or no-supply count, improve partner
            location freshness, push delivery, or city supply before changing policy.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
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
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {policyEffectAnalysis.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
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
                    <p className="muted">{row.avgParticipants} joined avg</p>
                  </td>
                  <td>
                    <span className={`pill ${row.outcomePill}`}>{row.outcomeLabel}</span>
                    <p className="muted" style={{ marginTop: 6 }}>
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
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Policy enforcement trace</h2>
            <p className="muted">
              Shows where each operating decision is enforced today, so operators know whether a policy change
              affects customer matching, partner acceptance, notifications, or finance gates.
            </p>
          </div>
          <span className="pill pill-info">{policyEnforcementTrace.length} enforced lane(s)</span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {policyEnforcementTrace.map((item) => (
            <div className="ops-task-card ops-task-done" key={item.title}>
              <span className="pill pill-success">{item.scope}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>{item.verify}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Live matching policy</h2>
            <p className="muted">
              These settings are enforced by booking creation, marketplace partner discovery, and partner join
              eligibility. Existing open bookings keep their stored expiry time, while new bookings use the
              latest policy.
            </p>
          </div>
          <span className="pill pill-success">Admin editable</span>
        </div>
        <div className="grid">
          {matchingSettings.map((setting) => (
            <PolicyForm key={setting.key} setting={setting} />
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Live policy simulator</h2>
            <p className="muted">
              Uses the current policy values, the latest booking/customer coordinate, and current partner
              locations to preview who would see or join a new direct booking request.
            </p>
          </div>
          <span className={`pill ${policySimulation.ready ? 'pill-success' : 'pill-warn'}`}>
            {policySimulation.ready ? 'Ready for dispatch check' : 'Needs better location data'}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {policySimulation.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="ops-task-note">
            <h3>Simulated booking path</h3>
            <div className="timeline" style={{ marginTop: 12 }}>
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
            <div className="risk-watch-header">
              <div>
                <h3>Eligible partner preview</h3>
                <p className="muted">
                  Top nearby online partners inside the current marketplace radius. Stale locations are excluded
                  from the dispatch count.
                </p>
              </div>
              <span className="pill pill-info">{policySimulation.partnerRows.length} shown</span>
            </div>
            <div className="stack" style={{ marginTop: 10 }}>
              {policySimulation.partnerRows.map((partner) => (
                <div className="ops-row" key={partner.id}>
                  <div>
                    <a className="text-link" href={`/partners/${partner.id}`}>
                      {partner.name}
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
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Policy change impact</h2>
            <p className="muted">
              Before changing a setting, use this view to see whether it only affects new bookings or also
              changes live partner visibility, join checks, and operational review work.
            </p>
          </div>
          <span className="pill pill-info">{bookings.length} booking(s) sampled</span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {impactDashboard.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {impactDashboard.snapshotSummary.map((item) => (
            <div className="ops-task-card ops-task-done" key={item.label} style={{ minHeight: 0 }}>
              <span className="pill pill-info">{item.scope}</span>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
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
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Policy impact drill-down</h2>
            <p className="muted">
              Click into the exact bookings and partners operators should review before changing live
              matching, wallet, or response-window policy.
            </p>
          </div>
          <span className="pill pill-info">{policyDrilldown.totalCount} item(s) to review</span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {policyDrilldown.lists.map((list) => (
            <PolicyDrilldownList key={list.key} list={list} />
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="risk-watch-header">
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
                    <strong>{relativeTime(row.createdAt)}</strong>
                    <p className="muted">{new Date(row.createdAt).toLocaleString()}</p>
                  </td>
                  <td>
                    <strong>{displayOperationalWording(row.label)}</strong>
                    <p className="muted">{row.key}</p>
                  </td>
                  <td>{row.actorName}</td>
                  <td>{row.previousValue}</td>
                  <td>{row.value}</td>
                  <td>
                    <p style={{ margin: 0 }}>{row.reason}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.enforced ? 'pill-success' : 'pill-warn'}`}>
                      {row.enforced ? 'Live behavior' : 'Decision log'}
                    </span>
                    <p className="muted" style={{ marginTop: 6 }}>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking matching playbook</h2>
            <p className="muted">
              Current operator-facing flow based on the saved policy values. Use this to verify whether the
              customer, partner, finance, and alert behavior still matches the intended operation.
            </p>
          </div>
          <span className="pill pill-info">Policy driven</span>
        </div>
        <div className="timeline" style={{ marginTop: 12 }}>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operator decisions</h2>
            <p className="muted">
              These are the flow choices HANDS should decide before the mobile screens are redesigned. Saving
              them creates an audit trail; items marked "planning" are not enforced until that flow is built.
            </p>
          </div>
          <span className="pill pill-warn">Needs owner choice</span>
        </div>
        <div className="grid">
          {decisionSettings.map((setting) => (
            <PolicyForm key={setting.key} setting={setting} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Recommended next choices</h2>
        <div className="booking-radar">
          <DecisionHint
            title="First-pick partner acceptance"
            recommendation="Keep customer final confirmation as the operating rule."
            detail="The preferred partner can accept quickly, marketplace partners can still join the shortlist, and the customer chooses the final partner."
          />
          <DecisionHint
            title="Marketplace participation"
            recommendation="Keep immediate marketplace visibility during the partner response window."
            detail="It reduces waiting anxiety, gives the customer alternatives, and fits the reference flow you described."
          />
          <DecisionHint
            title="Negative wallet gate"
            recommendation="Keep hard blocking while wallet balance is negative."
            detail="Cash services create company-fee debt. A hard gate is simpler for operations until settlement controls are mature."
          />
          <DecisionHint
            title="Phone OTP"
            recommendation="Keep production SMS deferred until provider selection is complete."
            detail="Use internal/demo auth for local development, then turn on phone auth once Twilio beta or Vietnam SMS provider credentials and sender rules are ready."
          />
          <DecisionHint
            title="Cancellation after match"
            recommendation="Keep admin review before any customer charge decision."
            detail="This keeps early customer support flexible while HANDS learns real cancellation, chat, and partner arrival patterns."
          />
          <DecisionHint
            title="No-show disputes"
            recommendation="Require admin review until evidence upload and dispute screens are mature."
            detail="No-show is an operational closeout state in MVP, not a person rating. Operators should review evidence before payment or support action."
          />
          <DecisionHint
            title="Partner alert channel"
            recommendation="Keep in-app notifications first, then promote OneSignal after production credentials are stable."
            detail="The system can record notifications now; push delivery should become mandatory only after monitoring is ready."
          />
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Owner decision backlog</h2>
            <p className="muted">
              Product and operations choices that should be reviewed before HANDS turns each policy into
              stricter automation. Keep the decision in Admin first, then automate after real operating data.
            </p>
          </div>
          <span className="pill pill-info">Review weekly</span>
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="risk-watch-header">
            <div>
              <h3>Current decision pressure</h3>
              <p className="muted">
                Data-driven signals that tell the owner which policy choice deserves attention first. This
                keeps HANDS from changing flow rules without matching, supply, wallet, or push evidence.
              </p>
            </div>
            <span className={`pill ${ownerDecisionPressure.alertCount ? 'pill-warn' : 'pill-success'}`}>
              {ownerDecisionPressure.alertCount} active signal(s)
            </span>
          </div>
          <div className="service-trace-summary" style={{ marginTop: 12 }}>
            {ownerDecisionPressure.summary.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </div>
          <div className="ops-task-grid" style={{ marginTop: 14 }}>
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
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {ownerDecisionBacklog.map((item) => (
            <div className={`ops-task-card ${item.className}`} key={item.title}>
              <span className={`pill ${item.pillClass}`}>{item.owner}</span>
              <h3>{item.title}</h3>
              <p>{item.question}</p>
              <small>{item.signal}</small>
              <div className="booking-radar" style={{ marginTop: 12 }}>
                {item.options.map((option) => (
                  <div className="insight-card" key={option.label}>
                    <strong>{displayOperationalWording(option.label)}</strong>
                    <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
                  </div>
                ))}
              </div>
              <div className="ops-task-note" style={{ marginTop: 12 }}>
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

function PolicyForm({ setting }: { setting: AdminOperationalPolicySetting }) {
  const valueType = typeof setting.value;
  const isNumber = valueType === 'number';
  const recommended = policyDisplayValue(setting, true);
  const impact = policyImpactDetails(setting.key);
  return (
    <form
      action={updateOperationalPolicy}
      className="card"
      id={policySettingAnchor(setting.key)}
      style={{ margin: 0 }}
    >
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="valueType" value={valueType} />
      <div className="risk-watch-header">
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
      </div>
      <div className="ops-task-note" style={{ marginTop: 12 }}>
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
      <div className="ops-task-note" style={{ marginTop: 12 }}>
        <strong>Before saving this policy</strong>
        <p className="muted">
          Review these operating surfaces first, then write the reason so the shift team can trace why the
          behavior changed.
        </p>
        <div className="booking-radar" style={{ marginTop: 12 }}>
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
          <div className="booking-radar" style={{ marginTop: 12 }}>
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
      <button type="submit" style={{ marginTop: 12 }}>
        Save policy
      </button>
      {setting.updatedAt ? (
        <p className="muted" style={{ marginTop: 10 }}>
          Last changed {formatDate(setting.updatedAt)} by{' '}
          {setting.updatedBy?.fullName ?? setting.updatedBy?.phone ?? 'admin'}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>
          Using default until an admin override is saved.
        </p>
      )}
    </form>
  );
}

function policySettingAnchor(key: string) {
  return `policy-${key.replaceAll('.', '-').replaceAll('_', '-')}`;
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

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
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
    policyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const backupInvitationLimit =
    policyNumberValue(settings, 'matching.backup_provider_invitation_limit') ?? 50;
  const travelBufferMinutes = policyNumberValue(settings, 'matching.travel_buffer_minutes') ?? 30;
  const backupOpenMode =
    policyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
  const preferredAcceptMode =
    policyStringValue(settings, 'matching.preferred_accept_mode') ?? 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const alertChannel =
    policyStringValue(settings, 'notification.partner_alert_channel') ?? 'IN_APP_WITH_PUSH_LATER';
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
    name: item.provider.displayName ?? item.provider.user?.fullName ?? 'Partner',
    status: (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes ? 'Fresh' : 'Stale',
    distanceLabel: formatDistance(item.distanceMeters ?? 0),
    locationAgeLabel: formatLocationAge(item.ageMinutes),
    pillClass: (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes ? 'pill-success' : 'pill-warn',
  }));
  const expiresAt = new Date(Date.now() + responseWindowMinutes * 60 * 1000);
  const immediateBackup = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
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
        helper: `A request created now would auto-close around ${expiresAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}.`,
      },
      {
        label: 'Marketplace policy',
        value: formatDistance(backupRadiusMeters),
        helper: `${eligiblePartners.length} usable partner(s), ${freshEligible.length} fresh location(s).`,
      },
      {
        label: 'Candidate alert cap',
        value: `${backupInvitationLimit} partner(s)`,
        helper: `${invitedPartners.length} partner(s) would be invited now after distance sorting.`,
      },
      {
        label: 'Partner alert',
        value: policyDisplayByKey(settings, 'notification.partner_alert_channel'),
        helper: `${
          alertChannel === 'ONESIGNAL_FOR_ALL_BOOKINGS'
            ? 'OS push plus in-app listing'
            : 'In-app listing now, OS push later'
        } for eligible partners.`,
      },
    ],
    timeline: [
      {
        step: '1',
        title: 'Customer creates direct request',
        detail:
          'The selected partner receives the first-pick request. Marketplace partners are evaluated from current policy and location data.',
        className: 'timeline-done',
        tags: [
          {
            label: customerFinalConfirm ? 'Customer final choice' : 'Auto-match after accept',
            tone: 'pill-info',
          },
          { label: `${responseWindowMinutes} min`, tone: 'pill-success' },
        ],
      },
      {
        step: '2',
        title: immediateBackup ? 'Marketplace list opens immediately' : 'Marketplace list waits unless declined',
        detail: immediateBackup
          ? `${invitedPartners.length}/${eligiblePartners.length} partner(s) can see or join while the first partner decides under current policy.`
          : `Marketplace partners are held until the ${responseWindowMinutes} minute first-pick window ends, but open immediately if the first-pick partner declines.`,
        className: immediateBackup ? 'timeline-active' : 'timeline-warn',
        tags: [
          { label: policyDisplayByKey(settings, 'matching.backup_open_mode'), tone: 'pill-info' },
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
        status: ready ? 'Healthy' : 'Needs supply',
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
        status: immediateBackup ? 'Low anxiety' : 'Strict first-pick',
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
          ? 'Accepted partners still require customer final selection.'
          : 'This setting would skip the final customer choice step.',
        operatorAction: customerFinalConfirm
          ? 'This matches the current HANDS direction: customer always chooses the final partner.'
          : 'Treat this as a configuration conflict for HANDS and return to customer-confirm mode.',
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
        ? 'This can reduce waiting time but may make first-pick partners miss requests.'
        : 'This gives partners more time but increases customer waiting anxiety.',
      operatorAction: `${liveContext} Existing booking countdowns do not recalculate.`,
      alignedAction: 'Keep monitoring first-pick response rate and cancellation during the waiting window.',
      className: shorter ? 'ops-task-pending' : 'ops-task-blocked',
      pillClass: shorter ? 'pill-warn' : 'pill-danger',
    };
  }

  if (setting.key === 'matching.backup_provider_radius_meters') {
    const narrower =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue < numericRecommended;
    return {
      status: narrower ? 'Narrow supply' : 'Wide supply',
      detail: narrower
        ? 'Fewer partners can join marketplace matching, so customer alternatives may look empty.'
        : 'More partners can join, but distance and arrival quality need closer monitoring.',
      operatorAction: `${liveContext} Monitor ignored marketplace alerts and late arrivals by city.`,
      alignedAction:
        'Radius is at the default operating range; keep reviewing city density before making it dynamic.',
      className: narrower ? 'ops-task-blocked' : 'ops-task-pending',
      pillClass: narrower ? 'pill-danger' : 'pill-warn',
    };
  }

  if (setting.key === 'matching.backup_provider_location_max_age_minutes') {
    const looser =
      Number.isFinite(numericValue) &&
      Number.isFinite(numericRecommended) &&
      numericValue > numericRecommended;
    return {
      status: looser ? 'Allows older locations' : 'Stricter freshness',
      detail: looser
        ? 'Marketplace alerts may reach partners whose last known location is no longer reliable.'
        : 'Only recently refreshed partner locations are eligible for marketplace alerts and joins.',
      operatorAction: `${liveContext} Check partner app location refresh failures before loosening this.`,
      alignedAction:
        'Freshness is at the 30-minute baseline; this fits the 10-minute periodic location update rule.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === 'matching.preferred_accept_mode') {
    return {
      status: value === 'AUTO_MATCH_ON_ACCEPT' ? 'Customer-choice conflict' : 'Customer choice',
      detail:
        value === 'AUTO_MATCH_ON_ACCEPT'
          ? 'This setting skips the final customer-choice step and conflicts with the current HANDS flow.'
          : 'Customer final-choice mode adds one step but better matches the HANDS target flow.',
      operatorAction: 'Use customer-confirm mode before scaling marketplace partner shortlist UX.',
      alignedAction:
        'Customer final-choice posture is aligned with the intended direct + marketplace matching model.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'matching.backup_open_mode') {
    return {
      status: value === 'IMMEDIATE_WITHIN_WINDOW' ? 'Immediate marketplace' : 'Delayed marketplace',
      detail:
        value === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'This reduces empty waiting screens and lets nearby partners show interest early.'
          : 'This protects the first-pick partner window, but marketplace partners now open immediately when the first-pick partner declines.',
      operatorAction: `${liveContext} If delayed mode is kept, support should watch waiting-screen complaints.`,
      alignedAction:
        'Immediate marketplace participation supports lower customer anxiety during the first window.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'wallet.negative_balance_gate') {
    return {
      status: value === 'BLOCK_ACCEPTS_WHEN_NEGATIVE' ? 'Hard block' : 'Recovery mode',
      detail:
        value === 'BLOCK_ACCEPTS_WHEN_NEGATIVE'
          ? 'Cash-debt exposure is contained, but partner recovery requires manual settlement.'
          : 'Recovery mode can help partners repay but increases operational cash-debt follow-up.',
      operatorAction: 'Keep hard block until cash settlement collection and recovery controls are stronger.',
      alignedAction: 'Hard block is safer for early operations with cash bookings.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: value === recommended ? 'pill-success' : 'pill-danger',
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
    policyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const preferredAcceptMode =
    policyStringValue(settings, 'matching.preferred_accept_mode') ?? 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const backupOpenMode =
    policyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
  const alertChannel =
    policyStringValue(settings, 'notification.partner_alert_channel') ?? 'IN_APP_WITH_PUSH_LATER';
  const walletGate =
    policyStringValue(settings, 'wallet.negative_balance_gate') ?? 'BLOCK_ACCEPTS_WHEN_NEGATIVE';

  const customerFinalChoice = preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const immediateBackup = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const pushReady = alertChannel === 'ONESIGNAL_FOR_ALL_BOOKINGS';
  const hardWalletBlock = walletGate === 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
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
      title: 'Marketplace partner pool',
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
      detail: `Marketplace partner location freshness is checked at ${backupLocationFreshnessMinutes} minute(s) for operator trust.`,
      operatorAction: baselineLocationFreshness
        ? 'This matches the partner app rule that refreshes location every 10 minutes while open.'
        : 'If this is loosened, monitor stale-location joins and partner no-response rates.',
      className: baselineLocationFreshness ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineLocationFreshness ? 'pill-success' : 'pill-warn',
      blocking: !baselineLocationFreshness,
    },
    {
      title: 'Marketplace visibility timing',
      status: immediateBackup ? 'Visible during wait' : 'Delayed marketplace',
      detail: immediateBackup
        ? 'Nearby partners can participate while the first-pick partner is still deciding.'
        : 'Marketplace partners wait until the timer passes, except when the first-pick partner declines.',
      operatorAction: immediateBackup
        ? 'This best matches the customer waiting screen where available marketplace partners appear early.'
        : 'Use delayed mode only if partner noise is worse than customer waiting anxiety.',
      className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      blocking: !immediateBackup,
    },
    {
      title: 'Customer final selection',
      status: customerFinalChoice ? 'Customer controls' : 'Customer-choice conflict',
      detail: customerFinalChoice
        ? 'Even after partner acceptance, the customer keeps the final partner selection step.'
        : 'This setting would match a booking without the final customer choice step.',
      operatorAction: customerFinalChoice
        ? 'This is the safer long-term rule for a marketplace with customer partner choice.'
        : 'Return this policy to customer-confirm mode before production use.',
      className: customerFinalChoice ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: customerFinalChoice ? 'pill-success' : 'pill-danger',
      blocking: !customerFinalChoice,
    },
    {
      title: 'Partner alert delivery',
      status: pushReady ? 'Push enabled' : 'In-app first',
      detail: pushReady
        ? 'Partner booking and marketplace participation alerts are ready to route through OneSignal.'
        : 'Booking notifications are recorded in-app until OneSignal production setup is fully ready.',
      operatorAction: pushReady
        ? 'Monitor delivery failures and disabled devices on the Notifications board.'
        : 'Keep this until OneSignal and production SMS credentials/monitoring are complete.',
      className: pushReady ? 'ops-task-done' : 'ops-task-pending',
      pillClass: pushReady ? 'pill-success' : 'pill-info',
      blocking: false,
    },
    {
      title: 'Negative wallet gate',
      status: hardWalletBlock ? 'Hard block' : 'Recovery booking',
      detail: hardWalletBlock
        ? 'Partners with unpaid cash-service fee debt cannot accept new work.'
        : 'Partners with debt may receive one recovery booking, increasing collection follow-up.',
      operatorAction: hardWalletBlock
        ? 'This protects HANDS cash-fee collection during early operations.'
        : 'Use recovery only after settlement playbooks and recovery controls are mature.',
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
        value: customerFinalChoice ? 'Customer chooses' : 'Auto-lock',
        helper: 'Who makes the final partner decision.',
      },
    ],
    cards,
    impact,
  };
}

function buildPolicySupplySensitivity(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
): PolicySupplySensitivity {
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const freshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const walletGate =
    policyStringValue(settings, 'wallet.negative_balance_gate') ?? 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
  const hardWalletBlock = walletGate === 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
  const reference = referenceBookingCoordinate(bookings);
  const candidates = providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(reference.lat, reference.lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
        hasCoordinate: Boolean(coordinate),
        hardBlocked: partnerHardBlocked(provider, { hardWalletBlock }),
        online: provider.status === 'ONLINE_AVAILABLE',
      };
    })
    .filter((item) => item.hasCoordinate && item.distanceMeters !== null);
  const currentUsable = candidates.filter(
    (item) =>
      item.online &&
      !item.hardBlocked &&
      (item.distanceMeters ?? Infinity) <= backupRadiusMeters &&
      (item.ageMinutes ?? Infinity) <= freshnessMinutes,
  );
  const currentHardBlocked = candidates.filter(
    (item) => item.hardBlocked && (item.distanceMeters ?? Infinity) <= backupRadiusMeters,
  );
  const currentStaleExcluded = candidates.filter(
    (item) =>
      item.online &&
      !item.hardBlocked &&
      (item.distanceMeters ?? Infinity) <= backupRadiusMeters &&
      (item.ageMinutes === null || item.ageMinutes > freshnessMinutes),
  );

  const radiusOptions = uniqueNumbers([5000, 10000, backupRadiusMeters, 15000, 20000]).sort((a, b) => a - b);
  const freshnessOptions = uniqueNumbers([10, 30, freshnessMinutes, 60, 120]).sort((a, b) => a - b);

  return {
    referenceLabel: reference.label,
    currentPolicyLabel: `${formatDistance(backupRadiusMeters)} / ${freshnessMinutes}m fresh`,
    summary: [
      {
        label: 'Coordinate sample',
        value: candidates.length.toString(),
        helper: `${providers.length} total partner(s), ${candidates.length} with saved coordinates.`,
      },
      {
        label: 'Current usable supply',
        value: currentUsable.length.toString(),
        helper: 'Online, not hard-blocked, inside radius, and fresh enough.',
      },
      {
        label: 'Hard blocked in radius',
        value: currentHardBlocked.length.toString(),
        helper: 'Identity, bank, wallet, or control gates stop acceptance even if nearby.',
      },
      {
        label: 'Stale excluded',
        value: currentStaleExcluded.length.toString(),
        helper: 'Could become usable by opening the Partner app and refreshing location.',
      },
    ],
    radiusRows: radiusOptions.map((radius) => {
      const insideRadius = candidates.filter((item) => (item.distanceMeters ?? Infinity) <= radius);
      const eligible = insideRadius.filter(
        (item) => item.online && !item.hardBlocked && (item.ageMinutes ?? Infinity) <= freshnessMinutes,
      );
      const fresh = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= freshnessMinutes);
      const hardBlocked = insideRadius.filter((item) => item.hardBlocked);
      return {
        radiusLabel: formatDistance(radius),
        eligible: eligible.length,
        fresh: fresh.length,
        hardBlocked: hardBlocked.length,
        operatorRead: radiusSensitivityRead(radius, backupRadiusMeters, eligible.length),
        pillClass:
          radius === backupRadiusMeters
            ? 'pill-info'
            : radius < backupRadiusMeters
              ? 'pill-warn'
              : 'pill-neutral',
      };
    }),
    freshnessRows: freshnessOptions.map((freshness) => {
      const insideRadius = candidates.filter(
        (item) => item.online && !item.hardBlocked && (item.distanceMeters ?? Infinity) <= backupRadiusMeters,
      );
      const eligible = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= freshness);
      const staleExcluded = insideRadius.length - eligible.length;
      return {
        freshnessLabel: `${freshness} min`,
        eligible: eligible.length,
        staleExcluded,
        operatorRead: freshnessSensitivityRead(freshness, freshnessMinutes, eligible.length, staleExcluded),
        pillClass:
          freshness === freshnessMinutes
            ? 'pill-info'
            : freshness < freshnessMinutes
              ? 'pill-warn'
              : 'pill-neutral',
      };
    }),
  };
}

function buildPolicyEnforcementTrace(settings: AdminOperationalPolicySetting[]) {
  const responseWindowMinutes =
    policyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const backupOpenMode =
    policyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
  const preferredAcceptMode =
    policyStringValue(settings, 'matching.preferred_accept_mode') ?? 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const walletGate =
    policyStringValue(settings, 'wallet.negative_balance_gate') ?? 'BLOCK_ACCEPTS_WHEN_NEGATIVE';

  return [
    {
      scope: 'Booking create',
      title: `${responseWindowMinutes} minute first-pick timer`,
      detail:
        'New direct bookings store the current response-window policy in booking metadata and expiry time.',
      verify:
        'Verify with a new booking, then open the booking detail timeline and matching policy snapshot.',
    },
    {
      scope: 'Marketplace join',
      title: `${formatDistance(backupRadiusMeters)} marketplace alert policy`,
      detail:
        'Marketplace partners are prioritized by customer distance before alerts and operator review.',
      verify: 'Verify from Operations Policy simulator and Partner Controls location freshness signals.',
    },
    {
      scope: 'Location gate',
      title: `${backupLocationFreshnessMinutes} minute location freshness`,
      detail:
        'Partners with stale or missing last location are flagged before marketplace participation and shown as dispatch checks.',
      verify:
        'Verify by opening App Sessions and Partner Controls after a partner app sends or misses a location heartbeat.',
    },
    {
      scope: 'Customer choice',
      title:
        preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'
          ? 'Customer keeps final partner selection'
          : 'Customer final selection is disabled',
      detail:
        'This controls whether preferred partner acceptance returns control to the customer for the final partner choice.',
      verify:
        'Verify by creating a direct booking, accepting in the partner app, then checking the customer waiting screen.',
    },
    {
      scope: 'Marketplace timing',
      title:
        backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'Marketplace partners can join during the wait'
          : 'Marketplace partners wait until timer or decline',
      detail: 'This controls whether marketplace partners can participate during the first-pick response window.',
      verify: 'Verify from partner app open request list while a direct booking is still waiting.',
    },
    {
      scope: 'Wallet gate',
      title:
        walletGate === 'BLOCK_ACCEPTS_WHEN_NEGATIVE'
          ? 'Negative wallet blocks acceptance'
          : 'Recovery booking mode is enabled',
      detail:
        'Cash-service company fee debt is enforced before partner accept/join actions and before payout release.',
      verify:
        'Verify from Cash Settlements, Partner Controls, and a blocked accept attempt in the partner app.',
    },
  ];
}

function buildMatchingStageImpactPreview(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
): MatchingStageImpactPreview {
  const responseWindowMinutes =
    policyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const freshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const hardWalletBlock =
    (policyStringValue(settings, 'wallet.negative_balance_gate') ?? 'BLOCK_ACCEPTS_WHEN_NEGATIVE') ===
    'BLOCK_ACCEPTS_WHEN_NEGATIVE';
  const openBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const liveHandoff = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const baseline = matchingStageImpactStats(bookings, providers, {
    responseWindowMinutes,
    backupRadiusMeters,
    freshnessMinutes,
    hardWalletBlock,
  });
  const responseOptions = uniqueNumbers([5, responseWindowMinutes, 10, 15]).sort(
    (left, right) => left - right,
  );
  const radiusOptions = uniqueNumbers([5000, backupRadiusMeters, 10000, 15000]).sort(
    (left, right) => left - right,
  );
  const freshnessOptions = uniqueNumbers([15, freshnessMinutes, 30, 60]).sort((left, right) => left - right);

  const rows = [
    ...responseOptions.map((value) => {
      const stats = matchingStageImpactStats(bookings, providers, {
        responseWindowMinutes: value,
        backupRadiusMeters,
        freshnessMinutes,
        hardWalletBlock,
      });
      return matchingStageImpactRow(
        'Response window',
        `${value} min`,
        stats,
        baseline,
        value === responseWindowMinutes,
      );
    }),
    ...radiusOptions.map((value) => {
      const stats = matchingStageImpactStats(bookings, providers, {
        responseWindowMinutes,
        backupRadiusMeters: value,
        freshnessMinutes,
        hardWalletBlock,
      });
      return matchingStageImpactRow(
        'Marketplace policy',
        formatDistance(value),
        stats,
        baseline,
        value === backupRadiusMeters,
      );
    }),
    ...freshnessOptions.map((value) => {
      const stats = matchingStageImpactStats(bookings, providers, {
        responseWindowMinutes,
        backupRadiusMeters,
        freshnessMinutes: value,
        hardWalletBlock,
      });
      return matchingStageImpactRow(
        'Location freshness',
        `${value} min`,
        stats,
        baseline,
        value === freshnessMinutes,
      );
    }),
  ];

  return {
    currentPolicyLabel: `${responseWindowMinutes}m / ${formatDistance(backupRadiusMeters)} / ${freshnessMinutes}m fresh`,
    summary: [
      {
        label: 'Open matching sample',
        value: openBookings.length.toString(),
        helper: 'Bookings currently waiting inside Stage 1, Stage 2, or Stage 3.',
      },
      {
        label: 'Current Stage 2 marketplace',
        value: baseline.stage2.toString(),
        helper: 'Open bookings with usable marketplace partner supply under the current policy.',
      },
      {
        label: 'Current no supply',
        value: baseline.noSupply.toString(),
        helper: 'Open bookings that would show customer waiting without usable marketplace supply.',
      },
      {
        label: 'Stage 4 repair',
        value: baseline.repair.toString(),
        helper: `${liveHandoff.length} matched/live booking(s) checked for missing chat handoff.`,
      },
    ],
    rows,
  };
}

function matchingStageImpactStats(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  policy: {
    responseWindowMinutes: number;
    backupRadiusMeters: number;
    freshnessMinutes: number;
    hardWalletBlock: boolean;
  },
) {
  return bookings.reduce(
    (stats, booking) => {
      const accepted = (booking.participants ?? []).filter(
        (participant) => participant.status === 'ACCEPTED' || participant.status === 'SELECTED',
      ).length;

      if (
        ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
        !booking.chatRoom
      ) {
        stats.repair += 1;
        return stats;
      }

      if (booking.status !== 'OPEN_MATCHING') {
        return stats;
      }

      if (accepted > 0 && !booking.selectedProvider) {
        stats.stage3 += 1;
        return stats;
      }

      const eligibleBackup = eligibleBackupPartnersForBooking(booking, providers, policy);
      const overdue = bookingOpenAgeMinutes(booking) > policy.responseWindowMinutes;
      if (overdue) {
        stats.overdue += 1;
      }

      if (eligibleBackup > 0) {
        stats.stage2 += 1;
      } else {
        stats.stage1 += 1;
        stats.noSupply += 1;
      }
      return stats;
    },
    { stage1: 0, stage2: 0, stage3: 0, repair: 0, noSupply: 0, overdue: 0 },
  );
}

function matchingStageImpactRow(
  scenario: string,
  value: string,
  stats: ReturnType<typeof matchingStageImpactStats>,
  baseline: ReturnType<typeof matchingStageImpactStats>,
  current: boolean,
) {
  return {
    scenario,
    value,
    stage1: stats.stage1,
    stage2: stats.stage2,
    stage3: stats.stage3,
    repair: stats.repair,
    noSupply: stats.noSupply,
    overdue: stats.overdue,
    operatorRead: matchingStageImpactRead(stats, baseline, current),
    pillClass: current
      ? 'pill-info'
      : stats.noSupply > baseline.noSupply || stats.overdue > baseline.overdue
        ? 'pill-warn'
        : 'pill-neutral',
  };
}

function matchingStageImpactRead(
  stats: ReturnType<typeof matchingStageImpactStats>,
  baseline: ReturnType<typeof matchingStageImpactStats>,
  current: boolean,
) {
  if (current) {
    return 'Current live policy baseline. Compare other rows against this before saving a change.';
  }
  if (stats.noSupply > baseline.noSupply) {
    return 'More bookings lose usable marketplace supply. Improve partner location/push readiness before choosing this.';
  }
  if (stats.overdue > baseline.overdue) {
    return 'More first-pick windows become overdue. Customer wait anxiety and manual dispatch work may rise.';
  }
  if (stats.stage2 > baseline.stage2 && stats.noSupply <= baseline.noSupply) {
    return 'More bookings can expose marketplace partner supply without increasing empty waiting screens.';
  }
  if (stats.noSupply < baseline.noSupply) {
    return 'Fewer bookings look supply-starved, but confirm distance quality and stale pins before widening.';
  }
  return 'Operational shape is similar to the current policy. Use real outcome cohorts before changing.';
}

function eligibleBackupPartnersForBooking(
  booking: AdminBooking,
  providers: AdminProvider[],
  policy: {
    backupRadiusMeters: number;
    freshnessMinutes: number;
    hardWalletBlock: boolean;
  },
) {
  const coordinate = parseCoordinatePair(booking.lat, booking.lng);
  if (!coordinate) {
    return 0;
  }
  const preferredId = booking.preferredProvider?.id;
  return providers.filter((provider) => {
    if (provider.id === preferredId || provider.status !== 'ONLINE_AVAILABLE') {
      return false;
    }
    if (partnerHardBlocked(provider, { hardWalletBlock: policy.hardWalletBlock })) {
      return false;
    }
    const providerCoordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
    if (!providerCoordinate) {
      return false;
    }
    const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
    if (ageMinutes === null || ageMinutes > policy.freshnessMinutes) {
      return false;
    }
    return (
      haversineDistanceMeters(
        coordinate.lat,
        coordinate.lng,
        providerCoordinate.lat,
        providerCoordinate.lng,
      ) <= policy.backupRadiusMeters
    );
  }).length;
}

function bookingOpenAgeMinutes(booking: AdminBooking) {
  const openedAt = Date.parse(booking.createdAt ?? booking.scheduledStartAt ?? '');
  if (!Number.isFinite(openedAt)) {
    return 0;
  }
  return Math.max(0, Math.round((Date.now() - openedAt) / 60000));
}

function buildPartnerAcceptancePolicyImpact(
  providers: AdminProvider[],
  policy: { backupLocationFreshnessMinutes: number; hardWalletBlock: boolean },
) {
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE'));
  const readyPartners = providers.filter((provider) => partnerCanAcceptUnderCurrentPolicy(provider, policy));
  const walletBlocked = providers.filter((provider) => partnerWalletBalance(provider) < 0);
  const identityBlocked = providers.filter((provider) => !partnerIdentityReady(provider));
  const bankBlocked = providers.filter((provider) => !partnerBankReady(provider));
  const locationBlocked = providers.filter(
    (provider) => !partnerLocationFresh(provider, policy.backupLocationFreshnessMinutes),
  );
  const pushGaps = providers.filter((provider) => !partnerHasEnabledPush(provider));
  const accountFollowUps = providers.filter((provider) => partnerAccountNeedsFollowUp(provider));
  const softRecovery = providers.filter(
    (provider) =>
      !partnerCanAcceptUnderCurrentPolicy(provider, policy) && !partnerHardBlocked(provider, policy),
  );

  return [
    {
      label: 'Can accept now',
      value: readyPartners.length.toString(),
      helper: `${onlinePartners.length} online partner(s), filtered by identity, bank, wallet, location, push, and control gates.`,
    },
    {
      label: 'Hard blocked',
      value: providers.filter((provider) => partnerHardBlocked(provider, policy)).length.toString(),
      helper:
        'Account controls, identity failure, missing approved bank, or negative wallet under the current wallet policy.',
    },
    {
      label: 'Cash debt block',
      value: walletBlocked.length.toString(),
      helper: policy.hardWalletBlock
        ? 'Negative wallet blocks booking acceptance.'
        : 'Negative wallet is visible but not a hard block under recovery mode.',
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
      helper: `Missing or older than ${policy.backupLocationFreshnessMinutes} minute(s), so marketplace matching should not trust it.`,
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
        'Blocked account, active sanction, blocked device, suspicious session, or shared device signal.',
    },
    {
      label: 'Recovery queue',
      value: softRecovery.length.toString(),
      helper: 'Not ready now, but can be recovered through app open, push refresh, or manual follow-up.',
    },
  ];
}

function partnerCanAcceptUnderCurrentPolicy(
  provider: AdminProvider,
  policy: { backupLocationFreshnessMinutes: number; hardWalletBlock: boolean },
) {
  return (
    provider.status === 'ONLINE_AVAILABLE' &&
    !partnerHardBlocked(provider, policy) &&
    partnerLocationFresh(provider, policy.backupLocationFreshnessMinutes) &&
    partnerHasEnabledPush(provider)
  );
}

function partnerHardBlocked(provider: AdminProvider, policy: { hardWalletBlock: boolean }) {
  return (
    partnerAccountNeedsFollowUp(provider) ||
    !partnerIdentityReady(provider) ||
    !partnerBankReady(provider) ||
    (policy.hardWalletBlock && partnerWalletBalance(provider) < 0)
  );
}

function partnerIdentityReady(provider: AdminProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return (
    provider.verification?.status === 'APPROVED' &&
    provider.kyc?.status === 'APPROVED' &&
    REQUIRED_KYC_DOCUMENTS.every((type) => approvedDocuments.has(type))
  );
}

function partnerBankReady(provider: AdminProvider) {
  return (provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED');
}

function partnerWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? []).reduce((total, earning) => total + Number(earning.netAmount ?? 0), 0);
}

function partnerLocationFresh(provider: AdminProvider, freshnessMinutes: number) {
  if (readOptionalNumber(provider.currentLat) === null || readOptionalNumber(provider.currentLng) === null) {
    return false;
  }
  const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  return ageMinutes !== null && ageMinutes <= freshnessMinutes;
}

function partnerHasEnabledPush(provider: AdminProvider) {
  return (provider.user?.pushDevices ?? []).some((device) => device.enabled);
}

function partnerAccountNeedsFollowUp(provider: AdminProvider) {
  return (
    Boolean(provider.blockedAt) ||
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE') ||
    (provider.devices ?? []).some((device) => Boolean(device.blockedAt) || device.enabled === false) ||
    (provider.sessions ?? []).some((session) => session.suspicious) ||
    (provider.sharedDeviceMatches ?? []).length > 0
  );
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
  const immediateBackup = policyRawValue(settings, 'matching.backup_open_mode') === 'IMMEDIATE_WITHIN_WINDOW';
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
        label: 'Legacy bookings',
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
            ? `${openMatchingWithoutSnapshot} open legacy booking(s) still need manual policy interpretation.`
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
        policy: 'Marketplace partner radius',
        scope: 'Partner eligibility',
        liveValue: policyDisplayByKey(settings, 'matching.backup_provider_radius_meters'),
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
        liveValue: policyDisplayByKey(settings, 'matching.backup_provider_location_max_age_minutes'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupProviderLocationMaxAgeMinutes,
          (value) => `${value} min`,
        ),
        operatorMeaning:
          'Controls whether stale partner locations are excluded from marketplace alerts and join attempts.',
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
          'Explains whether an accepted first-pick partner locks automatically or still waits for customer confirmation.',
      },
      {
        policy: 'Marketplace opening mode',
        scope: 'Marketplace visibility',
        liveValue: policyDisplayByKey(settings, 'matching.backup_open_mode'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupOpenMode,
          (value) => formatSnapshotPolicyValue(settings, 'matching.backup_open_mode', value),
        ),
        operatorMeaning:
          'Explains whether marketplace partners were allowed to join during the first-pick response window.',
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
          'Changing the first-pick partner response window affects new booking expiry and Redis TTL. Existing bookings keep their saved expiresAt value.',
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
          ? 'Marketplace partners can join during the first window'
          : 'Marketplace partners wait until the first window closes',
        detail: immediateBackup
          ? 'Eligible partners can appear while the first-pick partner is still deciding.'
          : 'Marketplace visibility and join checks stay delayed until the first-pick response window passes.',
        operatorAction: customerConfirm
          ? 'Customer confirmation mode is active, so accepted partners still require customer final choice.'
          : 'Auto-match mode is active, so accepted first-pick partners can lock faster.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        scope: 'Partner controls',
        title: 'Negative wallet gate protects cash-fee debt',
        detail:
          'Partners with unpaid cash-fee debt should be blocked from accepting or joining until settlement is posted.',
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

type PolicyEffectStats = {
  sampleCount: number;
  matchedCount: number;
  completedCount: number;
  cancelledCount: number;
  expiredCount: number;
  noShowCount: number;
  participantCount: number;
  backupInviteCount: number;
};

function buildPolicyEffectAnalysis(settings: AdminOperationalPolicySetting[], bookings: AdminBooking[]) {
  const sampledBookings = bookings.filter((booking) => readBookingMatchingPolicySnapshot(booking));
  const globalStats = policyEffectStatsForBookings(sampledBookings);
  const globalMatchedRate =
    globalStats.sampleCount > 0 ? globalStats.matchedCount / globalStats.sampleCount : 0;
  const rows = [
    ...buildPolicyEffectRows({
      policy: 'First-pick response window',
      settings,
      bookings: sampledBookings,
      settingKey: 'matching.provider_response_window_minutes',
      readValue: (snapshot) => snapshot.providerResponseWindowMinutes,
      formatValue: (value) => `${value} min`,
      globalMatchedRate,
    }),
    ...buildPolicyEffectRows({
      policy: 'Marketplace policy',
      settings,
      bookings: sampledBookings,
      settingKey: 'matching.backup_provider_radius_meters',
      readValue: (snapshot) => snapshot.backupProviderRadiusMeters,
      formatValue: (value) => formatDistance(Number(value)),
      globalMatchedRate,
    }),
    ...buildPolicyEffectRows({
      policy: 'Candidate alert cap',
      settings,
      bookings: sampledBookings,
      settingKey: 'matching.backup_provider_invitation_limit',
      readValue: (snapshot) => snapshot.backupProviderInvitationLimit,
      formatValue: (value) => `${value} partner(s)`,
      globalMatchedRate,
    }),
    ...buildPolicyEffectRows({
      policy: 'Marketplace opening mode',
      settings,
      bookings: sampledBookings,
      settingKey: 'matching.backup_open_mode',
      readValue: (snapshot) => snapshot.backupOpenMode,
      formatValue: (value) => formatSnapshotPolicyValue(settings, 'matching.backup_open_mode', value),
      globalMatchedRate,
    }),
    ...buildPolicyEffectRows({
      policy: 'First-pick accept mode',
      settings,
      bookings: sampledBookings,
      settingKey: 'matching.preferred_accept_mode',
      readValue: (snapshot) => snapshot.preferredAcceptMode,
      formatValue: (value) => formatSnapshotPolicyValue(settings, 'matching.preferred_accept_mode', value),
      globalMatchedRate,
    }),
  ]
    .sort((left, right) => right.sampleRaw - left.sampleRaw || left.policy.localeCompare(right.policy))
    .slice(0, 12);

  const totalOutcomeCheckCount =
    globalStats.cancelledCount + globalStats.expiredCount + globalStats.noShowCount;
  const avgBackupInvites = averageLabel(globalStats.backupInviteCount, globalStats.sampleCount, 'partner(s)');
  const currentInviteCap = policyDisplayByKey(settings, 'matching.backup_provider_invitation_limit');
  const currentRadius = policyDisplayByKey(settings, 'matching.backup_provider_radius_meters');

  return {
    sampleCount: sampledBookings.length,
    metrics: [
      {
        label: 'Matched rate',
        value: percentLabel(globalStats.matchedCount, globalStats.sampleCount),
        helper: `${globalStats.matchedCount}/${globalStats.sampleCount} sampled booking(s) reached a selected or active partner.`,
      },
      {
        label: 'Completed rate',
        value: percentLabel(globalStats.completedCount, globalStats.sampleCount),
        helper: `${globalStats.completedCount}/${globalStats.sampleCount} sampled booking(s) completed service.`,
      },
      {
        label: 'Avg candidate alerts',
        value: avgBackupInvites,
        helper: 'Uses stored candidate-alert traces from booking metadata, not just live partner supply.',
      },
      {
        label: 'Cancelled / expired / no-show',
        value: String(totalOutcomeCheckCount),
        helper: `${globalStats.cancelledCount} cancelled, ${globalStats.expiredCount} expired, ${globalStats.noShowCount} no-show.`,
      },
    ],
    rows,
    cards: [
      {
        scope: 'Evidence',
        title: sampledBookings.length ? 'Policy snapshots are measurable' : 'Create more measured bookings',
        detail: sampledBookings.length
          ? 'Each booking opened under a saved policy can now be compared against outcome, partner joins, and candidate alert batches.'
          : 'The dashboard needs bookings with metadata.matchingPolicy before it can compare policy outcomes.',
        operatorAction: sampledBookings.length
          ? 'Use these cohorts before changing response window, marketplace radius, invite cap, or accept mode.'
          : 'Create a fresh booking after policy setup, then run through accept/reject/marketplace scenarios.',
        className: sampledBookings.length ? 'ops-task-done' : 'ops-task-pending',
        pillClass: sampledBookings.length ? 'pill-success' : 'pill-warn',
      },
      {
        scope: 'Current rule',
        title: `Marketplace exposure: ${currentRadius}, cap ${currentInviteCap}`,
        detail:
          'Marketplace partner exposure should balance speed, push cost, and customer choice clarity. A high cap can notify too many partners; a low cap can hide useful supply.',
        operatorAction:
          globalStats.backupInviteCount > 0
            ? `Current sample averages ${avgBackupInvites} per measured booking.`
            : 'No candidate alert batch was found in the measured sample yet.',
        className: 'ops-task-pending',
        pillClass: 'pill-info',
      },
      {
        scope: 'Outcome checks',
        title: totalOutcomeCheckCount
          ? 'Review closed booking cohorts before changing policy'
          : 'No closed-outcome spike in sample',
        detail: totalOutcomeCheckCount
          ? 'Cancelled, expired, or no-show bookings may point to response-window, supply, payment, or partner readiness problems.'
          : 'The sampled policy snapshots do not show cancelled, expired, or no-show pressure yet.',
        operatorAction: totalOutcomeCheckCount
          ? 'Open the booking drill-down and compare closed bookings against their saved policy snapshot.'
          : 'Keep collecting results across more districts and time bands before treating this as final.',
        className: totalOutcomeCheckCount ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: totalOutcomeCheckCount ? 'pill-danger' : 'pill-success',
      },
    ],
  };
}

function buildPolicyEffectRows(input: {
  policy: string;
  settings: AdminOperationalPolicySetting[];
  bookings: AdminBooking[];
  settingKey: string;
  readValue: (snapshot: BookingMatchingPolicySnapshot) => string | number | null;
  formatValue: (value: string | number) => string;
  globalMatchedRate: number;
}) {
  const groups = new Map<string, { value: string; bookings: AdminBooking[] }>();
  for (const booking of input.bookings) {
    const snapshot = readBookingMatchingPolicySnapshot(booking);
    if (!snapshot) {
      continue;
    }
    const rawValue = input.readValue(snapshot);
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    const value = input.formatValue(rawValue);
    const key = `${input.policy}:${value}`;
    const group = groups.get(key) ?? { value, bookings: [] };
    group.bookings.push(booking);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const stats = policyEffectStatsForBookings(group.bookings);
    const matchedRateValue = stats.sampleCount > 0 ? stats.matchedCount / stats.sampleCount : 0;
    const closedOutcomeCount = stats.cancelledCount + stats.expiredCount + stats.noShowCount;
    const sampleTooSmall = stats.sampleCount < 5;
    const belowAverage = matchedRateValue + 0.05 < input.globalMatchedRate;
    const needsOutcomeReview = closedOutcomeCount > 0 || belowAverage;
    const liveValue = policyDisplayByKey(input.settings, input.settingKey);

    return {
      key,
      policy: input.policy,
      value: group.value,
      sampleRaw: stats.sampleCount,
      sample: `${stats.sampleCount} booking(s)`,
      matchedRate: percentLabel(stats.matchedCount, stats.sampleCount),
      completedRate: percentLabel(stats.completedCount, stats.sampleCount),
      avgBackupInvites: averageLabel(stats.backupInviteCount, stats.sampleCount, 'partner(s)'),
      avgParticipants: averageLabel(stats.participantCount, stats.sampleCount, 'partner(s)'),
      outcomeLabel: sampleTooSmall ? 'Low sample' : needsOutcomeReview ? 'Check outcomes' : 'On track',
      outcomePill: sampleTooSmall ? 'pill-warn' : needsOutcomeReview ? 'pill-danger' : 'pill-success',
      outcomeDetail: `${closedOutcomeCount} closed outcome(s) to review / live value now ${liveValue}.`,
      operatorRead: sampleTooSmall
        ? 'Keep collecting data before deciding. This cohort is useful for debugging, not final policy choice.'
        : belowAverage
          ? 'Matched rate is below the measured average. Check partner supply, alert delivery, and customer wait before expanding this value.'
          : needsOutcomeReview
            ? 'Closed or below-average outcomes exist. Review the booking detail snapshots before changing this policy again.'
            : 'This cohort is currently performing at or above the measured average in the sampled bookings.',
    };
  });
}

function policyEffectStatsForBookings(bookings: AdminBooking[]): PolicyEffectStats {
  return bookings.reduce<PolicyEffectStats>(
    (stats, booking) => {
      stats.sampleCount += 1;
      if (bookingHasMatchedPartner(booking)) {
        stats.matchedCount += 1;
      }
      if (booking.status === 'COMPLETED') {
        stats.completedCount += 1;
      }
      if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
        stats.cancelledCount += 1;
      }
      if (booking.status === 'EXPIRED') {
        stats.expiredCount += 1;
      }
      if (booking.status === 'NO_SHOW') {
        stats.noShowCount += 1;
      }
      stats.participantCount += booking.participants?.length ?? 0;
      stats.backupInviteCount += bookingBackupInviteCount(booking);
      return stats;
    },
    {
      sampleCount: 0,
      matchedCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      expiredCount: 0,
      noShowCount: 0,
      participantCount: 0,
      backupInviteCount: 0,
    },
  );
}

function bookingHasMatchedPartner(booking: AdminBooking) {
  return (
    Boolean(booking.selectedProvider) ||
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status)
  );
}

function bookingBackupInviteCount(booking: AdminBooking) {
  const metadata = readPlainRecord(booking.metadata);
  const traces = Array.isArray(metadata?.backupNotificationTraces) ? metadata.backupNotificationTraces : [];
  return traces.reduce((total, value) => {
    const trace = readPlainRecord(value);
    return total + (readOptionalNumber(trace?.notifiedCount) ?? 0);
  }, 0);
}

function percentLabel(count: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((count / total) * 100)}%`;
}

function averageLabel(total: number, count: number, unit: string) {
  if (count <= 0) {
    return `0 ${unit}`;
  }
  return `${(total / count).toLocaleString('en', { maximumFractionDigits: 1 })} ${unit}`;
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
            label: booking.expiresAt ? `expires ${relativeTime(booking.expiresAt)}` : 'no expiry',
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
        'Recent wallet entries are negative. Confirm settlement before allowing new booking actions.',
    }));

  const lists: PolicyDrilldownListView[] = [
    {
      key: 'open-matching',
      title: 'Open matching watchlist',
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
      title: 'Wallet gate watchlist',
      helper: 'Partners with negative recent wallet ledger entries that may block booking actions.',
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
    (booking.participants?.length ? 'Joined partner' : 'No partner yet')
  );
}

function bookingCustomerLabel(booking: AdminBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer not loaded'
  );
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} VND`;
}

function policyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalNumber(policyRawValue(settings, key));
}

function policyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalString(policyRawValue(settings, key));
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

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}

function radiusSensitivityRead(radius: number, currentRadius: number, eligibleCount: number) {
  if (eligibleCount === 0) {
    return 'No usable marketplace supply at this radius. Operators should improve partner location/push readiness before relying on it.';
  }
  if (radius < currentRadius) {
    return 'Tighter radius improves arrival quality but can create empty customer waiting screens in thin cities.';
  }
  if (radius > currentRadius) {
    return 'Wider radius increases customer options, but operators should watch late arrivals and ignored alerts.';
  }
  return 'Current live radius. Use this as the baseline before changing matching policy.';
}

function freshnessSensitivityRead(
  freshness: number,
  currentFreshness: number,
  eligibleCount: number,
  staleExcluded: number,
) {
  if (eligibleCount === 0) {
    return 'No usable partner remains under this freshness rule. Ask partners to reopen the app or loosen only with caution.';
  }
  if (freshness < currentFreshness) {
    return 'Stricter freshness improves trust in distance, but may hide partners who update every 10 minutes imperfectly.';
  }
  if (freshness > currentFreshness) {
    return 'Looser freshness exposes more supply, but stale pins can create bad arrival expectations.';
  }
  return staleExcluded
    ? 'Current live freshness. Stale partners can be recovered by opening the Partner app.'
    : 'Current live freshness. No stale partner is being excluded in this sample.';
}

function operationalPolicyAuditRows(logs: AdminAuditLog[]) {
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
        actorName: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        previousValue: compactAuditValue(metadata?.previousValue),
        value: compactAuditValue(metadata?.value),
        reason: readOptionalString(metadata?.reason) ?? 'No reason recorded',
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
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function compactAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
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
  const currentUsableSupply = readSupplySummaryNumber(supplySensitivity, 'Current usable supply');
  const staleExcluded = readSupplySummaryNumber(supplySensitivity, 'Stale excluded');
  const hardBlockedInRadius = readSupplySummaryNumber(supplySensitivity, 'Hard blocked in radius');
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE')).length;
  const enabledPushPartners = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const pushGap = Math.max(onlinePartners - enabledPushPartners, 0);
  const acceptanceBlocked = acceptanceMatrix.blockingCount + hardBlockedInRadius;

  const cards = [
    {
      title: 'First-pick response window',
      status: waitingFirstPick.length ? 'Monitor now' : 'Stable',
      detail: waitingFirstPick.length
        ? `${waitingFirstPick.length} open matching booking(s) are waiting on a first-pick partner. ${acceptedButNotFinal.length} already have accepted participants awaiting final customer choice.`
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
      status: currentUsableSupply > 0 ? 'Supply visible' : 'Supply thin',
      detail: `${currentUsableSupply} usable partner(s) are inside the current policy sample. ${backupInterest.length} open booking(s) already show marketplace interest.`,
      operatorAction:
        currentUsableSupply > 0
          ? 'Use the sensitivity table before changing the 10km radius.'
          : 'Refresh partner locations or consider city/service supply rules before launch.',
      href: '/partners?review=backup-ready',
      className: currentUsableSupply > 0 ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: currentUsableSupply > 0 ? 'pill-success' : 'pill-danger',
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
      title: 'Wallet and hard blockers',
      status: acceptanceBlocked ? 'Gate active' : 'Clear',
      detail: `${acceptanceBlocked} partner blocker signal(s) affect booking acceptance or marketplace participation.`,
      operatorAction: acceptanceBlocked
        ? 'Keep negative-wallet and identity gates strict until finance and partner controls clear the queue.'
        : 'No current sample pressure to relax booking acceptance gates.',
      href: acceptanceBlocked ? '/partners?review=acceptance-blocked' : '/partner-controls',
      className: acceptanceBlocked ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: acceptanceBlocked ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Partner push readiness',
      status: pushGap ? 'Push gap' : 'Ready',
      detail: `${enabledPushPartners}/${onlinePartners} online partner(s) have enabled push devices in the current snapshot.`,
      operatorAction: pushGap
        ? 'Keep in-app request listing as the fallback until OneSignal device coverage is reliable.'
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
        label: 'Usable supply',
        value: String(currentUsableSupply),
        helper: `${supplySensitivity.currentPolicyLabel} around ${supplySensitivity.referenceLabel}.`,
      },
      {
        label: 'Acceptance blockers',
        value: String(acceptanceBlocked),
        helper:
          'Wallet, identity, bank, account-control, or radius blockers that change dispatch availability.',
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

function operationsOwnerDecisionBacklog() {
  return [
    {
      owner: 'Dispatch',
      title: 'First-pick partner timer',
      question:
        'Should the first-pick partner keep the full response window, or should marketplace partners become more prominent earlier?',
      signal:
        'Review open matching wait time, first-pick response rate, and customer cancellation before changing the timer.',
      options: [
        {
          label: 'Keep 10 minutes',
          tradeoff:
            'Protects the customer-selected partner and keeps the first-pick promise clear, but customers may wait longer.',
        },
        {
          label: 'Escalate earlier',
          tradeoff:
            'Shows marketplace partners sooner and reduces waiting anxiety, but the first-pick partner has less exclusive time.',
        },
      ],
      recommendation:
        'Keep the 10-minute policy for launch, then review response-rate data by city before shortening it.',
      decisionTrigger:
        'Revisit when first-pick response rate drops below 70% or customer cancellations during wait exceed 8%.',
      href: '/bookings?view=matching',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Supply',
      title: 'Marketplace partner radius',
      question:
        'Should HANDS keep one nationwide default radius, or vary radius by city density and service type?',
      signal:
        'Review partner count within radius, average distance, late arrivals, and ignored marketplace alerts by city.',
      options: [
        {
          label: 'Single 10km default',
          tradeoff:
            'Simple to explain and operate during MVP, but dense cities and low-supply cities may need different behavior.',
        },
        {
          label: 'City/service rules',
          tradeoff:
            'More precise dispatch control, but requires more admin policy work and monitoring per market.',
        },
      ],
      recommendation:
        'Start with one marketplace policy baseline, then add city/service overrides after Ho Chi Minh City data is stable.',
      decisionTrigger:
        'Revisit when marketplace alerts are ignored often, or accepted marketplace partners are repeatedly too far away.',
      href: '/operations-policy#policy-matching-backup-provider-radius-meters',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Finance',
      title: 'Negative wallet recovery',
      question:
        'Should partners with cash-fee debt be fully blocked, or allowed one recovery booking under supervision?',
      signal:
        'Review cash settlement speed, repeated debt partners, and customer impact before enabling recovery mode.',
      options: [
        {
          label: 'Hard block',
          tradeoff:
            'Strongly protects company fees and tax withholding, but may reduce available supply for cash-heavy areas.',
        },
        {
          label: 'Recovery booking',
          tradeoff:
            'Can keep a trusted partner active while collecting debt, but needs tighter finance review and abuse controls.',
        },
      ],
      recommendation:
        'Keep hard blocking until finance has a reliable settlement workflow and recovery control playbook.',
      decisionTrigger:
        'Revisit after cash-settlement median collection time is under 24 hours for two consecutive weeks.',
      href: '/cash-settlements',
      className: 'ops-task-blocked',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Support',
      title: 'Cancellation fee rule',
      question:
        'When a customer cancels after partner commitment, should payment be released immediately or held for fee review?',
      signal:
        'Review after-match cancellation reasons, partner travel evidence, refund complaints, and manual review workload.',
      options: [
        {
          label: 'Admin review',
          tradeoff:
            'Protects early customer trust and lets support learn real patterns, but increases manual workload.',
        },
        {
          label: 'Auto fee',
          tradeoff: 'Faster and more consistent, but mistakes can quickly damage customer and partner trust.',
        },
      ],
      recommendation:
        'Use admin review during MVP and only automate once arrival evidence and cancellation reasons are reliable.',
      decisionTrigger:
        'Revisit when support has at least 100 reviewed after-match cancellations with clear reason categories.',
      href: '/refunds',
      className: 'ops-task-pending',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Trust',
      title: 'No-show evidence',
      question:
        'What evidence should be required before no-show closeout or customer fee decisions are reviewed?',
      signal:
        'Review chat, arrival timestamp, location proof, customer response, and dispute context before no-show closeout.',
      options: [
        {
          label: 'Manual evidence review',
          tradeoff:
            'More controlled for launch and disputes, but slower for partner compensation and customer closeout.',
        },
        {
          label: 'Evidence checklist',
          tradeoff: 'Keeps decisions factual and repeatable, but requires reliable location, chat, and timestamp capture.',
        },
      ],
      recommendation:
        'Keep manual review until service-start, arrival, chat, and location proof are consistently captured.',
      decisionTrigger:
        'Revisit when no-show dispute rate is measurable and evidence completeness is above 95%.',
      href: '/bookings?view=no-show',
      className: 'ops-task-pending',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Growth',
      title: 'Partner alert channel',
      question:
        'When should time-sensitive booking alerts move from in-app only to mandatory OneSignal push delivery?',
      signal:
        'Review delivery failure rate, disabled devices, missed requests, and production push credential readiness.',
      options: [
        {
          label: 'In-app first',
          tradeoff:
            'Lowest setup work and easiest local testing, but partners may miss requests when the app is closed.',
        },
        {
          label: 'OneSignal required',
          tradeoff:
            'Better booking reach, but depends on production credentials and delivery monitoring.',
        },
      ],
      recommendation:
        'Keep in-app first locally, then enable OneSignal once production credentials and failure dashboards are ready.',
      decisionTrigger:
        'Revisit immediately after OneSignal production setup is complete and device delivery logs are visible.',
      href: '/operations-policy#policy-notification-partner-alert-channel',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    },
  ];
}

function buildMatchingPlaybook(settings: AdminOperationalPolicySetting[]) {
  const responseWindow = policyDisplayByKey(settings, 'matching.provider_response_window_minutes');
  const backupRadius = policyDisplayByKey(settings, 'matching.backup_provider_radius_meters');
  const backupLimit = policyDisplayByKey(settings, 'matching.backup_provider_invitation_limit');
  const backupOpenMode = policyDisplayByKey(settings, 'matching.backup_open_mode');
  const preferredAcceptMode = policyDisplayByKey(settings, 'matching.preferred_accept_mode');
  const walletGate = policyDisplayByKey(settings, 'wallet.negative_balance_gate');
  const alertChannel = policyDisplayByKey(settings, 'notification.partner_alert_channel');

  return [
    {
      step: '1',
      title: 'Customer picks one first-pick partner',
      detail:
        'The customer chooses a partner profile and service option first. This creates a direct booking request and opens the matching window.',
      className: 'timeline-done',
      tags: [
        { label: 'Direct request', tone: 'pill-success' },
        { label: preferredAcceptMode, tone: 'pill-info' },
      ],
    },
    {
      step: '2',
      title: 'First-pick partner response window starts',
      detail: `The first-pick partner has ${responseWindow} to accept. Existing open bookings keep their saved expiry time.`,
      className: 'timeline-active',
      tags: [
        { label: responseWindow, tone: 'pill-info' },
        { label: 'Timer saved on booking', tone: 'pill-neutral' },
      ],
    },
    {
      step: '3',
      title: 'Marketplace partners can participate by policy',
      detail: `Up to ${backupLimit} partners inside ${backupRadius} can see or join the marketplace lane according to "${backupOpenMode}".`,
      className: 'timeline-active',
      tags: [
        { label: backupRadius, tone: 'pill-info' },
        { label: backupLimit, tone: 'pill-info' },
        { label: backupOpenMode, tone: 'pill-warn' },
      ],
    },
    {
      step: '4',
      title: 'Customer sees available partner choices',
      detail:
        'Accepted or joined partners appear in the customer waiting screen so the customer can confirm the final partner when customer-confirm mode is active.',
      className: 'timeline-active',
      tags: [
        { label: 'Customer shortlist', tone: 'pill-success' },
        { label: preferredAcceptMode, tone: 'pill-info' },
      ],
    },
    {
      step: '5',
      title: 'Wallet and control gates protect operations',
      detail: `Negative cash-fee debt follows "${walletGate}". Payout holds, account blocks, and stale location should be reviewed before partner dispatch.`,
      className: walletGate.includes('Block') ? 'timeline-active' : 'timeline-done',
      tags: [
        { label: walletGate, tone: walletGate.includes('Block') ? 'pill-danger' : 'pill-warn' },
        { label: 'Partner controls', tone: 'pill-info' },
      ],
    },
    {
      step: '6',
      title: 'Chat and service execution',
      detail: `After acceptance/service start, chat and operational follow-up continue in-app. Alerts currently follow "${alertChannel}".`,
      className: 'timeline-done',
      tags: [
        { label: 'Chat unlock', tone: 'pill-success' },
        { label: alertChannel, tone: 'pill-info' },
      ],
    },
  ];
}

function policyDisplayByKey(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = settings.find((item) => item.key === key);
  return setting ? policyDisplayValue(setting) : 'Not configured';
}

function formatSnapshotPolicyValue(
  settings: AdminOperationalPolicySetting[],
  key: string,
  value: string | number,
) {
  const setting = settings.find((item) => item.key === key);
  const stringValue = String(value);
  return displayOperationalWording(
    setting?.options?.find((option) => option.value === stringValue)?.label ??
      formatPolicyValue(value, setting?.unit),
  );
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return settings.find((item) => item.key === key)?.value;
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
    setting.options?.find((option) => option.value === value)?.label ?? formatPolicyValue(value, setting.unit),
  );
}

function displayOperationalWording(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replaceAll('backupNotificationTraces', 'candidate alert traces')
    .replaceAll('backup-radius', 'marketplace-radius')
    .replaceAll('backup-open', 'marketplace-open')
    .replaceAll('Backup partner', 'Marketplace partner')
    .replaceAll('backup partner', 'marketplace partner')
    .replaceAll('Backup participation', 'Marketplace participation')
    .replaceAll('backup participation', 'marketplace participation')
    .replaceAll('Backup visibility', 'Marketplace visibility')
    .replaceAll('backup visibility', 'marketplace visibility')
    .replaceAll('Backup notification', 'Marketplace notification')
    .replaceAll('backup notification', 'marketplace notification')
    .replaceAll('Backup invite', 'Candidate alert')
    .replaceAll('backup invite', 'candidate alert')
    .replaceAll('Backup request', 'Marketplace request')
    .replaceAll('backup request', 'marketplace request')
    .replaceAll('Backup shortlist', 'Marketplace shortlist')
    .replaceAll('backup shortlist', 'marketplace shortlist')
    .replaceAll('Backup lane', 'Marketplace lane')
    .replaceAll('backup lane', 'marketplace lane')
    .replaceAll('Backup join', 'Marketplace join')
    .replaceAll('backup join', 'marketplace join')
    .replaceAll('Open backups', 'Open marketplace')
    .replaceAll('open backups', 'open marketplace')
    .replaceAll('Immediate backup', 'Immediate marketplace')
    .replaceAll('immediate backup', 'immediate marketplace')
    .replaceAll('Delayed backup', 'Delayed marketplace')
    .replaceAll('delayed backup', 'delayed marketplace')
    .replaceAll('Delay backup', 'Delay marketplace')
    .replaceAll('delay backup', 'delay marketplace')
    .replaceAll('backup partners', 'marketplace partners')
    .replaceAll('Backup partners', 'Marketplace partners')
    .replaceAll('backup alerts', 'marketplace alerts')
    .replaceAll('Backup alerts', 'Marketplace alerts')
    .replaceAll('backup open mode', 'marketplace open mode')
    .replaceAll('Backup open mode', 'Marketplace open mode')
    .replaceAll('backup mode', 'marketplace mode')
    .replaceAll('Backup mode', 'Marketplace mode')
    .replaceAll('backup list', 'marketplace list')
    .replaceAll('Backup list', 'Marketplace list');
}

type PolicySaveCheck = {
  label: string;
  detail: string;
  href: string;
};

type PolicyImpactDetails = {
  area: string;
  title: string;
  detail: string;
  saveChecks: PolicySaveCheck[];
};

function policyImpactDetails(key: string): PolicyImpactDetails {
  const details: Record<string, PolicyImpactDetails> = {
    'matching.provider_response_window_minutes': {
      area: 'Booking timer',
      title: 'Affects new booking expiry windows',
      detail:
        'New requests use this value for the first-pick partner response timer and Redis matching TTL. Existing open bookings keep their saved expiry.',
      saveChecks: [
        {
          label: 'First-pick queue',
          detail:
            'Check how many bookings are still waiting for the preferred partner before shortening the timer.',
          href: '/bookings?view=first-pick',
        },
        {
          label: 'Customer choice backlog',
          detail: 'Confirm customers are not already waiting too long after partners accept.',
          href: '/bookings?view=customer-choice',
        },
      ],
    },
    'matching.backup_provider_radius_meters': {
      area: 'Partner supply',
      title: 'Controls who can see and join marketplace requests',
      detail:
        'Partner open-booking lists, join validation, marketplace notifications, and customer shortlist visibility use this radius.',
      saveChecks: [
        {
          label: 'Stage impact preview',
          detail: 'Preview how the selected radius changes marketplace supply and no-supply checks.',
          href: '/operations-policy#matching-stage-impact',
        },
        {
          label: 'Marketplace ready',
          detail: 'Review partners that can actually receive and join marketplace requests.',
          href: '/partners?review=backup-ready',
        },
      ],
    },
    'matching.backup_provider_invitation_limit': {
      area: 'Partner supply',
      title: 'Controls how many marketplace partners are exposed',
      detail:
        'Eligible marketplace partners are sorted by distance, then capped by this limit before notification jobs and customer-visible supply are created.',
      saveChecks: [
        {
          label: 'Marketplace notification load',
          detail: 'Check delivery volume and failed partner alerts before raising invitation volume.',
          href: '/notifications',
        },
        {
          label: 'Marketplace shortlist',
          detail: 'Confirm the customer shortlist will stay readable when more partners can join.',
          href: '/bookings?view=backup',
        },
      ],
    },
    'matching.travel_buffer_minutes': {
      area: 'Availability',
      title: 'Controls partner availability after work',
      detail:
        'Nearby sorting and availability calculations use this buffer before a partner becomes eligible for another booking.',
      saveChecks: [
        {
          label: 'Partner capacity',
          detail: 'Review online partners and session freshness before reducing rest/travel time.',
          href: '/app-sessions?role=PROVIDER&state=live',
        },
        {
          label: 'Schedule pressure',
          detail: 'Look for stacked bookings that may create late arrivals if the buffer is too low.',
          href: '/bookings?view=matching',
        },
      ],
    },
    'matching.preferred_accept_mode': {
      area: 'Customer choice',
      title: 'Controls whether acceptance locks the booking',
      detail:
        'Auto-match is faster. Customer confirmation keeps the booking open after partner accept so the customer can make the final choice.',
      saveChecks: [
        {
          label: 'Customer choice queue',
          detail: 'Use this before switching toward customer-confirmation behavior.',
          href: '/bookings?view=customer-choice',
        },
        {
          label: 'Handoff repair',
          detail: 'Check chat and service-start failures before making acceptance more automatic.',
          href: '/bookings?view=handoff-repair',
        },
      ],
    },
    'matching.backup_open_mode': {
      area: 'Marketplace flow',
      title: 'Controls when other partners can participate',
      detail:
        'Immediate mode notifies eligible partners right away. Delayed mode hides and blocks marketplace join until the first-pick response window passes, but opens immediately after first-pick decline.',
      saveChecks: [
        {
          label: 'Open matching timeline',
          detail: 'Check whether delayed marketplace visibility would increase waiting anxiety on current bookings.',
          href: '/bookings?view=matching',
        },
        {
          label: 'Policy stage preview',
          detail: 'Compare delayed and immediate marketplace impact before saving the mode.',
          href: '/operations-policy#matching-stage-impact',
        },
      ],
    },
    'wallet.negative_balance_gate': {
      area: 'Wallet controls',
      title: 'Controls unpaid cash-fee debt enforcement',
      detail:
        'Block mode stops partners with negative cash-fee debt from accepting new work. Recovery mode permits one active booking so they can earn toward repayment.',
      saveChecks: [
        {
          label: 'Cash debt queue',
          detail: 'Review partners blocked by unpaid HANDS cash fees before changing acceptance gates.',
          href: '/partners?review=cash-debt',
        },
        {
          label: 'Settlement command queue',
          detail: 'Check pending repayments and manual offsets before relaxing debt enforcement.',
          href: '/cash-settlements',
        },
      ],
    },
    'cancellation.after_match_policy': {
      area: 'Cancellation money',
      title: 'Controls payment handling after partner commitment',
      detail:
        'Admin-review mode releases normal early cancellations. Auto-fee mode keeps matched cancellation payment holds for operator review.',
      saveChecks: [
        {
          label: 'Cancellation closeout',
          detail:
            'Review cancellation reasons, matched state, and refund exposure before changing fee posture.',
          href: '/bookings?view=closeout',
        },
        {
          label: 'Refund command board',
          detail: 'Check manual refund workload before holding more matched cancellations.',
          href: '/refunds',
        },
      ],
    },
    'no_show.partner_report_policy': {
      area: 'No-show review',
      title: 'Controls no-show evidence and payment review posture',
      detail:
        'Admin-review mode keeps no-show and fee decisions manual. Evidence mode records required proof in notes and audit logs for consistent review.',
      saveChecks: [
        {
          label: 'No-show board',
          detail: 'Review active no-show cases and missing evidence before tightening no-show policy.',
          href: '/bookings?view=no-show',
        },
        {
          label: 'No-show alerts',
          detail:
            'Check alert delivery so partners and customers are informed before no-show closeout is reviewed.',
          href: '/notifications?review=no-show',
        },
      ],
    },
    'notification.partner_alert_channel': {
      area: 'Alert routing',
      title: 'Controls partner booking alert delivery provider',
      detail:
        'In-app mode records inbox notifications only. OneSignal mode routes partner booking alerts through OS push delivery and logs provider results.',
      saveChecks: [
        {
          label: 'Delivery operations queue',
          detail: 'Confirm failed delivery codes and disabled devices before changing alert routing.',
          href: '/notifications',
        },
        {
          label: 'Setup checklist',
          detail: 'Verify OneSignal, app IDs, and secrets are configured before enabling external push.',
          href: '/setup',
        },
      ],
    },
  };

  return (
    details[key] ?? {
      area: 'Operations',
      title: 'Operational policy',
      detail: 'This setting is tracked for auditability and future automation.',
      saveChecks: [
        {
          label: 'Audit trail',
          detail: 'Check recent policy changes and leave a clear reason before saving another change.',
          href: '/audit-log',
        },
        {
          label: 'Operations dashboard',
          detail: 'Review live booking, partner, and customer health before changing behavior.',
          href: '/',
        },
      ],
    }
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'Unknown time';
  }
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
}

function policyNotice(params: Record<string, string | string[] | undefined>) {
  const status = firstParam(params.status);
  const reason = firstParam(params.reason);
  if (status === 'saved') {
    return {
      tone: 'success' as const,
      title: 'Operational policy saved',
      detail: `Updated ${reason}. New bookings and partner join checks will use the latest enforced settings.`,
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

function readBookingMatchingPolicySnapshot(booking: AdminBooking): BookingMatchingPolicySnapshot | null {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy.backupProviderRadiusMeters),
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(policy.backupProviderLocationMaxAgeMinutes),
    backupProviderInvitationLimit: readOptionalNumber(policy.backupProviderInvitationLimit),
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
}

function summarizeSnapshotValues(
  bookings: AdminBooking[],
  readValue: (snapshot: BookingMatchingPolicySnapshot) => string | number | null,
  formatValue: (value: string | number) => string,
) {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    const snapshot = readBookingMatchingPolicySnapshot(booking);
    if (!snapshot) {
      continue;
    }
    const value = readValue(snapshot);
    if (value === null || value === undefined) {
      continue;
    }
    const label = formatValue(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const entries = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  if (!entries.length) {
    return 'No saved value';
  }
  if (entries.length === 1) {
    return `${entries[0][0]} (${entries[0][1]})`;
  }
  const preview = entries
    .slice(0, 2)
    .map(([label, count]) => `${label} (${count})`)
    .join(', ');
  return entries.length > 2 ? `${preview}, +${entries.length - 2} more` : preview;
}

function bookingPolicySnapshotDrift(booking: AdminBooking, settings: AdminOperationalPolicySetting[]) {
  const snapshot = readBookingMatchingPolicySnapshot(booking);
  if (!snapshot) {
    return [];
  }
  const comparisons = [
    {
      label: 'response window',
      saved: snapshot.providerResponseWindowMinutes,
      live: policyRawValue(settings, 'matching.provider_response_window_minutes'),
    },
    {
      label: 'marketplace radius',
      saved: snapshot.backupProviderRadiusMeters,
      live: policyRawValue(settings, 'matching.backup_provider_radius_meters'),
    },
    {
      label: 'marketplace location freshness',
      saved: snapshot.backupProviderLocationMaxAgeMinutes,
      live: policyRawValue(settings, 'matching.backup_provider_location_max_age_minutes'),
    },
    {
      label: 'marketplace invitation limit',
      saved: snapshot.backupProviderInvitationLimit,
      live: policyRawValue(settings, 'matching.backup_provider_invitation_limit'),
    },
    {
      label: 'accept mode',
      saved: snapshot.preferredAcceptMode,
      live: policyRawValue(settings, 'matching.preferred_accept_mode'),
    },
    {
      label: 'marketplace open mode',
      saved: snapshot.backupOpenMode,
      live: policyRawValue(settings, 'matching.backup_open_mode'),
    },
    {
      label: 'travel buffer',
      saved: snapshot.travelBufferMinutes,
      live: policyRawValue(settings, 'matching.travel_buffer_minutes'),
    },
  ];
  return comparisons.filter((comparison) => {
    if (comparison.saved === null || comparison.saved === undefined) {
      return false;
    }
    return String(comparison.saved) !== String(comparison.live);
  });
}

function bookingWalletLedgerTotal(booking: AdminBooking) {
  return (booking.earning?.walletLedgerEntries ?? []).reduce(
    (total, entry) => total + Number(entry.amount ?? 0),
    0,
  );
}

function readPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
