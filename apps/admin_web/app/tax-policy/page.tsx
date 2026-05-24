import { AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import { createTaxPolicyVersion, createTaxRule, updateTaxPolicyVersion } from './actions';

const statusOptions = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
const scopeOptions = ['DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND'];

export default async function TaxPolicyPage() {
  const policies = await adminGet<AdminTaxPolicyVersion[]>('/admin/tax-policy-versions', []);
  const activePolicies = policies.filter((policy) => policy.status === 'ACTIVE');
  const ruleCount = policies.reduce((sum, policy) => sum + (policy.rules?.length ?? 0), 0);
  const healthItems = buildTaxPolicyHealth(policies);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Tax policy</h1>
          <p className="muted">
            Versioned withholding rules for Vietnam freelance providers. Rates are configured here, not in
            application code.
          </p>
        </div>
        <div className="actions">
          <span className={`signal ${activePolicies.length === 1 ? 'signal-ok' : 'signal-warn'}`}>
            {activePolicies.length} active
          </span>
          <span className="pill pill-info">{ruleCount} rule(s)</span>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Policy health</h2>
            <p className="muted">
              Keep exactly one active policy with a default rule. Every earning stores the selected rule
              snapshot, so changing future policy does not rewrite tax history.
            </p>
          </div>
          <span className={`pill ${healthItems.every((item) => item.ok) ? 'pill-success' : 'pill-warn'}`}>
            {healthItems.every((item) => item.ok) ? 'Healthy' : 'Needs review'}
          </span>
        </div>
        <div className="setup-stage-list">
          {healthItems.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.ok ? 'OK' : 'CHECK'}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.value}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Create policy version</h2>
        <p className="muted">Use basis points for percentage rates. Example: 500 bps = 5%.</p>
        <form action={createTaxPolicyVersion} className="form-grid">
          <label>
            Name
            <input name="name" placeholder="Vietnam freelance withholding 2026" required />
          </label>
          <label>
            Status
            <select name="status" defaultValue="DRAFT">
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Effective from
            <input name="effectiveFrom" type="datetime-local" required />
          </label>
          <label>
            Default rate bps
            <input name="defaultRateBps" type="number" min="0" max="10000" placeholder="500" />
          </label>
          <label className="full-span">
            Notes
            <input name="notes" placeholder="Policy source, approval note, or internal memo" />
          </label>
          <button type="submit">Create policy</button>
        </form>
      </section>

      <section className="grid">
        {policies.map((policy) => (
          <article className="card" key={policy.id}>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <div>
                <h2>{policy.name}</h2>
                <p className="muted">
                  {formatDate(policy.effectiveFrom)}
                  {policy.effectiveTo ? ` - ${formatDate(policy.effectiveTo)}` : ''}
                </p>
              </div>
              <span className={`pill ${policy.status === 'ACTIVE' ? 'pill-success' : 'pill-neutral'}`}>
                {policy.status}
              </span>
            </div>
            {policy.notes ? <p className="muted">{policy.notes}</p> : null}

            <form action={updateTaxPolicyVersion} className="form-grid compact-form">
              <input type="hidden" name="policyId" value={policy.id} />
              <label>
                Status
                <select name="status" defaultValue={policy.status}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Effective from
                <input
                  name="effectiveFrom"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(policy.effectiveFrom)}
                />
              </label>
              <label>
                Effective to
                <input
                  name="effectiveTo"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(policy.effectiveTo)}
                />
              </label>
              <label>
                Notes
                <input name="notes" defaultValue={policy.notes ?? ''} />
              </label>
              <button type="submit">Update policy</button>
            </form>

            <h3>Rules</h3>
            <div className="participant-list" style={{ marginBottom: 12 }}>
              {(policy.rules ?? []).map((rule) => (
                <span key={rule.id} className={`pill ${rule.active ? 'pill-info' : 'pill-neutral'}`}>
                  {rule.scope} {rule.serviceType ? `/${rule.serviceType}` : ''} {formatBps(rule.rateBps)}
                  {rule.fixedAmount ? ` + ${formatCurrency(rule.fixedAmount)} VND` : ''}
                </span>
              ))}
              {(policy.rules ?? []).length === 0 ? <span className="muted">No rules yet.</span> : null}
            </div>

            <form action={createTaxRule} className="form-grid compact-form">
              <input type="hidden" name="policyId" value={policy.id} />
              <label>
                Scope
                <select name="scope" defaultValue="DEFAULT">
                  {scopeOptions.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Service type
                <input name="serviceType" placeholder="optional" />
              </label>
              <label>
                Min amount
                <input name="minGrossAmount" type="number" min="0" placeholder="optional" />
              </label>
              <label>
                Max amount
                <input name="maxGrossAmount" type="number" min="0" placeholder="optional" />
              </label>
              <label>
                Rate bps
                <input name="rateBps" type="number" min="0" max="10000" defaultValue="0" />
              </label>
              <label>
                Fixed amount
                <input name="fixedAmount" type="number" min="0" defaultValue="0" />
              </label>
              <button type="submit">Add rule</button>
            </form>
          </article>
        ))}
      </section>
    </>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'No date';
  }
  return new Date(value).toLocaleString();
}

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 16);
}

