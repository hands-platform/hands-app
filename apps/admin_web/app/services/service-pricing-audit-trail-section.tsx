import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import {
  humanizeAuditAction,
  type ServicePricingAuditRow,
} from '../../lib/service-pricing-audit-rows';

type ServicePricingAuditTrailSectionProps = {
  readonly rows: readonly ServicePricingAuditRow[];
};

export function ServicePricingAuditTrailSection({ rows }: ServicePricingAuditTrailSectionProps) {
  return (
    <section className="card admin-card-scroll admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Recent pricing audit trail</h2>
          <p className="muted">
            Tracks who changed service prices, partner payout amounts, VAT, other costs, and duration settings.
            Use this before investigating unexpected commission or payout changes.
          </p>
        </div>
        <a className="text-link" href="/audit-log?bucket=Service%2FPricing">
          Open service audit
        </a>
      </div>
      {rows.length ? (
        <table className="table service-trace">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Changed fields</th>
              <th>Pricing snapshot</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      ) : (
        <p className="muted">No recent service pricing audit event has been recorded yet.</p>
      )}
    </section>
  );
}
