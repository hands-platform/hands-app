import Link from 'next/link';
import { AdminAuditLog, AdminEarning, AdminTaxPolicyVersion, AdminTaxRule, adminGet } from '../../lib/admin-api';
import { formatDateTime, formatMoney } from '../../lib/admin-format';
import { createTaxPolicyVersion, createTaxRule, updateTaxPolicyVersion, updateTaxRule } from './actions';
import { buildTaxPolicyAuditSummary } from './tax-policy-audit-summary';
import { buildTaxPolicySnapshotConsistency } from './tax-policy-snapshot-consistency';
import { taxPolicyNotice } from './tax-policy-notice';

const statusOptions = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
const scopeOptions = ['DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND'];
const TAX_POLICY_VERSION_PAGE_SIZE = 20;
const TAX_POLICY_AUDIT_LOG_PAGE_SIZE = 8;
const TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE = 8;

type TaxPolicyPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TaxPolicyPage({ searchParams }: { searchParams?: TaxPolicyPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const [policies, auditLogs, recentEarnings] = await Promise.all([
    adminGet<AdminTaxPolicyVersion[]>(`/admin/tax-policy-versions?take=${TAX_POLICY_VERSION_PAGE_SIZE}`, []),
    adminGet<AdminAuditLog[]>(`/admin/audit-logs?q=tax_&take=${TAX_POLICY_AUDIT_LOG_PAGE_SIZE}`, []),
    adminGet<AdminEarning[]>(
      `/admin/earnings?range=30d&take=${TAX_POLICY_EARNING_SAMPLE_PAGE_SIZE}`,
      [],
    ),
  ]);
  const activePolicies = policies.filter((policy) => policy.status === 'ACTIVE');
  const ruleCount = policies.reduce((sum, policy) => sum + (policy.rules?.length ?? 0), 0);
  const healthItems = buildTaxPolicyHealth(policies);
  const preview = buildTaxPreview(policies, params);
  const notice = taxPolicyNotice(params);
  const auditSummary = buildTaxPolicyAuditSummary(auditLogs);
  const snapshotConsistency = buildTaxPolicySnapshotConsistency(recentEarnings);

  return (
    <div className="tax-policy-page">
      <section className="toolbar">
        <div>
          <h1>Tax policy</h1>
          <p className="muted">
            Versioned withholding rules for Vietnam freelance partners. Rates are configured here, not in
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

      {notice ? (
        <section
          className={`card admin-mb-16 admin-notice-card ${
            notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'
          }`}
        >
          <div className="ops-section-header">
            <div>
              <h2>{notice.title}</h2>
              <p className="muted">{notice.detail}</p>
            </div>
            <span className={`pill ${notice.tone === 'success' ? 'pill-success' : 'pill-danger'}`}>
              {notice.badge}
            </span>
          </div>
        </section>
      ) : null}

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Policy checklist</h2>
            <p className="muted">
              Keep exactly one active policy with a default rule. Every earning stores the selected rule
              snapshot, so changing future policy does not rewrite tax history.
            </p>
          </div>
          <span className={`pill ${healthItems.every((item) => item.ok) ? 'pill-success' : 'pill-warn'}`}>
            {healthItems.every((item) => item.ok) ? 'Configured' : 'Needs review'}
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

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Withholding preview</h2>
            <p className="muted">
              Check the active rule result before changing partner payout or service pricing. This is only a
              calculation preview; completed earnings still store their own immutable rule snapshot.
            </p>
          </div>
          <span className={`pill ${preview.policy ? 'pill-success' : 'pill-warn'}`}>
            {preview.policy ? preview.policy.name : 'No effective active policy'}
          </span>
        </div>
        <form className="form-grid" method="get">
          <label>
            Service type
            <input name="serviceType" defaultValue={preview.serviceType} placeholder="leg_massage" />
          </label>
          <label>
            Gross amount
            <input
              name="grossAmount"
              type="number"
              min="0"
              step="100000"
              defaultValue={preview.grossAmount}
            />
          </label>
          <button type="submit">Preview withholding</button>
        </form>
        <div className="setup-stage-list admin-mt-12">
          <div className="setup-stage-item">
            <span>{preview.policy ? 'POLICY' : 'MISSING'}</span>
            <div>
              <strong>{preview.policy?.name ?? 'No active policy available now'}</strong>
              <p className="muted">
                {preview.policy
                  ? `Effective from ${formatDateTime(preview.policy.effectiveFrom, 'No date')}`
                  : 'Create or activate one policy before partner earnings are settled.'}
              </p>
            </div>
            <small>{preview.policy?.status ?? 'NONE'}</small>
          </div>
          <div className="setup-stage-item">
            <span>{preview.rule ? 'RULE' : 'FALLBACK'}</span>
            <div>
              <strong>{preview.rule ? taxRuleLabel(preview.rule) : 'No matching active rule'}</strong>
              <p className="muted">
                {preview.rule
                  ? `${formatBps(preview.rule.rateBps)} plus ${formatMoney(preview.rule.fixedAmount, 'VND', '0 VND')} fixed amount.`
                  : 'Withholding preview returns 0 until a matching default/service/amount-band rule exists.'}
              </p>
            </div>
            <small>{preview.rule?.id.slice(0, 8) ?? '-'}</small>
          </div>
          <div className="setup-stage-item">
            <span>TAX</span>
            <div>
              <strong>{formatMoney(preview.withholdingAmount)} withholding</strong>
              <p className="muted">
                Gross {formatMoney(preview.grossAmount)} / service type {preview.serviceType || 'not set'}.
              </p>
            </div>
            <small>{formatBps(preview.rule?.rateBps ?? 0)}</small>
          </div>
        </div>
      </section>

      <section className="card admin-mb-16">
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

      <section className="grid tax-policy-version-grid">
        {policies.map((policy) => (
          <article className="card" key={policy.id}>
            <div className="toolbar admin-mb-12">
              <div>
                <h2>{policy.name}</h2>
                <p className="muted">
                  {formatDateTime(policy.effectiveFrom, 'No date')}
                  {policy.effectiveTo ? ` - ${formatDateTime(policy.effectiveTo, 'No date')}` : ''}
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
            <p className="muted admin-mb-12">
              DEFAULT is the fallback. SERVICE_TYPE requires a service type. AMOUNT_BAND requires min or
              max amount, and min cannot be greater than max.
            </p>
            <div className="setup-stage-list admin-mb-12">
              {(policy.rules ?? []).map((rule) => (
                <div className="setup-stage-item" key={rule.id}>
                  <span>{rule.active ? 'ON' : 'OFF'}</span>
                  <div>
                    <strong>
                      {rule.scope}
                      {rule.serviceType ? ` / ${rule.serviceType}` : ''}
                    </strong>
                    <p className="muted">
                      {formatBps(rule.rateBps)}
                      {rule.fixedAmount ? ` + ${formatMoney(rule.fixedAmount)}` : ''}
                      {rule.scope === 'AMOUNT_BAND'
                        ? ` / ${formatMoney(rule.minGrossAmount ?? 0)}-${rule.maxGrossAmount ? formatMoney(rule.maxGrossAmount) : 'no max'}`
                        : ''}
                    </p>
                    <form action={updateTaxRule} className="form-grid compact-form">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <label>
                        Scope
                        <select name="scope" defaultValue={rule.scope}>
                          {scopeOptions.map((scope) => (
                            <option key={scope} value={scope}>
                              {scope}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Service type
                        <input name="serviceType" defaultValue={rule.serviceType ?? ''} />
                      </label>
                      <label>
                        Min amount
                        <input
                          name="minGrossAmount"
                          type="number"
                          min="0"
                          defaultValue={rule.minGrossAmount ?? ''}
                        />
                      </label>
                      <label>
                        Max amount
                        <input
                          name="maxGrossAmount"
                          type="number"
                          min="0"
                          defaultValue={rule.maxGrossAmount ?? ''}
                        />
                      </label>
                      <label>
                        Rate bps
                        <input name="rateBps" type="number" min="0" max="10000" defaultValue={rule.rateBps} />
                      </label>
                      <label>
                        Fixed amount
                        <input name="fixedAmount" type="number" min="0" defaultValue={rule.fixedAmount} />
                      </label>
                      <label>
                        Active
                        <input name="active" type="checkbox" defaultChecked={rule.active} />
                      </label>
                      <button type="submit">Update rule</button>
                    </form>
                  </div>
                  <small>{rule.id.slice(0, 8)}</small>
                </div>
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

      <section className="card admin-mt-16">
        <div className="ops-section-header">
          <div>
            <h2>Tax policy audit summary</h2>
            <p className="muted">
              Recent policy and rule changes. Use the full audit log only when an operator needs deeper
              evidence.
            </p>
          </div>
          <div className="actions">
            <span className="pill pill-info">{auditSummary.totalChangeCount} recent</span>
            <span className="pill pill-neutral">{auditSummary.policyChangeCount} policy</span>
            <span className="pill pill-neutral">{auditSummary.ruleChangeCount} rule</span>
          </div>
        </div>
        <div className="setup-stage-list">
          {auditSummary.rows.map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span className={`pill ${row.toneClassName}`}>{row.actionLabel.split(' ')[0].toUpperCase()}</span>
              <div>
                <strong>{row.actionLabel}</strong>
                <p className="muted">
                  {row.detail} / {row.actorLabel} / {formatDateTime(row.createdAt, 'Unknown time')}
                </p>
              </div>
              <small>{row.targetLabel}</small>
            </div>
          ))}
          {auditSummary.rows.length === 0 ? (
            <div className="setup-stage-item">
              <span>EMPTY</span>
              <div>
                <strong>No recent tax policy audit entries</strong>
                <p className="muted">Create or update a policy/rule to populate this operator summary.</p>
              </div>
              <small>-</small>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card admin-mt-16">
        <div className="ops-section-header">
          <div>
            <h2>Settlement snapshot consistency</h2>
            <p className="muted">
              Recent 30-day earning sample. This does not recalculate tax; it checks whether immutable
              earning withholding and retained tax log snapshots still line up.
            </p>
          </div>
          <div className="actions">
            <span className="pill pill-info">{snapshotConsistency.sampleCount} sampled</span>
            <span className="pill pill-success">{snapshotConsistency.consistentCount} aligned</span>
            <span className={snapshotConsistency.warningCount ? 'pill pill-warn' : 'pill pill-neutral'}>
              {snapshotConsistency.warningCount} check
            </span>
          </div>
        </div>
        <div className="setup-stage-list">
          {snapshotConsistency.rows.map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span className={`pill ${row.toneClassName}`}>{row.statusLabel}</span>
              <div>
                <strong>
                  <Link className="text-link" href={row.bookingHref}>
                    {row.bookingLabel}
                  </Link>{' '}
                  / {row.providerLabel}
                </strong>
                <p className="muted">
                  Gross {row.grossAmountLabel} / earning tax {row.earningTaxLabel} / tax log{' '}
                  {row.taxLogLabel} / delta {row.deltaLabel}
                </p>
                <div className="actions admin-mt-8">
                  <Link className="text-link" href={row.earningHref}>
                    Open earning
                  </Link>
                  <Link className="text-link" href={row.financeTraceHref}>
                    Finance trace
                  </Link>
                </div>
              </div>
              <small>{row.snapshotLabel}</small>
            </div>
          ))}
          {snapshotConsistency.rows.length === 0 ? (
            <div className="setup-stage-item">
              <span>EMPTY</span>
              <div>
                <strong>No recent earning tax snapshots</strong>
                <p className="muted">Completed earnings will appear here after the API returns recent rows.</p>
              </div>
              <small>30d</small>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
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
  const activeDefaultRuleCount = activePolicies.reduce(
    (sum, policy) =>
      sum + (policy.rules ?? []).filter((rule) => rule.active && rule.scope === 'DEFAULT').length,
    0,
  );
  const activeWithoutRules = activePolicies.filter((policy) => (policy.rules ?? []).length === 0);
  const futurePolicies = policies.filter(
    (policy) => new Date(policy.effectiveFrom).getTime() > Date.now() && policy.status !== 'ARCHIVED',
  );
  const activeRules = activePolicies.flatMap((policy) =>
    (policy.rules ?? []).filter((rule) => rule.active).map((rule) => ({ ...rule, policyName: policy.name })),
  );
  const amountBandRules = activeRules.filter((rule) => rule.scope === 'AMOUNT_BAND');
  const duplicateServiceTypeRules = duplicateActiveServiceTypeRules(activePolicies);
  const overlappingAmountBands = overlappingActiveAmountBands(activePolicies);

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
      ok: activePolicies.length === 1 && activeDefaultRuleCount === 1,
      value: `${activeDefaultRuleCount} default`,
      detail:
        activePolicies.length === 1 && activeDefaultRuleCount === 1
          ? 'The active policy has a fallback DEFAULT rule.'
          : 'Keep exactly one active DEFAULT rule on the active policy so every service can be calculated predictably.',
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
    {
      label: 'No duplicate service rules',
      ok: duplicateServiceTypeRules.length === 0,
      value: duplicateServiceTypeRules.length ? `${duplicateServiceTypeRules.length} duplicate` : 'clear',
      detail:
        duplicateServiceTypeRules.length === 0
          ? 'Each active service-type rule is unique inside its policy.'
          : `Resolve duplicate active service-type rules: ${duplicateServiceTypeRules.slice(0, 3).join(', ')}.`,
    },
    {
      label: 'No overlapping amount bands',
      ok: overlappingAmountBands.length === 0,
      value: overlappingAmountBands.length ? `${overlappingAmountBands.length} overlap` : 'clear',
      detail:
        overlappingAmountBands.length === 0
          ? 'Active amount-band rules do not overlap inside the active policy.'
          : `Review overlapping amount bands: ${overlappingAmountBands.slice(0, 3).join(', ')}.`,
    },
  ];
}

function duplicateActiveServiceTypeRules(policies: AdminTaxPolicyVersion[]) {
  return policies.flatMap((policy) => {
    const counts = new Map<string, number>();
    for (const rule of policy.rules ?? []) {
      if (policy.status !== 'ACTIVE' || !rule.active || rule.scope !== 'SERVICE_TYPE' || !rule.serviceType) {
        continue;
      }
      const key = rule.serviceType.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([serviceType]) => `${policy.name}/${serviceType}`);
  });
}

function overlappingActiveAmountBands(policies: AdminTaxPolicyVersion[]) {
  return policies.flatMap((policy) => {
    if (policy.status !== 'ACTIVE') {
      return [];
    }
    const bands = (policy.rules ?? [])
      .filter((rule) => rule.active && rule.scope === 'AMOUNT_BAND')
      .sort((left, right) => (left.minGrossAmount ?? 0) - (right.minGrossAmount ?? 0));
    const overlaps: string[] = [];
    for (let index = 0; index < bands.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < bands.length; nextIndex += 1) {
        if (amountBandsOverlap(bands[index], bands[nextIndex])) {
          overlaps.push(`${policy.name}/${formatBand(bands[index])} vs ${formatBand(bands[nextIndex])}`);
        }
      }
    }
    return overlaps;
  });
}

function buildTaxPreview(
  policies: AdminTaxPolicyVersion[],
  params: Record<string, string | string[] | undefined>,
) {
  const serviceType = readSearchParam(params, 'serviceType') || 'leg_massage';
  const grossAmount = parsePositiveInteger(readSearchParam(params, 'grossAmount')) ?? 500000;
  const policy = selectEffectiveActiveTaxPolicy(policies);
  const rule = selectTaxRule(policy?.rules ?? [], {
    grossAmount,
    serviceTypes: serviceType ? [serviceType] : [],
  });
  const withholdingAmount = policy && rule ? cappedBpsAmount(grossAmount, rule.rateBps, rule.fixedAmount) : 0;

  return {
    serviceType,
    grossAmount,
    policy,
    rule,
    withholdingAmount,
  };
}

function selectEffectiveActiveTaxPolicy(policies: AdminTaxPolicyVersion[]) {
  const now = Date.now();
  return policies
    .filter((policy) => {
      if (policy.status !== 'ACTIVE') {
        return false;
      }
      const startsAt = new Date(policy.effectiveFrom).getTime();
      const endsAt = policy.effectiveTo ? new Date(policy.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
      return startsAt <= now && endsAt >= now;
    })
    .sort(
      (left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime(),
    )[0];
}

function selectTaxRule(
  rules: AdminTaxRule[],
  input: {
    grossAmount: number;
    serviceTypes: string[];
  },
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const prioritized = [...rules]
    .filter((rule) => rule.active)
    .sort(
      (left, right) =>
        taxRulePriority(right, serviceTypes, input.grossAmount) -
        taxRulePriority(left, serviceTypes, input.grossAmount),
    );
  return prioritized.find((rule) => taxRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null;
}

function taxRulePriority(rule: AdminTaxRule, serviceTypes: Set<string>, grossAmount: number) {
  if (rule.scope === 'SERVICE_TYPE') {
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase()) ? 30 : 0;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    const aboveMin = rule.minGrossAmount == null || grossAmount >= rule.minGrossAmount;
    const belowMax = rule.maxGrossAmount == null || grossAmount <= rule.maxGrossAmount;
    return aboveMin && belowMax ? 20 : 0;
  }
  if (rule.scope === 'DEFAULT') {
    return 10;
  }
  return 0;
}

function taxRuleLabel(rule: AdminTaxRule) {
  if (rule.scope === 'SERVICE_TYPE') {
    return `Service type / ${rule.serviceType ?? 'missing service key'}`;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    return `Amount band / ${formatBand(rule)}`;
  }
  return 'Default withholding rule';
}

function readSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value?: string) {
  if (!value) {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function amountBandsOverlap(left: AdminTaxRule, right: AdminTaxRule) {
  const leftMin = left.minGrossAmount ?? Number.NEGATIVE_INFINITY;
  const leftMax = left.maxGrossAmount ?? Number.POSITIVE_INFINITY;
  const rightMin = right.minGrossAmount ?? Number.NEGATIVE_INFINITY;
  const rightMax = right.maxGrossAmount ?? Number.POSITIVE_INFINITY;
  return leftMin <= rightMax && rightMin <= leftMax;
}

function formatBand(rule: AdminTaxRule) {
  return `${formatMoney(rule.minGrossAmount ?? 0)}-${rule.maxGrossAmount ? formatMoney(rule.maxGrossAmount) : 'no max'}`;
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

function cappedBpsAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  return Math.max(0, Math.min(baseAmount, Math.round((baseAmount * rateBps) / 10000) + fixedAmount));
}
