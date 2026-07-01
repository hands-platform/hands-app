import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { formatMoney } from '../../lib/admin-format';

export type PayoutMoneyFlowCard = {
  readonly amount: number;
  readonly detail: string;
  readonly label: string;
};

export type PayoutMoneyFlowCheck = {
  readonly action: string;
  readonly className: string;
  readonly detail: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type PayoutMoneyFlowSectionProps = {
  readonly cards: readonly PayoutMoneyFlowCard[];
  readonly checks: readonly PayoutMoneyFlowCheck[];
  readonly currency: string;
};

export function PayoutMoneyFlowSection({ cards, checks, currency }: PayoutMoneyFlowSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
      description="Reconciles payout batches against service pricing evidence before transfer: gross represented, partner payout, HANDS fee, withholding, and cash debt."
      id="release-blocker-queue"
      resultLabel={`${checks.length} check(s)`}
      resultTone={checks.length > 0 ? 'warning' : 'success'}
      title="Payout money flow"
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
      {checks.length ? (
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
      ) : (
        <p className="muted">No payout money flow check is visible for this range.</p>
      )}
    </AdminFilterPanel>
  );
}
