import { AdminSection } from '../../components/admin-surface';
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
            <div className="ops-task-card" key={item.key}>
              <PillClassBadge pillClass={item.tone}>{item.label}</PillClassBadge>
              <h3 className="admin-mt-10">{item.count}</h3>
              <p className="muted">{item.detail}</p>
              <PillClassBadgeLink href={item.href} pillClass="pill-neutral">
                Open queue
              </PillClassBadgeLink>
            </div>
          ))
        ) : (
          <div className="ops-task-card">
            <StatusBadge tone="success">Ready</StatusBadge>
            <h3 className="admin-mt-10">Delivery path is clean</h3>
            <p className="muted">
              Keep monitoring failed sends after FCM credentials and mobile token registration are enabled.
            </p>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
