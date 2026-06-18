import { ExternalLink } from 'lucide-react';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import type { PolicyAuditRow } from './policy-audit-rows';

type OperationsPolicyAuditTrailSectionProps = {
  readonly rows: readonly PolicyAuditRow[];
};

const POLICY_AUDIT_TRAIL_HEADERS = [
  'When',
  'Policy',
  'Actor',
  'Before',
  'After',
  'Reason',
  'Ops effect',
] as const;

export function OperationsPolicyAuditTrailSection({ rows }: OperationsPolicyAuditTrailSectionProps) {
  return (
    <section className="card admin-card-scroll admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Recent policy audit trail</h2>
          <p className="muted">
            Shows who changed a policy, the previous value, the new value, and whether the setting is already
            enforced by live booking logic.
          </p>
        </div>
        <a className="button button-secondary" href="/audit-log?bucket=Operations%2FPolicy">
          <ExternalLink size={16} aria-hidden="true" />
          Open policy audit
        </a>
      </div>
      {rows.length ? (
        <AdminTableScroll>
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={POLICY_AUDIT_TRAIL_HEADERS}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>
                    {formatRelativeTime(row.createdAt, { justNow: 'Just now', includeFuture: true })}
                  </strong>
                  <p className="muted">{formatDateTime(row.createdAt)}</p>
                </td>
                <td>
                  <strong>{displayOperationalWording(row.label)}</strong>
                  <p className="muted">{displayOperationalWording(row.policyContext)}</p>
                </td>
                <td>{row.actorName}</td>
                <td>{row.previousValue}</td>
                <td>{row.value}</td>
                <td>
                  <p className="admin-m-0">{displayOperationalWording(row.reason)}</p>
                </td>
                <td>
                  <span className={`pill ${row.enforced ? 'pill-success' : 'pill-warn'}`}>
                    {row.enforced ? 'Live behavior' : 'Decision log'}
                  </span>
                  <p className="muted admin-mt-6">{row.effect}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <p className="muted">No policy change has been audited yet.</p>
      )}
    </section>
  );
}
