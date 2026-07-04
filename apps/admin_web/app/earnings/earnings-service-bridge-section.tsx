import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { StatusBadge } from '../../components/status-badge';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Confirms which service duration options are creating Partner net, HANDS platform fee, tax withholding, cash wallet debt, and payout-batch pressure."
      resultLabel={`${items.length} option(s)`}
      resultTone={items.length > 0 ? 'info' : 'warning'}
      title="Service to earnings bridge"
    >
      <div className="participant-list admin-mb-12">
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
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No earning has linked service details yet."
          headers={[
            'Service option',
            'Bookings',
            'Gross',
            'Partner payout',
            'Partner net',
            'Platform fee',
            'VAT / cost',
            'Tax withheld',
            'Net company fee',
            'Cash debt',
            'Payout state',
          ]}
          rowCount={items.length}
        >
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
                  <StatusBadge tone={item.cashDebtAmount ? 'danger' : 'success'}>
                    {formatMoney(item.cashDebtAmount, item.currency)}
                  </StatusBadge>
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
        </AdminDataTable>
      </AdminTableScroll>
    </AdminFilterPanel>
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
