import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { formatRelativeTime } from '../../lib/admin-format';

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
    <AdminSection
      actions={
        <AdminTextLink href="/cash-settlements">
          Open cash settlements
        </AdminTextLink>
      }
      bodyClassName="detail-grid admin-mt-16"
      className="admin-mb-16"
      description="Negative wallet balances are factual settlement rows. Partners can stay visible, but marketplace final acceptance, service start, and payout release wait until the company fee or approved offset is recorded."
      title="Cash debt handoff"
    >
      <div>
        <span className="muted">Wallet-gated Partners</span>
        <h3>{providerCount}</h3>
      </div>
      <div>
        <span className="muted">Open cash rows</span>
        <h3>{rowCount}</h3>
      </div>
      <div>
        <span className="muted">Wallet debt</span>
        <h3>
          <MoneyText amount={cashDebtAmount} currency={currency} />
        </h3>
      </div>
      <div>
        <span className="muted">Oldest open</span>
        <h3>{oldestOpenLabel(oldestOpenAt)}</h3>
      </div>
    </AdminSection>
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
