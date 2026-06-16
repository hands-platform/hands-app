import { AdminTableScroll } from '../../components/admin-data-table';
import { MetricCard } from '../../components/metric-card';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { PolicyChangeImpactDashboard } from './policy-impact-dashboard';

type OperationsPolicyChangeImpactSectionProps = {
  readonly dashboard: PolicyChangeImpactDashboard;
  readonly sampledBookingCount: number;
};

export function OperationsPolicyChangeImpactSection({
  dashboard,
  sampledBookingCount,
}: OperationsPolicyChangeImpactSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Policy change impact</h2>
          <p className="muted">
            Before changing a setting, use this view to see whether it only affects new bookings or also
            changes live Partner visibility, participation checks, and operational review work.
          </p>
        </div>
        <span className="pill pill-info">{sampledBookingCount} booking(s) sampled</span>
      </div>
      <div className="grid admin-mt-12">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {dashboard.snapshotSummary.map((item) => (
          <div className="ops-task-card ops-task-done admin-min-h-0" key={item.label}>
            <span className="pill pill-info">{item.scope}</span>
            <h3>{item.label}</h3>
            <p>{item.value}</p>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Current live value</th>
              <th>Saved booking snapshot</th>
              <th>Operator meaning</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.snapshotRows.map((row) => (
              <tr key={row.policy}>
                <td>
                  <strong>{displayOperationalWording(row.policy)}</strong>
                  <p className="muted">{row.scope}</p>
                </td>
                <td>{row.liveValue}</td>
                <td>{row.savedValue}</td>
                <td>
                  <p className="admin-m-0">{row.operatorMeaning}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableScroll>
      <div className="ops-task-grid admin-mt-14">
        {dashboard.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.title}>
            <span className={`pill ${card.pillClass}`}>{card.scope}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.operatorAction}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
