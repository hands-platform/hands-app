import { AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

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
    <AdminTablePanel
      description="Same finance language as booking detail: customer charge, Partner payout, HANDS fee, tax, company net, and cash debt before payout."
      resultLabel={`${checks.length} check(s)`}
      resultTone={checks.length > 0 ? 'warning' : 'success'}
      title="Money flow command center"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/bookings">
          Trace bookings
        </AdminTextLink>
      </div>
      <AdminTraceSummary
        metrics={cards.map((card) => ({
          detail: card.detail,
          key: card.label,
          label: card.label,
          value: <MoneyText amount={card.amount} currency={currency} />,
        }))}
      />
      <div className="ops-task-grid admin-mt-16">
        {checks.map((check) => (
          <AdminTaskCard
            actionLabel={check.action}
            className={check.className}
            detail={check.detail}
            key={check.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(check.pillClass)}>
                {check.status}
              </StatusBadge>
            }
            title={check.title}
          />
        ))}
      </div>
    </AdminTablePanel>
  );
}
