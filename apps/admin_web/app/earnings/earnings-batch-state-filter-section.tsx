import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { PillClassBadgeLink } from '../../components/status-badge';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Filter the raw earning ledger by payout readiness. Totals, finance queue, and cash debt queue stay based on the selected date range."
      resultLabel={`${ledgerCount} ledger row(s)`}
      resultTone={ledgerCount > 0 ? 'info' : 'warning'}
      title="Earning batch state filters"
    >
      <div className="filter-row admin-mt-12">
        {cards.map((card) => (
          <PillClassBadgeLink
            ariaCurrent={card.state === activeState ? 'page' : undefined}
            href={card.href}
            key={card.state}
            pillClass={activeBatchStateFilterClassName(card.state, activeState)}
          >
            {card.label} / {card.count}
          </PillClassBadgeLink>
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
    </AdminFilterPanel>
  );
}

function activeBatchStateFilterClassName(state: string, activeState: string) {
  return state === activeState ? 'pill-info' : 'pill-neutral';
}
