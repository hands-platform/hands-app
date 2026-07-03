import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { PillClassBadge } from '../../components/status-badge';

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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
      description="Evidence-first checklist for operators before a refund is released, rejected, or handed to finance closeout."
      resultLabel={`${items.length} check(s)`}
      resultTone={items.length > 0 ? 'warning' : 'success'}
      title="Refund decision checklist"
    >
      <div className="participant-list admin-mb-12">
        <Link className="text-link" href="/bookings?view=manual-decision">
          Manual decision queue
        </Link>
      </div>
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
            <div>
              <PillClassBadge pillClass={item.pillClass}>{item.status}</PillClassBadge>
              <h3>{item.title}</h3>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.operatorRule}</small>
          </Link>
        ))}
      </div>
    </AdminFilterPanel>
  );
}
