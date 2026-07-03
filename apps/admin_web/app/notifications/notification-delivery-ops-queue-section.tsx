import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';

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
        <span className={`pill ${items.length ? 'pill-warn' : 'pill-success'}`}>
          {items.length ? `${items.length} issue(s)` : 'No delivery blockers'}
        </span>
      }
      title="Delivery operations queue"
    >
      <div className="ops-task-grid">
        {items.length ? (
          items.map((item) => (
            <div className="ops-task-card" key={item.key}>
              <span className={`pill ${item.tone}`}>{item.label}</span>
              <h3 className="admin-mt-10">{item.count}</h3>
              <p className="muted">{item.detail}</p>
              <AdminFormControlLink className="pill pill-neutral" href={item.href}>
                Open queue
              </AdminFormControlLink>
            </div>
          ))
        ) : (
          <div className="ops-task-card">
            <span className="pill pill-success">Ready</span>
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
