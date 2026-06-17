import Link from 'next/link';
import type { ActionGatePolicyChecklist } from './action-gate-policy-checklist';

type OperationsPolicyActionGateChecklistSectionProps = {
  readonly checklist: ActionGatePolicyChecklist;
};

export function OperationsPolicyActionGateChecklistSection({
  checklist,
}: OperationsPolicyActionGateChecklistSectionProps) {
  const allRecommended = checklist.alignedCount === checklist.totalCount;
  const visibleCards = checklist.cards.filter((item) => item.status !== 'Recommended');

  return (
    <section className="card admin-mb-16" id="action-gate-policy-checklist">
      <div className="ops-section-header">
        <div>
          <h2>Action gate policy checklist</h2>
          <p className="muted">
            These admin-editable policies explain which evidence operators should check before booking
            capture, release, cash-fee clearance, first-pick expiry, no-show closeout, and completed
            closeout actions.
          </p>
        </div>
        <span className={`pill ${allRecommended ? 'pill-success' : 'pill-warn'}`}>
          {checklist.alignedCount}/{checklist.totalCount} recommended
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {checklist.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {visibleCards.map((item) => (
          <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
            <span className={`pill ${item.pillClass}`}>{item.status}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <small>Current: {item.current}</small>
            <small>{item.operatorAction}</small>
          </Link>
        ))}
        {visibleCards.length === 0 ? (
          <div className="ops-task-card ops-task-done">
            <span className="pill pill-success">Clear</span>
            <h3>Action gate policies are aligned</h3>
            <p>
              Booking, cash, payout, first-pick, and no-show evidence gates follow the recommended
              baseline.
            </p>
            <small>Keep using booking detail evidence before irreversible operator decisions.</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
