import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { commandToneClass, commandToneLabel, type BookingCommandTone } from './booking-command-display';

export type BookingMonitorCustomerProtectionLane = {
  readonly bookings: readonly AdminBooking[];
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

type BookingMonitorCustomerProtectionSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly lanes: readonly BookingMonitorCustomerProtectionLane[];
};

export function BookingMonitorCustomerProtectionSection({
  getCustomerLabel,
  lanes,
}: BookingMonitorCustomerProtectionSectionProps) {
  const openCloseoutCount = lanes.reduce((sum, lane) => sum + lane.bookings.length, 0);
  const hasOpenCloseout = lanes.some((lane) => lane.bookings.length > 0);
  const visibleLanes = lanes.filter((lane) => lane.tone !== 'ok' || lane.bookings.length > 0);

  if (visibleLanes.length === 0) {
    return null;
  }

  return (
    <AdminSection
      actions={
        <StatusBadge tone={hasOpenCloseout ? 'warning' : 'success'}>
          {openCloseoutCount} open closeout
        </StatusBadge>
      }
      className="admin-mt-16 booking-monitor-customer-protection-card"
      description="Only unresolved customer money or evidence lanes are shown here."
      title="Customer protection closeout board"
    >
      <AdminTaskGrid className="admin-mt-14">
        {visibleLanes.map((lane) => (
          <AdminActionCard
            actionLabel={lane.operatorAction}
            detail={lane.detail}
            href={lane.href}
            key={lane.title}
            signalClassName={commandToneClass(lane.tone)}
            signalLabel={commandToneLabel(lane.tone)}
            title={lane.title}
            variant="ops-task"
          >
            <div className="participant-list">
              <StatusBadge tone="neutral">{lane.status}</StatusBadge>
              <StatusBadge tone="neutral">{lane.bookings.length} booking(s)</StatusBadge>
            </div>
            {lane.bookings.length > 0 ? (
              <div className="stack">
                {lane.bookings.slice(0, 3).map((booking) => (
                  <span className="muted" key={`${lane.title}-${booking.id}`}>
                    {shortId(booking.id)} / {getCustomerLabel(booking)} /{' '}
                    {booking.payment?.status ?? 'no payment'}
                  </span>
                ))}
              </div>
            ) : null}
          </AdminActionCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
