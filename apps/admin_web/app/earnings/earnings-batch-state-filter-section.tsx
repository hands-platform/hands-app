import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';

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
      <div className="booking-date-filter-bar earnings-filter-group admin-mt-12">
        <span className="earnings-filter-group-label">State</span>
        <AdminSegmentedControl
          activeValue={activeState}
          ariaLabel="Earning batch state"
          className="earnings-filter-buttons"
          options={cards.map((card) => ({
            href: card.href,
            label: `${card.label} / ${card.count}`,
            value: card.state,
          }))}
        />
      </div>
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
