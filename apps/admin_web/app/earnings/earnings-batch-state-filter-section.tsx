import Link from 'next/link';

import { formatMoney } from '../../lib/admin-format';

export type EarningsBatchStateCard = {
  readonly amount: number;
  readonly count: number;
  readonly href: string;
  readonly label: string;
  readonly state: string;
};

type EarningsBatchStateFilterSectionProps = {
  readonly activeState: string;
  readonly cards: readonly EarningsBatchStateCard[];
  readonly currency: string;
  readonly ledgerCount: number;
};

export function EarningsBatchStateFilterSection({
  activeState,
  cards,
  currency,
  ledgerCount,
}: EarningsBatchStateFilterSectionProps) {
  return (
    <div className="card admin-mt-20">
      <div className="ops-section-header">
        <div>
          <h2>Earning batch state filters</h2>
          <p className="muted">
            Filter the raw earning ledger by payout readiness. Totals, finance queue, and cash debt queue
            stay based on the selected date range.
          </p>
        </div>
        <span className="pill pill-info">{ledgerCount} ledger row(s)</span>
      </div>
      <div className="filter-row admin-mt-12">
        {cards.map((card) => (
          <Link
            className={`filter-pill ${card.state === activeState ? 'pill-info' : ''}`}
            href={card.href}
            key={card.state}
          >
            {card.label} / {card.count}
          </Link>
        ))}
      </div>
      <div className="service-trace-summary admin-mt-16">
        {cards
          .filter((card) => card.state !== 'all')
          .map((card) => (
            <div key={card.state}>
              <span>{card.label}</span>
              <strong>{card.count}</strong>
              <small>{formatMoney(card.amount, currency)}</small>
            </div>
          ))}
      </div>
    </div>
  );
}
