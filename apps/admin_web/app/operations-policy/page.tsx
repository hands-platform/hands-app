import { AdminOperationalPolicySetting, adminGet } from '../../lib/admin-api';
import { updateOperationalPolicy } from './actions';

type OperationsPolicySearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsPolicyPage({
  searchParams,
}: {
  searchParams?: OperationsPolicySearchParams;
}) {
  const params = (await searchParams) ?? {};
  const settings = await adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []);
  const matchingSettings = settings.filter((setting) => setting.category === 'Matching');
  const decisionSettings = settings.filter((setting) => setting.category === 'Decision');
  const savedCount = settings.filter((setting) => setting.updatedAt).length;
  const notice = policyNotice(params);

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
            recommendation="Keep immediate backup visibility inside 10km."
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
            min={isNumber ? setting.min ?? undefined : undefined}
            max={isNumber ? setting.max ?? undefined : undefined}
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
  return setting.options?.find((option) => option.value === value)?.label ?? formatPolicyValue(value, setting.unit);
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
