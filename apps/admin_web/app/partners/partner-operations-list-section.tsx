import { AdminBoundedTableFooter, AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import {
  AdminSignal,
  StatusBadge,
  StatusBadgeFromPillClass,
  type AdminSignalTone,
} from '../../components/status-badge';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { partnerHasFirstRevenueSignal as providerHasFirstRevenueSignal } from './partner-finance-readiness-facts';
import { providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import { partnerOperationPillClass, type PartnerOperationRow } from './partner-operation-row';

export type PartnerOperationsListSectionRow = PartnerOperationRow;

type PartnerOperationsListSectionProps = {
  readonly directReadyCount: number;
  readonly hiddenPartnerCount: number;
  readonly rows: readonly PartnerOperationsListSectionRow[];
  readonly settlementWarningCount: number;
  readonly totalPartnerCount: number;
};

const PARTNER_OPERATIONS_TABLE_HEADERS = [
  'Partner',
  'Approval',
  'Booking access',
  'Work',
  'Wallet',
  'App / next check',
] as const;

export function PartnerOperationsListSection({
  directReadyCount,
  hiddenPartnerCount,
  rows,
  settlementWarningCount,
  totalPartnerCount,
}: PartnerOperationsListSectionProps) {
  return (
    <AdminTablePanel
      className="vuexy-partner-table-card admin-mb-16"
      description="List-first partner control view. Operators can check approval readiness, booking access, work history, wallet state, app activity, and the next operator check before opening the full partner record."
      id="partner-operations-list"
      resultLabel={`${totalPartnerCount} partner(s)`}
      title="Partner operations list"
    >
      <AdminFilterChipGroup ariaLabel="Partner operations summary counters" className="admin-mb-12">
        <StatusBadge tone="success">{directReadyCount} can receive direct requests</StatusBadge>
        <StatusBadge tone="warning">{settlementWarningCount} settlement warning</StatusBadge>
      </AdminFilterChipGroup>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-partner-table service-trace"
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
                <AdminFilterChipGroup ariaLabel={`${row.name} profile status`} className="admin-mt-6">
                  <StatusBadge tone="info">{row.provider.level ?? 'LEVEL_1_SIGNUP'}</StatusBadge>
                  <StatusBadge tone={row.provider.blockedAt ? 'danger' : 'success'}>
                    {row.provider.blockedAt ? 'Account blocked' : 'Account open'}
                  </StatusBadge>
                </AdminFilterChipGroup>
              </td>
              <td>
                <AdminFilterChipGroup ariaLabel={`${row.name} approval checklist`}>
                  {row.checklist.map((item) => (
                    <StatusBadgeFromPillClass
                      key={item.label}
                      pillClass={partnerOperationPillClass(item.tone)}
                    >
                      {item.label}: {item.status}
                    </StatusBadgeFromPillClass>
                  ))}
                </AdminFilterChipGroup>
              </td>
              <td>
                <AdminSignal tone={partnerOperationSignalTone(row.acceptanceTone)}>
                  {row.acceptanceLabel}
                </AdminSignal>
                <p className="muted admin-mt-8">{row.acceptanceDetail}</p>
                <AdminSignal tone={partnerOperationSignalTone(row.marketplaceAccessTone)}>
                  {row.marketplaceAccessLabel}
                </AdminSignal>
                <p className="muted admin-mt-8">{row.marketplaceAccessDetail}</p>
                {row.marketplacePartnerAppMessage ? (
                  <p className="muted admin-mt-8">Partner app message: {row.marketplacePartnerAppMessage}</p>
                ) : null}
                <AdminFilterChipGroup ariaLabel={`${row.name} matching flow`} className="admin-mt-8">
                  {row.matchingFlow.map((item) => (
                    <StatusBadgeFromPillClass
                      key={item.label}
                      pillClass={partnerOperationPillClass(item.tone)}
                    >
                      {item.label}: {item.status}
                    </StatusBadgeFromPillClass>
                  ))}
                </AdminFilterChipGroup>
                <p className="muted admin-mt-8">{row.matchingFlowDetail}</p>
              </td>
              <td>
                <strong>{row.completedWorkCount} completed</strong>
                <p className="muted">
                  Last work: <DateTimeText fallback="none" value={row.lastWorkAt} />
                </p>
                <p className="muted">
                  First revenue: {providerHasFirstRevenueSignal(row.provider) ? 'yes' : 'no'}
                </p>
              </td>
              <td>
                <strong>{formatProviderMoney(row.walletBalance)}</strong>
                <p className="muted">
                  {row.walletBalance < 0
                    ? 'Settlement required before final acceptance, service start, and payout release.'
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
                  Last app activity: <DateTimeText fallback="not recorded" value={row.lastActivityAt} />
                </p>
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
                  {hiddenPartnerCount} more partner row(s) are hidden for page speed. Use search or filters to
                  narrow this list.
                </p>
              </td>
            </tr>
          ) : null}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminBoundedTableFooter className="vuexy-partner-table-footer" rowCount={rows.length} />
    </AdminTablePanel>
  );
}

function PartnerOperationsEmptyState() {
  return (
    <AdminEmptyState
      message="Change the filters or clear search to view partner records."
      title="No partners found"
    />
  );
}

function partnerOperationSignalTone(tone: PartnerOperationRow['acceptanceTone']): AdminSignalTone {
  if (tone === 'danger' || tone === 'warn') {
    return 'warn';
  }
  if (tone === 'info') {
    return 'info';
  }
  return 'ok';
}
