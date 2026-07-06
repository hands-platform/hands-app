import { AdminActionCard, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

export type RefundDecisionChecklistItem = {
  readonly className: string;
  readonly detail: string;
  readonly href: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type RefundDecisionChecklistSectionProps = {
  readonly items: readonly RefundDecisionChecklistItem[];
};

export function RefundDecisionChecklistSection({ items }: RefundDecisionChecklistSectionProps) {
  return (
    <AdminTablePanel
      description="Evidence-first checklist for operators before a refund is released, rejected, or handed to finance closeout."
      resultLabel={`${items.length} check(s)`}
      resultTone={items.length > 0 ? 'warning' : 'success'}
      title="Refund decision checklist"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/bookings?view=manual-decision">
          Manual decision queue
        </AdminTextLink>
      </div>
      <AdminTaskGrid>
        {items.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorRule}
            className={item.className}
            detail={item.detail}
            href={item.href}
            key={item.title}
            leading={
              <StatusBadgeFromPillClass pillClass={item.pillClass}>
                {item.status}
              </StatusBadgeFromPillClass>
            }
            title={item.title}
            variant="ops-task"
          />
        ))}
      </AdminTaskGrid>
    </AdminTablePanel>
  );
}
