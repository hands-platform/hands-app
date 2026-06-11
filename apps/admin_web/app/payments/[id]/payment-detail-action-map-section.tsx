import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';

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
    <section className="card admin-mb-16" id="payment-action-map">
      {confirmation}
      <div className="ops-section-header">
        <div>
          <h2>Payment action execution map</h2>
          <p className="muted">Operator action checks for sync, capture, release, refund, and cash fee settlement.</p>
        </div>
        <span className={`pill ${hasBlockingReview ? 'pill-warn' : 'pill-success'}`}>
          {hasBlockingReview ? 'Review needed' : 'No urgent block'}
        </span>
      </div>
      <div className="setup-stage-list">
        {rows.map((row) => (
          <div className="setup-stage-item" key={row.action}>
            <span className={`pill ${row.pillClass}`}>{row.status}</span>
            <div>
              <strong>{row.action}</strong>
              <p className="muted">{row.reason}</p>
              <small>{row.operatorRule}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="actions admin-mt-16">
        <ActionMenu actions={actions} label={actionLabel} />
      </div>
      {cashDebtSettlementForm}
    </section>
  );
}
