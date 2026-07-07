import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminStageItemLink, AdminStageList } from '../../components/admin-stage-item';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { FinanceCloseoutShiftActionMapItem } from '../../lib/finance-closeout';

type FinanceCloseoutShiftActionMapSectionProps = {
  readonly items: readonly FinanceCloseoutShiftActionMapItem[];
};

export function FinanceCloseoutShiftActionMapSection({ items }: FinanceCloseoutShiftActionMapSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminTextLink href="/operations-handoff">
          Open handoff
        </AdminTextLink>
      }
      className="admin-mb-16"
      description="Final finance pass before handoff. Each row points to the source queue and states what keeps the shift open."
      title="Shift close action map"
    >
      <AdminStageList className="admin-mt-12">
        {items.length ? (
          items.map((item) => (
            <AdminStageItemLink href={item.href} key={item.action}>
              <StatusBadgeFromPillClass pillClass={item.pillClass}>
                {item.status}
              </StatusBadgeFromPillClass>
              <div>
                <strong>{item.action}</strong>
                <p className="muted">{item.reason}</p>
                <small>{item.operatorRule}</small>
              </div>
            </AdminStageItemLink>
          ))
        ) : (
          <AdminEmptyState framed message="No shift close action is visible for this range." />
        )}
      </AdminStageList>
    </AdminSection>
  );
}
