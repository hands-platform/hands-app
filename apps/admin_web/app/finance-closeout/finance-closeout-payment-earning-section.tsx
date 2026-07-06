import { AdminTraceSummary } from '../../components/admin-overview-card';
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
      className="admin-mb-16"
      description="Confirms that completed services have earning records, captured payments, or a cash settlement trail. Cash jobs with negative wallet balance stay visible until settled."
      title="Payment-to-earning checks"
    >
      <AdminTraceSummary
        metrics={[
          {
            key: 'gross-represented',
            label: 'Gross represented',
            value: <MoneyText amount={summary.grossAmount} currency={currency} />,
            detail: `${summary.count} earning record(s)`,
          },
          {
            key: 'hands-fee',
            label: 'HANDS fee',
            value: <MoneyText amount={summary.platformFee} currency={currency} />,
            detail: 'Before VAT, withholding, and other cost views.',
          },
          {
            key: 'tax-withheld',
            label: 'Tax withheld',
            value: <MoneyText amount={summary.withholdingAmount} currency={currency} />,
            detail: 'Stored from active tax policy snapshots.',
          },
          {
            key: 'pending-partner-net',
            label: 'Pending Partner net',
            value: <MoneyText amount={summary.pendingNetAmount} currency={currency} />,
            detail: 'Positive payout or negative cash-fee debt.',
          },
        ]}
      />
    </AdminSection>
  );
}
