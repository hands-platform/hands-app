import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { RoleBadge } from '../../components/role-badge';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';

export type AppSessionTableRow = {
  readonly appVersionLabel: string;
  readonly avatarStatus: AdminAvatarStatus;
  readonly deviceIdLabel: string;
  readonly id: string;
  readonly ipAddressLabel: string;
  readonly lastSeenAtLabel: string;
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
  readonly rows: readonly AppSessionTableRow[];
};

export function AppSessionsTableSection({ emptyMessage, rows }: AppSessionsTableSectionProps) {
  return (
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
              <span className={`pill ${row.statePillClassName}`}>{row.stateLabel}</span>
            </td>
            <td>{row.platformLabel}</td>
            <td>{row.appVersionLabel}</td>
            <td>
              {row.relativeLastSeenLabel}
              <div className="muted">{row.lastSeenAtLabel}</div>
            </td>
            <td>
              <code>{row.deviceIdLabel}</code>
              <div className="muted">{row.ipAddressLabel}</div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
  );
}
