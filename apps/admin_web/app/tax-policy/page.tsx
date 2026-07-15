import type { ReactNode } from 'react';

import { AdminAuditLog, AdminEarning, AdminTaxPolicyVersion, AdminTaxRule, adminGet } from '../../lib/admin-api';
import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminCard, AdminDetailGrid, AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { AdminSignal, StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import { createTaxPolicyVersion, createTaxRule, updateTaxPolicyVersion, updateTaxRule } from './actions';
import { buildTaxPolicyAuditSummary } from './tax-policy-audit-summary';
import { buildTaxPolicySnapshotConsistency } from './tax-policy-snapshot-consistency';
import { taxPolicyNotice } from './tax-policy-notice';
import { buildTaxPolicyDetailsHref, buildTaxPolicyLoadPlan } from './tax-policy-page-model';

const statusOptions = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
const scopeOptions = ['DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND'];
const statusSelectOptions = statusOptions.map((status) => ({ label: status, value: status }));
const scopeSelectOptions = scopeOptions.map((scope) => ({ label: scope, value: scope }));
type TaxPolicyPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type TaxPolicyHealthItem = {
  readonly label: string;
  readonly ok: boolean;
  readonly value: string;
  readonly detail: ReactNode;
};
type TaxPolicyAmountBandOverlap = {
  readonly policyName: string;
  readonly left: AdminTaxRule;
  readonly right: AdminTaxRule;
};

export default async function TaxPolicyPage({ searchParams }: { searchParams?: TaxPolicyPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const loadPlan = buildTaxPolicyLoadPlan(params);
  const [policies, auditLogs, recentEarnings] = await Promise.all([
    adminGet<AdminTaxPolicyVersion[]>(loadPlan.taxPolicyVersionsHref, []),
    loadPlan.auditLogsHref ? adminGet<AdminAuditLog[]>(loadPlan.auditLogsHref, []) : Promise.resolve([]),
    loadPlan.recentEarningsHref
      ? adminGet<AdminEarning[]>(loadPlan.recentEarningsHref, [])
      : Promise.resolve([]),
  ]);
  const activePolicies = policies.filter((policy) => policy.status === 'ACTIVE');
  const ruleCount = policies.reduce((sum, policy) => sum + (policy.rules?.length ?? 0), 0);
  const healthItems = buildTaxPolicyHealth(policies);
  const preview = buildTaxPreview(policies, params);
  const notice = taxPolicyNotice(params);
  const auditSummary = buildTaxPolicyAuditSummary(auditLogs);
  const snapshotConsistency = buildTaxPolicySnapshotConsistency(recentEarnings);

  return (
    <AdminPageTemplate
      actions={
        loadPlan.detailsMode === 'summary' ? (
          <AdminFormControlLink className="button-secondary" href={buildTaxPolicyDetailsHref('all')}>
            Open workspaces
          </AdminFormControlLink>
        ) : (
          <AdminFormControlLink className="button-secondary" href={buildTaxPolicyDetailsHref('summary')}>
            Back to summary
          </AdminFormControlLink>
        )
      }
      contentClassName="tax-policy-page"
      description="Versioned withholding rules for Vietnam freelance partners. Rates are configured here, not in application code."
      title="Tax policy"
    >

      {notice ? (
        <AdminNoticeCard
          className="admin-mb-16"
          role="status"
          tone={notice.tone === 'success' ? 'success' : 'danger'}
        >
          <AdminSectionHeader
            actions={
              <StatusBadgeFromPillClass pillClass={notice.tone === 'success' ? 'pill-success' : 'pill-danger'}>
                {notice.badge}
              </StatusBadgeFromPillClass>
            }
            description={notice.detail}
            title={notice.title}
          />
        </AdminNoticeCard>
      ) : null}

      {loadPlan.shouldRenderSummary ? <AdminSection
        actions={
          <>
            <AdminSignal tone={activePolicies.length === 1 ? 'ok' : 'warn'}>{activePolicies.length} active</AdminSignal>
            <StatusBadge tone="info">{ruleCount} rule(s)</StatusBadge>
            <StatusBadgeFromPillClass pillClass={healthItems.every((item) => item.ok) ? 'pill-success' : 'pill-warn'}>
              {healthItems.every((item) => item.ok) ? 'Configured' : 'Needs review'}
            </StatusBadgeFromPillClass>
          </>
        }
        className="admin-mb-16 tax-policy-checklist-card"
        description="Keep exactly one active policy with a default rule. Every earning stores the selected rule snapshot, so changing future policy does not rewrite tax history."
        title="Policy checklist"
      >
        <AdminStageList>
          {healthItems.map((item) => (
            <AdminStageItem key={item.label}>
              <span>{item.ok ? 'OK' : 'CHECK'}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.value}</small>
            </AdminStageItem>
          ))}
        </AdminStageList>
      </AdminSection> : null}

      {loadPlan.shouldRenderSummary ? <AdminSection
        actions={
          <StatusBadgeFromPillClass pillClass={preview.policy ? 'pill-success' : 'pill-warn'}>
            {preview.policy ? preview.policy.name : 'No effective active policy'}
          </StatusBadgeFromPillClass>
        }
        className="admin-mb-16 tax-policy-withholding-preview-card"
        description="Check the active rule result before changing partner payout or service pricing. This is only a calculation preview; completed earnings still store their own immutable rule snapshot."
        title="Withholding preview"
      >
        <AdminFormGrid method="get">
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={preview.serviceType}
            label="Service type"
            labelVisibility="visible"
            name="serviceType"
            placeholder="leg_massage"
          />
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={preview.grossAmount}
            label="Gross amount"
            labelVisibility="visible"
            min="0"
            name="grossAmount"
            step="100000"
            type="number"
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Preview withholding
          </AdminFormControlButton>
        </AdminFormGrid>
        <AdminStageList className="admin-mt-12">
          <AdminStageItem>
            <span>{preview.policy ? 'POLICY' : 'MISSING'}</span>
            <div>
              <strong>{preview.policy?.name ?? 'No active policy available now'}</strong>
              <p className="muted">
                {preview.policy
                  ? (
                      <>
                        Effective from <DateTimeText fallback="No date" value={preview.policy.effectiveFrom} />
                      </>
                    )
                  : 'Create or activate one policy before partner earnings are settled.'}
              </p>
            </div>
            <small>{preview.policy?.status ?? 'NONE'}</small>
          </AdminStageItem>
          <AdminStageItem>
            <span>{preview.rule ? 'RULE' : 'FALLBACK'}</span>
            <div>
              <strong>{preview.rule ? <TaxPolicyRuleLabel rule={preview.rule} /> : 'No matching active rule'}</strong>
              <p className="muted">
                {preview.rule
                  ? (
                      <>
                        {formatBps(preview.rule.rateBps)} plus{' '}
                        <MoneyText amount={preview.rule.fixedAmount} fallback="0 VND" /> fixed amount.
                      </>
                    )
                  : 'Withholding preview returns 0 until a matching default/service/amount-band rule exists.'}
              </p>
            </div>
            <small>{preview.rule?.id.slice(0, 8) ?? '-'}</small>
          </AdminStageItem>
          <AdminStageItem>
            <span>TAX</span>
            <div>
              <strong>
                <MoneyText amount={preview.withholdingAmount} /> withholding
              </strong>
              <p className="muted">
                Gross <MoneyText amount={preview.grossAmount} /> / service type{' '}
                {preview.serviceType || 'not set'}.
              </p>
            </div>
            <small>{formatBps(preview.rule?.rateBps ?? 0)}</small>
          </AdminStageItem>
        </AdminStageList>
      </AdminSection> : null}

      {loadPlan.shouldRenderWorkspaceIndex ? (
        <AdminSection
          className="admin-mb-16 tax-policy-workspace-index-card"
          description="Open one bounded workspace at a time. Policy editor contains write controls, audit history shows retained operator changes, and settlement records checks recent immutable earning snapshots."
          statusLabel="Choose workspace"
          statusTone="info"
          title="Tax policy workspaces"
        >
          <AdminFilterChipGroup ariaLabel="Tax policy workspaces">
            <AdminFormControlLink href={buildTaxPolicyDetailsHref('editor')}>Policy editor</AdminFormControlLink>
            <AdminFormControlLink href={buildTaxPolicyDetailsHref('audit')}>Audit history</AdminFormControlLink>
            <AdminFormControlLink href={buildTaxPolicyDetailsHref('records')}>Settlement records</AdminFormControlLink>
          </AdminFilterChipGroup>
        </AdminSection>
      ) : null}

      {loadPlan.shouldRenderEditor ? <><AdminSection
        className="admin-mb-16 tax-policy-create-policy-card"
        description="Use basis points for percentage rates. Example: 500 bps = 5%."
        title="Create policy version"
      >
        <AdminFormGrid action={createTaxPolicyVersion}>
          <AdminFormInput
            className="admin-form-control-fluid"
            label="Name"
            labelVisibility="visible"
            name="name"
            placeholder="Vietnam freelance withholding 2026"
            required
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue="DRAFT"
            label="Status"
            labelVisibility="visible"
            name="status"
            options={statusSelectOptions}
          />
          <AdminFormDateTime
            className="admin-form-control-fluid"
            label="Effective from"
            labelVisibility="visible"
            name="effectiveFrom"
            required
          />
          <AdminFormInput
            className="admin-form-control-fluid"
            label="Default rate bps"
            labelVisibility="visible"
            max="10000"
            min="0"
            name="defaultRateBps"
            placeholder="500"
            type="number"
          />
          <AdminFormInput
            className="admin-form-control-fluid admin-grid-span-2"
            label="Notes"
            labelVisibility="visible"
            name="notes"
            placeholder="Policy source, approval note, or internal memo"
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Create policy
          </AdminFormControlButton>
        </AdminFormGrid>
      </AdminSection>

      <AdminDetailGrid className="tax-policy-version-grid">
        {policies.map((policy) => (
          <AdminCard className="tax-policy-version-card" key={policy.id}>
            <AdminSectionHeader
              description={
                <>
                  <DateTimeText fallback="No date" value={policy.effectiveFrom} />
                  {policy.effectiveTo ? (
                    <>
                      {' - '}
                      <DateTimeText fallback="No date" value={policy.effectiveTo} />
                    </>
                  ) : null}
                </>
              }
              status={
                <StatusBadgeFromPillClass pillClass={policy.status === 'ACTIVE' ? 'pill-success' : 'pill-neutral'}>
                  {policy.status}
                </StatusBadgeFromPillClass>
              }
              title={policy.name}
            />
            {policy.notes ? <p className="muted">{policy.notes}</p> : null}

            <AdminFormGrid action={updateTaxPolicyVersion} className="compact-form">
              <input type="hidden" name="policyId" value={policy.id} />
              <AdminFormSelect
                className="admin-form-control-fluid"
                defaultValue={policy.status}
                label="Status"
                labelVisibility="visible"
                name="status"
                options={statusSelectOptions}
              />
              <AdminFormDateTime
                className="admin-form-control-fluid"
                defaultValue={toDateTimeLocal(policy.effectiveFrom)}
                label="Effective from"
                labelVisibility="visible"
                name="effectiveFrom"
              />
              <AdminFormDateTime
                className="admin-form-control-fluid"
                defaultValue={toDateTimeLocal(policy.effectiveTo)}
                label="Effective to"
                labelVisibility="visible"
                name="effectiveTo"
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                defaultValue={policy.notes ?? ''}
                label="Notes"
                labelVisibility="visible"
                name="notes"
              />
              <AdminFormControlButton className="button-primary" type="submit">
                Update policy
              </AdminFormControlButton>
            </AdminFormGrid>

            <h3>Rules</h3>
            <p className="muted admin-mb-12">
              DEFAULT is the fallback. SERVICE_TYPE requires a service type. AMOUNT_BAND requires min or
              max amount, and min cannot be greater than max.
            </p>
            <AdminStageList className="admin-mb-12">
              {(policy.rules ?? []).map((rule) => (
                <AdminStageItem key={rule.id}>
                  <span>{rule.active ? 'ON' : 'OFF'}</span>
                  <div>
                    <strong>
                      {rule.scope}
                      {rule.serviceType ? ` / ${rule.serviceType}` : ''}
                    </strong>
                    <p className="muted">
                      {formatBps(rule.rateBps)}
                      {rule.fixedAmount ? (
                        <>
                          {' '}
                          + <MoneyText amount={rule.fixedAmount} />
                        </>
                      ) : null}
                      {rule.scope === 'AMOUNT_BAND' ? (
                        <>
                          {' '}
                          / <TaxPolicyAmountBand rule={rule} />
                        </>
                      ) : null}
                    </p>
                    <AdminFormGrid action={updateTaxRule} className="compact-form">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <AdminFormSelect
                        className="admin-form-control-fluid"
                        defaultValue={rule.scope}
                        label="Scope"
                        labelVisibility="visible"
                        name="scope"
                        options={scopeSelectOptions}
                      />
                      <AdminFormInput
                        className="admin-form-control-fluid"
                        defaultValue={rule.serviceType ?? ''}
                        label="Service type"
                        labelVisibility="visible"
                        name="serviceType"
                      />
                      <AdminFormInput
                        className="admin-form-control-fluid"
                        defaultValue={rule.minGrossAmount ?? ''}
                        label="Min amount"
                        labelVisibility="visible"
                        min="0"
                        name="minGrossAmount"
                        type="number"
                      />
                      <AdminFormInput
                        className="admin-form-control-fluid"
                        defaultValue={rule.maxGrossAmount ?? ''}
                        label="Max amount"
                        labelVisibility="visible"
                        min="0"
                        name="maxGrossAmount"
                        type="number"
                      />
                      <AdminFormInput
                        className="admin-form-control-fluid"
                        defaultValue={rule.rateBps}
                        label="Rate bps"
                        labelVisibility="visible"
                        max="10000"
                        min="0"
                        name="rateBps"
                        type="number"
                      />
                      <AdminFormInput
                        className="admin-form-control-fluid"
                        defaultValue={rule.fixedAmount}
                        label="Fixed amount"
                        labelVisibility="visible"
                        min="0"
                        name="fixedAmount"
                        type="number"
                      />
                      <AdminFormCheckbox
                        defaultChecked={rule.active}
                        label={`Tax rule ${rule.id} active`}
                        name="active"
                      >
                        <span>Active</span>
                      </AdminFormCheckbox>
                      <AdminFormControlButton className="button-primary" type="submit">
                        Update rule
                      </AdminFormControlButton>
                    </AdminFormGrid>
                  </div>
                  <small>{rule.id.slice(0, 8)}</small>
                </AdminStageItem>
              ))}
              {(policy.rules ?? []).length === 0 ? <AdminInlineFallback>No rules yet.</AdminInlineFallback> : null}
            </AdminStageList>

            <AdminFormGrid action={createTaxRule} className="compact-form">
              <input type="hidden" name="policyId" value={policy.id} />
              <AdminFormSelect
                className="admin-form-control-fluid"
                defaultValue="DEFAULT"
                label="Scope"
                labelVisibility="visible"
                name="scope"
                options={scopeSelectOptions}
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                label="Service type"
                labelVisibility="visible"
                name="serviceType"
                placeholder="optional"
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                label="Min amount"
                labelVisibility="visible"
                min="0"
                name="minGrossAmount"
                placeholder="optional"
                type="number"
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                label="Max amount"
                labelVisibility="visible"
                min="0"
                name="maxGrossAmount"
                placeholder="optional"
                type="number"
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                defaultValue="0"
                label="Rate bps"
                labelVisibility="visible"
                max="10000"
                min="0"
                name="rateBps"
                type="number"
              />
              <AdminFormInput
                className="admin-form-control-fluid"
                defaultValue="0"
                label="Fixed amount"
                labelVisibility="visible"
                min="0"
                name="fixedAmount"
                type="number"
              />
              <AdminFormControlButton className="button-primary" type="submit">
                Add rule
              </AdminFormControlButton>
            </AdminFormGrid>
          </AdminCard>
        ))}
      </AdminDetailGrid></> : null}

      {loadPlan.shouldRenderAudit ? <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{auditSummary.totalChangeCount} recent</StatusBadge>
            <StatusBadge tone="neutral">{auditSummary.policyChangeCount} policy</StatusBadge>
            <StatusBadge tone="neutral">{auditSummary.ruleChangeCount} rule</StatusBadge>
          </>
        }
        className="admin-mt-16 tax-policy-audit-summary-card"
        description="Recent policy and rule changes. Use the full audit log only when an operator needs deeper evidence."
        title="Tax policy audit summary"
      >
        <AdminStageList>
          {auditSummary.rows.map((row) => (
            <AdminStageItem key={row.id}>
              <StatusBadgeFromPillClass pillClass={row.toneClassName}>
                {row.actionLabel.split(' ')[0].toUpperCase()}
              </StatusBadgeFromPillClass>
              <div>
                <strong>{row.actionLabel}</strong>
                <p className="muted">
                  {row.detail} / {row.actorLabel} /{' '}
                  <DateTimeText fallback="Unknown time" value={row.createdAt} />
                </p>
              </div>
              <small>{row.targetLabel}</small>
            </AdminStageItem>
          ))}
          {auditSummary.rows.length === 0 ? (
            <AdminStageItem>
              <span>EMPTY</span>
              <div>
                <AdminEmptyState
                  message="Create or update a policy/rule to populate this operator summary."
                  title="No recent tax policy audit entries"
                />
              </div>
              <small>-</small>
            </AdminStageItem>
          ) : null}
        </AdminStageList>
      </AdminSection> : null}

      {loadPlan.shouldRenderRecords ? <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{snapshotConsistency.sampleCount} sampled</StatusBadge>
            <StatusBadge tone="success">{snapshotConsistency.consistentCount} aligned</StatusBadge>
            <StatusBadgeFromPillClass pillClass={snapshotConsistency.warningCount ? 'pill-warn' : 'pill-neutral'}>
              {snapshotConsistency.warningCount} check
            </StatusBadgeFromPillClass>
          </>
        }
        className="admin-mt-16 tax-policy-snapshot-consistency-card"
        description="Recent 30-day earning sample. This does not recalculate tax; it checks whether retained earning withholding and tax records still line up."
        title="Settlement record consistency"
      >
        <AdminStageList>
          {snapshotConsistency.rows.map((row) => (
            <AdminStageItem key={row.id}>
              <StatusBadgeFromPillClass pillClass={row.toneClassName}>{row.statusLabel}</StatusBadgeFromPillClass>
              <div>
                <strong>
                  <AdminTextLink href={row.bookingHref}>
                    {row.bookingLabel}
                  </AdminTextLink>{' '}
                  / {row.providerLabel}
                </strong>
                <p className="muted">
                  Gross {row.grossAmountLabel} / earning tax {row.earningTaxLabel} / tax log{' '}
                  {row.taxLogLabel} / delta {row.deltaLabel}
                </p>
                <div className="actions admin-mt-8">
                  <AdminTextLink href={row.earningHref}>
                    Open earning
                  </AdminTextLink>
                  <AdminTextLink href={row.financeTraceHref}>
                    Finance evidence
                  </AdminTextLink>
                </div>
              </div>
              <small>{row.snapshotLabel}</small>
            </AdminStageItem>
          ))}
          {snapshotConsistency.rows.length === 0 ? (
            <AdminStageItem>
              <span>EMPTY</span>
              <div>
                <AdminEmptyState
                  message="Completed earnings will appear here after the API returns recent rows."
                  title="No recent earning tax snapshots"
                />
              </div>
              <small>30d</small>
            </AdminStageItem>
          ) : null}
        </AdminStageList>
      </AdminSection> : null}
    </AdminPageTemplate>
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

function buildTaxPolicyHealth(policies: AdminTaxPolicyVersion[]): TaxPolicyHealthItem[] {
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
          : (
              <>
                Review overlapping amount bands:{' '}
                {overlappingAmountBands.slice(0, 3).map((overlap, index) => (
                  <span key={`${overlap.policyName}-${overlap.left.id}-${overlap.right.id}`}>
                    {index > 0 ? ', ' : ''}
                    {overlap.policyName}/<TaxPolicyAmountBandLabel rule={overlap.left} /> vs{' '}
                    <TaxPolicyAmountBandLabel rule={overlap.right} />
                  </span>
                ))}
                .
              </>
            ),
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

function overlappingActiveAmountBands(policies: AdminTaxPolicyVersion[]): TaxPolicyAmountBandOverlap[] {
  return policies.flatMap((policy) => {
    if (policy.status !== 'ACTIVE') {
      return [];
    }
    const bands = (policy.rules ?? [])
      .filter((rule) => rule.active && rule.scope === 'AMOUNT_BAND')
      .sort((left, right) => (left.minGrossAmount ?? 0) - (right.minGrossAmount ?? 0));
    const overlaps: TaxPolicyAmountBandOverlap[] = [];
    for (let index = 0; index < bands.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < bands.length; nextIndex += 1) {
        if (amountBandsOverlap(bands[index], bands[nextIndex])) {
          overlaps.push({
            left: bands[index],
            policyName: policy.name,
            right: bands[nextIndex],
          });
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

function TaxPolicyRuleLabel({ rule }: { readonly rule: AdminTaxRule }) {
  if (rule.scope === 'SERVICE_TYPE') {
    return <>Service type / {rule.serviceType ?? 'missing service key'}</>;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    return (
      <>
        Amount band / <TaxPolicyAmountBand rule={rule} />
      </>
    );
  }
  return <>Default withholding rule</>;
}

function TaxPolicyAmountBand({ rule }: { readonly rule: AdminTaxRule }) {
  return <TaxPolicyAmountBandLabel rule={rule} />;
}

function TaxPolicyAmountBandLabel({ rule }: { readonly rule: AdminTaxRule }) {
  return (
    <>
      <MoneyText amount={rule.minGrossAmount ?? 0} />
      {' - '}
      {rule.maxGrossAmount ? <MoneyText amount={rule.maxGrossAmount} /> : 'no max'}
    </>
  );
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

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

function cappedBpsAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  return Math.max(0, Math.min(baseAmount, Math.round((baseAmount * rateBps) / 10000) + fixedAmount));
}
