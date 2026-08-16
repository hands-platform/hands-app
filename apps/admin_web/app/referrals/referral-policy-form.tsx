'use client';

import { useMemo, useState } from 'react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import type { AdminReferralPolicy } from '../../lib/admin-api';
import { updateReferralPolicy } from './actions';

type PolicyDraft = {
  commissionPercent: string;
  enabledState: 'off' | 'on';
  fixedRewardAmount: string;
  holdPeriodDays: string;
  maxRewardedReferrals: string;
  maxRewardsPerReferred: string;
  notes: string;
  perRewardCapAmount: string;
  platformFeeVatRate: string;
  totalRewardCapAmount: string;
};

export function ReferralPolicyForm({
  openExposure,
  policy,
}: {
  readonly openExposure: { readonly amount: number; readonly count: number };
  readonly policy: AdminReferralPolicy;
}) {
  const audience = policy.audience === 'PARTNER' ? 'partner' : 'customer';
  const formLabel = policy.audience === 'PARTNER' ? 'Partner referral policy controls' : 'Customer referral policy controls';
  const initial = useMemo(() => policyDraft(policy), [policy]);
  const [draft, setDraft] = useState<PolicyDraft>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const changes = policyChanges(policy, draft);
  const dirty = changes.length > 0;
  const valid = policyDraftIsValid(policy, draft);
  const reasonValid = reason.trim().length >= 12 && reason.trim().length <= 500;
  const canSave = dirty && valid && reasonValid && confirmed;
  const update = (key: keyof PolicyDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setConfirmed(false);
  };

  return (
    <AdminFormShell
      action={updateReferralPolicy}
      aria-label={formLabel}
      className="vuexy-customer-form referral-policy-form admin-mt-16"
    >
      <input name="audience" type="hidden" value={audience} />
      <input name="expectedUpdatedAt" type="hidden" value={policy.updatedAt ?? ''} />
      <input name="returnTo" type="hidden" value={`/referrals/${audience === 'partner' ? 'partners' : 'customers'}?settings=policy`} />
      <AdminFormGridFields className="referral-policy-form-grid">
        <AdminFormSelect
          className="admin-form-control-fluid"
          label="Policy status"
          labelVisibility="visible"
          name="enabledState"
          onChange={(event) => update('enabledState', event.target.value)}
          options={[{ label: 'Enabled', value: 'on' }, { label: 'Disabled', value: 'off' }]}
          value={draft.enabledState}
        />
        {policy.audience === 'CUSTOMER' ? (
          <AdminFormInput
            className="admin-form-control-fluid"
            label="Reward percent (%)"
            labelVisibility="visible"
            max="100"
            min="0"
            name="commissionPercent"
            onChange={(event) => update('commissionPercent', event.target.value)}
            step="0.01"
            type="number"
            value={draft.commissionPercent}
          />
        ) : (
          <PolicyNumberInput draft={draft} field="fixedRewardAmount" label="Fixed reward amount (VND)" onChange={update} step="1000" />
        )}
        <PolicyNumberInput draft={draft} field="perRewardCapAmount" label="Per-reward cap (VND)" onChange={update} step="1000" />
        <PolicyNumberInput draft={draft} field="totalRewardCapAmount" label="Total reward cap (VND)" onChange={update} step="1000" />
        <PolicyNumberInput draft={draft} field="maxRewardedReferrals" label="Max rewarded referrals (count)" onChange={update} />
        <PolicyNumberInput draft={draft} field="maxRewardsPerReferred" label="Max rewards per referred (count)" onChange={update} />
        <PolicyNumberInput draft={draft} field="holdPeriodDays" label="Hold period (days)" onChange={update} />
        <AdminFormInput
          className="admin-form-control-fluid"
          label="Platform fee VAT (%)"
          labelVisibility="visible"
          max="100"
          min="0"
          name="platformFeeVatRate"
          onChange={(event) => update('platformFeeVatRate', event.target.value)}
          step="0.01"
          type="number"
          value={draft.platformFeeVatRate}
        />
        <AdminFormInput className="admin-form-control-fluid" disabled label="Currency" labelVisibility="visible" name="currencyDisplay" value="VND" />
        <input name="currency" type="hidden" value="VND" />
        <AdminFormTextarea
          className="admin-form-control-fluid admin-grid-span-2"
          label="Policy notes"
          labelVisibility="visible"
          name="notes"
          onChange={(event) => update('notes', event.target.value)}
          rows={3}
          value={draft.notes}
        />
        <AdminFormInput
          className="admin-form-control-fluid admin-grid-span-2"
          label="Update reason"
          labelVisibility="visible"
          maxLength={500}
          minLength={12}
          name="reason"
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </AdminFormGridFields>
      <details className="referral-policy-impact-preview admin-mt-16" open>
        <summary>Review current and proposed liability</summary>
        <div className="referral-policy-impact-grid admin-mt-12">
          <div>
            <strong>Current open exposure</strong>
            <p className="muted">{formatMoney(openExposure.amount)} across {formatCount(openExposure.count, 'open reward')}.</p>
            <p className="muted">Existing reward snapshots are not changed retroactively.</p>
          </div>
          <div aria-live="polite">
            <strong>Proposed policy changes</strong>
            {changes.length > 0 ? (
              <ul className="referral-policy-change-list">
                {changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            ) : <p className="muted">No policy values have changed.</p>}
          </div>
        </div>
      </details>
      {!valid ? (
        <AdminInlineNotice className="admin-mt-16" role="alert" tone="danger">
          Review invalid or missing policy values before saving.
        </AdminInlineNotice>
      ) : null}
      <AdminFormCheckbox
        checked={confirmed}
        className="admin-mt-16"
        disabled={!dirty || !valid}
        label="Confirm referral policy change"
        name="confirmation"
        onChange={(event) => setConfirmed(event.target.checked)}
        required
        value="confirmed"
      >
        I reviewed the current values, proposed changes, units, scope, and wallet liability impact.
      </AdminFormCheckbox>
      <div className="vuexy-customer-filter-actions referral-policy-actions">
        <span className="muted" role="status">{policySaveBlocker({ confirmed, dirty, reasonValid, valid })}</span>
        <AdminFormControlButton className="referral-policy-save-button" disabled={!canSave}>
          Save referral policy
        </AdminFormControlButton>
      </div>
    </AdminFormShell>
  );
}

function PolicyNumberInput({ draft, field, label, onChange, step }: {
  readonly draft: PolicyDraft;
  readonly field: keyof PolicyDraft;
  readonly label: string;
  readonly onChange: (field: keyof PolicyDraft, value: string) => void;
  readonly step?: string;
}) {
  return (
    <AdminFormInput
      className="admin-form-control-fluid"
      label={label}
      labelVisibility="visible"
      min="0"
      name={field}
      onChange={(event) => onChange(field, event.target.value)}
      step={step}
      type="number"
      value={draft[field]}
    />
  );
}

export function policyDraft(policy: AdminReferralPolicy): PolicyDraft {
  return {
    commissionPercent: policy.commissionPercentBps == null ? '' : String(policy.commissionPercentBps / 100),
    enabledState: policy.enabled ? 'on' : 'off',
    fixedRewardAmount: nullableNumber(policy.fixedRewardAmount),
    holdPeriodDays: String(policy.holdPeriodDays),
    maxRewardedReferrals: nullableNumber(policy.maxRewardedReferrals),
    maxRewardsPerReferred: nullableNumber(policy.maxRewardsPerReferred),
    notes: policy.notes ?? '',
    perRewardCapAmount: nullableNumber(policy.perRewardCapAmount),
    platformFeeVatRate: String((policy.platformFeeVatRateBps ?? 800) / 100),
    totalRewardCapAmount: nullableNumber(policy.totalRewardCapAmount),
  };
}

export function policyChanges(policy: AdminReferralPolicy, draft: PolicyDraft) {
  const initial = policyDraft(policy);
  const definitions: Array<[keyof PolicyDraft, string, string]> = [
    ['enabledState', 'Status', ''],
    [policy.audience === 'CUSTOMER' ? 'commissionPercent' : 'fixedRewardAmount', policy.audience === 'CUSTOMER' ? 'Reward percent' : 'Fixed reward', policy.audience === 'CUSTOMER' ? '%' : ' VND'],
    ['perRewardCapAmount', 'Per-reward cap', ' VND'],
    ['totalRewardCapAmount', 'Total reward cap', ' VND'],
    ['maxRewardedReferrals', 'Max rewarded referrals', ''],
    ['maxRewardsPerReferred', 'Max rewards per referred', ''],
    ['holdPeriodDays', 'Hold period', ' days'],
    ['platformFeeVatRate', 'Platform fee VAT', '%'],
    ['notes', 'Notes', ''],
  ];
  return definitions.flatMap(([key, label, unit]) =>
    initial[key] === draft[key] ? [] : [`${label}: ${displayValue(initial[key])}${unit} -> ${displayValue(draft[key])}${unit}`],
  );
}

export function policyDraftIsValid(policy: AdminReferralPolicy, draft: PolicyDraft) {
  const required = policy.audience === 'CUSTOMER' ? draft.commissionPercent : draft.fixedRewardAmount;
  const values = [required, draft.holdPeriodDays, draft.platformFeeVatRate];
  if (values.some((value) => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) return false;
  if (Number(draft.platformFeeVatRate) > 100 || (policy.audience === 'CUSTOMER' && Number(draft.commissionPercent) > 100)) return false;
  return [draft.perRewardCapAmount, draft.totalRewardCapAmount, draft.maxRewardedReferrals, draft.maxRewardsPerReferred]
    .every((value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0));
}

export function policySaveBlocker({ confirmed, dirty, reasonValid, valid }: {
  confirmed: boolean;
  dirty: boolean;
  reasonValid: boolean;
  valid: boolean;
}) {
  if (!dirty) return 'Change at least one policy value to enable save.';
  if (!valid) return 'Correct invalid policy values to enable save.';
  if (!reasonValid) return 'Enter a 12-500 character audit reason.';
  if (!confirmed) return 'Confirm the reviewed liability change.';
  return 'Ready to save with server validation and audit evidence.';
}

function nullableNumber(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function displayValue(value: string) {
  return value.trim() || 'Not set';
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

function formatCount(value: number, label: string) {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}
