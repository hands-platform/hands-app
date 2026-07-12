import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

export type OperationsHandoffReviewOrderTone = 'danger' | 'info' | 'warn';

export type OperationsHandoffReviewOrderItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly priority: number;
  readonly tone: OperationsHandoffReviewOrderTone;
};

type OperationsHandoffReviewOrderSectionProps = {
  readonly items: readonly OperationsHandoffReviewOrderItem[];
};

export function OperationsHandoffReviewOrderSection({
  items,
}: OperationsHandoffReviewOrderSectionProps) {
  const visibleItems = items
    .filter((item) => item.count > 0)
    .sort((a, b) => a.priority - b.priority || b.count - a.count);

  return (
    <AdminSection
      bodyClassName={visibleItems.length > 0 ? undefined : 'admin-section-empty-body'}
      className="admin-mb-16 operations-handoff-review-order-card"
      description="Start with these history lanes before opening the longer paginated tables below."
      id="operations-handoff-review-order"
      status={
        <StatusBadge tone={visibleItems.length > 0 ? 'warning' : 'success'}>
          {visibleItems.length > 0 ? `${visibleItems.length} lane(s) to review` : 'All reviewed'}
        </StatusBadge>
      }
      title="Review order"
    >
      {visibleItems.length > 0 ? (
        <AdminTaskGrid>
          {visibleItems.map((item) => (
            <AdminActionCard
              actionLabel="Open section"
              detail={item.detail}
              href={item.href}
              key={item.id}
              signalClassName={reviewOrderSignalClass(item.tone)}
              signalLabel={reviewOrderSignalLabel(item.priority)}
              title={item.label}
              value={`${item.count} row(s)`}
              variant="ops-task"
            />
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState
          framed
          message="No full-history rows need review in this window."
          title="No review order needed"
        />
      )}
    </AdminSection>
  );
}

function reviewOrderSignalClass(tone: OperationsHandoffReviewOrderTone) {
  if (tone === 'danger') return 'signal-danger';
  if (tone === 'warn') return 'signal-warn';
  return 'signal-info';
}

function reviewOrderSignalLabel(priority: number) {
  return `#${priority}`;
}
