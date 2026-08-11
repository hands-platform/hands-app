import { Settings2 } from 'lucide-react';

import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';

type NotificationChannelPolicySectionProps = {
  readonly canViewDiagnostics?: boolean;
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly policyLabel: string;
};

export function NotificationChannelPolicySection({
  canViewDiagnostics = false,
  inAppDeliveries,
  fcmDeliveries,
  policyLabel,
}: NotificationChannelPolicySectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/operations-policy">
          <Settings2 aria-hidden="true" size={16} />
          Change alert policy
        </AdminFormControlLink>
      }
      className="soft-card admin-mb-16"
      description={
        <>
          Current decision: <strong>{policyLabel}</strong>. Partner booking alerts follow this route until
          the policy is changed.
        </>
      }
      title="Partner alert routing policy"
    >
      <AdminFilterChipGroup ariaLabel="Partner alert policy status" className="admin-mt-10">
        <StatusBadge tone="success">Policy active</StatusBadge>
        <StatusBadge tone={inAppDeliveries ? 'success' : 'neutral'}>
          {inAppDeliveries ? 'In-app route observed' : 'No in-app activity in range'}
        </StatusBadge>
        <StatusBadge tone={fcmDeliveries ? 'info' : 'neutral'}>
          {fcmDeliveries ? 'Mobile push route observed' : 'No mobile push activity in range'}
        </StatusBadge>
        {canViewDiagnostics ? (
          <StatusBadgeLink href="/setup?commands=all#notifications" tone="neutral">
            Open Developer setup
          </StatusBadgeLink>
        ) : null}
      </AdminFilterChipGroup>
    </AdminSection>
  );
}
