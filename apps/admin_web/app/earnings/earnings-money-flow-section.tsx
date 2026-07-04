import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminTaskCard } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Same finance language as booking detail: customer charge, Partner payout, HANDS fee, tax, company net, and cash debt before payout."
      resultLabel={`${checks.length} check(s)`}
      resultTone={checks.length > 0 ? 'warning' : 'success'}
      title="Money flow command center"
    >
      <div className="participant-list admin-mb-12">
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
    </AdminFilterPanel>
  );
}
