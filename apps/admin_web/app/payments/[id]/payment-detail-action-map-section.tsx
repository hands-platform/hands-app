import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminStageItem } from '../../../components/admin-stage-item';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';

export type PaymentDetailActionMapRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

type PaymentDetailActionMapSectionProps = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly cashDebtSettlementForm: ReactNode;
  readonly confirmation: ReactNode;
  readonly hasBlockingReview: boolean;
  readonly rows: readonly PaymentDetailActionMapRow[];
};

export function PaymentDetailActionMapSection({
  actionLabel,
  actions,
  cashDebtSettlementForm,
  confirmation,
  hasBlockingReview,
  rows,
}: PaymentDetailActionMapSectionProps) {
  return (
    <AdminTablePanel
      description="Operator action checks for sync, capture, release, refund, and cash fee settlement."
      id="payment-action-map"
      resultLabel={hasBlockingReview ? 'Review needed' : 'No urgent block'}
      resultTone={hasBlockingReview ? 'warning' : 'success'}
      title="Payment action execution map"
    >
      {confirmation}
      <div className="setup-stage-list">
        {rows.map((row) => (
          <AdminStageItem key={row.action}>
            <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.status}</StatusBadgeFromPillClass>
            <div>
              <strong>{row.action}</strong>
              <p className="muted">{row.reason}</p>
              <small>{row.operatorRule}</small>
            </div>
          </AdminStageItem>
        ))}
      </div>
      <div className="actions admin-mt-16">
        <ActionMenu actions={actions} label={actionLabel} />
      </div>
      {cashDebtSettlementForm}
    </AdminTablePanel>
  );
}
