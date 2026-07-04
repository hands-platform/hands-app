import Link from 'next/link';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
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
          <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
            <div>
              <PillClassBadge pillClass={item.pillClass}>{item.status}</PillClassBadge>
              <h3>{item.title}</h3>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.operatorRule}</small>
          </Link>
        ))
      ) : (
        <AdminEmptyState framed message="No finance closeout evidence item is visible for this range." />
      )}
    </AdminSection>
  );
}
