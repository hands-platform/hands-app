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
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
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
    adminGet<AdminProvider[]>('/admin/providers', []),
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
  const policyDrilldown = buildPolicyDrilldown(bookings, settings);
  const policyAuditRows = operationalPolicyAuditRows(auditLogs);
  const recommendationReview = buildPolicyRecommendationReview(settings, bookings);
  const acceptanceMatrix = buildBookingAcceptanceMatrix(settings, providers);
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
              Current owner choices for the direct booking window, 10km backup participation, partner push
              reach, and negative wallet blocking. This is the screen operators should check before changing
              the mobile flow.
            </p>
          </div>
          <span className={`pill ${acceptanceMatrix.blockingCount ? 'pill-warn' : 'pill-success'}`}>
            {acceptanceMatrix.blockingCount} risk choice(s)
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
            <h2>Policy enforcement trace</h2>
            <p className="muted">
              Shows where each operating decision is enforced today, so operators know whether a policy
              change affects customer matching, partner acceptance, notifications, or finance gates.
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
              These settings are enforced by booking creation, backup partner discovery, and partner join
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
                  Top nearby online partners inside the current backup radius. Stale locations are excluded
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
                    <strong>{row.policy}</strong>
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
                    <strong>{row.label}</strong>
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
            recommendation="For the stable product, customer final confirmation is stronger."
            detail="MVP can keep auto-match for speed, but the long-term flow should let the customer pick from the first-pick partner plus backup partners."
          />
          <DecisionHint
            title="Backup participation"
            recommendation="Keep immediate backup visibility inside the configured backup radius."
            detail="It reduces waiting anxiety, gives the customer alternatives, and fits the reference flow you described."
          />
          <DecisionHint
            title="Negative wallet gate"
            recommendation="Keep hard blocking while wallet balance is negative."
            detail="Cash services create company-fee debt. A hard gate is simpler for operations until partner trust scoring is mature."
          />
          <DecisionHint
            title="Phone OTP"
            recommendation="Keep Vonage deferred until account setup is complete."
            detail="Use internal/demo auth for local development, then turn on phone auth once Vonage credentials and sender rules are ready."
          />
          <DecisionHint
            title="Cancellation after match"
            recommendation="Start with admin review before adding automatic fees."
            detail="This keeps early customer support flexible while HANDS learns real cancellation and partner arrival patterns."
          />
          <DecisionHint
            title="No-show disputes"
            recommendation="Require admin review until evidence upload and dispute screens are mature."
            detail="No-show penalties are sensitive; manual review prevents trust damage in the first operating phase."
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
                    <strong>{option.label}</strong>
                    <p className="muted">{option.tradeoff}</p>
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
    <form action={updateOperationalPolicy} className="card" style={{ margin: 0 }}>
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="valueType" value={valueType} />
      <div className="risk-watch-header">
        <div>
          <h3>{setting.label}</h3>
          <p className="muted">{setting.description}</p>
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
      {setting.options?.length ? (
        <>
          <label className="field">
            <span>Decision</span>
            <select name="value" defaultValue={String(setting.value)}>
              {setting.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="booking-radar" style={{ marginTop: 12 }}>
            {setting.options.map((option) => (
              <div key={option.value} className="insight-card">
                <strong>{option.label}</strong>
                <p className="muted">{option.tradeoff}</p>
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
          placeholder="Example: Increase backup visibility because District 1 wait time is rising."
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
  const freshEligible = eligiblePartners.filter((item) => (item.ageMinutes ?? Infinity) <= 30);
  const partnerRows: PolicySimulatorPartnerRow[] = eligiblePartners.slice(0, 6).map((item) => ({
    id: item.provider.id,
    name: item.provider.displayName ?? item.provider.user?.fullName ?? 'Partner',
    status: (item.ageMinutes ?? Infinity) <= 30 ? 'Fresh' : 'Stale',
    distanceLabel: formatDistance(item.distanceMeters ?? 0),
    locationAgeLabel: formatLocationAge(item.ageMinutes),
    pillClass: (item.ageMinutes ?? Infinity) <= 30 ? 'pill-success' : 'pill-warn',
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
        label: 'Backup radius',
        value: formatDistance(backupRadiusMeters),
        helper: `${eligiblePartners.length} usable partner(s), ${freshEligible.length} fresh location(s).`,
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
          'The selected partner receives the first-pick request. Backup partners are evaluated from current policy and location data.',
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
        title: immediateBackup ? 'Backup list opens immediately' : 'Backup list waits unless declined',
        detail: immediateBackup
          ? `${eligiblePartners.length} partner(s) inside ${formatDistance(backupRadiusMeters)} can see or join while the first partner decides.`
          : `Backup partners are held until the ${responseWindowMinutes} minute first-pick window ends, but open immediately if the first-pick partner declines.`,
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
          ? 'Customers can see backup interest during the first response window.'
          : 'Customers may see an empty waiting screen until the first partner times out, unless that partner declines first.',
        operatorAction: immediateBackup
          ? 'Keep monitoring whether customers understand first-pick vs backup partner choice.'
          : 'Use only if first-pick response rate is high enough to avoid empty waiting.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        status: customerFinalConfirm ? 'Customer controls' : 'Fast lock',
        title: 'Final matching decision',
        detail: customerFinalConfirm
          ? 'Accepted partners still require customer final selection.'
          : 'The first accepted partner can lock the booking faster.',
        operatorAction: customerFinalConfirm
          ? 'This matches the current HANDS direction: customer always chooses the final partner.'
          : 'Use only if HANDS decides faster auto-lock is more important than customer choice.',
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
      label: setting.label,
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
        ? 'Fewer partners can join backup matching, so customer alternatives may look empty.'
        : 'More partners can join, but distance and arrival quality need closer monitoring.',
      operatorAction: `${liveContext} Watch ignored backup alerts and late arrivals by city.`,
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
        ? 'Backup alerts may reach partners whose last known location is no longer reliable.'
        : 'Only recently refreshed partner locations are eligible for backup alerts and joins.',
      operatorAction: `${liveContext} Watch partner app location refresh failures before loosening this.`,
      alignedAction:
        'Freshness is at the 30-minute baseline; this fits the 10-minute periodic location update rule.',
      className: looser ? 'ops-task-pending' : 'ops-task-done',
      pillClass: looser ? 'pill-warn' : 'pill-success',
    };
  }

  if (setting.key === 'matching.preferred_accept_mode') {
    return {
      status: value === 'AUTO_MATCH_ON_ACCEPT' ? 'Fast lock' : 'Customer choice',
      detail:
        value === 'AUTO_MATCH_ON_ACCEPT'
          ? 'Fast lock reduces friction but weakens the customer final-choice flow.'
          : 'Customer final-choice mode adds one step but better matches the HANDS target flow.',
      operatorAction: 'Use customer-confirm mode before scaling backup partner shortlist UX.',
      alignedAction:
        'Customer final-choice posture is aligned with the intended direct + backup matching model.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'matching.backup_open_mode') {
    return {
      status: value === 'IMMEDIATE_WITHIN_WINDOW' ? 'Immediate backup' : 'Delayed backup',
      detail:
        value === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'This reduces empty waiting screens and lets nearby partners show interest early.'
          : 'This protects the first-pick partner window, but backup partners now open immediately when the first-pick partner declines.',
      operatorAction: `${liveContext} If delayed mode is kept, support should watch waiting-screen complaints.`,
      alignedAction:
        'Immediate backup participation supports lower customer anxiety during the first window.',
      className: value === recommended ? 'ops-task-done' : 'ops-task-pending',
      pillClass: value === recommended ? 'pill-success' : 'pill-warn',
    };
  }

  if (setting.key === 'wallet.negative_balance_gate') {
    return {
      status: value === 'BLOCK_ACCEPTS_WHEN_NEGATIVE' ? 'Hard block' : 'Recovery mode',
      detail:
        value === 'BLOCK_ACCEPTS_WHEN_NEGATIVE'
          ? 'Debt risk is contained, but partner recovery requires manual settlement.'
          : 'Recovery mode can help partners repay but increases operational cash-debt risk.',
      operatorAction: 'Keep hard block until cash settlement collection and trust scoring are stronger.',
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
  const backupOpenMode = policyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
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
      detail: `The first selected partner has ${responseWindowMinutes} minute(s) before the request becomes operationally at-risk.`,
      operatorAction: baselineTimer
        ? 'Keep this at 10 minutes until live response-rate data says otherwise.'
        : 'Monitor customer wait complaints and first-pick acceptance rate before keeping this override.',
      className: baselineTimer ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineTimer ? 'pill-success' : 'pill-warn',
      blocking: !baselineTimer,
    },
    {
      title: 'Backup partner pool',
      status: baselineRadius ? '10km default' : 'Custom radius',
      detail: `Backup participation currently uses ${formatDistance(backupRadiusMeters)} from the customer location.`,
      operatorAction: baselineRadius
        ? 'This matches the requested 10km operating rule for nearby backup participation.'
        : 'Review city supply, arrival time, and ignored backup alerts before changing radius.',
      className: baselineRadius ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineRadius ? 'pill-success' : 'pill-warn',
      blocking: !baselineRadius,
    },
    {
      title: 'Backup location freshness',
      status: baselineLocationFreshness ? '30m default' : 'Custom freshness',
      detail: `Backup partners must refresh location within ${backupLocationFreshnessMinutes} minute(s) before alerts or joins.`,
      operatorAction: baselineLocationFreshness
        ? 'This matches the partner app rule that refreshes location every 10 minutes while open.'
        : 'If this is loosened, monitor stale-location joins and partner no-response rates.',
      className: baselineLocationFreshness ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineLocationFreshness ? 'pill-success' : 'pill-warn',
      blocking: !baselineLocationFreshness,
    },
    {
      title: 'Backup visibility timing',
      status: immediateBackup ? 'Visible during wait' : 'Delayed backup',
      detail: immediateBackup
        ? 'Nearby partners can participate while the first-pick partner is still deciding.'
        : 'Backup partners wait until the timer passes, except when the first-pick partner declines.',
      operatorAction: immediateBackup
        ? 'This best matches the customer waiting screen where available backup partners appear early.'
        : 'Use delayed mode only if partner noise is worse than customer waiting anxiety.',
      className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      blocking: !immediateBackup,
    },
    {
      title: 'Customer final selection',
      status: customerFinalChoice ? 'Customer controls' : 'Auto-lock',
      detail: customerFinalChoice
        ? 'Even after partner acceptance, the customer keeps the final partner selection step.'
        : 'The first accepted partner can lock the booking without final customer choice.',
      operatorAction: customerFinalChoice
        ? 'This is the safer long-term rule for a marketplace with backup partner choices.'
        : 'Only use auto-lock if HANDS intentionally prioritizes speed over customer choice.',
      className: customerFinalChoice ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: customerFinalChoice ? 'pill-success' : 'pill-danger',
      blocking: !customerFinalChoice,
    },
    {
      title: 'Partner alert delivery',
      status: pushReady ? 'Push enabled' : 'In-app first',
      detail: pushReady
        ? 'Partner booking and backup participation alerts are ready to route through OneSignal.'
        : 'Booking notifications are recorded in-app until OneSignal production setup is fully ready.',
      operatorAction: pushReady
        ? 'Watch delivery failures and disabled devices on the Notifications board.'
        : 'Keep this until OneSignal/Vonage production credentials and monitoring are complete.',
      className: pushReady ? 'ops-task-done' : 'ops-task-pending',
      pillClass: pushReady ? 'pill-success' : 'pill-info',
      blocking: false,
    },
    {
      title: 'Negative wallet gate',
      status: hardWalletBlock ? 'Hard block' : 'Recovery booking',
      detail: hardWalletBlock
        ? 'Partners with unpaid cash-service fee debt cannot accept new work.'
        : 'Partners with debt may receive one recovery booking, increasing collection risk.',
      operatorAction: hardWalletBlock
        ? 'This protects HANDS cash-fee collection during early operations.'
        : 'Use recovery only after settlement playbooks and trust scoring are mature.',
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
        helper: 'Partner accepts or the request becomes at-risk.',
      },
      {
        label: 'Backup radius',
        value: formatDistance(backupRadiusMeters),
        helper: 'Nearby partners who can participate.',
      },
      {
        label: 'Location freshness',
        value: `${backupLocationFreshnessMinutes} min`,
        helper: 'Backup alerts exclude older partner locations.',
      },
      {
        label: 'Backup timing',
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

function buildPolicyEnforcementTrace(settings: AdminOperationalPolicySetting[]) {
  const responseWindowMinutes =
    policyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters = policyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, 'matching.backup_provider_location_max_age_minutes') ?? 30;
  const backupOpenMode = policyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
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
      verify: 'Verify with a new booking, then open the booking detail timeline and matching policy snapshot.',
    },
    {
      scope: 'Backup join',
      title: `${formatDistance(backupRadiusMeters)} backup radius`,
      detail:
        'Backup partners are filtered by customer distance before they can see, join, or receive backup availability alerts.',
      verify: 'Verify from Operations Policy simulator and Partner Risk location freshness signals.',
    },
    {
      scope: 'Location gate',
      title: `${backupLocationFreshnessMinutes} minute location freshness`,
      detail:
        'Partners with stale or missing last location are excluded from backup participation and shown as dispatch risk.',
      verify: 'Verify by opening App Sessions and Partner Risk after a partner app sends or misses a location heartbeat.',
    },
    {
      scope: 'Customer choice',
      title:
        preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'
          ? 'Customer keeps final partner selection'
          : 'Partner acceptance can auto-lock',
      detail:
        'This controls whether accepting the preferred partner immediately matches the booking or returns control to the customer.',
      verify: 'Verify by creating a direct booking, accepting in the partner app, then checking the customer waiting screen.',
    },
    {
      scope: 'Backup timing',
      title:
        backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'Backup partners can join during the wait'
          : 'Backup partners wait until timer or decline',
      detail:
        'This controls whether backup partners can participate during the first-pick response window.',
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
      verify: 'Verify from Cash Settlements, Partner Risk, and a blocked accept attempt in the partner app.',
    },
  ];
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
  const accountRisk = providers.filter((provider) => partnerAccountRisk(provider));
  const softRecovery = providers.filter(
    (provider) => !partnerCanAcceptUnderCurrentPolicy(provider, policy) && !partnerHardBlocked(provider, policy),
  );

  return [
    {
      label: 'Can accept now',
      value: readyPartners.length.toString(),
      helper: `${onlinePartners.length} online partner(s), filtered by identity, bank, wallet, location, push, and risk gates.`,
    },
    {
      label: 'Hard blocked',
      value: providers.filter((provider) => partnerHardBlocked(provider, policy)).length.toString(),
      helper: 'Account risk, identity failure, missing approved bank, or negative wallet under the current wallet policy.',
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
      helper: `Missing or older than ${policy.backupLocationFreshnessMinutes} minute(s), so 10km backup matching should not trust it.`,
    },
    {
      label: 'Push gap',
      value: pushGaps.length.toString(),
      helper: 'Partner may not receive first-pick or backup participation alerts.',
    },
    {
      label: 'Account risk',
      value: accountRisk.length.toString(),
      helper: 'Blocked account, active sanction, blocked device, suspicious session, or shared device signal.',
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

function partnerHardBlocked(
  provider: AdminProvider,
  policy: { hardWalletBlock: boolean },
) {
  return (
    partnerAccountRisk(provider) ||
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

function partnerAccountRisk(provider: AdminProvider) {
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
  const openMatchingWithSnapshot = openMatching.filter((booking) => readBookingMatchingPolicySnapshot(booking));
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
        helper: 'Existing open bookings keep their saved policy snapshot; new bookings use the current live policy.',
      },
      {
        label: 'Active dispatch',
        value: String(activeDispatch.length),
        helper: 'Matched or in-service bookings should be handled by their saved booking state.',
      },
      {
        label: 'Policy drift',
        value: String(snapshotDrift.length),
        helper: 'Expected when Admin policy changed after a booking opened; use booking detail before manual action.',
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
        policy: 'Backup partner radius',
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
        policy: 'Backup location freshness',
        scope: 'Partner eligibility',
        liveValue: policyDisplayByKey(settings, 'matching.backup_provider_location_max_age_minutes'),
        savedValue: summarizeSnapshotValues(
          bookings,
          (snapshot) => snapshot.backupProviderLocationMaxAgeMinutes,
          (value) => `${value} min`,
        ),
        operatorMeaning:
          'Controls whether stale partner locations are excluded from backup alerts and join attempts.',
      },
      {
        policy: 'Partner accept mode',
        scope: 'Final matching',
        liveValue: policyDisplayByKey(settings, 'matching.preferred_accept_mode'),
        savedValue: summarizeSnapshotValues(bookings, (snapshot) => snapshot.preferredAcceptMode, (value) =>
          formatSnapshotPolicyValue(settings, 'matching.preferred_accept_mode', value),
        ),
        operatorMeaning:
          'Explains whether an accepted first-pick partner locks automatically or still waits for customer confirmation.',
      },
      {
        policy: 'Backup opening mode',
        scope: 'Backup visibility',
        liveValue: policyDisplayByKey(settings, 'matching.backup_open_mode'),
        savedValue: summarizeSnapshotValues(bookings, (snapshot) => snapshot.backupOpenMode, (value) =>
          formatSnapshotPolicyValue(settings, 'matching.backup_open_mode', value),
        ),
        operatorMeaning:
          'Explains whether backup partners were allowed to join during the first-pick response window.',
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
          ? 'Backup partners can join during the first window'
          : 'Backup partners wait until the first window closes',
        detail: immediateBackup
          ? 'Eligible partners inside the radius can appear while the first-pick partner is still deciding.'
          : 'Backup visibility and join checks stay delayed until the first-pick response window passes.',
        operatorAction: customerConfirm
          ? 'Customer confirmation mode is active, so accepted partners still require customer final choice.'
          : 'Auto-match mode is active, so accepted first-pick partners can lock faster.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        scope: 'Partner risk',
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
          'Bookings created after this change keep response window, backup radius, accept mode, backup-open mode, and travel buffer in metadata.',
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
            label: booking.expiresAt ? `expires ${relativeTime(booking.expiresAt)}` : 'no expiry',
            className: 'pill-info',
          },
        ],
        operatorAction:
          'Review this booking before changing response-window, backup-radius, or backup-open policy.',
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
      helper: 'Bookings currently waiting for first-pick and backup partner decisions.',
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

function operationsOwnerDecisionBacklog() {
  return [
    {
      owner: 'Dispatch',
      title: 'First-pick partner timer',
      question:
        'Should the first-pick partner keep the full response window, or should backup partners become more prominent earlier?',
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
            'Shows backup partners sooner and reduces waiting anxiety, but the first-pick partner has less exclusive time.',
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
      title: 'Backup partner radius',
      question:
        'Should HANDS keep one nationwide default radius, or vary radius by city density and service type?',
      signal:
        'Review partner count within radius, average distance, late arrivals, and ignored backup alerts by city.',
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
        'Start with a single 10km radius, then add city/service overrides after Ho Chi Minh City data is stable.',
      decisionTrigger:
        'Revisit when backup alerts are ignored often, or accepted backup partners are repeatedly too far away.',
      href: '/operations-policy',
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
        'Keep hard blocking until finance has a reliable settlement workflow and partner trust scoring.',
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
          tradeoff:
            'Faster and more consistent, but mistakes can quickly damage customer and partner trust.',
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
        'What evidence should be required before no-show penalties or customer fee decisions are automated?',
      signal:
        'Review chat, arrival timestamp, location proof, customer response, and dispute rate before auto no-show.',
      options: [
        {
          label: 'Manual evidence review',
          tradeoff:
            'Safer for launch and disputes, but slower for partner compensation and customer closeout.',
        },
        {
          label: 'Evidence-based automation',
          tradeoff:
            'Scales support decisions, but requires reliable location, chat, and timestamp capture.',
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
        'When should urgent booking alerts move from in-app only to mandatory OneSignal push delivery?',
      signal:
        'Review delivery failure rate, disabled devices, missed requests, and production push credential readiness.',
      options: [
        {
          label: 'In-app first',
          tradeoff:
            'Lowest setup risk and easiest local testing, but partners may miss requests when the app is closed.',
        },
        {
          label: 'OneSignal required',
          tradeoff:
            'Better booking reach and urgency, but depends on production credentials and delivery monitoring.',
        },
      ],
      recommendation:
        'Keep in-app first locally, then enable OneSignal once production credentials and failure dashboards are ready.',
      decisionTrigger:
        'Revisit immediately after OneSignal production setup is complete and device delivery logs are visible.',
      href: '/notifications',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    },
  ];
}

function buildMatchingPlaybook(settings: AdminOperationalPolicySetting[]) {
  const responseWindow = policyDisplayByKey(settings, 'matching.provider_response_window_minutes');
  const backupRadius = policyDisplayByKey(settings, 'matching.backup_provider_radius_meters');
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
      title: 'Backup partners can participate by policy',
      detail: `Partners inside ${backupRadius} can see or join the backup lane according to "${backupOpenMode}".`,
      className: 'timeline-active',
      tags: [
        { label: backupRadius, tone: 'pill-info' },
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
      title: 'Wallet and risk gates protect operations',
      detail: `Negative cash-fee debt follows "${walletGate}". Risk holds, account blocks, and stale location should be reviewed before partner dispatch.`,
      className: walletGate.includes('Block') ? 'timeline-active' : 'timeline-done',
      tags: [
        { label: walletGate, tone: walletGate.includes('Block') ? 'pill-danger' : 'pill-warn' },
        { label: 'Partner Risk', tone: 'pill-info' },
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
  return setting?.options?.find((option) => option.value === stringValue)?.label ?? formatPolicyValue(value, setting?.unit);
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
  return (
    setting.options?.find((option) => option.value === value)?.label ?? formatPolicyValue(value, setting.unit)
  );
}

function policyImpactDetails(key: string) {
  const details: Record<string, { area: string; title: string; detail: string }> = {
    'matching.provider_response_window_minutes': {
      area: 'Booking timer',
      title: 'Affects new booking expiry windows',
      detail:
        'New requests use this value for the first-pick partner response timer and Redis matching TTL. Existing open bookings keep their saved expiry.',
    },
    'matching.backup_provider_radius_meters': {
      area: 'Partner supply',
      title: 'Controls who can see and join backup requests',
      detail:
        'Partner open-booking lists, join validation, backup notifications, and customer shortlist visibility use this radius.',
    },
    'matching.travel_buffer_minutes': {
      area: 'Availability',
      title: 'Controls partner availability after work',
      detail:
        'Nearby sorting and availability calculations use this buffer before a partner becomes eligible for another booking.',
    },
    'matching.preferred_accept_mode': {
      area: 'Customer choice',
      title: 'Controls whether acceptance locks the booking',
      detail:
        'Auto-match is faster. Customer confirmation keeps the booking open after partner accept so the customer can make the final choice.',
    },
    'matching.backup_open_mode': {
      area: 'Backup flow',
      title: 'Controls when other partners can participate',
      detail:
        'Immediate mode notifies eligible partners right away. Delayed mode hides and blocks backup join until the first-pick response window passes, but opens immediately after first-pick decline.',
    },
    'wallet.negative_balance_gate': {
      area: 'Wallet risk',
      title: 'Controls unpaid cash-fee debt enforcement',
      detail:
        'Block mode stops partners with negative cash-fee debt from accepting new work. Recovery mode permits one active booking so they can earn toward repayment.',
    },
    'cancellation.after_match_policy': {
      area: 'Cancellation money',
      title: 'Controls payment handling after partner commitment',
      detail:
        'Admin-review mode releases normal early cancellations. Auto-fee mode keeps matched cancellation payment holds for operator review.',
    },
    'no_show.partner_report_policy': {
      area: 'No-show review',
      title: 'Controls no-show evidence and payment review posture',
      detail:
        'Admin-review mode keeps penalties manual. Evidence mode marks the policy in notes and audit logs for faster future automation.',
    },
    'notification.partner_alert_channel': {
      area: 'Alert routing',
      title: 'Controls partner booking alert delivery provider',
      detail:
        'In-app mode records inbox notifications only. OneSignal mode routes partner booking alerts through OS push delivery and logs provider results.',
    },
  };

  return (
    details[key] ?? {
      area: 'Operations',
      title: 'Operational policy',
      detail: 'This setting is tracked for auditability and future automation.',
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
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(
      policy.backupProviderLocationMaxAgeMinutes,
    ),
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
      label: 'backup radius',
      saved: snapshot.backupProviderRadiusMeters,
      live: policyRawValue(settings, 'matching.backup_provider_radius_meters'),
    },
    {
      label: 'backup location freshness',
      saved: snapshot.backupProviderLocationMaxAgeMinutes,
      live: policyRawValue(settings, 'matching.backup_provider_location_max_age_minutes'),
    },
    {
      label: 'accept mode',
      saved: snapshot.preferredAcceptMode,
      live: policyRawValue(settings, 'matching.preferred_accept_mode'),
    },
    {
      label: 'backup open mode',
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
