import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import type { SetupOperationalHealthRow } from './setup-page-model';

type SetupOverviewSectionProps = {
  readonly readinessUnavailable: boolean;
  readonly readinessTimestamp: string;
  readonly rows: readonly SetupOperationalHealthRow[];
};

const SYSTEM_HEALTH_HEADERS = [
  'Service',
  'Status',
  'Affected work',
  'Last checked',
  'Owning team',
  'Next action',
];

export function SetupOverviewSection({
  readinessUnavailable,
  readinessTimestamp,
  rows,
}: SetupOverviewSectionProps) {
  const blockedCount = rows.filter((row) => row.status === 'Blocked' || row.status === 'Unavailable').length;
  const limitedCount = rows.filter((row) => row.status === 'Limited').length;
  const overallStatus = readinessUnavailable
    ? { label: 'Status unavailable', tone: 'danger' as const }
    : blockedCount > 0
      ? { label: `${blockedCount} blocked`, tone: 'danger' as const }
      : limitedCount > 0
        ? { label: `${limitedCount} limited`, tone: 'warning' as const }
        : { label: 'All checked services operational', tone: 'success' as const };

  return (
    <AdminSection
      actions={
        <>
          <StatusBadge tone={overallStatus.tone}>{overallStatus.label}</StatusBadge>
          {readinessUnavailable ? (
            <StatusBadge tone="warning">Last checked unavailable</StatusBadge>
          ) : (
            <StatusBadge tone="info">
              Last checked <DateTimeText value={readinessTimestamp} />
            </StatusBadge>
          )}
        </>
      }
      description="External service state, affected operator work, ownership, and the next safe action."
      id="system-health"
      title="System health"
    >
      <AdminTableScroll ariaLabel="System health status table" className="setup-health-table-scroll">
        <AdminDataTable
          className="setup-health-table"
          emptyMessage="No system health checks were returned."
          headers={SYSTEM_HEALTH_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => {
            const owners = row.owner
              .split(',')
              .map((owner) => owner.trim())
              .filter(Boolean);
            const contacts = owners.filter((owner) => owner.includes('@'));
            const teams = owners.filter((owner) => !owner.includes('@'));

            return (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                </td>
                <td>{row.affectedWork}</td>
                <td>{row.lastCheckedAt ? <DateTimeText value={row.lastCheckedAt} /> : 'Unavailable'}</td>
                <td>
                  <span className="setup-health-owner">
                    <strong>{teams.join(', ') || (contacts.length ? 'Operations team' : 'Owner unavailable')}</strong>
                    {contacts.length ? <small>{contacts.join(', ')}</small> : null}
                  </span>
                </td>
                <td>{row.nextAction}</td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}
