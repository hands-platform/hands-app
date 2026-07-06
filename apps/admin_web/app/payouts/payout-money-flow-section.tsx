import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

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
      {checks.length ? (
        <AdminTaskGrid className="admin-mt-16">
          {checks.map((check) => (
            <AdminTaskCard
              actionLabel={check.action}
              className={check.className}
              detail={check.detail}
              key={check.title}
              leading={
                <StatusBadgeFromPillClass pillClass={check.pillClass}>
                  {check.status}
                </StatusBadgeFromPillClass>
              }
              title={check.title}
            />
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState framed message="No payout money flow check is visible for this range." />
      )}
    </AdminTablePanel>
  );
}
