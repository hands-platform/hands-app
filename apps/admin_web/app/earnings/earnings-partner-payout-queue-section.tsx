import Link from 'next/link';

import { formatMoney } from '../../lib/admin-format';

export type EarningsPartnerPayoutQueueGroup = {
  readonly activeBatchSummary: string | null;
  readonly canBatch: boolean;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly nextAction: string;
  readonly providerHref: string;
  readonly providerName: string;
  readonly providerProfileId: string;
  readonly status: string;
  readonly transferRef: string;
  readonly unbatchedCount: number;
  readonly unbatchedNet: number;
  readonly walletBalance: number;
  readonly withholdingAmount: number;
};

type EarningsPartnerPayoutQueueSectionProps = {
  readonly groups: readonly EarningsPartnerPayoutQueueGroup[];
};

export function EarningsPartnerPayoutQueueSection({ groups }: EarningsPartnerPayoutQueueSectionProps) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ops-section-header">
        <div>
          <h2>Partner payout queue</h2>
          <p className="muted">
            Grouped by partner so finance can create one payout batch for all eligible unpaid earnings.
          </p>
        </div>
        <span className="pill pill-info">{groups.length} partner(s)</span>
      </div>
      {groups.length ? (
        <div className="setup-stage-list">
          {groups.slice(0, 12).map((group) => (
            <div className="setup-stage-item" key={group.providerProfileId}>
              <span>{group.status}</span>
              <div>
                <strong>{group.providerName}</strong>
                <p className="muted">
                  {group.unbatchedCount} unbatched earning(s) / net{' '}
                  {formatMoney(group.unbatchedNet, group.currency)}
                  {' / '}withholding {formatMoney(group.withholdingAmount, group.currency)}
                </p>
                <p className="muted">
                  Wallet balance {formatMoney(group.walletBalance, group.currency)}
                  {group.cashDebtAmount > 0
                    ? ` / cash debt ${formatMoney(group.cashDebtAmount, group.currency)} blocks payout batching`
                    : ' / no cash debt'}
                </p>
                <p className="muted">{group.activeBatchSummary ?? group.nextAction}</p>
              </div>
              <div className="actions">
                <Link className="text-link" href={group.providerHref}>
                  Partner
                </Link>
                {group.canBatch ? (
                  <form action="/earnings">
                    <input type="hidden" name="confirm" value="create-payout" />
                    <input type="hidden" name="providerProfileId" value={group.providerProfileId} />
                    <input type="hidden" name="transferRef" value={group.transferRef} />
                    <button type="submit">Review payout batch</button>
                  </form>
                ) : (
                  <span className="muted">No batch action</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No partner has unpaid earnings in the current admin result window.</p>
      )}
    </div>
  );
}
