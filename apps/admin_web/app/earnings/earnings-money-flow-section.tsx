import Link from 'next/link';

import { formatMoney } from '../../lib/admin-format';

export type EarningsMoneyFlowCard = {
  readonly amount: number;
  readonly detail: string;
  readonly label: string;
};

export type EarningsMoneyFlowCheck = {
  readonly action: string;
  readonly className: string;
  readonly detail: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type EarningsMoneyFlowSectionProps = {
  readonly cards: readonly EarningsMoneyFlowCard[];
  readonly checks: readonly EarningsMoneyFlowCheck[];
  readonly currency: string;
};

export function EarningsMoneyFlowSection({ cards, checks, currency }: EarningsMoneyFlowSectionProps) {
  return (
    <div className="card admin-mt-20">
      <div className="ops-section-header">
        <div>
          <h2>Money flow command center</h2>
          <p className="muted">
            Same finance language as booking detail: customer charge, partner payout, HANDS fee, tax,
            company net, and cash debt before payout.
          </p>
        </div>
        <Link className="text-link" href="/bookings">
          Trace bookings
        </Link>
      </div>
      <div className="service-trace-summary">
        {cards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{formatMoney(card.amount, currency)}</strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-16">
        {checks.map((check) => (
          <div className={`ops-task-card ${check.className}`} key={check.title}>
            <div>
              <span className={`pill ${check.pillClass}`}>{check.status}</span>
              <h3>{check.title}</h3>
              <p className="muted">{check.detail}</p>
            </div>
            <small>{check.action}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
