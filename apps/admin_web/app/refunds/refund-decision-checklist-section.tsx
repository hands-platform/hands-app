import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card admin-mb-16">
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/bookings?view=manual-decision">
            Manual decision queue
          </Link>
        }
        description="Evidence-first checklist for operators before a refund is released, rejected, or handed to finance closeout."
        title="Refund decision checklist"
      />
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
            <div>
              <span className={`pill ${item.pillClass}`}>{item.status}</span>
              <h3>{item.title}</h3>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.operatorRule}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
