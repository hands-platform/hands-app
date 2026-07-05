import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type PayoutReleaseBlockerReason = {
  readonly label: string;
  readonly pillClass: string;
};

export type PayoutReleaseBlockerQueueItem = {
  readonly action: string;
  readonly amount: number;
  readonly blockingReasons: readonly PayoutReleaseBlockerReason[];
  readonly currency: string;
  readonly detail: string;
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
          <div className="setup-stage-item" key={`${item.id}-${item.label}`}>
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
                  <StatusBadge key={reason.label} tone={statusBadgeToneFromPillClass(reason.pillClass)}>
                    {reason.label}
                  </StatusBadge>
                ))}
              </div>
            </div>
            <a className="text-link" href={`#${item.id}`}>
              Row
            </a>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="setup-stage-item">
            <span>OK</span>
            <div>
              <AdminEmptyState
                message="Transfer refs, withholding logs, payout holds, and earning attachments are clean for the current queue."
                title="No payout release blocker"
              />
            </div>
            <small>Clear</small>
          </div>
        ) : null}
      </div>
    </AdminTablePanel>
  );
}
