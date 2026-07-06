import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from '../../components/status-badge';

export type NotificationDeliveryOpsQueueItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly key: string;
  readonly label: string;
  readonly tone: StatusBadgeTone;
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
      <AdminTaskGrid>
        {items.length ? (
          items.map((item) => (
            <AdminTaskCard
              detail={item.detail}
              key={item.key}
              leading={<StatusBadge tone={item.tone}>{item.label}</StatusBadge>}
              title={item.count}
            >
              <StatusBadgeLink href={item.href} tone="neutral">
                Open queue
              </StatusBadgeLink>
            </AdminTaskCard>
          ))
        ) : (
          <AdminTaskCard
            detail="Keep monitoring failed sends after FCM credentials and mobile token registration are enabled."
            leading={<StatusBadge tone="success">Ready</StatusBadge>}
            title="Delivery path is clean"
          />
        )}
      </AdminTaskGrid>
    </AdminSection>
  );
}
