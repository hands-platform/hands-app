import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
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

const PARTNER_OPERATIONS_TABLE_HEADERS = [
  'Partner',
  'Basic checklist',
  'Direct request gate',
  'Matching flow',
  'Marketplace access',
  'Work history',
  'Money',
  'App/location',
  'Next operator check',
] as const;

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
        <AdminDataTable
          className="service-trace"
          emptyMessage={<PartnerOperationsEmptyState />}
          headers={PARTNER_OPERATIONS_TABLE_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.provider.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={row.avatarStatus}
                  className="vuexy-booking-person"
                  helper={row.phone}
                  href={`/partners/${row.provider.id}`}
                  label={row.name}
                  linkClassName="table-link"
                />
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
                <p className="muted admin-mt-8">{row.acceptanceDetail}</p>
              </td>
              <td>
                <div className="participant-list">
                  {row.matchingFlow.map((item) => (
                    <span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>
                      {item.label}: {item.status}
                    </span>
                  ))}
                </div>
                <p className="muted admin-mt-8">{row.matchingFlowDetail}</p>
              </td>
              <td>
                <span className={`signal ${partnerOperationSignalClass(row.marketplaceAccessTone)}`}>
                  {row.marketplaceAccessLabel}
                </span>
                <p className="muted admin-mt-8">{row.marketplaceAccessDetail}</p>
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
            </tr>
          ))}
          {hiddenPartnerCount > 0 ? (
            <tr>
              <td colSpan={PARTNER_OPERATIONS_TABLE_HEADERS.length}>
                <p className="muted">
                  {hiddenPartnerCount} more partner row(s) are hidden for page speed. Use search or
                  filters to narrow this list.
                </p>
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
    </section>
  );
}

function PartnerOperationsEmptyState() {
  return (
    <>
      <strong>No partners found</strong>
      <p className="muted">Change the filters or clear search to view partner records.</p>
    </>
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
