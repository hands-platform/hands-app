import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

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
    <AdminSection
      className="admin-mb-16"
      description="Check old app versions, stale sessions, missing push readiness, and duplicate device usage."
      status={
        <StatusBadge tone={items.length ? 'warning' : 'success'}>
          {items.length ? `${items.length} review` : 'No session check'}
        </StatusBadge>
      }
      title="Session check queue"
    >
      {items.length ? (
        <AdminTaskGrid className="admin-mt-12">
          {items.slice(0, 12).map((item) => (
            <AdminTaskCard
              actionLabel={item.action}
              className={item.tone}
              detail={item.detail}
              key={item.key}
              leading={<small>{item.status}</small>}
              title={item.title}
            />
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState framed message="No visible session issue in the latest heartbeat snapshot." />
      )}
    </AdminSection>
  );
}
