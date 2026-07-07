import type { AdminProvider } from '../../lib/admin-api';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
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
      <AdminFilterChipGroup ariaLabel="Partner location status" className="admin-mb-8">
        <StatusBadgeFromPillClass pillClass={providerLocationPillClass(status)}>
          {providerLocationLabel(status)}
        </StatusBadgeFromPillClass>
      </AdminFilterChipGroup>
      <p className="muted admin-mb-4">
        {providerLocationAgeLabel(provider.currentLocationUpdatedAt)}
      </p>
      {hasCoordinate ? (
        <p className="muted">Partner location saved for dispatch checks.</p>
      ) : (
        <AdminEmptyState message="No saved location yet." title={null} />
      )}
    </div>
  );
}
