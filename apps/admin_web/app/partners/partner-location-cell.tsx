import type { AdminProvider } from '../../lib/admin-api';
import { PillClassBadge } from '../../components/status-badge';
import {
  hasProviderCoordinate,
  providerLocationAgeLabel,
  providerLocationLabel,
  providerLocationPillClass,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';

type PartnerLocationCellProps = {
  readonly opsPolicy: ProviderOpsPolicy;
  readonly provider: AdminProvider;
};

export function PartnerLocationCell({ opsPolicy, provider }: PartnerLocationCellProps) {
  const status = providerLocationStatus(provider, opsPolicy);
  const hasCoordinate = hasProviderCoordinate(provider);

  return (
    <div>
      <div className="participant-list admin-mb-8">
        <PillClassBadge pillClass={providerLocationPillClass(status)}>{providerLocationLabel(status)}</PillClassBadge>
      </div>
      <p className="muted admin-mb-4">
        {providerLocationAgeLabel(provider.currentLocationUpdatedAt)}
      </p>
      {hasCoordinate ? (
        <p className="muted">Partner location saved for dispatch checks.</p>
      ) : (
        <p className="muted">No saved location yet.</p>
      )}
    </div>
  );
}
