import Link from 'next/link';

import { AdminDataTable } from '../../components/admin-data-table';
import { RoleBadge } from '../../components/role-badge';

export type AppSessionTableRow = {
  readonly appVersionLabel: string;
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
  readonly userLabel: string;
  readonly userPhoneLabel: string;
};

type AppSessionsTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly AppSessionTableRow[];
};

export function AppSessionsTableSection({ emptyMessage, rows }: AppSessionsTableSectionProps) {
  return (
    <AdminDataTable
      emptyMessage={emptyMessage}
      headers={['User', 'Role', 'State', 'Platform', 'Version', 'Last seen', 'Device']}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          <td>
            <strong>{row.userLabel}</strong>
            <div className="muted">{row.userPhoneLabel}</div>
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
            {row.partnerHref ? (
              <Link className="text-link" href={row.partnerHref}>
                Open Partner
              </Link>
            ) : null}
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
