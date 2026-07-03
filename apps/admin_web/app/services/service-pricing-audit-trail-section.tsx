import { FileClock } from 'lucide-react';
import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import {
  humanizeAuditAction,
  type ServicePricingAuditRow,
} from '../../lib/service-pricing-audit-rows';

type ServicePricingAuditTrailSectionProps = {
  readonly rows: readonly ServicePricingAuditRow[];
};

const SERVICE_PRICING_AUDIT_HEADERS = [
  'When',
  'Action',
  'Actor',
  'Target',
  'Changed fields',
  'Pricing snapshot',
] as const;

export function ServicePricingAuditTrailSection({ rows }: ServicePricingAuditTrailSectionProps) {
  return (
    <AdminSection
      actions={
        <a className="button button-secondary" href="/audit-log?bucket=Service%2FPricing">
          <FileClock aria-hidden="true" size={16} />
          Open service audit
        </a>
      }
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Tracks who changed service prices, Partner payout amounts, VAT, other costs, and duration settings. Use this before investigating unexpected commission or payout changes."
      title="Recent pricing audit trail"
    >
      {rows.length ? (
        <div className="admin-table-scroll">
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={SERVICE_PRICING_AUDIT_HEADERS}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{formatRelativeTime(row.createdAt, { justNow: 'Updated just now' })}</strong>
                  <p className="muted">{formatDateTime(row.createdAt)}</p>
                </td>
                <td>
                  <span className="pill pill-warn">{humanizeAuditAction(row.action)}</span>
                </td>
                <td>{row.actorName}</td>
                <td>
                  <strong>{row.targetShort}</strong>
                  <p className="muted">{row.target}</p>
                </td>
                <td>
                  <div className="participant-list">
                    {row.changedFields.map((field) => (
                      <span className="pill pill-info" key={`${row.id}-${field}`}>
                        {field}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{row.serviceLabel}</small>
                    <small>{row.priceLabel}</small>
                    <small>{row.payoutLabel}</small>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </div>
      ) : (
        <p className="muted">No recent service pricing audit event has been recorded yet.</p>
      )}
    </AdminSection>
  );
}
