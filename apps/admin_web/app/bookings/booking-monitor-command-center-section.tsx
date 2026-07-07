import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { commandToneClass, commandToneLabel, type BookingCommandTone } from './booking-command-display';

export type BookingMonitorCommandCenterLane = {
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

type BookingMonitorCommandCenterSectionProps = {
  readonly lanes: readonly BookingMonitorCommandCenterLane[];
};

export function BookingMonitorCommandCenterSection({ lanes }: BookingMonitorCommandCenterSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">Operator first view</StatusBadge>}
      className="admin-mt-16 booking-monitor-command-center-card"
      description="One-glance control for dispatch pressure, customer protection, payment closeout, and handoff quality."
      title="Booking command center"
    >
      <AdminDetailGrid className="admin-mt-12">
        {lanes.map((lane) => (
          <AdminActionCard
            detail={lane.detail}
            href={lane.href}
            key={lane.title}
            signalClassName={commandToneClass(lane.tone)}
            signalLabel={commandToneLabel(lane.tone)}
            title={lane.title}
            value={lane.status}
            valueClassName="admin-summary-card-value"
          >
            <AdminFilterChipGroup ariaLabel={`${lane.title} metrics`} className="admin-mt-10">
              {lane.metrics.map((item) => (
                <StatusBadge tone="neutral" key={item.label}>
                  {item.label}: {item.value}
                </StatusBadge>
              ))}
            </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
      </AdminDetailGrid>
    </AdminSection>
  );
}
