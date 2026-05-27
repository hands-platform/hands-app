import { AdminBooking, AdminOperationalPolicySetting, adminGet } from '../../lib/admin-api';
import { updateOperationalPolicy } from './actions';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [settings, bookings] = await Promise.all([
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminBooking[]>('/admin/bookings', []),
  ]);
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = policyNotice(params);
  const ownerDecisionBacklog = operationsOwnerDecisionBacklog();
  const matchingPlaybook = buildMatchingPlaybook(settings);
  const impactDashboard = buildPolicyImpactDashboard(settings, bookings);

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
            title="Preferred partner acceptance"
            recommendation="For the stable product, customer final confirmation is stronger."
            detail="MVP can keep auto-match for speed, but the long-term flow should let the customer pick from the preferred partner plus backup partners."
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

function buildPolicyImpactDashboard(settings: AdminOperationalPolicySetting[], bookings: AdminBooking[]) {
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const activeDispatch = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const negativeCashDebtBookings = bookings.filter((booking) => bookingWalletLedgerTotal(booking) < 0);
  const snapshotDrift = bookings.filter(
    (booking) => bookingPolicySnapshotDrift(booking, settings).length > 0,
  );
  const withoutSnapshot = bookings.filter((booking) => !readBookingMatchingPolicySnapshot(booking));
  const immediateBackup = policyRawValue(settings, 'matching.backup_open_mode') === 'IMMEDIATE_WITHIN_WINDOW';
  const customerConfirm =
    policyRawValue(settings, 'matching.preferred_accept_mode') === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

  return {
    metrics: [
      {
        label: 'Open matching now',
        value: String(openMatching.length),
        helper: 'These bookings may feel radius, backup-open, and partner alert changes immediately.',
      },
      {
        label: 'Active dispatch',
        value: String(activeDispatch.length),
        helper: 'Matched or in-service bookings should be handled by their saved booking state.',
      },
      {
        label: 'Policy drift',
        value: String(snapshotDrift.length),
        helper: 'Bookings whose saved matching snapshot differs from current Admin policy.',
      },
      {
        label: 'Legacy bookings',
        value: String(withoutSnapshot.length),
        helper: 'Older bookings without metadata fall back to live policy explanations.',
      },
    ],
    cards: [
      {
        scope: 'New bookings',
        title: 'Response timer changes are forward-only',
        detail:
          'Changing the preferred partner response window affects new booking expiry and Redis TTL. Existing bookings keep their saved expiresAt value.',
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
          ? 'Eligible partners inside the radius can appear while the preferred partner is still deciding.'
          : 'Backup visibility and join checks stay delayed until the preferred response window passes.',
        operatorAction: customerConfirm
          ? 'Customer confirmation mode is active, so accepted partners still require customer final choice.'
          : 'Auto-match mode is active, so accepted preferred partners can lock faster.',
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

function operationsOwnerDecisionBacklog() {
  return [
    {
      owner: 'Dispatch',
      title: 'Preferred partner timer',
      question:
        'Should the first-picked partner keep the full response window, or should backup partners become more prominent earlier?',
      signal:
        'Review open matching wait time, first-pick response rate, and customer cancellation before changing the timer.',
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
      title: 'Customer picks one preferred partner',
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
      title: 'Preferred partner response window starts',
      detail: `The first-picked partner has ${responseWindow} to accept. Existing open bookings keep their saved expiry time.`,
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
        'New requests use this value for the preferred partner response timer and Redis matching TTL. Existing open bookings keep their saved expiry.',
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
        'Immediate mode notifies eligible partners right away. Delayed mode hides and blocks backup join until the preferred response window has passed.',
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

function readBookingMatchingPolicySnapshot(booking: AdminBooking) {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy.backupProviderRadiusMeters),
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
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
