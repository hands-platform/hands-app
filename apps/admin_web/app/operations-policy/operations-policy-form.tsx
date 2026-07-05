import { ExternalLink, Save } from 'lucide-react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminCard, AdminFormCard, AdminLinkCard, AdminNotePanel } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { formatDateTime } from '../../lib/admin-format';
import { operationalPolicyAnchor } from '../../lib/operations-policy';
import { updateOperationalPolicy } from './actions';
import { policyImpactDetails } from './policy-impact-details';
import { policyRelatedBookingRecords } from './policy-related-bookings';
import { policyDisplayValue } from './policy-value-display';

type OperationsPolicyFormProps = {
  readonly setting: AdminOperationalPolicySetting;
  readonly bookings: readonly AdminBooking[];
};

export function OperationsPolicyForm({ setting, bookings }: OperationsPolicyFormProps) {
  const valueType = typeof setting.value;
  const isNumber = valueType === 'number';
  const recommended = policyDisplayValue(setting, true);
  const impact = policyImpactDetails(setting.key);
  const relatedBookings = policyRelatedBookingRecords(setting.key, bookings);

  return (
    <AdminFormCard
      action={updateOperationalPolicy}
      className="admin-m-0"
      id={operationalPolicyAnchor(setting.key)}
    >
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="valueType" value={valueType} />
      <AdminSectionHeader
        actions={(
          <StatusBadge tone={setting.enforced ? 'success' : 'warning'}>
            {setting.enforced ? 'Enforced' : 'Planning'}
          </StatusBadge>
        )}
        description={displayOperationalWording(setting.description)}
        title={displayOperationalWording(setting.label)}
      />
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
      <AdminNotePanel className="admin-mt-12">
        <div className="ops-row">
          <div>
            <strong>{impact.title}</strong>
            <p className="muted">{impact.detail}</p>
          </div>
          <StatusBadge tone={setting.enforced ? 'success' : 'warning'}>
            {setting.enforced ? 'Live behavior' : 'Decision log'}
          </StatusBadge>
        </div>
      </AdminNotePanel>
      <AdminNotePanel className="admin-mt-12">
        <div className="ops-row">
          <div>
            <strong>{relatedBookings.title}</strong>
            <p className="muted">{relatedBookings.helper}</p>
          </div>
          <AdminFormControlLink className="button-secondary" href={relatedBookings.href}>
            <ExternalLink size={16} aria-hidden="true" />
            Open records
          </AdminFormControlLink>
        </div>
        <div className="booking-radar admin-mt-12">
          {relatedBookings.rows.map((row) => (
            <AdminLinkCard className="insight-card" href={row.href} key={`${setting.key}-${row.id}`}>
              <strong>{row.title}</strong>
              <p className="muted">{row.subtitle}</p>
              <div className="participant-list">
                {row.pills.map((pill) => (
                  <StatusBadge
                    tone={statusBadgeToneFromPillClass(pill.className)}
                    key={`${row.id}-${pill.label}`}
                  >
                    {pill.label}
                  </StatusBadge>
                ))}
              </div>
            </AdminLinkCard>
          ))}
          {relatedBookings.rows.length === 0 ? (
            <AdminCard className="insight-card">
              <AdminEmptyState message={relatedBookings.emptyText} title="No sampled record" />
            </AdminCard>
          ) : null}
        </div>
      </AdminNotePanel>
      <AdminNotePanel className="admin-mt-12">
        <strong>Before saving this policy</strong>
        <p className="muted">
          Review these operating surfaces first, then write the reason so the shift team can trace why the
          behavior changed.
        </p>
        <div className="booking-radar admin-mt-12">
          {impact.saveChecks.map((check) => (
            <AdminLinkCard className="insight-card" href={check.href} key={`${setting.key}-${check.label}`}>
              <strong>{check.label}</strong>
              <p className="muted">{check.detail}</p>
            </AdminLinkCard>
          ))}
        </div>
      </AdminNotePanel>
      {setting.options?.length ? (
        <>
          <AdminFormSelect
            className="admin-form-control-fluid admin-mt-12"
            defaultValue={String(setting.value)}
            label="Decision"
            labelVisibility="visible"
            name="value"
            options={setting.options.map((option) => ({
              label: displayOperationalWording(option.label),
              value: option.value,
            }))}
          />
          <div className="booking-radar admin-mt-12">
            {setting.options.map((option) => (
              <AdminCard key={option.value} className="insight-card">
                <strong>{displayOperationalWording(option.label)}</strong>
                <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
              </AdminCard>
            ))}
          </div>
        </>
      ) : (
        <AdminFormInput
          className="admin-form-control-fluid admin-mt-12"
          defaultValue={String(setting.value)}
          label={`Value ${setting.unit ? `(${setting.unit})` : ''}${
            isNumber && setting.min !== undefined && setting.max !== undefined
              ? `, ${setting.min}-${setting.max}`
              : ''
          }`}
          labelVisibility="visible"
          max={isNumber ? (setting.max ?? undefined) : undefined}
          min={isNumber ? (setting.min ?? undefined) : undefined}
          name="value"
          type={isNumber ? 'number' : 'text'}
        />
      )}
      <AdminFormTextarea
        className="admin-form-control-fluid admin-mt-12"
        label="Change reason"
        labelVisibility="visible"
        minLength={12}
        name="reason"
        placeholder="Example: Increase marketplace visibility because District 1 wait time is rising."
        required
      />
      <AdminFormControlButton className="button-primary admin-mt-12" type="submit">
        <Save size={16} aria-hidden="true" />
        Save policy
      </AdminFormControlButton>
      {setting.updatedAt ? (
        <p className="muted admin-mt-10">
          Last changed {formatDate(setting.updatedAt)} by{' '}
          {setting.updatedBy?.fullName ?? setting.updatedBy?.phone ?? 'admin'}
        </p>
      ) : (
        <p className="muted admin-mt-10">Using default until an admin override is saved.</p>
      )}
    </AdminFormCard>
  );
}

function formatDate(value: string) {
  return formatDateTime(value);
}
