import type { ReactNode } from 'react';

import { AdminBoundedTableFooter, AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTableCard } from '../../components/admin-table-panel';
import type { AdminProvider } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals } from '../../lib/admin-avatar-status';

type PartnerCellRenderer = (provider: AdminProvider) => ReactNode;

type PartnerLegacyOperationsTableSectionProps = {
  readonly emptyMessage: ReactNode;
  readonly hiddenPartnerCount: number;
  readonly partnerName: (provider: AdminProvider) => string;
  readonly providers: readonly AdminProvider[];
  readonly renderActions: PartnerCellRenderer;
  readonly renderFiles: PartnerCellRenderer;
  readonly renderLocation: PartnerCellRenderer;
  readonly renderOnboarding: PartnerCellRenderer;
  readonly renderOpsReadiness: PartnerCellRenderer;
  readonly renderPushDevices: PartnerCellRenderer;
  readonly renderSecurity: PartnerCellRenderer;
  readonly renderServices: PartnerCellRenderer;
};

const PARTNER_LEGACY_OPERATIONS_HEADERS = [
  'Partner',
  'Status',
  'Onboarding',
  'Ops readiness',
  'Location',
  'Device/session',
  'Push Devices',
  'Files',
  'Services',
  'Action',
] as const;

export function PartnerLegacyOperationsTableSection({
  emptyMessage,
  hiddenPartnerCount,
  partnerName,
  providers,
  renderActions,
  renderFiles,
  renderLocation,
  renderOnboarding,
  renderOpsReadiness,
  renderPushDevices,
  renderSecurity,
  renderServices,
}: PartnerLegacyOperationsTableSectionProps) {
  return (
    <AdminTableCard className="admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-partner-table-card">
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-partner-table partner-legacy-table"
          emptyMessage={emptyMessage}
          headers={PARTNER_LEGACY_OPERATIONS_HEADERS}
          rowCount={providers.length}
        >
          {providers.map((provider) => (
            <tr id={`provider-${provider.id}`} key={provider.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={partnerLegacyAvatarStatus(provider)}
                  className="vuexy-booking-person"
                  helper={provider.user?.phone ?? provider.id}
                  href={`/partners/${provider.id}`}
                  label={partnerName(provider)}
                  linkClassName="table-link"
                />
              </td>
              <td>
                {provider.verification?.status ?? 'DRAFT'}
                {provider.verification?.rejectionReason ? (
                  <p className="muted">{provider.verification.rejectionReason}</p>
                ) : null}
                <p className="muted admin-mt-4">Queue status: {provider.status}</p>
                {provider.blockedAt ? (
                  <p className="muted admin-mt-4">
                    Account blocked: {provider.blockedReason ?? 'No reason saved'}
                  </p>
                ) : null}
              </td>
              <td>{renderOnboarding(provider)}</td>
              <td>{renderOpsReadiness(provider)}</td>
              <td>{renderLocation(provider)}</td>
              <td>{renderSecurity(provider)}</td>
              <td>{renderPushDevices(provider)}</td>
              <td>{renderFiles(provider)}</td>
              <td>{renderServices(provider)}</td>
              <td>{renderActions(provider)}</td>
            </tr>
          ))}
          {hiddenPartnerCount > 0 ? (
            <tr>
              <td colSpan={PARTNER_LEGACY_OPERATIONS_HEADERS.length}>
                <p className="muted">
                  {hiddenPartnerCount} more partner row(s) are hidden for page speed. Use filters or search
                  to narrow the queue.
                </p>
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminBoundedTableFooter className="vuexy-partner-table-footer" rowCount={providers.length} />
    </AdminTableCard>
  );
}

function partnerLegacyAvatarStatus(provider: AdminProvider) {
  return adminAvatarStatusFromSignals({
    devices: [...(provider.user?.pushDevices ?? []), ...(provider.devices ?? [])],
    fallbackOnline: provider.status === 'ONLINE_AVAILABLE' || provider.status === 'ONLINE_AVAILABLE_SOON',
    sessions: provider.sessions,
    working: provider.status === 'ONLINE_BUSY',
  });
}
