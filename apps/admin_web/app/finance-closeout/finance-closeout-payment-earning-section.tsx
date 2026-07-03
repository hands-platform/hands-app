import Link from 'next/link';

import { AdminSection } from '../../components/admin-surface';
import type { AdminEarningSummary } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';

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
        <Link className="text-link" href="/earnings">
          Open earnings
        </Link>
      }
      bodyClassName="service-trace-summary"
      className="admin-mb-16"
      description="Confirms that completed services have earning records, captured payments, or a cash settlement trail. Cash jobs with negative wallet balance stay visible until settled."
      title="Payment-to-earning checks"
    >
      <div>
        <span>Gross represented</span>
        <strong>{formatMoney(summary.grossAmount, currency)}</strong>
        <small>{summary.count} earning record(s)</small>
      </div>
      <div>
        <span>HANDS fee</span>
        <strong>{formatMoney(summary.platformFee, currency)}</strong>
        <small>Before VAT, withholding, and other cost views.</small>
      </div>
      <div>
        <span>Tax withheld</span>
        <strong>{formatMoney(summary.withholdingAmount, currency)}</strong>
        <small>Stored from active tax policy snapshots.</small>
      </div>
      <div>
        <span>Pending Partner net</span>
        <strong>{formatMoney(summary.pendingNetAmount, currency)}</strong>
        <small>Positive payout or negative cash-fee debt.</small>
      </div>
    </AdminSection>
  );
}
