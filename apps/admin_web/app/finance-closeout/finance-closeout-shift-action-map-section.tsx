import Link from 'next/link';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
import type { FinanceCloseoutShiftActionMapItem } from '../../lib/finance-closeout';

type FinanceCloseoutShiftActionMapSectionProps = {
  readonly items: readonly FinanceCloseoutShiftActionMapItem[];
};

export function FinanceCloseoutShiftActionMapSection({ items }: FinanceCloseoutShiftActionMapSectionProps) {
  return (
    <AdminSection
      actions={
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      }
      bodyClassName="setup-stage-list admin-mt-12"
      className="admin-mb-16"
      description="Final finance pass before handoff. Each row points to the source queue and states what keeps the shift open."
      title="Shift close action map"
    >
      {items.length ? (
        items.map((item) => (
          <Link className="setup-stage-item" href={item.href} key={item.action}>
            <PillClassBadge pillClass={item.pillClass}>{item.status}</PillClassBadge>
            <div>
              <strong>{item.action}</strong>
              <p className="muted">{item.reason}</p>
              <small>{item.operatorRule}</small>
            </div>
          </Link>
        ))
      ) : (
        <AdminEmptyState framed message="No shift close action is visible for this range." />
      )}
    </AdminSection>
  );
}
