import Link from 'next/link';

import { formatMoney, formatRelativeTime } from '../../lib/admin-format';

type FinanceCloseoutCashDebtHandoffSectionProps = {
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly oldestOpenAt?: string | null;
  readonly providerCount: number;
  readonly rowCount: number;
};

export function FinanceCloseoutCashDebtHandoffSection({
  cashDebtAmount,
  currency,
  oldestOpenAt,
  providerCount,
  rowCount,
}: FinanceCloseoutCashDebtHandoffSectionProps) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Cash debt handoff</h2>
          <p className="muted">
            Negative wallet balances are factual settlement rows. Partners can stay visible, but marketplace
            final acceptance, service start, and payout release wait until the company fee or approved offset is
            recorded.
          </p>
        </div>
        <Link className="text-link" href="/cash-settlements">
          Open cash settlements
        </Link>
      </div>
      <div className="detail-grid" style={{ marginTop: 16 }}>
        <div>
          <span className="muted">Wallet-gated partners</span>
          <h3>{providerCount}</h3>
        </div>
        <div>
          <span className="muted">Open cash rows</span>
          <h3>{rowCount}</h3>
        </div>
        <div>
          <span className="muted">Wallet debt</span>
          <h3>{formatMoney(cashDebtAmount, currency)}</h3>
        </div>
        <div>
          <span className="muted">Oldest open</span>
          <h3>{oldestOpenLabel(oldestOpenAt)}</h3>
        </div>
      </div>
    </section>
  );
}

function oldestOpenLabel(oldestOpenAt?: string | null) {
  if (!oldestOpenAt) {
    return '-';
  }

  return formatRelativeTime(oldestOpenAt, {
    emptyFallback: '-',
    invalidFallback: oldestOpenAt,
  });
}
