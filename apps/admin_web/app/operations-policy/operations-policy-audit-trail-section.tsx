import { ExternalLink } from 'lucide-react';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { formatRelativeTime } from '../../lib/admin-format';
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
    <AdminTableSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/audit-log?bucket=Operations%2FPolicy">
          <ExternalLink size={16} aria-hidden="true" />
          Open policy audit
        </AdminFormControlLink>
      }
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll admin-mb-16"
      description="Shows who changed a policy, the previous value, the new value, and whether the setting is already enforced by live booking logic."
      title="Recent policy audit trail"
    >
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
                  <p className="muted">
                    <DateTimeText value={row.createdAt} />
                  </p>
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
                  <StatusBadge tone={row.enforced ? 'success' : 'warning'}>
                    {row.enforced ? 'Live behavior' : 'Decision log'}
                  </StatusBadge>
                  <p className="muted admin-mt-6">{row.effect}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState framed message="No policy change has been audited yet." />
      )}
    </AdminTableSection>
  );
}
