import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AdminProvider } from '../../lib/admin-api';

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
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Partner</th>
            <th>Status</th>
            <th>Onboarding</th>
            <th>Ops readiness</th>
            <th>Location</th>
            <th>Device/session</th>
            <th>Push Devices</th>
            <th>Files</th>
            <th>Services</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr id={`provider-${provider.id}`} key={provider.id}>
              <td>
                <Link className="text-link" href={`/partners/${provider.id}`}>
                  {partnerName(provider)}
                </Link>
                <p className="muted">{provider.user?.phone ?? provider.id}</p>
              </td>
              <td>
                {provider.verification?.status ?? 'DRAFT'}
                {provider.verification?.rejectionReason ? (
                  <p className="muted">{provider.verification.rejectionReason}</p>
                ) : null}
                <p className="muted" style={{ marginTop: 4 }}>
                  Queue status: {provider.status}
                </p>
                {provider.blockedAt ? (
                  <p className="muted" style={{ marginTop: 4 }}>
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
              <td colSpan={10}>
                <p className="muted">
                  {hiddenPartnerCount} more partner row(s) are hidden for page speed. Use filters or search
                  to narrow the queue.
                </p>
              </td>
            </tr>
          ) : null}
          {providers.length === 0 ? (
            <tr>
              <td colSpan={10}>{emptyMessage}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