function buildTaxPolicyHealth(policies: AdminTaxPolicyVersion[]) {
  const activePolicies = policies.filter((policy) => policy.status === 'ACTIVE');
  const activeWithDefaultRules = activePolicies.filter((policy) =>
    (policy.rules ?? []).some((rule) => rule.active && rule.scope === 'DEFAULT'),
  );
  const activeWithoutRules = activePolicies.filter((policy) => (policy.rules ?? []).length === 0);
  const futurePolicies = policies.filter(
    (policy) => new Date(policy.effectiveFrom).getTime() > Date.now() && policy.status !== 'ARCHIVED',
  );
  const amountBandRules = policies.flatMap((policy) =>
    (policy.rules ?? []).filter((rule) => rule.active && rule.scope === 'AMOUNT_BAND'),
  );

  return [
    {
      label: 'Single active policy',
      ok: activePolicies.length === 1,
      value: `${activePolicies.length} active`,
      detail:
        activePolicies.length === 1
          ? `${activePolicies[0].name} is active.`
          : 'Set one policy to ACTIVE and keep all other policy versions inactive or archived.',
    },
    {
      label: 'Default withholding rule',
      ok: activeWithDefaultRules.length === 1,
      value: `${activeWithDefaultRules.length} default`,
      detail:
        activeWithDefaultRules.length === 1
          ? 'The active policy has a fallback DEFAULT rule.'
          : 'Add one active DEFAULT rule to the active policy so every service can be calculated.',
    },
    {
      label: 'Active policy has rules',
      ok: activeWithoutRules.length === 0 && activePolicies.length > 0,
      value: activeWithoutRules.length ? `${activeWithoutRules.length} empty` : 'rules ready',
      detail:
        activeWithoutRules.length === 0 && activePolicies.length > 0
          ? 'Active policy has at least one rule.'
          : 'An active policy without rules can block earning tax calculation.',
    },
    {
      label: 'Future policy staging',
      ok: futurePolicies.length > 0,
      value: `${futurePolicies.length} staged`,
      detail:
        futurePolicies.length > 0
          ? 'At least one future or draft policy exists for upcoming tax changes.'
          : 'Create future-dated draft policies before Vietnam tax rules change.',
    },
    {
      label: 'Amount band coverage',
      ok: amountBandRules.every(
        (rule) =>
          rule.minGrossAmount !== null ||
          rule.maxGrossAmount !== null ||
          rule.rateBps > 0 ||
          rule.fixedAmount > 0,
      ),
      value: `${amountBandRules.length} band`,
      detail:
        amountBandRules.length === 0
          ? 'No amount-band rules are configured yet. This is fine if default/service-type rules are enough.'
          : 'Amount-band rules should have a min or max boundary and a non-zero rate or fixed amount.',
    },
  ];
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

function formatCurrency(value: number) {
  return value.toLocaleString('vi-VN');
}
