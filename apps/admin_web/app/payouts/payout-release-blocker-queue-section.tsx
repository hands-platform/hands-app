import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

export type PayoutReleaseBlockerReason = {
  readonly label: string;
  readonly pillClass: string;
};

export type PayoutReleaseBlockerQueueItem = {
  readonly action: string;
  readonly amount: number;
  readonly blockingReasons: readonly PayoutReleaseBlockerReason[];
  readonly currency: string;
  readonly detail: ReactNode;
  readonly id: string;
  readonly label: string;
  readonly providerLabel: string;
  readonly severity: 'Block' | 'Check';
};

type PayoutReleaseBlockerQueueSectionProps = {
  readonly items: readonly PayoutReleaseBlockerQueueItem[];
};

export function PayoutReleaseBlockerQueueSection({ items }: PayoutReleaseBlockerQueueSectionProps) {
  return (
    <AdminTablePanel
      description="Transfer-facing list of batches that should not be paid until finance, tax, partner checks, and bank references are clean."
      resultLabel={items.length ? `${items.length} blocker(s)` : 'Clear'}
      resultTone={items.length > 0 ? 'danger' : 'success'}
      title="Release blocker queue"
    >
      <div className="setup-stage-list">
        {items.map((item) => (
          <AdminStageItem key={`${item.id}-${item.label}`}>
            <span>{item.severity}</span>
            <div>
              <strong>
                {item.providerLabel} / <MoneyText amount={item.amount} currency={item.currency} />
              </strong>
              <p className="muted">
                {item.label}: {item.detail}
              </p>
              <p className="muted">{item.action}</p>
              <div className="participant-list admin-mt-8">
                {item.blockingReasons.map((reason) => (
                  <StatusBadgeFromPillClass key={reason.label} pillClass={reason.pillClass}>
                    {reason.label}
                  </StatusBadgeFromPillClass>
                ))}
              </div>
            </div>
            <AdminTextLink href={`#${item.id}`}>
              Row
            </AdminTextLink>
          </AdminStageItem>
        ))}
        {items.length === 0 ? (
          <AdminStageItem>
            <span>OK</span>
            <div>
              <AdminEmptyState
                message="Transfer refs, withholding logs, payout holds, and earning attachments are clean for the current queue."
                title="No payout release blocker"
              />
            </div>
            <small>Clear</small>
          </AdminStageItem>
        ) : null}
      </div>
    </AdminTablePanel>
  );
}
