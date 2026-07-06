import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import type { ServiceBookingReadinessItem } from '../../lib/service-booking-readiness-queue';

type ServiceBookingReadinessQueueSectionProps = {
  readonly blockedCount: number;
  readonly items: readonly ServiceBookingReadinessItem[];
  readonly warningCount: number;
};

const VISIBLE_READINESS_ITEM_LIMIT = 12;

export function ServiceBookingReadinessQueueSection({
  blockedCount,
  items,
  warningCount,
}: ServiceBookingReadinessQueueSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Shows services that can block customer booking or create a negative finance result before Partners start using those prices."
      status={
        <div className="actions">
          <StatusBadge tone={blockedCount ? 'danger' : 'success'}>
            {blockedCount} blocked
          </StatusBadge>
          <StatusBadge tone={warningCount ? 'warning' : 'success'}>
            {warningCount} warning
          </StatusBadge>
        </div>
      }
      title="Booking readiness queue"
    >
      {items.length ? (
        <div className="setup-stage-list">
          {items.slice(0, VISIBLE_READINESS_ITEM_LIMIT).map((item) => (
            <AdminStageItem key={`${item.serviceId}-${item.title}-${item.detail}`}>
              <span>{item.status}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
                <p className="muted">{item.action}</p>
              </div>
              <small>{item.serviceId.slice(0, 8)}</small>
            </AdminStageItem>
          ))}
        </div>
      ) : (
        <p className="muted">
          All active service rows have a base payout rule and a positive projected company commission.
        </p>
      )}
    </AdminSection>
  );
}
