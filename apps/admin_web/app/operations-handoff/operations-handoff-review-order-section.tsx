import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminQueueMeta } from '../../components/admin-overview-card';
import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { adminCountLabel } from '../../lib/admin-copy';

export type OperationsHandoffReviewOrderTone = 'danger' | 'info' | 'warn';

export type OperationsHandoffReviewOrderItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly owner: string;
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
      description="Start with incomplete handoff work. Completed records are available under View completed handoffs below."
      id="operations-handoff-review-order"
      status={
        <StatusBadge tone={visibleItems.length > 0 ? 'warning' : 'success'}>
          {visibleItems.length > 0 ? `${adminCountLabel(visibleItems.length, 'lane')} to review` : 'All reviewed'}
        </StatusBadge>
      }
      title="Incomplete handoff"
    >
      {visibleItems.length > 0 ? (
        <AdminTaskGrid>
          {visibleItems.map((item) => (
            <AdminActionCard
              actionLabel={item.label}
              href={item.href}
              key={item.id}
              signalClassName={reviewOrderSignalClass(item.tone)}
              signalLabel={reviewOrderSignalLabel(item.priority)}
              title={item.label}
              value={adminCountLabel(item.count, 'row')}
              variant="ops-task"
            >
              <AdminQueueMeta impact={item.detail} owner={item.owner} />
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState
          framed
          message="No handoff work is waiting for an operator in this window."
          title="No incomplete handoff"
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
