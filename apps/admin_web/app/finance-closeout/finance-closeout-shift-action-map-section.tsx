import Link from 'next/link';

import type { FinanceCloseoutShiftActionMapItem } from '../../lib/finance-closeout';

type FinanceCloseoutShiftActionMapSectionProps = {
  readonly items: readonly FinanceCloseoutShiftActionMapItem[];
};

export function FinanceCloseoutShiftActionMapSection({ items }: FinanceCloseoutShiftActionMapSectionProps) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Shift close action map</h2>
          <p className="muted">
            Final finance pass before handoff. Each row points to the source queue and states what keeps the
            shift open.
          </p>
        </div>
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      </div>
      {items.length ? (
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {items.map((item) => (
            <Link className="setup-stage-item" href={item.href} key={item.action}>
              <span className={`pill ${item.pillClass}`}>{item.status}</span>
              <div>
                <strong>{item.action}</strong>
                <p className="muted">{item.reason}</p>
                <small>{item.operatorRule}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">No shift close action is visible for this range.</p>
      )}
    </section>
  );
}
