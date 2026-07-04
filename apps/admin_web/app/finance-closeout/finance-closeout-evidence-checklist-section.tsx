import Link from 'next/link';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { FinanceCloseoutEvidenceChecklistItem } from '../../lib/finance-closeout';

type FinanceCloseoutEvidenceChecklistSectionProps = {
  readonly items: readonly FinanceCloseoutEvidenceChecklistItem[];
};

export function FinanceCloseoutEvidenceChecklistSection({
  items,
}: FinanceCloseoutEvidenceChecklistSectionProps) {
  return (
    <AdminSection
      actions={
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      }
      bodyClassName="ops-task-grid"
      className="admin-mb-16"
      description="Final operator pass before the shift is handed off. Every item links to the queue where the source record can be checked."
      title="Finance closeout evidence checklist"
    >
      {items.length ? (
        items.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorRule}
            className={item.className}
            detail={item.detail}
            href={item.href}
            key={item.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>
                {item.status}
              </StatusBadge>
            }
            title={item.title}
            variant="ops-task"
          />
        ))
      ) : (
        <AdminEmptyState framed message="No finance closeout evidence item is visible for this range." />
      )}
    </AdminSection>
  );
}
