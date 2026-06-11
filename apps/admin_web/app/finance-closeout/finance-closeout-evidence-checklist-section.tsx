import Link from 'next/link';

import type { FinanceCloseoutEvidenceChecklistItem } from '../../lib/finance-closeout';

type FinanceCloseoutEvidenceChecklistSectionProps = {
  readonly items: readonly FinanceCloseoutEvidenceChecklistItem[];
};

export function FinanceCloseoutEvidenceChecklistSection({
  items,
}: FinanceCloseoutEvidenceChecklistSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Finance closeout evidence checklist</h2>
          <p className="muted">
            Final operator pass before the shift is handed off. Every item links to the queue where the source
            record can be checked.
          </p>
        </div>
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      </div>
      {items.length ? (
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
      ) : (
        <p className="muted">No finance closeout evidence item is visible for this range.</p>
      )}
    </section>
  );
}
