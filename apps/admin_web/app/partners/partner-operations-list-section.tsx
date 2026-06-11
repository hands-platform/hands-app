import Link from 'next/link';

import { AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { partnerHasFirstRevenueSignal as providerHasFirstRevenueSignal } from './partner-finance-readiness-facts';
import { formatDate, providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import {
  partnerOperationPillClass,
  type PartnerOperationRow,
} from './partner-operation-row';

export type PartnerOperationsListSectionRow = PartnerOperationRow;

type PartnerOperationsListSectionProps = {
  readonly directReadyCount: number;
  readonly hiddenPartnerCount: number;
  readonly rows: readonly PartnerOperationsListSectionRow[];
  readonly totalPartnerCount: number;
  readonly walletHoldCount: number;
};

export function PartnerOperationsListSection({
  directReadyCount,
  hiddenPartnerCount,
  rows,
  totalPartnerCount,
  walletHoldCount,
}: PartnerOperationsListSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="List-first partner control view. Operators can check onboarding, direct and marketplace readiness, completed work, last work, wallet, location, push, services, and app activity before opening the full partner record."
        status={
          <div className="participant-list">
            <span className="pill pill-info">{totalPartnerCount} partner(s)</span>
            <span className="pill pill-success">{directReadyCount} can receive direct requests</span>
            <span className="pill pill-warn">{walletHoldCount} wallet marketplace hold</span>
          </div>
        }
        title="Partner operations list"
      />
      <AdminTableScroll>
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Basic checklist</th>
              <th>Direct request gate</th>
              <th>Matching flow</th>
              <th>Marketplace access</th>
              <th>Work history</th>
              <th>Money</th>
              <th>App/location</th>
              <th>Next operator check</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.provider.id}>
                <td>
                  <strong>{row.name}</strong>
                  <p className="muted">{row.phone}</p>
                  <div className="participant-list admin-mt-6">
                    <span className="pill pill-info">{row.provider.level ?? 'LEVEL_1_SIGNUP'}</span>
                    <span className={`pill ${row.provider.blockedAt ? 'pill-danger' : 'pill-success'}`}>
                      {row.provider.blockedAt ? 'Account blocked' : 'Account open'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="participant-list">
                    {row.checklist.map((item) => (
                      <span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>
                        {item.label}: {item.status}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`signal ${partnerOperationSignalClass(row.acceptanceTone)}`}>
                    {row.acceptanceLabel}
                  </span>
                  <p className="muted admin-mt-8">
                    {row.acceptanceDetail}
                  </p>
                </td>
                <td>
                  <div className="participant-list">
                    {row.matchingFlow.map((item) => (
                      <span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>
                        {item.label}: {item.status}
                      </span>
                    ))}
                  </div>
                  <p className="muted admin-mt-8">
                    {row.matchingFlowDetail}
                  </p>
                </td>
                <td>
                  <span className={`signal ${partnerOperationSignalClass(row.marketplaceAccessTone)}`}>
                    {row.marketplaceAccessLabel}
                  </span>
                  <p className="muted admin-mt-8">
                    {row.marketplaceAccessDetail}
                  </p>
                  {row.marketplacePartnerAppMessage ? (
                    <p className="muted admin-mt-8">
                      Partner app message: {row.marketplacePartnerAppMessage}
                    </p>
                  ) : null}
                </td>
                <td>
                  <strong>{row.completedWorkCount} completed</strong>
                  <p className="muted">Last work: {row.lastWorkAt ? formatDate(row.lastWorkAt) : 'none'}</p>
                  <p className="muted">
                    First revenue: {providerHasFirstRevenueSignal(row.provider) ? 'yes' : 'no'}
                  </p>
                </td>
                <td>
                  <strong>{formatProviderMoney(row.walletBalance)}</strong>
                  <p className="muted">
                    {row.walletBalance < 0
                      ? 'Company fee settlement is required before marketplace alerts and participation.'
                      : 'No negative wallet balance.'}
                  </p>
                  <p className="muted">
                    Tax:{' '}
                    {row.provider.taxProfile?.status ??
                      (providerHasFirstRevenueSignal(row.provider) ? 'MISSING' : 'deferred')}
                  </p>
                </td>
                <td>
                  <strong>{providerLocationLabel(row.locationState)}</strong>
                  <p className="muted">{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</p>
                  <p className="muted">
                    Last app activity: {row.lastActivityAt ? formatDate(row.lastActivityAt) : 'not recorded'}
                  </p>
                </td>
                <td>
                  <strong>{row.nextAction.status}</strong>
                  <p className="muted">{row.nextAction.detail}</p>
                  <p className="muted">{row.nextAction.operatorAction}</p>
                </td>
                <td>
                  <Link className="text-link" href={`/partners/${row.provider.id}`}>
                    Open all records
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <strong>No partners found</strong>
                  <p className="muted">Change the filters or clear search to view partner records.</p>
                </td>
              </tr>
            ) : null}
            {hiddenPartnerCount > 0 ? (
              <tr>
                <td colSpan={10}>
                  <p className="muted">
                    {hiddenPartnerCount} more partner row(s) are hidden for page speed. Use search or
                    filters to narrow this list.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AdminTableScroll>
    </section>
  );
}

function partnerOperationSignalClass(tone: PartnerOperationRow['acceptanceTone']) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}
