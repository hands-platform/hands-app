import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { DateTimeText } from '../../components/date-time-text';
import { RoleBadge } from '../../components/role-badge';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';

export type AppSessionTableRow = {
  readonly appVersionLabel: string;
  readonly avatarStatus: AdminAvatarStatus;
  readonly deviceIdLabel: string;
  readonly id: string;
  readonly ipAddressLabel: string;
  readonly lastSeenAt: string | null;
  readonly partnerHref: string | null;
  readonly platformLabel: string;
  readonly relativeLastSeenLabel: string;
  readonly roleLabel: string;
  readonly stateLabel: string;
  readonly statePillClassName: string;
  readonly userHref: string | null;
  readonly userLabel: string;
  readonly userPhoneLabel: string;
};

type AppSessionsTableSectionProps = {
  readonly emptyMessage: string;
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly AppSessionTableRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

export function AppSessionsTableSection({ emptyMessage, pagination }: AppSessionsTableSectionProps) {
  const rows = pagination.rows;

  return (
    <>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={emptyMessage}
          headers={['User', 'Role', 'State', 'Platform', 'Version', 'Last seen', 'Device']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <AdminPersonCell
                  avatarClassName={`vuexy-booking-avatar${row.roleLabel === 'PARTNER' ? ' is-partner' : ''}`}
                  avatarStatus={row.avatarStatus}
                  className="vuexy-booking-person"
                  helper={row.userPhoneLabel}
                  href={row.userHref}
                  label={row.userLabel}
                  linkClassName="table-link"
                />
              </td>
              <td>
                <RoleBadge role={row.roleLabel} />
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={row.statePillClassName}>
                  {row.stateLabel}
                </StatusBadgeFromPillClass>
              </td>
              <td>{row.platformLabel}</td>
              <td>{row.appVersionLabel}</td>
              <td>
                {row.relativeLastSeenLabel}
                <div className="muted">
                  <DateTimeText value={row.lastSeenAt} />
                </div>
              </td>
              <td>
                <code>{row.deviceIdLabel}</code>
                <div className="muted">{row.ipAddressLabel}</div>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="App session pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </>
  );
}
