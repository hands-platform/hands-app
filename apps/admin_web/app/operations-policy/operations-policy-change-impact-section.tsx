import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminMetricGrid } from '../../components/admin-page-template';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { PolicyChangeImpactDashboard } from './policy-impact-dashboard';
import { policyCountLabel } from './policy-copy';

type OperationsPolicyChangeImpactSectionProps = {
  readonly dashboard: PolicyChangeImpactDashboard;
  readonly sampledBookingCount: number;
};

const POLICY_CHANGE_IMPACT_HEADERS = [
  'Policy',
  'Current live value',
  'Saved booking snapshot',
  'Operator meaning',
] as const;

export function OperationsPolicyChangeImpactSection({
  dashboard,
  sampledBookingCount,
}: OperationsPolicyChangeImpactSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Before changing a setting, use this view to see whether it only affects new bookings or also changes live Partner visibility, participation checks, and operational review work."
      statusLabel={`${policyCountLabel(sampledBookingCount, 'booking')} sampled`}
      statusTone="info"
      title="Policy change impact"
    >
      <AdminMetricGrid className="admin-mt-12" metrics={dashboard.metrics} />
      <AdminTaskGrid className="admin-mt-14">
        {dashboard.snapshotSummary.map((item) => (
          <AdminTaskCard
            actionLabel={item.helper}
            className="ops-task-done admin-min-h-0"
            detail={item.value}
            key={item.label}
            leading={<StatusBadge tone="info">{item.scope}</StatusBadge>}
            title={item.label}
          />
        ))}
      </AdminTaskGrid>
      <AdminTableScroll>
        <AdminDataTable
          className="service-trace"
          emptyMessage={null}
          headers={POLICY_CHANGE_IMPACT_HEADERS}
          rowCount={dashboard.snapshotRows.length}
        >
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
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTaskGrid className="admin-mt-14">
        {dashboard.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.title}
            leading={<StatusBadgeFromPillClass pillClass={card.pillClass}>{card.scope}</StatusBadgeFromPillClass>}
            title={card.title}
          />
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
