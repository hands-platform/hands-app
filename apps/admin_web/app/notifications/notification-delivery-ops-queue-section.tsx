import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from '../../components/status-badge';

export type NotificationDeliveryOpsQueueItem = {
  readonly actionLabel: string;
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
      description="Resolve failed or unconfirmed alerts first. Contact the affected user directly when the message is urgent."
      status={
        <StatusBadge tone={items.length ? 'warning' : 'success'}>
          {items.length
            ? `${items.length} queue ${items.length === 1 ? 'type' : 'types'}`
            : 'No delivery blockers'}
        </StatusBadge>
      }
      title="Needs action"
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
                {item.actionLabel}
              </StatusBadgeLink>
            </AdminTaskCard>
          ))
        ) : (
          <AdminTaskCard
            detail="No failed or unconfirmed mobile alerts currently need operator action."
            leading={<StatusBadge tone="success">Ready</StatusBadge>}
            title="Delivery queue is clear"
          />
        )}
      </AdminTaskGrid>
    </AdminSection>
  );
}
