import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type PayoutMoneyFlowCard = {
  readonly amount: number;
  readonly detail: string;
  readonly label: string;
};

export type PayoutMoneyFlowCheck = {
  readonly action: string;
  readonly className: string;
  readonly detail: ReactNode;
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
    <AdminTablePanel
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
            <strong>
              <MoneyText amount={card.amount} currency={currency} />
            </strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </div>
      {checks.length ? (
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
      ) : (
        <AdminEmptyState framed message="No payout money flow check is visible for this range." />
      )}
    </AdminTablePanel>
  );
}
