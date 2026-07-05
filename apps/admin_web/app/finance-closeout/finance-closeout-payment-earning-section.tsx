import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import type { AdminEarningSummary } from '../../lib/admin-api';

type FinanceCloseoutPaymentEarningSectionProps = {
  readonly currency: string;
  readonly summary: AdminEarningSummary;
};

export function FinanceCloseoutPaymentEarningSection({
  currency,
  summary,
}: FinanceCloseoutPaymentEarningSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminTextLink href="/earnings">
          Open earnings
        </AdminTextLink>
      }
      bodyClassName="service-trace-summary"
      className="admin-mb-16"
      description="Confirms that completed services have earning records, captured payments, or a cash settlement trail. Cash jobs with negative wallet balance stay visible until settled."
      title="Payment-to-earning checks"
    >
      <div>
        <span>Gross represented</span>
        <strong>
          <MoneyText amount={summary.grossAmount} currency={currency} />
        </strong>
        <small>{summary.count} earning record(s)</small>
      </div>
      <div>
        <span>HANDS fee</span>
        <strong>
          <MoneyText amount={summary.platformFee} currency={currency} />
        </strong>
        <small>Before VAT, withholding, and other cost views.</small>
      </div>
      <div>
        <span>Tax withheld</span>
        <strong>
          <MoneyText amount={summary.withholdingAmount} currency={currency} />
        </strong>
        <small>Stored from active tax policy snapshots.</small>
      </div>
      <div>
        <span>Pending Partner net</span>
        <strong>
          <MoneyText amount={summary.pendingNetAmount} currency={currency} />
        </strong>
        <small>Positive payout or negative cash-fee debt.</small>
      </div>
    </AdminSection>
  );
}
