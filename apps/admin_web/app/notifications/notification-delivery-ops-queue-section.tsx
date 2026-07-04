import { AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { PillClassBadge, PillClassBadgeLink, StatusBadge } from '../../components/status-badge';

export type NotificationDeliveryOpsQueueItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly key: string;
  readonly label: string;
  readonly tone: string;
};

type NotificationDeliveryOpsQueueSectionProps = {
  readonly items: readonly NotificationDeliveryOpsQueueItem[];
};

export function NotificationDeliveryOpsQueueSection({ items }: NotificationDeliveryOpsQueueSectionProps) {
  return (
    <AdminSection
      className="soft-card admin-mb-16"
      description="Fix current delivery blockers before retrying, so alert sends do not loop."
      status={
        <StatusBadge tone={items.length ? 'warning' : 'success'}>
          {items.length ? `${items.length} issue(s)` : 'No delivery blockers'}
        </StatusBadge>
      }
      title="Delivery operations queue"
    >
      <div className="ops-task-grid">
        {items.length ? (
          items.map((item) => (
            <AdminTaskCard
              detail={item.detail}
              key={item.key}
              leading={<PillClassBadge pillClass={item.tone}>{item.label}</PillClassBadge>}
              title={item.count}
            >
              <PillClassBadgeLink href={item.href} pillClass="pill-neutral">
                Open queue
              </PillClassBadgeLink>
            </AdminTaskCard>
          ))
        ) : (
          <AdminTaskCard
            detail="Keep monitoring failed sends after FCM credentials and mobile token registration are enabled."
            leading={<StatusBadge tone="success">Ready</StatusBadge>}
            title="Delivery path is clean"
          />
        )}
      </div>
    </AdminSection>
  );
}
