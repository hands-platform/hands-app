import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeLink, statusBadgeToneFromPillClass } from '../../components/status-badge';

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
    <AdminTablePanel
      description="Filter the raw earning ledger by payout readiness. Totals, finance queue, and cash debt queue stay based on the selected date range."
      resultLabel={`${ledgerCount} ledger row(s)`}
      resultTone={ledgerCount > 0 ? 'info' : 'warning'}
      title="Earning batch state filters"
    >
      <AdminFilterChipGroup ariaLabel="Earning batch state" className="admin-mt-12">
        {cards.map((card) => (
          <StatusBadgeLink
            ariaCurrent={card.state === activeState ? 'page' : undefined}
            href={card.href}
            key={card.state}
            tone={statusBadgeToneFromPillClass(activeBatchStateFilterClassName(card.state, activeState))}
          >
            {card.label} / {card.count}
          </StatusBadgeLink>
        ))}
      </AdminFilterChipGroup>
      <div className="service-trace-summary admin-mt-16">
        {cards
          .filter((card) => card.state !== 'all')
          .map((card) => (
            <div key={card.state}>
              <span>{card.label}</span>
              <strong>{card.count}</strong>
              <small>
                <MoneyText amount={card.amount} currency={currency} />
              </small>
            </div>
          ))}
      </div>
    </AdminTablePanel>
  );
}

function activeBatchStateFilterClassName(state: string, activeState: string) {
  return state === activeState ? 'pill-info' : 'pill-neutral';
}
