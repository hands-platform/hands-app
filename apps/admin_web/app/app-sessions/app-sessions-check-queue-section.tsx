import { AdminSectionHeader } from '../../components/admin-page-template';

export type SessionCheckQueueItem = {
  readonly action: string;
  readonly detail: string;
  readonly key: string;
  readonly status: string;
  readonly title: string;
  readonly tone: string;
};

type AppSessionsCheckQueueSectionProps = {
  readonly items: readonly SessionCheckQueueItem[];
};

export function AppSessionsCheckQueueSection({ items }: AppSessionsCheckQueueSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Check old app versions, stale sessions, missing push readiness, and duplicate device usage."
        status={
          <span className={`pill ${items.length ? 'pill-warn' : 'pill-success'}`}>
            {items.length ? `${items.length} review` : 'No session check'}
          </span>
        }
        title="Session check queue"
      />
      {items.length ? (
        <div className="ops-task-grid admin-mt-12">
          {items.slice(0, 12).map((item) => (
            <div className={`ops-task-card ${item.tone}`} key={item.key}>
              <small>{item.status}</small>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <span className="ops-task-card-action">{item.action}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No visible session issue in the latest heartbeat snapshot.</p>
      )}
    </section>
  );
}
