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

export function AppSessionsBreakdownSection({
  platformRows,
  roleRows,
  versionRows,
}: AppSessionsBreakdownSectionProps) {
  return (
    <section className="detail-grid" style={{ marginBottom: 16 }}>
      <div className="card">
        <h2>Role split</h2>
        <table className="table">
          <tbody>
            {roleRows.map((row) => (
              <InfoRow
                detail={`${row.recent} recent, ${row.stale} stale, ${row.expired} expired`}
                key={row.role}
                label={row.role}
                value={`${row.live} live / ${row.total} total`}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Platform and version</h2>
        <table className="table">
          <tbody>
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
