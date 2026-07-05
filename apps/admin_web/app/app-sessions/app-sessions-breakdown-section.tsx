import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { InfoRow } from '../../components/info-row';

export type AppSessionRoleRow = {
  readonly expired: number;
  readonly live: number;
  readonly recent: number;
  readonly role: string;
  readonly stale: number;
  readonly total: number;
};

export type AppSessionPlatformRow = {
  readonly live: number;
  readonly platform: string;
  readonly total: number;
};

export type AppSessionVersionRow = {
  readonly customer: number;
  readonly live: number;
  readonly partner: number;
  readonly total: number;
  readonly version: string;
};

type AppSessionsBreakdownSectionProps = {
  readonly platformRows: readonly AppSessionPlatformRow[];
  readonly roleRows: readonly AppSessionRoleRow[];
  readonly versionRows: readonly AppSessionVersionRow[];
};

const APP_SESSION_ROLE_HEADERS = ['Role', 'Sessions'] as const;
const APP_SESSION_PLATFORM_VERSION_HEADERS = ['Platform or version', 'Sessions'] as const;

export function AppSessionsBreakdownSection({
  platformRows,
  roleRows,
  versionRows,
}: AppSessionsBreakdownSectionProps) {
  return (
    <AdminDetailGrid ariaLabel="App session breakdowns" className="admin-mb-16">
      <AdminSection className="vuexy-booking-table-card vuexy-booking-table-group" title="Role split">
        <AdminTableScroll>
          <AdminDataTable emptyMessage={null} headers={APP_SESSION_ROLE_HEADERS} rowCount={roleRows.length}>
            {roleRows.map((row) => (
              <InfoRow
                detail={`${row.recent} recent, ${row.stale} stale, ${row.expired} expired`}
                key={row.role}
                label={row.role}
                value={`${row.live} live / ${row.total} total`}
              />
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminSection>

      <AdminSection className="vuexy-booking-table-card vuexy-booking-table-group" title="Platform and version">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={APP_SESSION_PLATFORM_VERSION_HEADERS}
            rowCount={platformRows.length + Math.min(versionRows.length, 4)}
          >
            {platformRows.map((row) => (
              <InfoRow
                detail={`${row.live} live session(s) right now`}
                key={row.platform}
                label={row.platform}
                value={`${row.total} session(s)`}
              />
            ))}
            {versionRows.slice(0, 4).map((row) => (
              <InfoRow
                detail={`${row.live} live, ${row.customer} customer, ${row.partner} partner`}
                key={`version-${row.version}`}
                label={`Version ${row.version}`}
                value={`${row.total} session(s)`}
              />
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminSection>
    </AdminDetailGrid>
  );
}
