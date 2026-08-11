'use client';

import { Save, X } from 'lucide-react';
import { useState } from 'react';
import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminFormCard, AdminNotePanel } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { operationalPolicyAnchor } from '../../lib/operations-policy';
import { updateOperationalPolicy } from './actions';
import { policyImpactDetails } from './policy-impact-details';
import { policyDisplayValue } from './policy-value-display';

type OperationsPolicyFormProps = {
  readonly setting: AdminOperationalPolicySetting;
};

export function OperationsPolicyForm({ setting }: OperationsPolicyFormProps) {
  const valueType = typeof setting.value;
  const isNumber = valueType === 'number';
  const impact = policyImpactDetails(setting.key);
  const [nextValue, setNextValue] = useState(String(setting.value));

  return (
    <AdminFormCard action={updateOperationalPolicy} id={operationalPolicyAnchor(setting.key)}>
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="valueType" value={valueType} />
      <input type="hidden" name="expectedValue" value={String(setting.value)} />
      <AdminSectionHeader
        actions={
          <AdminFormControlLink className="button-secondary" href="/operations-policy">
            <X size={16} aria-hidden="true" />
            Close
          </AdminFormControlLink>
        }
        description={displayOperationalWording(setting.description)}
        status={
          <StatusBadge tone={setting.enforced ? 'warning' : 'info'}>
            {setting.enforced ? 'Live policy' : 'Decision record'}
          </StatusBadge>
        }
        title={`Change ${displayOperationalWording(setting.label)}`}
      />
      <AdminTraceSummary
        defaultKind="record"
        defaultScope="Policy change"
        metrics={[
          { label: 'Before', value: policyDisplayValue(setting) },
          {
            label: 'After',
            value: policyDisplayValue({ ...setting, value: parsedPreviewValue(nextValue, valueType) }),
          },
          { label: 'Scope', value: setting.category },
          { label: 'Operating impact', value: impact.area },
          {
            label: 'Effective',
            value: setting.requiresRestart ? 'After service restart' : 'Immediately after save',
          },
          { label: 'Additional approval', value: 'Not required' },
        ]}
      />
      <AdminNotePanel className="admin-mt-12">
        <strong>{impact.title}</strong>
        <p className="muted">{impact.detail}</p>
        <p className="muted admin-mt-6">
          Only an operator with System Policy write access can save this change. The value and audit event are
          committed together.
        </p>
      </AdminNotePanel>
      {setting.options?.length ? (
        <AdminFormSelect
          className="admin-form-control-fluid admin-mt-12"
          label="New value"
          labelVisibility="visible"
          name="value"
          onChange={(event) => setNextValue(event.target.value)}
          options={setting.options.map((option) => ({
            label: displayOperationalWording(option.label),
            value: option.value,
          }))}
          value={nextValue}
        />
      ) : valueType === 'boolean' ? (
        <AdminFormSelect
          className="admin-form-control-fluid admin-mt-12"
          label="New value"
          labelVisibility="visible"
          name="value"
          onChange={(event) => setNextValue(event.target.value)}
          options={[
            { label: 'Enabled', value: 'true' },
            { label: 'Disabled', value: 'false' },
          ]}
          value={nextValue}
        />
      ) : (
        <AdminFormInput
          className="admin-form-control-fluid admin-mt-12"
          label={`New value ${setting.unit ? `(${setting.unit})` : ''}${
            isNumber && setting.min !== undefined && setting.max !== undefined
              ? `, ${setting.min}-${setting.max}`
              : ''
          }`}
          labelVisibility="visible"
          max={isNumber ? (setting.max ?? undefined) : undefined}
          min={isNumber ? (setting.min ?? undefined) : undefined}
          name="value"
          onChange={(event) => setNextValue(event.target.value)}
          required
          type={isNumber ? 'number' : 'text'}
          value={nextValue}
        />
      )}
      <AdminFormTextarea
        className="admin-form-control-fluid admin-mt-12"
        label="Change reason"
        labelVisibility="visible"
        minLength={12}
        name="reason"
        placeholder="State the operating evidence and expected outcome."
        required
      />
      <AdminFormCheckbox
        className="admin-mt-12"
        label="I reviewed the before and after values, operating impact, and effective time."
        name="confirmed"
        required
        value="yes"
      />
      <AdminFormActionRow className="admin-mt-12">
        <AdminFormControlButton className="button-primary" type="submit">
          <Save size={16} aria-hidden="true" />
          Save policy change
        </AdminFormControlButton>
        <AdminFormControlLink className="button-secondary" href="/operations-policy">
          Cancel
        </AdminFormControlLink>
      </AdminFormActionRow>
    </AdminFormCard>
  );
}

function parsedPreviewValue(value: string, valueType: string) {
  if (valueType === 'number') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : value;
  }
  if (valueType === 'boolean') return value === 'true';
  return value;
}
