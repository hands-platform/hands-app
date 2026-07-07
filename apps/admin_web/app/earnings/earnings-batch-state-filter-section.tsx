import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeLinkFromPillClass } from '../../components/status-badge';

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
      description="Filter earning rows by payout state. Totals, finance queue, and cash debt queue stay based on the selected date range."
      resultLabel={`${ledgerCount} ledger row(s)`}
      resultTone={ledgerCount > 0 ? 'info' : 'warning'}
      title="Earning batch state filters"
    >
      <AdminFilterChipGroup ariaLabel="Earning batch state" className="admin-mt-12">
        {cards.map((card) => (
          <StatusBadgeLinkFromPillClass
            ariaCurrent={card.state === activeState ? 'page' : undefined}
            href={card.href}
            key={card.state}
            pillClass={activeBatchStateFilterClassName(card.state, activeState)}
          >
            {card.label} / {card.count}
          </StatusBadgeLinkFromPillClass>
        ))}
      </AdminFilterChipGroup>
      <AdminTraceSummary
        className="admin-mt-16"
        metrics={cards
          .filter((card) => card.state !== 'all')
          .map((card) => ({
            detail: <MoneyText amount={card.amount} currency={currency} />,
            key: card.state,
            label: card.label,
            value: card.count,
          }))}
      />
    </AdminTablePanel>
  );
}

function activeBatchStateFilterClassName(state: string, activeState: string) {
  return state === activeState ? 'pill-info' : 'pill-neutral';
}
