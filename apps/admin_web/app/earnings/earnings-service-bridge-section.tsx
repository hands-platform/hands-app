import Link from 'next/link';

import { formatMoney } from '../../lib/admin-format';

export type EarningsServiceBridgeItem = {
  readonly batchedCount: number;
  readonly bookingCount: number;
  readonly cashBookingCount: number;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly grossAmount: number;
  readonly groupKey: string;
  readonly key: string;
  readonly label: string;
  readonly matrixBackedCount: number;
  readonly netAmount: number;
  readonly netCompanyFee: number;
  readonly otherCostAmount: number;
  readonly paidCount: number;
  readonly platformFee: number;
  readonly providerPayoutAmount: number;
  readonly unbatchedCount: number;
  readonly vatAmount: number;
  readonly withholdingAmount: number;
};

type EarningsServiceBridgeSectionProps = {
  readonly currency: string;
  readonly items: readonly EarningsServiceBridgeItem[];
};

export function EarningsServiceBridgeSection({ currency, items }: EarningsServiceBridgeSectionProps) {
  return (
    <div className="card admin-card-scroll" style={{ marginTop: 20 }}>
      <div className="ops-section-header">
        <div>
          <h2>Service to earnings bridge</h2>
          <p className="muted">
            Confirms which service duration options are creating partner net, HANDS platform fee, tax
            withholding, cash wallet debt, and payout-batch pressure.
          </p>
        </div>
        <Link className="text-link" href="/services">
          Review service pricing
        </Link>
      </div>
      <div className="service-trace-summary">
        <ServiceBridgeMetric label="Service options" value={String(items.length)} />
        <ServiceBridgeMetric amount={sumBridge(items, 'grossAmount')} currency={currency} label="Gross" />
        <ServiceBridgeMetric amount={sumBridge(items, 'netAmount')} currency={currency} label="Partner net" />
        <ServiceBridgeMetric amount={sumBridge(items, 'providerPayoutAmount')} currency={currency} label="Partner payout" />
        <ServiceBridgeMetric amount={sumBridge(items, 'platformFee')} currency={currency} label="Platform fee" />
        <ServiceBridgeMetric
          amount={sumBridge(items, 'vatAmount') + sumBridge(items, 'otherCostAmount')}
          currency={currency}
          label="VAT / cost"
        />
        <ServiceBridgeMetric amount={sumBridge(items, 'withholdingAmount')} currency={currency} label="Tax withheld" />
        <ServiceBridgeMetric amount={sumBridge(items, 'cashDebtAmount')} currency={currency} label="Cash debt" />
      </div>
      {items.length ? (
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Service option</th>
              <th>Bookings</th>
              <th>Gross</th>
              <th>Partner payout</th>
              <th>Partner net</th>
              <th>Platform fee</th>
              <th>VAT / cost</th>
              <th>Tax withheld</th>
              <th>Net company fee</th>
              <th>Cash debt</th>
              <th>Payout state</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.groupKey}</p>
                </td>
                <td>
                  <strong>{item.bookingCount}</strong>
                  <p className="muted">{item.cashBookingCount} cash booking(s)</p>
                </td>
                <td>{formatMoney(item.grossAmount, item.currency)}</td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>{formatMoney(item.providerPayoutAmount, item.currency)}</strong>
                    <small>{item.matrixBackedCount} matrix-backed booking(s)</small>
                  </div>
                </td>
                <td>{formatMoney(item.netAmount, item.currency)}</td>
                <td>{formatMoney(item.platformFee, item.currency)}</td>
                <td>
                  <div className="service-matrix-cell">
                    <small>VAT {formatMoney(item.vatAmount, item.currency)}</small>
                    <small>Cost {formatMoney(item.otherCostAmount, item.currency)}</small>
                  </div>
                </td>
                <td>{formatMoney(item.withholdingAmount, item.currency)}</td>
                <td>{formatMoney(item.netCompanyFee, item.currency)}</td>
                <td>
                  <span className={`pill ${item.cashDebtAmount ? 'pill-danger' : 'pill-success'}`}>
                    {formatMoney(item.cashDebtAmount, item.currency)}
                  </span>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{item.unbatchedCount} unbatched</small>
                    <small>{item.batchedCount} batched</small>
                    <small>{item.paidCount} paid</small>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No earning has linked service details yet.</p>
      )}
    </div>
  );
}

function ServiceBridgeMetric({
  amount,
  currency,
  label,
  value,
}: {
  readonly amount?: number;
  readonly currency?: string;
  readonly label: string;
  readonly value?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value ?? formatMoney(amount ?? 0, currency ?? 'VND')}</strong>
    </div>
  );
}

function sumBridge(items: readonly EarningsServiceBridgeItem[], key: keyof EarningsServiceBridgeItem) {
  return items.reduce((sum, item) => {
    const value = item[key];
    return typeof value === 'number' ? sum + value : sum;
  }, 0);
}
